import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Tank as TankState } from '../sim/match'
import { store } from '../state/store'

const shortestDelta = (from: number, to: number) => {
  let d = (to - from) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

/** A tank seated on the surface: hull, turret and a barrel driven by the aim state. */
export function TankMesh({ tank }: { tank: TankState }) {
  const isPlayer = tank.id === 'player'
  const turret = useRef<THREE.Group>(null)
  const barrel = useRef<THREE.Group>(null)
  const root = useRef<THREE.Group>(null)
  const smoothed = useRef({ bearing: tank.bearing, elevation: tank.elevation })
  const quaternion = useMemo(() => {
    const f = tank.frame
    const m = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(f.east.x, f.east.y, f.east.z),
      new THREE.Vector3(f.up.x, f.up.y, f.up.z),
      new THREE.Vector3(-f.north.x, -f.north.y, -f.north.z),
    )
    return new THREE.Quaternion().setFromRotationMatrix(m)
  }, [tank.frame])

  useFrame((_, dt) => {
    const s = store.get()
    const target = isPlayer ? s.aim : s.aiAim
    const sm = smoothed.current
    const k = 1 - Math.exp(-dt * (isPlayer ? 18 : 5))
    sm.bearing += shortestDelta(sm.bearing, target.bearing) * k
    sm.elevation += (target.elevation - sm.elevation) * k
    if (turret.current) turret.current.rotation.y = -sm.bearing
    if (barrel.current) barrel.current.rotation.x = sm.elevation
    if (root.current && !tank.alive) {
      // Destroyed: settle into a slumped pose.
      root.current.rotation.z = THREE.MathUtils.lerp(root.current.rotation.z, 0.18, dt * 2)
    }
  })

  const body = isPlayer ? '#3f7fd6' : '#d1533c'
  const dark = isPlayer ? '#22447a' : '#6e2a1d'
  const dead = !tank.alive
  const bodyColor = dead ? '#2a2623' : body
  const darkColor = dead ? '#1a1715' : dark

  return (
    <group position={[tank.pos.x, tank.pos.y, tank.pos.z]} quaternion={quaternion}>
      <group ref={root}>
        {/* tracks */}
        <mesh position={[-0.75, 0.22, 0]}>
          <boxGeometry args={[0.42, 0.44, 2.3]} />
          <meshStandardMaterial color={darkColor} roughness={0.9} />
        </mesh>
        <mesh position={[0.75, 0.22, 0]}>
          <boxGeometry args={[0.42, 0.44, 2.3]} />
          <meshStandardMaterial color={darkColor} roughness={0.9} />
        </mesh>
        {/* hull */}
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1.4, 0.5, 2.1]} />
          <meshStandardMaterial color={bodyColor} roughness={0.6} metalness={0.25} />
        </mesh>
        {/* turret */}
        <group ref={turret} position={[0, 0.78, 0]}>
          <mesh>
            <sphereGeometry args={[0.52, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} metalness={0.3} />
          </mesh>
          <group ref={barrel} position={[0, 0.2, 0]}>
            <mesh position={[0, 0, -0.85]} rotation={[-Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.09, 0.12, 1.5, 12]} />
              <meshStandardMaterial color={dead ? '#1a1715' : '#2b2f36'} roughness={0.4} metalness={0.6} />
            </mesh>
          </group>
        </group>
        {/* team light so tanks are findable on the night side */}
        {!dead && <pointLight position={[0, 1.6, 0]} intensity={4} distance={9} color={isPlayer ? '#7fb4ff' : '#ff8a6a'} />}
      </group>
    </group>
  )
}
