import { useState } from 'react'
import {
  ITINERARY_BLOCK_TYPES,
  blankItineraryBlock,
  itineraryBlocksToMarkdown,
  parseItineraryMarkdown,
} from './travelItinerary'

const blockTitle = (block, index) => {
  if (block.type === ITINERARY_BLOCK_TYPES.heading) return `HEADING ${index + 1}`
  if (block.type === ITINERARY_BLOCK_TYPES.bulletList) return `BULLET LIST ${index + 1}`
  if (block.type === ITINERARY_BLOCK_TYPES.numberedList) return `NUMBERED LIST ${index + 1}`
  return `PARAGRAPH ${index + 1}`
}

export default function TravelItineraryEditor({ value = '', onChange }) {
  const initialMarkdown = String(value ?? '')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [blocks, setBlocks] = useState(() => parseItineraryMarkdown(initialMarkdown))
  const [markdownText, setMarkdownText] = useState(initialMarkdown)
  const [message, setMessage] = useState('')

  const emitMarkdown = (markdown) => {
    onChange?.(markdown)
  }

  const updateBlocks = (nextBlocks) => {
    setBlocks(nextBlocks)
    setMessage('')
    emitMarkdown(itineraryBlocksToMarkdown(nextBlocks))
  }

  const updateBlock = (index, patch) => {
    updateBlocks(blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)))
  }

  const addBlock = (type) => {
    updateBlocks([...blocks, blankItineraryBlock(type)])
  }

  const moveBlock = (index, direction) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= blocks.length) return
    const next = [...blocks]
    const [moved] = next.splice(index, 1)
    next.splice(nextIndex, 0, moved)
    updateBlocks(next)
  }

  const removeBlock = (index) => {
    updateBlocks(blocks.filter((_, i) => i !== index))
  }

  const updateListItem = (blockIndex, itemIndex, value) => {
    const block = blocks[blockIndex]
    const items = [...(block.items || [])]
    items[itemIndex] = value
    updateBlock(blockIndex, { items })
  }

  const addListItem = (blockIndex) => {
    const block = blocks[blockIndex]
    updateBlock(blockIndex, { items: [...(block.items || []), ''] })
  }

  const moveListItem = (blockIndex, itemIndex, direction) => {
    const block = blocks[blockIndex]
    const items = [...(block.items || [])]
    const nextIndex = itemIndex + direction
    if (nextIndex < 0 || nextIndex >= items.length) return
    const [moved] = items.splice(itemIndex, 1)
    items.splice(nextIndex, 0, moved)
    updateBlock(blockIndex, { items })
  }

  const removeListItem = (blockIndex, itemIndex) => {
    const block = blocks[blockIndex]
    updateBlock(blockIndex, { items: (block.items || []).filter((_, i) => i !== itemIndex) })
  }

  const openAdvanced = () => {
    const markdown = itineraryBlocksToMarkdown(blocks)
    setMarkdownText(markdown)
    setMessage('')
    emitMarkdown(markdown)
    setAdvancedOpen(true)
  }

  const applyMarkdown = () => {
    const nextBlocks = parseItineraryMarkdown(markdownText)
    const nextMarkdown = itineraryBlocksToMarkdown(nextBlocks)
    setBlocks(nextBlocks)
    setMarkdownText(nextMarkdown)
    emitMarkdown(nextMarkdown)
    setAdvancedOpen(false)
    setMessage(`Applied ${nextBlocks.length} block${nextBlocks.length === 1 ? '' : 's'}.`)
  }

  const toggleAdvanced = () => {
    if (advancedOpen) {
      applyMarkdown()
      return
    }
    openAdvanced()
  }

  const renderListBlock = (block, blockIndex) => (
    <>
      {(block.items || []).length === 0 && (
        <div className="travel-note">
          <font face="Comic Sans MS" size="2" color="#FFFFFF">
            No list items yet.
          </font>
        </div>
      )}
      {(block.items || []).map((item, itemIndex) => (
        <div className="travel-itinerary-list-row" key={itemIndex}>
          <label className="travel-label">
            <font face="Impact" size="2" color="#FFFF00">
              ITEM {itemIndex + 1}
            </font>
            <input
              type="text"
              value={item}
              onChange={(e) => updateListItem(blockIndex, itemIndex, e.target.value)}
              placeholder="e.g. Museum tickets at 10 AM"
            />
          </label>
          <span className="travel-stops-actions travel-itinerary-list-actions">
            <button
              type="button"
              className="mini-btn"
              onClick={() => moveListItem(blockIndex, itemIndex, -1)}
              disabled={itemIndex === 0}
            >
              UP
            </button>
            <button
              type="button"
              className="mini-btn"
              onClick={() => moveListItem(blockIndex, itemIndex, 1)}
              disabled={itemIndex === (block.items || []).length - 1}
            >
              DOWN
            </button>
            <button type="button" className="mini-btn" onClick={() => removeListItem(blockIndex, itemIndex)}>
              REMOVE
            </button>
          </span>
        </div>
      ))}
      <button type="button" className="mini-btn" onClick={() => addListItem(blockIndex)}>
        ADD ITEM
      </button>
    </>
  )

  const renderBlockFields = (block, index) => {
    if (block.type === ITINERARY_BLOCK_TYPES.heading) {
      return (
        <div className="travel-stop-grid">
          <label className="travel-label">
            <font face="Impact" size="2" color="#FFFF00">
              LEVEL
            </font>
            <select value={block.level} onChange={(e) => updateBlock(index, { level: Number(e.target.value) })}>
              <option value={1}>H1</option>
              <option value={2}>H2</option>
              <option value={3}>H3</option>
            </select>
          </label>
          <label className="travel-label">
            <font face="Impact" size="2" color="#FFFF00">
              TEXT
            </font>
            <input
              type="text"
              value={block.text}
              onChange={(e) => updateBlock(index, { text: e.target.value })}
              placeholder="e.g. Day 1"
            />
          </label>
        </div>
      )
    }

    if (block.type === ITINERARY_BLOCK_TYPES.bulletList || block.type === ITINERARY_BLOCK_TYPES.numberedList) {
      return renderListBlock(block, index)
    }

    return (
      <label className="travel-label">
        <font face="Impact" size="2" color="#FFFF00">
          TEXT
        </font>
        <textarea
          value={block.text}
          rows={5}
          onChange={(e) => updateBlock(index, { text: e.target.value })}
          placeholder="Add itinerary details..."
        />
      </label>
    )
  }

  return (
    <div className="travel-itinerary-editor travel-stops-editor">
      <div className="travel-stops-toolbar">
        <font face="Impact" size="3" color="#FFFF00">
          ITINERARY
        </font>
        <span className="travel-stops-actions">
          {!advancedOpen && (
            <>
              <button type="button" className="mini-btn" onClick={() => addBlock(ITINERARY_BLOCK_TYPES.heading)}>
                ADD HEADING
              </button>
              <button type="button" className="mini-btn" onClick={() => addBlock(ITINERARY_BLOCK_TYPES.paragraph)}>
                ADD PARAGRAPH
              </button>
              <button type="button" className="mini-btn" onClick={() => addBlock(ITINERARY_BLOCK_TYPES.bulletList)}>
                ADD BULLET LIST
              </button>
              <button type="button" className="mini-btn" onClick={() => addBlock(ITINERARY_BLOCK_TYPES.numberedList)}>
                ADD NUMBERED LIST
              </button>
            </>
          )}
          <button type="button" className="mini-btn" onClick={toggleAdvanced}>
            {advancedOpen ? 'VALUE EDITOR' : 'ADVANCED MARKDOWN'}
          </button>
        </span>
      </div>

      {!advancedOpen && (
        <>
          {blocks.length === 0 && (
            <div className="travel-note">
              <font face="Comic Sans MS" size="2" color="#FFFFFF">
                No itinerary blocks yet.
              </font>
            </div>
          )}

          {blocks.map((block, index) => (
            <div className="travel-itinerary-card travel-stop-card" key={index}>
              <div className="travel-stop-header">
                <font face="Impact" size="3" color="#00FFFF">
                  {blockTitle(block, index)}
                </font>
                <span className="travel-stops-actions">
                  <button type="button" className="mini-btn" onClick={() => moveBlock(index, -1)} disabled={index === 0}>
                    UP
                  </button>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => moveBlock(index, 1)}
                    disabled={index === blocks.length - 1}
                  >
                    DOWN
                  </button>
                  <button type="button" className="mini-btn" onClick={() => removeBlock(index)}>
                    REMOVE
                  </button>
                </span>
              </div>
              {renderBlockFields(block, index)}
            </div>
          ))}

          {message && (
            <div className="travel-note">
              <font face="Comic Sans MS" size="2" color="#FFFF00">
                {message}
              </font>
            </div>
          )}
        </>
      )}

      {advancedOpen && (
        <div className="travel-itinerary-markdown travel-stops-json">
          <label className="travel-label">
            <font face="Impact" size="3" color="#FFFF00">
              ADVANCED MARKDOWN
            </font>
            <textarea
              value={markdownText}
              rows={14}
              onChange={(e) => {
                setMarkdownText(e.target.value)
                setMessage('')
                emitMarkdown(e.target.value)
              }}
              placeholder="Paste or edit markdown itinerary here..."
            />
          </label>
          <center>
            <button type="button" className="dl-btn" onClick={applyMarkdown}>
              APPLY MARKDOWN
            </button>
          </center>
        </div>
      )}
    </div>
  )
}
