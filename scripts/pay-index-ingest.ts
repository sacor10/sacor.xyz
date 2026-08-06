#!/usr/bin/env -S npx tsx
// Monthly Pay Index ingest CLI. Not a Netlify function — walking ~1,500
// basket cells across three source tiers takes far longer than any
// serverless function timeout, and a free-tier API budget (Adzuna) can
// realistically require spreading a period's ingest across several
// invocations. This script is resumable for exactly that reason: rerunning
// it for the same period picks up where the last invocation left off
// (see repo.ts's isTaskAlreadyDone) instead of re-fetching everything.
//
// Usage:
//   npx tsx scripts/pay-index-ingest.ts [--period=YYYY-MM] [--max-calls=200] [--dry-run]
//
// Requires TURSO_DATABASE_URL/TURSO_AUTH_TOKEN (or falls back to a local
// file DB) and, for the Adzuna adapter, ADZUNA_APP_ID/ADZUNA_APP_KEY — see
// .env.example.

import { getPayIndexDb } from '../netlify/functions/_lib/payindex/db.ts'
import { createHttpContext } from '../netlify/functions/_lib/payindex/http.ts'
import { allAdapters } from '../netlify/functions/_lib/payindex/adapters/registry.ts'
import {
  insertObservations,
  recordAdapterRun,
  isTaskAlreadyDone,
  computeAndStoreCellValue,
  setBaselinePeriodIfUnset,
  getBaselinePeriod,
  computeAndStoreSnapshot,
} from '../netlify/functions/_lib/payindex/repo.ts'
import { jobs as basketJobs } from '../src/data/payIndex/jobs.ts'
import { cities as basketCities } from '../src/data/payIndex/cities.ts'

interface Args {
  readonly period: string
  readonly maxCalls: number
  readonly dryRun: boolean
}

function currentPeriod(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

function parseArgs(argv: readonly string[]): Args {
  const flags = new Map<string, string>()
  for (const arg of argv) {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg)
    if (match) flags.set(match[1], match[2] ?? 'true')
  }
  return {
    period: flags.get('period') ?? currentPeriod(),
    maxCalls: Number(flags.get('max-calls') ?? process.env.PAY_INDEX_MAX_CALLS_PER_RUN ?? 200),
    dryRun: flags.get('dry-run') === 'true',
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const activeJobs = basketJobs.filter((j) => j.active)
  const activeCities = basketCities.filter((c) => c.active)

  console.log(`Pay Index ingest — period ${args.period}, budget ${args.maxCalls} calls${args.dryRun ? ' (dry run)' : ''}`)
  console.log(`Basket: ${activeJobs.length} jobs x ${activeCities.length} cities = ${activeJobs.length * activeCities.length} cells`)

  const db = await getPayIndexDb()
  const http = createHttpContext()
  const runId = args.period

  let callsMade = 0
  let budgetExhausted = false
  const adapterTotals = new Map<string, number>()
  const failedPreflight: string[] = []

  for (const adapter of allAdapters) {
    if (budgetExhausted) break
    adapterTotals.set(adapter.id, adapterTotals.get(adapter.id) ?? 0)

    try {
      await adapter.preflight()
    } catch (err) {
      // Rule 8: a misconfigured adapter must fail loudly, not silently
      // contribute zero rows that look like a legitimate coverage gap.
      console.error(`[${adapter.id}] preflight failed — skipping this adapter for the run: ${String(err)}`)
      failedPreflight.push(adapter.id)
      continue
    }

    for (const job of activeJobs) {
      if (budgetExhausted) break
      for (const city of activeCities) {
        if (callsMade >= args.maxCalls) {
          console.log(`Call budget (${args.maxCalls}) reached — stopping. Rerun this command to resume.`)
          budgetExhausted = true
          break
        }
        if (!adapter.covers(job, city)) continue
        if (await isTaskAlreadyDone(db, runId, adapter.id, job.id, city.id)) continue

        const startedAt = nowIso()
        callsMade++

        if (args.dryRun) {
          console.log(`[dry-run] would fetch ${adapter.id} for ${job.id} x ${city.id}`)
          continue
        }

        try {
          const observations = await adapter.fetchObservations(job, city, args.period, {
            period: args.period,
            http,
            log: (event, detail) => console.log(`  ${event}`, detail ?? {}),
          })
          const { inserted } = await insertObservations(db, observations)
          const status = observations.length > 0 ? 'ok' : 'zero_rows'
          await recordAdapterRun(db, {
            runId,
            adapterId: adapter.id,
            jobId: job.id,
            cityId: city.id,
            period: args.period,
            rowsReturned: inserted,
            status,
            error: null,
            startedAt,
            finishedAt: nowIso(),
          })
          adapterTotals.set(adapter.id, (adapterTotals.get(adapter.id) ?? 0) + inserted)
        } catch (err) {
          console.error(`[${adapter.id}] ${job.id} x ${city.id} failed: ${String(err)}`)
          await recordAdapterRun(db, {
            runId,
            adapterId: adapter.id,
            jobId: job.id,
            cityId: city.id,
            period: args.period,
            rowsReturned: 0,
            status: 'error',
            error: String(err),
            startedAt,
            finishedAt: nowIso(),
          })
        }
      }
    }
  }

  console.log(`\nCalls made this invocation: ${callsMade}`)

  if (failedPreflight.length > 0) {
    console.error(`ALERT: these adapters failed preflight and did not run at all: ${failedPreflight.join(', ')}`)
  }

  if (args.dryRun) {
    console.log('Dry run — no fetches were made, so zero-rows totals are meaningless and not reported.')
    console.log('Dry run — skipping aggregation and snapshot.')
    if (failedPreflight.length > 0) process.exitCode = 1
    return
  }

  // Rule 8: a whole adapter returning zero rows across an entire run is an
  // alert, never a silent no-op — distinct from an individual cell having
  // no data, which is an expected, normal gap.
  const deadAdapters = [...adapterTotals.entries()].filter(([, total]) => total === 0).map(([id]) => id)
  if (deadAdapters.length > 0) {
    console.error(`\nALERT: these adapters returned ZERO total rows this run: ${deadAdapters.join(', ')}`)
  }

  if (!budgetExhausted) {
    console.log('\nAggregating cells...')
    let included = 0
    let gaps = 0
    for (const job of activeJobs) {
      for (const city of activeCities) {
        const cell = await computeAndStoreCellValue(db, job.id, city.id, args.period)
        if (cell.status === 'included') included++
        else gaps++
      }
    }
    console.log(`Cells included: ${included}, gaps: ${gaps}`)

    const baselineBefore = await getBaselinePeriod(db)
    await setBaselinePeriodIfUnset(db, args.period)
    if (baselineBefore === null) {
      console.log(`Baseline period set to ${args.period}. No change figure publishes until a later period is ingested.`)
    }

    const snapshot = await computeAndStoreSnapshot(db, args.period)
    if (snapshot) {
      console.log(
        `\nSnapshot: mean ${(snapshot.mean * 100).toFixed(2)}%, median ${(snapshot.median * 100).toFixed(2)}%, ` +
          `coverage ${snapshot.cellsIncluded}/${snapshot.cellsTotal} (${snapshot.cellsMissing} missing)`,
      )
    } else {
      console.log('\nNo headline snapshot published — this period IS the baseline, or no baseline exists yet.')
    }
  } else {
    console.log('\nBudget exhausted before this period completed — skipping aggregation/snapshot until a resumed run finishes.')
  }

  if (deadAdapters.length > 0 || failedPreflight.length > 0) {
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('Pay Index ingest failed:', err)
  process.exitCode = 1
})
