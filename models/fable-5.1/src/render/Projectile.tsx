import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Trajectory } from '../sim/physics'
import { store } from '../state/store'

const TRAIL = 36

/** Sample the precomputed trajectory at a sim time. */
export function sampleTrajectory(t: Trajectory, simTime: number, out: THREE.Vector3): THREE.Vector3 {
  const f = Math.min(t.count - 1, Math.max(0, simTime / t.dt))
  const i = Math.floor(f)
  const j = Math.min(t.count - 1, i + 1)
  const k = f - i
  const p = t.points
  out.set(
    p[i * 3] + (p[j * 3] - p[i * 3]) * k,
    p[i * 3 + 1] + (p[j * 3 + 1] - p[i * 3 + 1]) * k,
    p[i * 3 + 2] + (p[j * 3 + 2] - p[i * 3 + 2]) * k,
  )
  return out
}

export function Projectile() {
  const mesh = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const line = useRef<THREE.Line>(null)
  const trail = useMemo(() => new Float32Array(TRAIL * 3), [])
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(trail, 3))
    return g
  }, [trail])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const lastShot = useRef(0)

  useFrame(() => {
    const s = store.get()
    const shot = s.shot
    const m = mesh.current, l = line.current
    if (!m || !l) return
    if (!shot) {
      m.visible = false
      l.visible = false
      return
    }
    const simTime = (s.time - shot.startedAt) * shot.timeScale
    sampleTrajectory(shot.trajectory, simTime, tmp)
    m.visible = true
    l.visible = true
    m.position.copy(tmp)
    if (light.current) light.current.position.copy(tmp)
    if (lastShot.current !== shot.id) {
      lastShot.current = shot.id
      for (let i = 0; i < TRAIL; i++) trail.set([tmp.x, tmp.y, tmp.z], i * 3)
    } else {
      trail.copyWithin(3, 0, (TRAIL - 1) * 3)
      trail[0] = tmp.x; trail[1] = tmp.y; trail[2] = tmp.z
    }
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute
    attr.needsUpdate = true
    geometry.computeBoundingSphere()
  })

  return (
    <group>
      <mesh ref={mesh} visible={false}>
        <sphereGeometry args={[0.32, 16, 12]} />
        <meshStandardMaterial color="#ffd27a" emissive="#ff9a3c" emissiveIntensity={2.5} />
      </mesh>
      <pointLight ref={light} intensity={30} distance={25} color="#ffb060" />
      {/* @ts-expect-error three Line vs SVG line typing clash in JSX */}
      <line ref={line} geometry={geometry} visible={false} frustumCulled={false}>
        <lineBasicMaterial color="#ffc477" transparent opacity={0.7} />
      </line>
    </group>
  )
}
