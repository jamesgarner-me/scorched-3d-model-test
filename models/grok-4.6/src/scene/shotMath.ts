import { lerpVec } from '../game/math.ts'
import type { ShotPath } from '../game/types.ts'

export function shotPosition(shot: ShotPath): [number, number, number] {
  const t = shot.duration <= 0 ? 1 : Math.min(1, shot.elapsed / shot.duration)
  const f = t * (shot.path.length - 1)
  const i = Math.min(shot.path.length - 2, Math.max(0, Math.floor(f)))
  const local = f - i
  const a = shot.path[i]!
  const b = shot.path[i + 1] ?? a
  return lerpVec(a, b, local)
}
