export const ITINERARY_BLOCK_TYPES = {
  heading: 'heading',
  paragraph: 'paragraph',
  bulletList: 'bullet-list',
  numberedList: 'numbered-list',
}

const draftText = (value) => (value === null || value === undefined ? '' : String(value))

const markdownText = (value) => draftText(value).replace(/\r\n?/g, '\n')

const trimmedText = (value) => markdownText(value).trim()

const paragraphText = (value) => markdownText(value).replace(/^\n+|\n+$/g, '')

const clampHeadingLevel = (level) => {
  const number = Number(level)
  if (number === 1 || number === 2 || number === 3) return number
  return 2
}

export const blankItineraryBlock = (type = ITINERARY_BLOCK_TYPES.paragraph) => {
  if (type === ITINERARY_BLOCK_TYPES.heading) {
    return { type, level: 2, text: '' }
  }
  if (type === ITINERARY_BLOCK_TYPES.bulletList || type === ITINERARY_BLOCK_TYPES.numberedList) {
    return { type, items: [''] }
  }
  return { type: ITINERARY_BLOCK_TYPES.paragraph, text: '' }
}

const headingFromLine = (line) => {
  const match = /^ {0,3}(#{1,3})\s+(.+)$/.exec(line)
  if (!match) return null
  return {
    type: ITINERARY_BLOCK_TYPES.heading,
    level: match[1].length,
    text: match[2].replace(/\s+#+\s*$/, '').trim(),
  }
}

const listItemFromLine = (line) => {
  const bulletMatch = /^ {0,3}[-*+](?:\s+(.*)|\s*)$/.exec(line)
  if (bulletMatch) {
    return {
      type: ITINERARY_BLOCK_TYPES.bulletList,
      text: draftText(bulletMatch[1]),
    }
  }

  const numberedMatch = /^ {0,3}\d+[.)](?:\s+(.*)|\s*)$/.exec(line)
  if (numberedMatch) {
    return {
      type: ITINERARY_BLOCK_TYPES.numberedList,
      text: draftText(numberedMatch[1]),
    }
  }

  return null
}

const normalizeBlock = (block) => {
  if (!block || typeof block !== 'object') return blankItineraryBlock()

  if (block.type === ITINERARY_BLOCK_TYPES.heading) {
    return {
      type: ITINERARY_BLOCK_TYPES.heading,
      level: clampHeadingLevel(block.level),
      text: draftText(block.text),
    }
  }

  if (block.type === ITINERARY_BLOCK_TYPES.bulletList || block.type === ITINERARY_BLOCK_TYPES.numberedList) {
    return {
      type: block.type,
      items: Array.isArray(block.items) ? block.items.map(draftText) : [''],
    }
  }

  return {
    type: ITINERARY_BLOCK_TYPES.paragraph,
    text: draftText(block.text),
  }
}

export const normalizeItineraryBlocks = (blocks) => (Array.isArray(blocks) ? blocks.map(normalizeBlock) : [])

export const parseItineraryMarkdown = (markdown) => {
  const lines = markdownText(markdown).split('\n')
  const blocks = []
  let paragraphLines = []
  let listBlock = null

  const flushParagraph = () => {
    const text = paragraphLines.join('\n')
    if (text.trim()) blocks.push({ type: ITINERARY_BLOCK_TYPES.paragraph, text })
    paragraphLines = []
  }

  const flushList = () => {
    if (listBlock) {
      blocks.push(listBlock)
      listBlock = null
    }
  }

  lines.forEach((rawLine) => {
    const line = rawLine.replace(/\s+$/, '')

    if (!line.trim()) {
      flushParagraph()
      flushList()
      return
    }

    const heading = headingFromLine(line)
    if (heading) {
      flushParagraph()
      flushList()
      blocks.push(heading)
      return
    }

    const listItem = listItemFromLine(line)
    if (listItem) {
      flushParagraph()
      if (!listBlock || listBlock.type !== listItem.type) {
        flushList()
        listBlock = { type: listItem.type, items: [] }
      }
      listBlock.items.push(listItem.text)
      return
    }

    flushList()
    paragraphLines.push(line)
  })

  flushParagraph()
  flushList()

  return normalizeItineraryBlocks(blocks)
}

export const itineraryBlocksToMarkdown = (blocks) => {
  const parts = []

  normalizeItineraryBlocks(blocks).forEach((block) => {
    if (block.type === ITINERARY_BLOCK_TYPES.heading) {
      const text = trimmedText(block.text)
      if (text) parts.push(`${'#'.repeat(block.level)} ${text}`)
      return
    }

    if (block.type === ITINERARY_BLOCK_TYPES.bulletList || block.type === ITINERARY_BLOCK_TYPES.numberedList) {
      const items = block.items.map(trimmedText).filter(Boolean)
      if (!items.length) return
      parts.push(
        items
          .map((item, index) =>
            block.type === ITINERARY_BLOCK_TYPES.bulletList ? `- ${item}` : `${index + 1}. ${item}`,
          )
          .join('\n'),
      )
      return
    }

    const text = paragraphText(block.text)
    if (text.trim()) parts.push(text)
  })

  return parts.join('\n\n')
}
