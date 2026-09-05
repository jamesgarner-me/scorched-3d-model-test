import { useEffect } from 'react'
import { unlockAudio } from '../audio/sound'
import { game } from '../state/game'
import { store } from '../state/store'

const AIM_KEYS: Record<string, 'left' | 'right' | 'up' | 'down'> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
}

/** Keyboard bindings: arrows aim, Space charges/fires, Esc pauses, ` toggles debug. */
export function useInput() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const s = store.get()
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      unlockAudio()
      if (e.key === 'Escape') { e.preventDefault(); game.togglePause(); return }
      if (e.key === '`' || e.key === 'F3') { e.preventDefault(); game.toggleDebug(); return }
      if (s.phase === 'flyover' && !e.repeat) { e.preventDefault(); game.skipFlyover(); return }
      if (s.phase === 'over' && (e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); game.newMatch(); return }
      const aimKey = AIM_KEYS[e.key]
      if (aimKey) { e.preventDefault(); game.setHeld(aimKey, true); return }
      if (e.key === ' ') { e.preventDefault(); if (!e.repeat) game.beginCharge() }
    }
    const up = (e: KeyboardEvent) => {
      const aimKey = AIM_KEYS[e.key]
      if (aimKey) { game.setHeld(aimKey, false); return }
      if (e.key === ' ') game.releaseFire()
    }
    const blur = () => {
      ;(['left', 'right', 'up', 'down'] as const).forEach((k) => game.setHeld(k, false))
      game.releaseFire()
    }
    const click = () => {
      unlockAudio()
      if (store.get().phase === 'flyover') game.skipFlyover()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    window.addEventListener('pointerdown', click)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      window.removeEventListener('pointerdown', click)
    }
  }, [])
}
