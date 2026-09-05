export function PauseOverlay({
  muted,
  onMute,
  onResume,
  onMenu,
}: {
  muted: boolean
  onMute: () => void
  onResume: () => void
  onMenu: () => void
}) {
  return (
    <div className="overlay pause">
      <div className="pause-panel">
        <p className="kicker">Hold fire</p>
        <h2>Paused</h2>
        <div className="end-actions">
          <button type="button" className="start" onClick={onResume}>
            Resume
          </button>
          <button type="button" className="ghost solid" onClick={onMute}>
            {muted ? 'Sound off' : 'Sound on'}
          </button>
          <button type="button" className="ghost solid" onClick={onMenu}>
            Abandon match
          </button>
        </div>
      </div>
    </div>
  )
}
