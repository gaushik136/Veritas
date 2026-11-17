/* AIDetectionCard — displays AI vs. human origin detection result */

const VERDICT_CONFIG = {
  likely_ai: {
    icon: '🤖',
    label: 'Likely AI-Generated',
    color: 'var(--refuted)',
    bg: 'var(--refuted-bg)',
    border: 'var(--refuted)',
    barColor: '#e53e3e',
  },
  likely_human: {
    icon: '👤',
    label: 'Likely Human-Written',
    color: 'var(--supported)',
    bg: 'var(--supported-bg)',
    border: 'var(--supported)',
    barColor: '#38a169',
  },
  uncertain: {
    icon: '❓',
    label: 'Uncertain — Insufficient Signal',
    color: 'var(--unverified)',
    bg: 'var(--unverified-bg)',
    border: 'var(--unverified)',
    barColor: '#d69e2e',
  },
}

export default function AIDetectionCard({ result }) {
  if (!result) return null

  const verdict = result.verdict in VERDICT_CONFIG ? result.verdict : 'uncertain'
  const cfg = VERDICT_CONFIG[verdict]
  const aiPct = Math.round((result.ai_probability ?? 0.5) * 100)
  const confPct = Math.round((result.confidence ?? 0) * 100)

  return (
    <div
      className="claim-card animate-fade-up"
      style={{
        borderLeft: `4px solid ${cfg.border}`,
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.4rem' }}>{cfg.icon}</span>
        <span
          style={{
            fontWeight: 700,
            fontSize: '1rem',
            color: cfg.color,
            letterSpacing: '0.01em',
          }}
        >
          {cfg.label}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '0.78rem',
            color: 'var(--text-disabled)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {result.model_used ?? 'gemini-3.1-flash-lite'}
          {result.analysis_time_ms > 0 && ` · ${result.analysis_time_ms}ms`}
        </span>
      </div>

      {/* AI Probability bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 5 }}>
          <span style={{ fontWeight: 600 }}>AI Probability</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: cfg.color }}>{aiPct}%</span>
        </div>
        <div style={{ height: 7, background: 'var(--bg-muted)', borderRadius: 99, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${aiPct}%`,
              background: cfg.barColor,
              borderRadius: 99,
              transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-disabled)', marginTop: 3 }}>
          <span>Human</span>
          <span>AI</span>
        </div>
      </div>

      {/* Detection confidence */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 5 }}>
          <span style={{ fontWeight: 600 }}>Detection Confidence</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{confPct}%</span>
        </div>
        <div style={{ height: 5, background: 'var(--bg-muted)', borderRadius: 99, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${confPct}%`,
              background: 'var(--text-disabled)',
              borderRadius: 99,
              transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
            }}
          />
        </div>
      </div>

      {/* Linguistic indicators */}
      {result.indicators?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: 8,
            }}
          >
            Linguistic Signals Detected
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {result.indicators.map((indicator, i) => (
              <li
                key={i}
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                {indicator}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Explanation */}
      {result.explanation && (
        <div
          style={{
            padding: '10px 14px',
            background: cfg.bg,
            borderRadius: 'var(--radius)',
            fontSize: '0.875rem',
            color: 'var(--text-primary)',
            lineHeight: 1.6,
          }}
        >
          <span style={{ fontWeight: 700, color: cfg.color }}>Analysis: </span>
          {result.explanation}
        </div>
      )}

      {/* Disclaimer */}
      <div
        style={{
          marginTop: 10,
          fontSize: '0.72rem',
          color: 'var(--text-disabled)',
          lineHeight: 1.5,
        }}
      >
        AI origin detection is probabilistic. Results are based on linguistic pattern analysis by Gemini and may not be definitive.
      </div>
    </div>
  )
}
