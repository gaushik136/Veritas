import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHistory, clearHistory } from '../services/history.js'
import VerdictBadge from '../components/VerdictBadge.jsx'

export default function HistoryPage() {
  const navigate = useNavigate()
  const [history, setHistory] = useState(() => getHistory())

  function handleClear() {
    if (confirm('Clear all analysis history? This cannot be undone.')) {
      clearHistory()
      setHistory([])
    }
  }

  return (
    <div className="history-page page-enter">
      <div className="container container--narrow">
        <div className="report-toolbar">
          <div className="report-toolbar__left">
            <div className="report-toolbar__title">Analysis History</div>
            <div className="report-toolbar__meta">
              Stored locally in your browser · {history.length} {history.length === 1 ? 'analysis' : 'analyses'}
            </div>
          </div>
          <div className="report-toolbar__actions">
            <button className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>
              + New
            </button>
            {history.length > 0 && (
              <button className="btn btn--ghost btn--sm" onClick={handleClear} style={{ color: 'var(--refuted)' }}>
                Clear All
              </button>
            )}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">◎</div>
            <div className="empty-state__title">No analyses yet</div>
            <p className="empty-state__text">Submit an article to get started.</p>
            <button
              className="btn btn--primary"
              style={{ marginTop: 20 }}
              onClick={() => navigate('/')}
            >
              Analyze an article →
            </button>
          </div>
        ) : (
          <div className="history-list">
            {history.map(item => (
              <div
                key={item.id}
                className="history-item"
                onClick={() => navigate(`/results/${item.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && navigate(`/results/${item.id}`)}
                aria-label={`View analysis: ${item.inputPreview}`}
              >
                <div
                  className="history-item__score"
                  style={{
                    background: item.credibility_score >= 0.65 ? 'var(--supported-bg)' :
                                item.credibility_score >= 0.35 ? 'var(--unverified-bg)' :
                                item.credibility_score !== null ? 'var(--refuted-bg)' : 'var(--bg-muted)',
                    color: item.credibility_score >= 0.65 ? 'var(--supported)' :
                           item.credibility_score >= 0.35 ? 'var(--unverified)' :
                           item.credibility_score !== null ? 'var(--refuted)' : 'var(--text-disabled)',
                  }}
                >
                  {item.credibility_score !== null
                    ? `${Math.round(item.credibility_score * 100)}`
                    : '?'}
                </div>
                <div className="history-item__content">
                  <div className="history-item__text">
                    {item.inputPreview || 'Analysis'}
                  </div>
                  <div className="history-item__meta">
                    {new Date(item.timestamp).toLocaleString('en-US', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                    {' · '}{item.inputType}
                    {item.language && item.language !== 'en' && ` · ${item.language.toUpperCase()}`}
                  </div>
                </div>
                <VerdictBadge score={item.credibility_score} />
                <svg
                  className="history-item__arrow"
                  width="16" height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 40, fontSize: '0.8rem', color: 'var(--text-disabled)', textAlign: 'center' }}>
          History is stored only in this browser. It is never sent to any server.
        </div>
      </div>
    </div>
  )
}
