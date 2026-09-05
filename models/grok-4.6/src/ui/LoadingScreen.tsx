export function LoadingScreen({
  progress,
  label,
}: {
  progress: number
  label: string
}) {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100)
  return (
    <div className="overlay loading">
      <div className="load-panel">
        <p className="kicker">Survey in progress</p>
        <h2>Raising a fresh world</h2>
        <div className="sweep" aria-hidden>
          <div className="sweep-arm" />
        </div>
        <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="load-label">
          {label} <b>{pct}%</b>
        </p>
      </div>
    </div>
  )
}
