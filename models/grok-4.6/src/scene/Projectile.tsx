import { useMemo } from 'react'
import { CatmullRomCurve3, Vector3 } from 'three'
import type { ShotPath } from '../game/types.ts'
import { shotPosition } from './shotMath.ts'

export function Projectile({ shot }: { shot: ShotPath }) {
  const pos = shotPosition(shot)
  const trail = useMemo(() => {
    const t = shot.duration <= 0 ? 1 : Math.min(1, shot.elapsed / shot.duration)
    const end = Math.max(1, Math.floor(t * shot.path.length))
    const start = Math.max(0, end - 18)
    return shot.path.slice(start, end + 1).map((p) => new Vector3(...p))
  }, [shot])
  const color = shot.side === 'player' ? '#f4c56a' : '#ff7048'
  return (
    <group>
      <mesh position={pos}>
        <sphereGeometry args={[0.28, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <pointLight position={pos} color={color} intensity={18} distance={12} />
      {trail.length > 1 && (
        <mesh>
          <tubeGeometry args={[new CatmullRomCurve3(trail), 24, 0.07, 5, false]} />
          <meshBasicMaterial color={color} transparent opacity={0.45} />
        </mesh>
      )}
    </group>
  )
}
