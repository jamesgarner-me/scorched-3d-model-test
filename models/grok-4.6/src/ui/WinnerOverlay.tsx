import type { Side } from '../game/types.ts'

export function WinnerOverlay({
  winner,
  demo = false,
  onAgain,
  onMenu,
}: {
  winner: Side
  demo?: boolean
  onAgain: () => void
  onMenu: () => void
}) {
  const kicker = demo ? 'Demo survey' : winner === 'player' ? 'Battery report' : 'Survey lost'
  const title = demo
    ? winner === 'player'
      ? 'Blue battery holds'
      : 'Red battery holds'
    : winner === 'player'
      ? 'Target destroyed'
      : 'You were destroyed'
  const tag = demo
    ? 'Two automata. One world. Another pass if you want it.'
    : 'A new body is waiting if you want another pass.'

  return (
    <div className="overlay end">
      <div className="end-panel">
        <p className="kicker">{kicker}</p>
        <h2>{title}</h2>
        <p className="tag">{tag}</p>
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
