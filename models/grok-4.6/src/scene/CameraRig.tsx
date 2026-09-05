import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Vector3 } from 'three'
import type { Snapshot } from '../game/match.ts'
import { shotPosition } from './shotMath.ts'
import { localFrame, lerpVec } from '../game/math.ts'

export function CameraRig({ snap }: { snap: Snapshot }) {
  const controls = useRef<{ target: Vector3; enabled: boolean } | null>(null)
  const { camera } = useThree()
  const shake = useRef(0)
  const settled = useRef(false)

  useEffect(() => {
    settled.current = false
  }, [snap.seed])

  useEffect(() => {
    if (snap.phase === 'playerTurn') settled.current = false
  }, [snap.phase])

  useEffect(() => {
    if (snap.effect?.kind === 'destruction') shake.current = 0.55
  }, [snap.effect])

  useFrame((_, dt) => {
    const radius = snap.radius
    const player = snap.player.position
    const frame = localFrame(player)

    if (snap.phase === 'flyover') {
      const t = Math.min(1, snap.flyoverT / 4.2)
      const ang = t * Math.PI * 1.35
      const dist = radius * (3.4 - t * 1.55)
      const target = lerpVec([0, 0, 0], player, t * 0.72)
      camera.position.set(
        Math.cos(ang) * dist,
        radius * (0.55 + (1 - t) * 0.8),
        Math.sin(ang) * dist,
      )
      camera.lookAt(target[0], target[1], target[2])
      if (controls.current) {
        controls.current.target.set(target[0], target[1], target[2])
        controls.current.enabled = false
      }
      return
    }

    if ((snap.phase === 'playerTurn' || snap.phase === 'charging') && !settled.current) {
      const pos: [number, number, number] = [
        player[0] + frame.up[0] * radius * 0.55 + frame.east[0] * radius * 0.35,
        player[1] + frame.up[1] * radius * 0.55 + frame.east[1] * radius * 0.35,
        player[2] + frame.up[2] * radius * 0.55 + frame.east[2] * radius * 0.35,
      ]
      camera.position.lerp(new Vector3(...pos), 1 - Math.pow(0.001, dt))
      camera.lookAt(player[0], player[1], player[2])
      if (controls.current) {
        controls.current.target.set(player[0], player[1], player[2])
        controls.current.enabled = false
      }
      if (camera.position.distanceTo(new Vector3(...pos)) < radius * 0.08) {
        settled.current = true
        if (controls.current) controls.current.enabled = true
      }
      return
    }

    if (snap.phase === 'inFlight' && snap.shot) {
      const p = shotPosition(snap.shot)
      const back = localFrame(p)
      const range = Math.hypot(p[0], p[1], p[2])
      const pull = Math.min(range * 0.35, snap.radius * 0.45)
      camera.position.lerp(
        new Vector3(
          p[0] + back.up[0] * 12 + back.east[0] * 8 - p[0] * (pull / range),
          p[1] + back.up[1] * 12 + back.east[1] * 8 - p[1] * (pull / range),
          p[2] + back.up[2] * 12 + back.east[2] * 8 - p[2] * (pull / range),
        ),
        1 - Math.pow(0.05, dt),
      )
      camera.lookAt(p[0] * 0.55, p[1] * 0.55, p[2] * 0.55)
      if (controls.current) {
        controls.current.target.set(p[0] * 0.55, p[1] * 0.55, p[2] * 0.55)
        controls.current.enabled = false
      }
      return
    }

    if (snap.phase === 'resolving' && snap.shot) {
      const impact = snap.shot.impact
      camera.lookAt(impact[0], impact[1], impact[2])
      if (controls.current) {
        controls.current.target.set(impact[0], impact[1], impact[2])
        controls.current.enabled = false
      }
    }

    if (snap.phase === 'destruction') {
      const wreck = snap.winner === 'player' ? snap.enemy.position : snap.player.position
      camera.lookAt(wreck[0], wreck[1], wreck[2])
      if (controls.current) {
        controls.current.target.set(wreck[0], wreck[1], wreck[2])
        controls.current.enabled = false
      }
    } else if (controls.current) {
      controls.current.enabled = snap.phase !== 'ended'
    }

    if (shake.current > 0) {
      shake.current = Math.max(0, shake.current - dt)
      camera.position.x += (Math.random() - 0.5) * shake.current * 1.2
      camera.position.y += (Math.random() - 0.5) * shake.current * 1.2
    }
  })

  return (
    <OrbitControls
      ref={controls as never}
      enableDamping
      dampingFactor={0.07}
      minDistance={snap.radius * 1.18}
      maxDistance={snap.radius * 5.2}
      zoomSpeed={0.85}
      rotateSpeed={0.72}
      panSpeed={0.55}
      enablePan
    />
  )
}
