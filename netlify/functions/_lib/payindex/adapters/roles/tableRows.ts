// Extracts each <tr>...</tr> block from a wage-scale/salary-schedule HTML
// page as plain text, one string per row, for parseSingleRate to run over.
// Falls back to the whole stripped document as a single "row" when the page
// has no table markup at all (a page that states one flat rate in prose).

import { stripHtml } from '../ats/common.ts'

export function extractTableRows(html: string): string[] {
  const rowMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  if (rowMatches.length === 0) {
    const whole = stripHtml(html)
    return whole ? [whole] : []
  }
  return rowMatches.map((m) => stripHtml(m[1])).filter((row) => row.length > 0)
}
