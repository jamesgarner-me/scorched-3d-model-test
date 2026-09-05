import { useMemo } from 'react'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { localFrame } from '../game/math.ts'
import type { TankPublic } from '../game/match.ts'

function tankQuaternion(dir: TankPublic['dir']): Quaternion {
  const frame = localFrame(dir)
  const m = new Matrix4().makeBasis(
    new Vector3(...frame.east),
    new Vector3(...frame.up),
    new Vector3(...frame.north),
  )
  return new Quaternion().setFromRotationMatrix(m)
}

export function TankMesh({ tank, wrecked }: { tank: TankPublic; wrecked: boolean }) {
  const q = useMemo(() => tankQuaternion(tank.dir), [tank.dir])
  const isPlayer = tank.side === 'player'
  const hull = isPlayer ? '#c4a15a' : '#b8432a'
  const trim = isPlayer ? '#2c2416' : '#2a100c'
  const accent = isPlayer ? '#f0c36a' : '#ff7a4a'
  if (wrecked) {
    return (
      <group position={tank.position} quaternion={q} scale={1.85}>
        <mesh position={[0, 0.15, 0]} rotation={[0.4, 0.6, 0.2]} castShadow>
          <boxGeometry args={[1.5, 0.35, 1.05]} />
          <meshStandardMaterial color="#2a1c14" roughness={0.95} />
        </mesh>
      </group>
    )
  }
  return (
    <group position={tank.position} quaternion={q} scale={1.85}>
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[1.7, 0.42, 1.2]} />
        <meshStandardMaterial color={hull} roughness={0.55} metalness={0.18} />
      </mesh>
      <mesh position={[0, 0.18, 0.15]} castShadow>
        <boxGeometry args={[1.9, 0.22, 1.4]} />
        <meshStandardMaterial color={trim} roughness={0.8} />
      </mesh>
      <group rotation={[0, tank.bearing, 0]}>
        <mesh position={[0, 0.62, 0]} castShadow>
          <cylinderGeometry args={[0.38, 0.46, 0.34, 10]} />
          <meshStandardMaterial color={accent} roughness={0.4} metalness={0.25} />
        </mesh>
        <group position={[0, 0.68, 0]} rotation={[-tank.elevation, 0, 0]}>
          <mesh position={[0, 0, 0.85]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.12, 1.7, 8]} />
            <meshStandardMaterial color="#1b1712" metalness={0.4} roughness={0.35} />
          </mesh>
        </group>
      </group>
      <pointLight color={accent} intensity={4.5} distance={6} position={[0, 1.1, 0]} />
    </group>
  )
}

