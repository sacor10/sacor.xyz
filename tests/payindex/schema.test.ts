import { createClient, type Client } from '@libsql/client'
import { describe, expect, it, beforeEach } from 'vitest'
import { ensureSchema } from '../../netlify/functions/_lib/payindex/schema'
import { BasketIntegrityError } from '../../netlify/functions/_lib/payindex/errors'

async function freshDb(): Promise<Client> {
  const db = createClient({ url: ':memory:' })
  await ensureSchema(db)
  return db
}

describe('ensureSchema', () => {
  let db: Client

  beforeEach(async () => {
    db = await freshDb()
  })

  it('seeds the full job and city basket', async () => {
    const jobs = await db.execute('SELECT COUNT(*) AS n FROM pay_index_jobs')
    const cities = await db.execute('SELECT COUNT(*) AS n FROM pay_index_cities')
    expect(Number(jobs.rows[0].n)).toBe(60)
    expect(Number(cities.rows[0].n)).toBe(25)
  })

  it('seeds sources including levelsfyi as an aggregate source', async () => {
    const result = await db.execute({
      sql: 'SELECT kind FROM pay_index_sources WHERE id = ?',
      args: ['levelsfyi'],
    })
    expect(result.rows[0]?.kind).toBe('aggregate')
  })

  it('is idempotent (running ensureSchema twice does not error or duplicate rows)', async () => {
    await ensureSchema(db)
    const jobs = await db.execute('SELECT COUNT(*) AS n FROM pay_index_jobs')
    expect(Number(jobs.rows[0].n)).toBe(60)
  })

  describe('methodology rule 5/6: immutable raw observations', () => {
    async function insertObservation(db: Client) {
      await db.execute({
        sql: `INSERT INTO pay_index_observations
                (job_id, city_id, source_id, period, raw_min, raw_max, raw_point, pay_basis,
                 annual_point, source_url, fetched_at, sample_size, observation_key)
              VALUES ('retail-cashier', 'new-york-ny', 'adzuna', '2026-07', 30000, 34000, NULL, 'annual',
                      32000, 'https://www.adzuna.com/posting/1', '2026-07-01T00:00:00.000Z', 1, 'adzuna:1')`,
      })
    }

    it('rejects UPDATE of a raw value column', async () => {
      await insertObservation(db)
      await expect(
        db.execute("UPDATE pay_index_observations SET raw_min = 99999 WHERE observation_key = 'adzuna:1'"),
      ).rejects.toThrow(/append-only/)
    })

    it('rejects DELETE', async () => {
      await insertObservation(db)
      await expect(
        db.execute("DELETE FROM pay_index_observations WHERE observation_key = 'adzuna:1'"),
      ).rejects.toThrow(/append-only/)
    })

    it('allows setting superseded_by (the correction mechanism)', async () => {
      await insertObservation(db)
      await db.execute({
        sql: `INSERT INTO pay_index_observations
                (job_id, city_id, source_id, period, raw_min, raw_max, raw_point, pay_basis,
                 annual_point, source_url, fetched_at, sample_size, observation_key)
              VALUES ('retail-cashier', 'new-york-ny', 'adzuna', '2026-07', 31000, 35000, NULL, 'annual',
                      33000, 'https://www.adzuna.com/posting/1', '2026-07-02T00:00:00.000Z', 1, 'adzuna:1-correction')`,
      })
      await expect(
        db.execute("UPDATE pay_index_observations SET superseded_by = 2 WHERE observation_key = 'adzuna:1'"),
      ).resolves.toBeDefined()
    })
  })

  describe('methodology rule 4: gap threshold as a DB constraint', () => {
    it('rejects an included cell with fewer than 5 observations', async () => {
      await expect(
        db.execute({
          sql: `INSERT INTO pay_index_cell_values
                  (job_id, city_id, period, status, median_annual_pay, observation_count, computed_at, methodology_version)
                VALUES ('retail-cashier', 'new-york-ny', '2026-07', 'included', 32000, 4, '2026-07-01T00:00:00.000Z', 'v1')`,
        }),
      ).rejects.toThrow()
    })

    it('accepts an included cell with exactly 5 observations', async () => {
      await expect(
        db.execute({
          sql: `INSERT INTO pay_index_cell_values
                  (job_id, city_id, period, status, median_annual_pay, observation_count, computed_at, methodology_version)
                VALUES ('retail-cashier', 'new-york-ny', '2026-07', 'included', 32000, 5, '2026-07-01T00:00:00.000Z', 'v1')`,
        }),
      ).resolves.toBeDefined()
    })

    it('rejects a gap row that carries a median value', async () => {
      await expect(
        db.execute({
          sql: `INSERT INTO pay_index_cell_values
                  (job_id, city_id, period, status, median_annual_pay, observation_count, computed_at, methodology_version)
                VALUES ('retail-cashier', 'new-york-ny', '2026-07', 'gap_no_data', 32000, 0, '2026-07-01T00:00:00.000Z', 'v1')`,
        }),
      ).rejects.toThrow()
    })
  })

  describe('methodology rule 4: coverage arithmetic as a DB constraint', () => {
    it('rejects a snapshot where included + missing != total', async () => {
      await expect(
        db.execute({
          sql: `INSERT INTO pay_index_snapshots
                  (period, baseline_period, index_mean, index_median, cells_included, cells_missing,
                   cells_total, basket_version, methodology_version, computed_at)
                VALUES ('2026-07', '2026-01', 0.04, 0.03, 1000, 400, 1500, 'v1', 'v1', '2026-07-01T00:00:00.000Z')`,
        }),
      ).rejects.toThrow()
    })

    it('accepts a snapshot where included + missing = total', async () => {
      await expect(
        db.execute({
          sql: `INSERT INTO pay_index_snapshots
                  (period, baseline_period, index_mean, index_median, cells_included, cells_missing,
                   cells_total, basket_version, methodology_version, computed_at)
                VALUES ('2026-07', '2026-01', 0.04, 0.03, 1100, 400, 1500, 'v1', 'v1', '2026-07-01T00:00:00.000Z')`,
        }),
      ).resolves.toBeDefined()
    })
  })

  describe('methodology rule 1: basket integrity at boot', () => {
    it('throws if a recorded basket version has a different fingerprint than the live basket', async () => {
      await db.execute({
        sql: 'UPDATE pay_index_basket_versions SET content_hash = ? WHERE version = ?',
        args: ['deliberately-wrong-hash', 'v1'],
      })
      await expect(ensureSchema(db)).rejects.toThrow(BasketIntegrityError)
    })
  })
})
