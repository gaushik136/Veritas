/** CredibilityMeter — animated SVG ring showing credibility score 0-100 */
import { useEffect, useState } from 'react'

const RADIUS = 45
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function getColor(score) {
  if (score >= 65) return 'var(--supported)'
  if (score >= 35) return 'var(--unverified)'
  return 'var(--refuted)'
}

export default function CredibilityMeter({ score, size = 120 }) {
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    if (score === null || score === undefined) return
    const target = Math.round(score * 100)
    let start = 0
    const duration = 1200
    const startTime = performance.now()

    function animate(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [score])

  if (score === null || score === undefined) {
    return (
      <div className="score-ring" style={{ width: size, height: size }}>
        <div className="skeleton" style={{ width: size, height: size, borderRadius: '50%' }} />
      </div>
    )
  }

  const pct = Math.round(score * 100)
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE
  const color = getColor(pct)

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg
        className="score-ring__svg"
        width={size}
        height={size}
        viewBox="0 0 100 100"
        aria-label={`Credibility score: ${pct}%`}
      >
        <circle
          className="score-ring__track"
          cx="50"
          cy="50"
          r={RADIUS}
        />
        <circle
          className="score-ring__fill"
          cx="50"
          cy="50"
          r={RADIUS}
          stroke={color}
          style={{
            strokeDashoffset: offset,
            transition: 'stroke-dashoffset 1.2s cubic-bezier(0, 0, 0.2, 1)',
          }}
        />
      </svg>
      <div className="score-ring__value">
        <span
          className="score-ring__number"
          style={{ color }}
        >
          {displayed}
        </span>
        <span className="score-ring__label">Score</span>
      </div>
    </div>
  )
}
