import { useState } from 'react'

// Onboarding interest picker (PRD §6.1): signed-in users pick >= minInterests
// before their stumbles get personalized.
export default function InterestPicker({
  catalog,
  initial,
  minInterests,
  busy,
  onSave,
  allowSkip = false,
  onSkip,
}) {
  const [selected, setSelected] = useState(() => new Set(initial || []))

  const toggle = (slug) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const enough = selected.size >= minInterests
  const remaining = Math.max(0, minInterests - selected.size)

  return (
    <div className="su-overlay" role="dialog" aria-modal="true" aria-label="Pick your interests">
      <div className="su-dialog">
        <h2>What are you into?</h2>
        <p>
          Pick at least {minInterests} interests and we’ll tune your stumbles. You can
          change these any time.
        </p>

        <div className="su-chip-grid">
          {catalog.map((interest) => (
            <button
              key={interest.slug}
              type="button"
              className="su-chip"
              aria-pressed={selected.has(interest.slug)}
              onClick={() => toggle(interest.slug)}
            >
              {interest.name}
            </button>
          ))}
        </div>

        <div className="su-dialog-footer">
          {allowSkip && (
            <button
              type="button"
              className="su-skip"
              disabled={busy}
              onClick={onSkip}
            >
              Skip — surprise me
            </button>
          )}
          <span className="su-dialog-hint">
            {enough
              ? `${selected.size} selected`
              : `Pick ${remaining} more`}
          </span>
          <button
            type="button"
            className="su-primary"
            disabled={!enough || busy}
            onClick={() => onSave([...selected])}
          >
            {busy ? 'Saving…' : 'Start stumbling'}
          </button>
        </div>
      </div>
    </div>
  )
}
