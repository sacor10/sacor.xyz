// Tier C: Levels.fyi's per-company machine-readable salary pages
// (/companies/{slug}/salaries.md), used with attribution under their data
// license. These figures are already medians of submitted data points —
// an aggregate, not a raw observation — so every row here is written with
// sourceKind: 'aggregate' (sources.ts marks the 'levelsfyi' source that
// way too). aggregate.ts's cell-median step only pools 'posting'/'scale'
// kinds, so nothing from this adapter can reach the headline no matter what
// this file does; it exists purely to populate the transparency page with
// required attribution (methodology rule 7).
//
// The exact markdown table shape isn't publicly documented, so this parses
// a generic "Level | ... comp column ..." markdown table. Like vivian.ts,
// this is the adapter most likely to need re-verification against the real
// current format — a shape mismatch degrades to zero rows (an honest gap
// and a rule-8 alert), never a fabricated figure.

import type { Job, City } from '../../../../../../src/data/payIndex/types.ts'
import { levelsFyiEntries } from '../../../../../../src/data/payIndex/roleSources.ts'
import type { Observation } from '../../types.ts'
import type { SourceAdapter, AdapterContext } from '../index.ts'

interface MarkdownRow {
  readonly level: string
  readonly compText: string
}

function parseMarkdownTable(markdown: string): MarkdownRow[] {
  const lines = markdown.split('\n').map((l) => l.trim())
  const tableLines = lines.filter((l) => l.startsWith('|'))
  if (tableLines.length < 2) return []

  const header = tableLines[0]
    .split('|')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)
  const levelCol = header.findIndex((c) => c.includes('level'))
  const compCol = header.findIndex((c) => c.includes('total comp') || c.includes('median') || c.includes('salary'))
  if (levelCol === -1 || compCol === -1) return []

  const rows: MarkdownRow[] = []
  // Skip the header row and the markdown separator row (e.g. "|---|---|").
  for (const line of tableLines.slice(2)) {
    const cells = line.split('|').map((c) => c.trim())
    // Leading/trailing pipes produce empty first/last cells; header parsing
    // already filtered those, but data rows keep positional alignment, so
    // offset by 1 when the row starts with an empty cell from a leading '|'.
    const offset = cells[0] === '' ? 1 : 0
    const level = cells[levelCol + offset]
    const compText = cells[compCol + offset]
    if (level && compText) rows.push({ level, compText })
  }
  return rows
}

function parseCompFigure(text: string): number | null {
  const match = /\$?\s*([\d,]+(?:\.\d+)?)\s*(k)?/i.exec(text)
  if (!match) return null
  const value = Number(match[1].replace(/,/g, '')) * (match[2] ? 1000 : 1)
  if (!Number.isFinite(value) || value < 10_000 || value > 5_000_000) return null
  return value
}

export const levelsFyiAdapter: SourceAdapter = {
  id: 'levelsfyi',
  tier: 'C',
  sourceIds: ['levelsfyi'],

  async preflight() {
    // Public page, no credentials required.
  },

  covers(job: Job, city: City): boolean {
    return levelsFyiEntries.some((e) => e.jobId === job.id && e.cityId === city.id)
  },

  async fetchObservations(job: Job, city: City, period: string, ctx: AdapterContext): Promise<Observation[]> {
    const entries = levelsFyiEntries.filter((e) => e.jobId === job.id && e.cityId === city.id)
    const observations: Observation[] = []

    for (const entry of entries) {
      const url = `https://www.levels.fyi/companies/${entry.companySlug}/salaries.md`
      let markdown: string
      try {
        markdown = await ctx.http.fetchText(url)
      } catch (err) {
        ctx.log('levelsfyi.fetch_failed', { entry: entry.id, url, error: String(err) })
        continue
      }

      const rows = parseMarkdownTable(markdown)
      for (const row of rows) {
        const value = parseCompFigure(row.compText)
        if (value === null) continue

        observations.push({
          sourceId: 'levelsfyi',
          // Never eligible for the headline (rule 7) — see file header.
          sourceKind: 'aggregate',
          jobId: job.id,
          cityId: city.id,
          period,
          rawMin: null,
          rawMax: null,
          rawPoint: value,
          payBasis: 'annual',
          sourceUrl: url,
          fetchedAt: new Date().toISOString(),
          sampleSize: null,
          observationKey: `levelsfyi:${period}:${entry.id}:${row.level}`,
        })
      }
    }

    ctx.log('levelsfyi.fetchObservations', { jobId: job.id, cityId: city.id, period, rows: observations.length })
    return observations
  },
}
