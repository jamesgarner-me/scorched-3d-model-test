import { DIFFICULTIES } from '../sim/ai'
import type { TankId } from '../sim/physics'
import { PRESETS, type PresetId } from '../sim/presets'
import { game } from '../state/game'
import { DEMO_MODE, tankName, useStore } from '../state/store'

export function FlyoverBanner() {
  const seed = useStore((s) => s.seed)
  const preset = useStore((s) => s.settings.preset)
  const radius = useStore((s) => s.match?.planet.radius ?? 0)
  return (
    <div className="flyover-banner">
      <div className="flyover-title">
        {PRESETS[preset].name} world “{seed}”
      </div>
      <div className="flyover-sub">radius {radius} m · press any key to skip</div>
    </div>
  )
}

export function PauseOverlay() {
  const settings = useStore((s) => s.settings)
  return (
    <div className="screen dim">
      <div className="panel">
        <h2>Paused</h2>
        <button className="primary" onClick={() => game.togglePause()}>Resume</button>
        <div className="section-label">Sound</div>
        <div className="choice-row compact">
          <button className={`choice ${settings.sound ? 'active' : ''}`} onClick={() => game.setSettings({ sound: true })}><span className="choice-title">On</span></button>
          <button className={`choice ${!settings.sound ? 'active' : ''}`} onClick={() => game.setSettings({ sound: false })}><span className="choice-title">Off</span></button>
        </div>
        <div className="section-label">Next match</div>
        <div className="choice-row compact">
          {(Object.keys(PRESETS) as PresetId[]).map((id) => (
            <button key={id} className={`choice ${settings.preset === id ? 'active' : ''}`} onClick={() => game.setSettings({ preset: id })}><span className="choice-title">{PRESETS[id].name}</span></button>
          ))}
        </div>
        <div className="choice-row compact">
          {DIFFICULTIES.map((d) => (
            <button key={d.id} className={`choice ${settings.difficulty === d.id ? 'active' : ''}`} onClick={() => game.setSettings({ difficulty: d.id })}><span className="choice-title">{d.name}</span></button>
          ))}
        </div>
        <div className="button-row">
          <button onClick={() => game.newMatch()}>Restart with new planet</button>
          <button onClick={() => game.toMenu()}>Quit to menu</button>
        </div>
      </div>
    </div>
  )
}

export function EndOverlay() {
  const winner = useStore((s) => s.winner)
  const shots = useStore((s) => s.shotsFired)
  const won = winner === 'player'
  // A demo has no "you" to win or lose: name the surviving computer and colour the title to match its hull.
  const loser: TankId = won ? 'ai' : 'player'
  const tone = DEMO_MODE ? (won ? 'blue' : 'red') : won ? 'victory' : 'defeat'
  const eyebrow = DEMO_MODE ? `${tankName(loser)} tank destroyed` : won ? 'Enemy tank destroyed' : 'Your tank was destroyed'
  const title = DEMO_MODE ? `${tankName(won ? 'player' : 'ai')} wins` : won ? 'Victory' : 'Defeat'
  return (
    <div className="screen dim end">
      <div className={`panel ${tone}`}>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="lede">{shots} shots fired this match.</p>
        <button className="primary" onClick={() => game.newMatch()}>New match</button>
        <div className="button-row">
          <button onClick={() => game.toMenu()}>Main menu</button>
        </div>
        <div className="controls-hint"><span><kbd>Enter</kbd> new match</span></div>
      </div>
    </div>
  )
}
