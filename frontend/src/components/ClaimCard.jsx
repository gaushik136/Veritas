/** ClaimCard — displays a single extracted claim with verdict, why it's fake, evidence, and confidence */

const VERDICT_MAP = {
  supported: { label: 'Verified True', cls: 'tag--supported', fillColor: 'var(--supported)', border: '#a7f3d0' },
  refuted: { label: 'Fake / Refuted', cls: 'tag--refuted', fillColor: 'var(--refuted)', border: '#fecaca' },
  unverified: { label: 'Unverified', cls: 'tag--unverified', fillColor: 'var(--unverified)', border: '#fde68a' },
}

export default function ClaimCard({ claim, index = 0 }) {
  const verdict = VERDICT_MAP[claim.verdict] || VERDICT_MAP.unverified
  const pct = Math.round((claim.confidence || 0) * 100)
  const isRefuted = claim.verdict === 'refuted'
  const isSupported = claim.verdict === 'supported'

  return (
    <div
      className="claim-card animate-fade-up"
      style={{
        animationDelay: `${index * 0.06}s`,
        borderLeft: `4px solid ${verdict.fillColor}`,
      }}
    >
      <div className="claim-card__header">
        <p className="claim-card__text">"{claim.text}"</p>
        <span className={`tag ${verdict.cls}`}>{verdict.label}</span>
      </div>

      {claim.explanation && (
        <p className="claim-card__explanation">{claim.explanation}</p>
      )}

      {/* Why it's fake / misleading callout */}
      {isRefuted && claim.why_fake && claim.why_fake !== 'N/A: Verified factual' && (
        <div style={{
          marginTop: '12px',
          padding: '12px 14px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          fontSize: '0.85rem',
          color: '#991b1b',
          lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>✕ Why this claim is False:</span>
          </div>
          <div>{claim.why_fake}</div>
        </div>
      )}

      {/* Factual Counter-Evidence / Proof */}
      {claim.evidence && (
        <div style={{
          marginTop: '10px',
          padding: '12px 14px',
          background: isRefuted ? '#fff5f5' : isSupported ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${isRefuted ? '#fed7d7' : isSupported ? '#bbf7d0' : '#fef08a'}`,
          borderRadius: '6px',
          fontSize: '0.85rem',
          color: isRefuted ? '#7f1d1d' : isSupported ? '#166534' : '#854d0e',
          lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{isRefuted ? '⚖ Debunking Evidence:' : isSupported ? '✓ Corroborating Evidence:' : 'ℹ Context & Evidence:'}</span>
          </div>
          <div>{claim.evidence}</div>
        </div>
      )}

      {/* Confidence Bar */}
      <div className="claim-card__confidence" style={{ marginTop: '14px' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
          Verification Confidence
        </span>
        <div className="confidence-bar">
          <div
            className="confidence-bar__fill"
            style={{
              width: `${pct}%`,
              background: verdict.fillColor,
            }}
          />
        </div>
        <span className="confidence-label">{pct}%</span>
      </div>
    </div>
  )
}
