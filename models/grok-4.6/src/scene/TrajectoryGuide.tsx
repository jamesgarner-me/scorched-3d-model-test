import { Line } from '@react-three/drei'
import type { Vec3 } from '../game/math.ts'
import { tuning } from '../game/tuning.ts'

export function TrajectoryGuide({ points }: { points: Vec3[] }) {
  if (points.length < 2) return null
  return (
    <Line
      points={points.map((p) => [p[0], p[1], p[2]] as [number, number, number])}
      color="#f0b45a"
      transparent
      opacity={tuning.get('guideOpacity')}
      lineWidth={2.2}
    />
  )
}
