import { useEffect, useRef, useState } from 'react'
import { GameCanvas } from './scene/GameCanvas.tsx'
import { Menu } from './ui/Menu.tsx'
import { LoadingScreen } from './ui/LoadingScreen.tsx'
import { HUD } from './ui/HUD.tsx'
import { WinnerOverlay } from './ui/WinnerOverlay.tsx'
import { PauseOverlay } from './ui/PauseOverlay.tsx'
import { DebugPanel } from './ui/DebugPanel.tsx'
import { useGame } from './hooks/useGame.ts'
import { playSfx, unlockAudio } from './audio/sfx.ts'
import type { Difficulty, PresetId } from './game/types.ts'

export default function App() {
  const { engine, snap, input } = useGame()
  const [preset, setPreset] = useState<PresetId>('earth')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const lastPhase = useRef(snap.phase)
  const lastEffect = useRef(snap.effect?.id ?? 0)

  useEffect(() => {
    const prev = lastPhase.current
    if (snap.phase === 'inFlight' && prev !== 'inFlight') {
      playSfx('fire', snap.muted)
      playSfx('flight', snap.muted)
    }
    lastPhase.current = snap.phase
  }, [snap.phase, snap.muted])

  useEffect(() => {
    const id = snap.effect?.id ?? 0
    if (!snap.effect || id === lastEffect.current) return
    lastEffect.current = id
    if (snap.effect.kind === 'splash') playSfx('splash', snap.muted)
    if (snap.effect.kind === 'explosion') playSfx('explosion', snap.muted)
    if (snap.effect.kind === 'destruction') playSfx('destruction', snap.muted)
  }, [snap.effect, snap.muted])

  const start = () => {
    unlockAudio()
    void engine.startMatch(preset, difficulty)
  }

  return (
    <div className="app">
      {engine.planet && <GameCanvas engine={engine} snap={snap} input={input} />}
      {snap.phase === 'menu' && (
        <Menu
          preset={preset}
          difficulty={difficulty}
          onPreset={setPreset}
          onDifficulty={setDifficulty}
          onStart={start}
        />
      )}
      {snap.phase === 'generating' && (
        <LoadingScreen progress={snap.progress} label={snap.progressLabel} />
      )}
      {snap.phase !== 'menu' && snap.phase !== 'generating' && (
        <HUD
          snap={snap}
          onPause={() => engine.togglePause()}
          onDebug={() => engine.setDebug(!snap.debug)}
        />
      )}
      {snap.paused && (
        <PauseOverlay
          muted={snap.muted}
          onMute={() => engine.setMuted(!snap.muted)}
          onResume={() => engine.togglePause()}
          onMenu={() => engine.returnToMenu()}
        />
      )}
      {snap.phase === 'ended' && snap.winner && (
        <WinnerOverlay
          winner={snap.winner}
          onAgain={() => void engine.newMatch()}
          onMenu={() => engine.returnToMenu()}
        />
      )}
      {snap.debug && (
        <DebugPanel
          snap={snap}
          onSeed={(seed) => void engine.regenerate(seed)}
          onRegen={() => void engine.regenerate()}
        />
      )}
    </div>
  )
}
