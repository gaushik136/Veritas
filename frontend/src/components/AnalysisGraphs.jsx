import { useState } from 'react'

export default function AnalysisGraphs({ gemini, aiDetection }) {
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'claims' | 'origin'

  if (!gemini && !aiDetection) return null

  const claims = gemini?.claims || []
  const sources = gemini?.sources || []
  const credScore = gemini?.credibility_score != null ? Math.round(gemini.credibility_score * 100) : 50

  // 1. Claims breakdown calculations
  const totalClaims = claims.length
  const supportedClaims = claims.filter(c => c.verdict === 'supported').length
  const refutedClaims = claims.filter(c => c.verdict === 'refuted').length
  const unverifiedClaims = claims.filter(c => c.verdict === 'unverified' || !['supported', 'refuted'].includes(c.verdict)).length

  const supportedPct = totalClaims > 0 ? Math.round((supportedClaims / totalClaims) * 100) : 0
  const refutedPct = totalClaims > 0 ? Math.round((refutedClaims / totalClaims) * 100) : 0
  const unverifiedPct = totalClaims > 0 ? Math.max(0, 100 - supportedPct - refutedPct) : 0

  // 2. AI vs Human calculations
  const aiProb = aiDetection?.ai_probability != null ? Math.round(aiDetection.ai_probability * 100) : null
  const humanProb = aiProb !== null ? 100 - aiProb : null
  const detectionConf = aiDetection?.confidence != null ? Math.round(aiDetection.confidence * 100) : null

  // 3. Multi-Metric Process Indices
  const sourceGrounding = Math.min(100, sources.length * 25 + (claims.some(c => c.evidence) ? 25 : 0))
  const avgConfidence = totalClaims > 0
    ? Math.round((claims.reduce((acc, c) => acc + (c.confidence || 0.7), 0) / totalClaims) * 100)
    : 70

  // SVG Donut calculations for Claim Verdicts
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const supportedStroke = (supportedPct / 100) * circumference
  const refutedStroke = (refutedPct / 100) * circumference
  const unverifiedStroke = (unverifiedPct / 100) * circumference

  const supportedOffset = 0
  const refutedOffset = -supportedStroke
  const unverifiedOffset = -(supportedStroke + refutedStroke)

  return (
    <div
      className="analysis-graphs-card animate-fade-up"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        marginBottom: '32px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header with Navigation Pills */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem', color: 'var(--accent)' }}>📊</span>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
              Verification Process & Analytics
            </h3>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Empirical breakdown of claims veracity, authorship signals, and evidence grounding
          </p>
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-muted)', padding: '3px', borderRadius: 'var(--radius)' }}>
          {[
            { id: 'overview', label: 'Metrics Overview' },
            { id: 'claims', label: 'Claims Breakdown' },
            { id: 'origin', label: 'AI Origin Spectrum' },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                border: 'none',
                background: activeTab === t.id ? 'var(--surface)' : 'transparent',
                color: activeTab === t.id ? 'var(--text)' : 'var(--text-secondary)',
                fontWeight: activeTab === t.id ? 600 : 500,
                fontSize: '0.78rem',
                padding: '5px 12px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                boxShadow: activeTab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: METRICS OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {/* Donut Chart: Claims Distribution */}
          <div
            style={{
              padding: '16px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', alignSelf: 'flex-start' }}>
              Claim Veracity Breakdown ({totalClaims} total)
            </div>

            {totalClaims > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                  <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                    {/* Background track */}
                    <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border)" strokeWidth="10" />
                    {/* Supported */}
                    {supportedStroke > 0 && (
                      <circle
                        cx="50" cy="50" r={radius} fill="none"
                        stroke="var(--supported)" strokeWidth="10"
                        strokeDasharray={`${supportedStroke} ${circumference}`}
                        strokeDashoffset={supportedOffset}
                        strokeLinecap="round"
                      />
                    )}
                    {/* Refuted / Fake */}
                    {refutedStroke > 0 && (
                      <circle
                        cx="50" cy="50" r={radius} fill="none"
                        stroke="var(--refuted)" strokeWidth="10"
                        strokeDasharray={`${refutedStroke} ${circumference}`}
                        strokeDashoffset={refutedOffset}
                        strokeLinecap="round"
                      />
                    )}
                    {/* Unverified */}
                    {unverifiedStroke > 0 && (
                      <circle
                        cx="50" cy="50" r={radius} fill="none"
                        stroke="var(--unverified)" strokeWidth="10"
                        strokeDasharray={`${unverifiedStroke} ${circumference}`}
                        strokeDashoffset={unverifiedOffset}
                        strokeLinecap="round"
                      />
                    )}
                  </svg>
                  <div
                    style={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0, bottom: 0,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {credScore}%
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-disabled)', textTransform: 'uppercase' }}>
                      Trust
                    </span>
                  </div>
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--supported)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Verified Truth:</span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>{supportedClaims} ({supportedPct}%)</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--refuted)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Refuted / Fake:</span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>{refutedClaims} ({refutedPct}%)</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--unverified)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Unsubstantiated:</span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>{unverifiedClaims} ({unverifiedPct}%)</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-disabled)', padding: '24px 0' }}>
                No verifiable claims isolated
              </div>
            )}
          </div>

          {/* Bar Matrix: Multi-Pillar Verification Process */}
          <div
            style={{
              padding: '16px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Multi-Pillar Verification Process Index
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Pillar 1: Factual Credibility */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                  <span>Factual Credibility</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: credScore >= 65 ? 'var(--supported)' : credScore >= 35 ? 'var(--unverified)' : 'var(--refuted)' }}>
                    {credScore}%
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${credScore}%`,
                      background: credScore >= 65 ? 'var(--supported)' : credScore >= 35 ? 'var(--unverified)' : 'var(--refuted)',
                      borderRadius: 99,
                      transition: 'width 0.8s ease',
                    }}
                  />
                </div>
              </div>

              {/* Pillar 2: Human Authorship */}
              {humanProb !== null && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                    <span>Human Authorship Likelihood</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: humanProb >= 50 ? 'var(--supported)' : 'var(--refuted)' }}>
                      {humanProb}%
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${humanProb}%`,
                        background: humanProb >= 50 ? 'var(--supported)' : 'var(--refuted)',
                        borderRadius: 99,
                        transition: 'width 0.8s ease',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Pillar 3: External Evidence Grounding */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                  <span>Source Grounding Depth</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text)' }}>
                    {sourceGrounding}% ({sources.length} sources)
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${sourceGrounding}%`,
                      background: '#3b82f6',
                      borderRadius: 99,
                      transition: 'width 0.8s ease',
                    }}
                  />
                </div>
              </div>

              {/* Pillar 4: Cross-Verification Confidence */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                  <span>Analysis Confidence</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text)' }}>
                    {avgConfidence}%
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${avgConfidence}%`,
                      background: 'var(--text-secondary)',
                      borderRadius: 99,
                      transition: 'width 0.8s ease',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLAIMS BREAKDOWN */}
      {activeTab === 'claims' && (
        <div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Comparative Claim Confidence Spectrum
          </div>

          {claims.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {claims.map((claim, idx) => {
                const conf = Math.round((claim.confidence || 0.75) * 100)
                const isSupported = claim.verdict === 'supported'
                const isRefuted = claim.verdict === 'refuted'
                const color = isSupported ? 'var(--supported)' : isRefuted ? 'var(--refuted)' : 'var(--unverified)'
                const label = isSupported ? 'Supported' : isRefuted ? 'Refuted' : 'Unverified'

                return (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 14px',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: 'var(--text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '75%',
                        }}
                      >
                        Claim {idx + 1}: "{claim.text}"
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: color,
                          background: isSupported ? 'var(--supported-bg)' : isRefuted ? 'var(--refuted-bg)' : 'var(--unverified-bg)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        {label} · {conf}%
                      </span>
                    </div>

                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${conf}%`,
                          background: color,
                          borderRadius: 99,
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-disabled)', textAlign: 'center', padding: '20px 0' }}>
              No claims available to chart.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AI ORIGIN SPECTRUM */}
      {activeTab === 'origin' && (
        <div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Authorship & Style Uniformity Spectrum
          </div>

          {aiDetection ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Dual Stacked Progress Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--supported)' }}>
                    👤 Human Likelihood: {humanProb}%
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--refuted)' }}>
                    🤖 AI Likelihood: {aiProb}%
                  </span>
                </div>

                <div style={{ height: 12, display: 'flex', borderRadius: 99, overflow: 'hidden', background: 'var(--border)' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${humanProb}%`,
                      background: 'var(--supported)',
                      transition: 'width 0.8s ease',
                    }}
                  />
                  <div
                    style={{
                      height: '100%',
                      width: `${aiProb}%`,
                      background: 'var(--refuted)',
                      transition: 'width 0.8s ease',
                    }}
                  />
                </div>
              </div>

              {/* Indicator Tags Matrix */}
              {aiDetection.indicators?.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Linguistic Signals Evaluated
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {aiDetection.indicators.map((ind, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '0.75rem',
                          background: 'var(--bg-subtle)',
                          border: '1px solid var(--border)',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        ⚡ {ind}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-disabled)', textAlign: 'center', padding: '20px 0' }}>
              AI origin detection spectrum unavailable for this item.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
