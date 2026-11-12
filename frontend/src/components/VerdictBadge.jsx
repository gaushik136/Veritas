/** VerdictBadge — displays the overall verdict with color and animation */
export default function VerdictBadge({ score, size = 'md' }) {
  if (score === null || score === undefined) {
    return <span className="tag tag--neutral">Unknown</span>
  }

  let label, cls
  if (score >= 0.65) {
    label = 'Likely Credible'
    cls = 'tag--supported'
  } else if (score >= 0.35) {
    label = 'Unverified'
    cls = 'tag--unverified'
  } else {
    label = 'Likely Misleading'
    cls = 'tag--refuted'
  }

  return (
    <span className={`tag ${cls}`} style={size === 'lg' ? { fontSize: '0.875rem', padding: '5px 14px' } : {}}>
      {label}
    </span>
  )
}
