import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getAnalysis } from '../services/history.js'
import CredibilityMeter from '../components/CredibilityMeter.jsx'
import VerdictBadge from '../components/VerdictBadge.jsx'
import ClaimCard from '../components/ClaimCard.jsx'
import SourceCard from '../components/SourceCard.jsx'
import Notice from '../components/Notice.jsx'

const ML_TASK_LABELS = {
  fever_claim: 'FEVER Claim Check',
  liar_statement: 'LIAR Dataset',
  tamil_xfact: 'Tamil XFact',
}

export default function ResultsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [analysis, setAnalysis] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const data = getAnalysis(id)
    if (!data) { setNotFound(true); return }
    setAnalysis(data)
  }, [id])

  if (notFound) {
    return (
      <div className="results">
        <div className="container container--narrow">
          <div className="empty-state">
            <div className="empty-state__icon">◎</div>
            <div className="empty-state__title">Analysis not found</div>
            <p className="empty-state__text">This report may have been cleared from your browser history.</p>
            <button className="btn btn--ghost" style={{ marginTop: 16 }} onClick={() => navigate('/')}>
              ← New Analysis
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="results">
        <div className="container container--narrow">
          <div className="skeleton" style={{ height: 180, marginBottom: 24 }} />
          <div className="skeleton" style={{ height: 100, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 100 }} />
        </div>
      </div>
    )
  }

  const { gemini, ml, errors, inputType, inputPreview, timestamp } = analysis
  const geminiError = errors?.gemini
  const hasGemini = !!gemini
  const hasAnyClaim = hasGemini && gemini.claims?.length > 0
  const hasAnySource = hasGemini && gemini.sources?.length > 0
  const mlTaskKeys = Object.keys(ml || {})
  const hasML = mlTaskKeys.length > 0

  function handleExport() {
    const lines = [
      `# VERITAS Analysis & Evidence Report`,
      `Date: ${new Date(timestamp).toLocaleString()}`,
      `Input Mode: ${inputType.toUpperCase()}`,
      `Content Preview: ${inputPreview}`,
      '',
      `## Credibility Score: ${gemini?.credibility_score != null ? Math.round(gemini.credibility_score * 100) + '/100' : 'N/A'}`,
      '',
      gemini?.summary ? `## Executive Fact-Check Summary\n${gemini.summary}` : '',
      '',
      hasAnyClaim ? `## Extracted Claims & Verification\n${gemini.claims.map(c => `- [${c.verdict.toUpperCase()}] "${c.text}" (Confidence: ${Math.round(c.confidence * 100)}%)\n  *Explanation:* ${c.explanation}\n  ${c.why_fake && c.why_fake !== 'N/A: Verified factual' ? `*Why Fake:* ${c.why_fake}\n  ` : ''}${c.evidence ? `*Evidence:* ${c.evidence}` : ''}`).join('\n\n')}` : '',
      '',
      hasAnySource ? `## Corroborating & Reference Sources\n${gemini.sources.map(s => `- **${s.title}**: ${s.url}\n  *Relevance:* ${s.relevance}`).join('\n\n')}` : '',
      '',
      hasML ? `## ML Model Classifications\n${mlTaskKeys.map(t => {
        const r = ml[t]
        return `### ${ML_TASK_LABELS[t] || t}\nLabel: ${r.label}\nConfidence: ${Math.round(r.confidence * 100)}%`
      }).join('\n\n')}` : '',
      '',
      geminiError ? `## ⚠ Notice\n${geminiError.message}` : '',
    ].filter(Boolean).join('\n')

    const blob = new Blob([lines], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `veritas-evidence-report-${id}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="results page-enter">
      <div className="container container--narrow">
        {/* Toolbar */}
        <div className="report-toolbar">
          <div className="report-toolbar__left">
            <div className="report-toolbar__title">Verification & Evidence Report</div>
            <div className="report-toolbar__meta">
              {new Date(timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              {' · '}
              <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{inputType}</span>
            </div>
          </div>
          <div className="report-toolbar__actions">
            <button className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>
              ← New Check
            </button>
            <button className="btn btn--primary btn--sm" onClick={handleExport}>
              Export Report (.md)
            </button>
          </div>
        </div>

        {/* Gemini error notice only if API failed */}
        {geminiError && (
          <div style={{ marginBottom: 20 }}>
            <Notice type="error">
              <strong>Analysis Notice:</strong> {geminiError.message}
              {geminiError.code === 'api_key_missing' && ' — Set LLM_API_KEY in backend/.env'}
            </Notice>
          </div>
        )}

        {/* Score hero */}
        <div className="score-hero">
          <CredibilityMeter
            score={gemini?.credibility_score ?? null}
            size={120}
          />
          <div className="score-info">
            <div className="score-info__verdict">
              {!hasGemini ? 'Analysis Unavailable' :
               gemini.credibility_score >= 0.65 ? 'Verified Credible' :
               gemini.credibility_score >= 0.35 ? 'Unsubstantiated / Inconclusive' :
               'Fabricated / Fake News'}
            </div>
            {gemini?.summary && (
              <p className="score-info__summary">{gemini.summary}</p>
            )}
            <div className="score-info__meta">
              <VerdictBadge score={gemini?.credibility_score ?? null} size="lg" />
              {gemini?.language && (
                <span className="tag tag--neutral">Lang: {gemini.language.toUpperCase()}</span>
              )}
              {gemini?.model_used && (
                <span className="tag tag--neutral">{gemini.model_used}</span>
              )}
              {gemini?.analysis_time_ms > 0 && (
                <span className="tag tag--neutral">{gemini.analysis_time_ms}ms</span>
              )}
            </div>
          </div>
        </div>

        {/* Claims & Why It's Fake with Evidence */}
        <section aria-labelledby="claims-heading">
          <div className="section-title" id="claims-heading">
            Fact-Checked Claims & Evidence Breakdown
            {hasAnyClaim && <span className="tag tag--neutral">{gemini.claims.length}</span>}
          </div>

          {!hasGemini ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <div className="empty-state__title">No claims available</div>
              <p className="empty-state__text">Fact-checking analysis could not be completed.</p>
            </div>
          ) : !hasAnyClaim ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <div className="empty-state__title">No verifiable claims found</div>
              <p className="empty-state__text">No specific factual assertions could be isolated in the provided text.</p>
            </div>
          ) : (
            gemini.claims.map((claim, i) => (
              <ClaimCard key={i} claim={claim} index={i} />
            ))
          )}
        </section>

        {/* Authoritative Reference Sources */}
        <section aria-labelledby="sources-heading" style={{ marginTop: 36 }}>
          <div className="section-title" id="sources-heading">
            Authoritative Reference & Debunking Sources
            {hasAnySource && <span className="tag tag--neutral">{gemini.sources.length}</span>}
          </div>

          {!hasGemini ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <div className="empty-state__title">No reference sources available</div>
            </div>
          ) : !hasAnySource ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <div className="empty-state__title">No external sources cited</div>
              <p className="empty-state__text">No specific third-party links were identified for this item.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {gemini.sources.map((source, i) => (
                <SourceCard key={i} source={source} index={i} />
              ))}
            </div>
          )}
        </section>

        {/* ML Classification (Only shown if models exist and produced valid scores) */}
        {hasML && (
          <section aria-labelledby="ml-heading" style={{ marginTop: 36 }}>
            <div className="section-title" id="ml-heading">
              ML Dataset Classifications
            </div>
            <div>
              {mlTaskKeys.map(task => {
                const result = ml[task]
                if (!result) return null
                return (
                  <div key={task} className="ml-card animate-fade-up">
                    <div className="ml-card__task">{ML_TASK_LABELS[task] || task}</div>
                    <div className="ml-card__label">{result.label}</div>
                    {result.all_scores && Object.entries(result.all_scores)
                      .sort(([,a],[,b]) => b - a)
                      .map(([label, score]) => (
                        <div key={label} className="ml-bar-row">
                          <span className="ml-bar-label">{label}</span>
                          <div className="ml-bar">
                            <div
                              className="ml-bar__fill"
                              style={{ width: `${Math.round(score * 100)}%` }}
                            />
                          </div>
                          <span className="ml-bar-pct">{Math.round(score * 100)}%</span>
                        </div>
                      ))
                    }
                    {result.model_version && (
                      <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)' }}>
                        {result.model_version}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Input preview */}
        <section style={{ marginTop: 40 }}>
          <div className="section-title">Submitted Content Preview</div>
          <div style={{
            padding: '16px 20px',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            maxHeight: 180,
            overflow: 'auto',
          }}>
            {inputPreview || '(no preview)'}
          </div>
        </section>

        {/* Footer note */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-disabled)', textAlign: 'center', lineHeight: 1.6 }}>
          VERITAS Fact-Checking Engine · Evidence retrieved directly via real-time verification and official reference sources.
        </div>
      </div>
    </div>
  )
}
