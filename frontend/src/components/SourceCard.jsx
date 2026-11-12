/** SourceCard — displays verified reference sources with direct URLs and evidence context */

function getFavicon(url) {
  try {
    const { hostname } = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
  } catch {
    return null
  }
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return null
  }
}

export default function SourceCard({ source, index = 0 }) {
  const hasRealUrl = source.url && source.url.startsWith('http')
  const domain = hasRealUrl ? getDomain(source.url) : null
  const favicon = hasRealUrl ? getFavicon(source.url) : null
  const initials = (source.title || 'S').slice(0, 2).toUpperCase()

  const inner = (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', width: '100%' }}>
      <div className="source-card__favicon" style={{ width: '32px', height: '32px', borderRadius: '8px' }}>
        {favicon ? (
          <img
            src={favicon}
            alt=""
            width={22}
            height={22}
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ) : initials}
      </div>

      <div className="source-card__content" style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
          <div className="source-card__title" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
            {source.title || 'Authoritative Source'}
          </div>
          {domain && (
            <span className="tag tag--neutral" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
              {domain}
            </span>
          )}
        </div>

        {source.relevance && (
          <p className="source-card__relevance" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '4px' }}>
            <strong style={{ color: 'var(--text)' }}>Reference Evidence:</strong> {source.relevance}
          </p>
        )}

        {hasRealUrl && (
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#2563eb', fontWeight: 500 }}>
            <span>Open external source verification</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M17 7H7M17 7v10" />
            </svg>
          </div>
        )}
      </div>
    </div>
  )

  if (hasRealUrl) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="source-card animate-fade-up"
        style={{
          animationDelay: `${index * 0.06}s`,
          display: 'block',
          background: 'var(--bg)',
          border: '1.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
        }}
      >
        {inner}
      </a>
    )
  }

  return (
    <div
      className="source-card animate-fade-up"
      style={{
        animationDelay: `${index * 0.06}s`,
        cursor: 'default',
        padding: '16px 20px',
      }}
    >
      {inner}
    </div>
  )
}
