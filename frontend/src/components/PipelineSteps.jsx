/** PipelineSteps — real-time analysis pipeline progress */

const STEP_ICONS = {
  pending: (
    <span style={{ opacity: 0.4 }}>○</span>
  ),
  running: (
    <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} aria-hidden="true" />
  ),
  done: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  failed: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  unavailable: (
    <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>—</span>
  ),
}

export default function PipelineSteps({ steps }) {
  return (
    <div className="pipeline" role="list" aria-label="Analysis pipeline">
      {steps.map((step, i) => (
        <div
          key={step.id}
          className={`pipeline-step pipeline-step--${step.status}`}
          role="listitem"
          aria-label={`${step.label}: ${step.status}`}
        >
          <div className="pipeline-step__icon" aria-hidden="true">
            {STEP_ICONS[step.status] || STEP_ICONS.pending}
          </div>
          <div className="pipeline-step__content">
            <div className="pipeline-step__label">{step.label}</div>
            {step.note && (
              <div className="pipeline-step__meta">{step.note}</div>
            )}
          </div>
          {step.timeMs != null && step.status === 'done' && (
            <span className="pipeline-step__time">{step.timeMs}ms</span>
          )}
        </div>
      ))}
    </div>
  )
}
