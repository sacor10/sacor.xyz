import { stumbleInterests } from '../../data/stumbleInterests'

// X-Frame-Options DENY (site-wide) + target sites' own frame policies make
// iframing impossible, so we show a preview card (PRD §3 Option A) and link out.

const interestName = (slug) =>
  stumbleInterests.find((i) => i.slug === slug)?.name || slug

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// Deterministic placeholder color so a thumbnail-less card still looks intentional.
function hueFor(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) % 360
  return h
}

export default function PreviewCard({ card, onLike, onDislike, busy, canRate }) {
  const domain = domainOf(card.url)
  const hue = hueFor(domain)

  return (
    <article className="su-card">
      <div className="su-thumb">
        {card.thumbnailUrl ? (
          <img src={card.thumbnailUrl} alt="" loading="lazy" />
        ) : (
          <div
            className="su-thumb-placeholder"
            style={{
              background: `linear-gradient(135deg, hsl(${hue} 55% 52%), hsl(${(hue + 40) % 360} 60% 42%))`,
            }}
            aria-hidden="true"
          >
            {(card.title || domain).charAt(0)}
          </div>
        )}
      </div>

      <div className="su-card-body">
        <div className="su-card-domain">{domain}</div>
        <h1 className="su-card-title">{card.title}</h1>
        {card.description && <p className="su-card-desc">{card.description}</p>}

        {card.interests?.length > 0 && (
          <div className="su-tags">
            {card.interests.map((slug) => (
              <span key={slug} className="su-tag">
                {interestName(slug)}
              </span>
            ))}
          </div>
        )}

        <div className="su-card-actions">
          <button
            type="button"
            className="su-iconbtn"
            onClick={onLike}
            disabled={busy}
            title={canRate ? 'I like this (↑)' : 'Sign in to rate'}
            aria-label="Thumbs up"
          >
            👍
          </button>
          <button
            type="button"
            className="su-iconbtn"
            onClick={onDislike}
            disabled={busy}
            title={canRate ? 'Not for me (↓)' : 'Sign in to rate'}
            aria-label="Thumbs down"
          >
            👎
          </button>
          <a
            className="su-visit"
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit site →
          </a>
        </div>

        {(card.upVotes > 0 || card.downVotes > 0) && (
          <div className="su-votes">
            👍 {card.upVotes} · 👎 {card.downVotes}
          </div>
        )}
      </div>
    </article>
  )
}
