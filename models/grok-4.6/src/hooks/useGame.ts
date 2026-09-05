import { useEffect, useMemo, useState } from 'react'
import { MatchEngine, type Snapshot } from '../game/match.ts'
import type { InputState } from '../game/types.ts'

const emptyInput = (): InputState => ({
  left: false,
  right: false,
  up: false,
  down: false,
  space: false,
})

export function useGame() {
  const engine = useMemo(() => new MatchEngine(), [])
  const input = useMemo(() => emptyInput(), [])
  const [snap, setSnap] = useState<Snapshot>(() => engine.getSnapshot())

  useEffect(() => engine.subscribe(() => setSnap(engine.getSnapshot())), [engine])

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft') input.left = true
      if (e.code === 'ArrowRight') input.right = true
      if (e.code === 'ArrowUp') input.up = true
      if (e.code === 'ArrowDown') input.down = true
      if (e.code === 'Space') input.space = true
      if (e.code === 'Escape') engine.togglePause()
      if (e.code === 'Backquote') engine.setDebug(!engine.getSnapshot().debug)
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
        e.preventDefault()
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft') input.left = false
      if (e.code === 'ArrowRight') input.right = false
      if (e.code === 'ArrowUp') input.up = false
      if (e.code === 'ArrowDown') input.down = false
      if (e.code === 'Space') input.space = false
    }
    window.addEventListener('keydown', onDown, { passive: false })
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [engine, input])

  return { engine, snap, input }
}
