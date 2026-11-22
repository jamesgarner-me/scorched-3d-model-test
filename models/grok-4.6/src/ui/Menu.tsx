import type { Difficulty, PresetId } from '../game/types.ts'

export function Menu({
  preset,
  difficulty,
  demo = false,
  onPreset,
  onDifficulty,
  onStart,
}: {
  preset: PresetId
  difficulty: Difficulty
  demo?: boolean
  onPreset: (preset: PresetId) => void
  onDifficulty: (difficulty: Difficulty) => void
  onStart: () => void
}) {
  return (
    <div className="overlay menu">
      <div className="menu-frame">
        <p className="kicker">
          {demo ? 'Orbital fire-control // spectator survey' : 'Orbital fire-control // client survey'}
        </p>
        <h1>Planetary Artillery</h1>
        <p className="tag">
          {demo
            ? 'SCORCHED 3D · two automata, one world, no turret for you'
            : 'SCORCHED 3D · one planet, two guns, no horizon to hide behind'}
        </p>

        <section>
          <h2>World body</h2>
          <div className="cards">
            <button
              type="button"
              className={preset === 'earth' ? 'card earth active' : 'card earth'}
              onClick={() => onPreset('earth')}
            >
              <span className="card-kicker">Preset A</span>
              <strong>Earth-like</strong>
              <em>Water, haze, weather, heavier pull</em>
            </button>
            <button
              type="button"
              className={preset === 'mars' ? 'card mars active' : 'card mars'}
              onClick={() => onPreset('mars')}
            >
              <span className="card-kicker">Preset B</span>
              <strong>Mars-like</strong>
              <em>Dry rust, dust wind, lighter gravity</em>
            </button>
          </div>
        </section>

        <section>
          <h2>Opponent</h2>
          <div className="pills">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                className={difficulty === d ? 'pill active' : 'pill'}
                onClick={() => onDifficulty(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </section>

        <button type="button" className="start" onClick={onStart}>
          {demo ? 'Begin demo' : 'Begin survey'}
        </button>

        <p className="hint">
          {demo
            ? 'drag to orbit · halt for sound · no turret input'
            : '←→ bearing · ↑↓ elevation · hold space to charge · release to fire · drag to orbit'}
        </p>
      </div>
    </div>
  )
}
