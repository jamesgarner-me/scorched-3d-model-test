import type { Side } from '../game/types.ts'

export function WinnerOverlay({
  winner,
  onAgain,
  onMenu,
}: {
  winner: Side
  onAgain: () => void
  onMenu: () => void
}) {
  return (
    <div className="overlay end">
      <div className="end-panel">
        <p className="kicker">{winner === 'player' ? 'Battery report' : 'Survey lost'}</p>
        <h2>{winner === 'player' ? 'Target destroyed' : 'You were destroyed'}</h2>
        <p className="tag">A new body is waiting if you want another pass.</p>
        <div className="end-actions">
          <button type="button" className="start" onClick={onAgain}>
            New match
          </button>
          <button type="button" className="ghost solid" onClick={onMenu}>
            Change world
          </button>
        </div>
      </div>
    </div>
  )
}
