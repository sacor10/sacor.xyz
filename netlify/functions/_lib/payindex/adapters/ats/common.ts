// Tiny shared helper for the ATS extractors — stripping posting HTML down
// to plain text before running parsePayBand over it.

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&mdash;/gi, '—')
    .replace(/\s+/g, ' ')
    .trim()
}
