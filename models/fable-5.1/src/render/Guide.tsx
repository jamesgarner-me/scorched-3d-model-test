import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { tune } from '../sim/tuning'
import { store } from '../state/store'

const DOTS = 56

/**
 * Trajectory guide: a fading dotted arc from the muzzle covering only the first
 * part of the flight. Uses the same simulation as the live shot, then throws
 * away everything after the guide fraction so the landing point is never shown.
 */
export function Guide() {
  const inst = useRef<THREE.InstancedMesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const last = useRef({ bearing: NaN, elevation: NaN, power: NaN, version: -1, matchId: -1 })

  useFrame(() => {
    const s = store.get()
    const m = inst.current
    if (!m) return
    const show = s.phase === 'aim' && s.match && !s.paused
    m.visible = !!show
    if (!show || !s.match) return
    if (mat.current) mat.current.opacity = tune('guideOpacity')
    const { bearing, elevation, power } = s.aim
    const l = last.current
    if (l.bearing === bearing && l.elevation === elevation && l.power === power && l.version === s.planetVersion && l.matchId === s.matchId) return
    last.current = { bearing, elevation, power, version: s.planetVersion, matchId: s.matchId }
    const traj = s.match.preview('player', { bearing, elevation, power })
    const shown = Math.max(2, Math.floor(traj.count * tune('guideFraction')))
    const p = traj.points
    for (let i = 0; i < DOTS; i++) {
      const t = i / (DOTS - 1)
      const idx = Math.min(shown - 1, Math.floor(t * (shown - 1)))
      dummy.position.set(p[idx * 3], p[idx * 3 + 1], p[idx * 3 + 2])
      const scale = 0.16 * (1 - t * 0.6)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      color.setHSL(0.12 - t * 0.08, 0.9, 0.75 - t * 0.2)
      m.setColorAt(i, color)
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={inst} args={[undefined, undefined, DOTS]} frustumCulled={false} visible={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial ref={mat} transparent opacity={0.45} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  )
}
