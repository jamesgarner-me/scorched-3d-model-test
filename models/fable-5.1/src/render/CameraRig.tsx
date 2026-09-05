import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Tank } from '../sim/match'
import { store, useStore } from '../state/store'
import { game } from '../state/game'
import { sampleTrajectory } from './Projectile'

const v = (p: { x: number; y: number; z: number }) => new THREE.Vector3(p.x, p.y, p.z)
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

function aimPose(tank: Tank, bearing: number) {
  const f = tank.frame
  const flat = v(f.north).multiplyScalar(Math.cos(bearing)).addScaledVector(v(f.east), Math.sin(bearing))
  const up = v(f.up)
  const pos = v(tank.pos)
  return {
    eye: pos.clone().addScaledVector(flat, -11).addScaledVector(up, 5.5),
    target: pos.clone().addScaledVector(flat, 6).addScaledVector(up, 1.5),
    up,
  }
}

/**
 * Camera director: flyover, smooth transitions into an over-the-shoulder aim
 * view (then free orbit around the tank), cinematic projectile follow, impact
 * linger, and shake. The camera's up vector always follows the local surface
 * normal so the horizon stays level anywhere on the sphere.
 */
export function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera } = useThree()
  const intent = useStore((s) => s.camera)
  const matchId = useStore((s) => s.matchId)
  const [free, setFree] = useState(false)
  // OrbitControls bakes camera.up at construction, so remount it whenever the up changes.
  const [controlsKey, setControlsKey] = useState(0)
  const mode = useRef<'flyover' | 'transition' | 'free' | 'follow' | 'linger'>('free')
  const t = useRef(0)
  const from = useRef({ eye: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) })
  const goal = useRef({ eye: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) })
  const lookTarget = useRef(new THREE.Vector3())
  const up = useRef(new THREE.Vector3(0, 1, 0))
  const shake = useRef(0)
  const flyoverStart = useRef(0)
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() }), [])

  const lookAt = (target: THREE.Vector3) => {
    camera.up.copy(up.current)
    camera.lookAt(target)
    lookTarget.current.copy(target)
  }
  const settleUp = (desired: THREE.Vector3, k: number) => {
    up.current.lerp(desired, k).normalize()
  }

  useEffect(() => {
    const s = store.get()
    const match = s.match
    if (!match) return
    const c = controls.current
    setFree(false)
    if (intent.mode === 'flyover') {
      mode.current = 'flyover'
      t.current = 0
      // Start over the sunlit hemisphere the tanks share, then sweep toward the player.
      const mid = v(match.tanks.player.pos).normalize().add(v(match.tanks.ai.pos).normalize())
      flyoverStart.current = Math.atan2(mid.z, mid.x) - Math.PI * 0.45
      up.current.set(0, 1, 0)
      return
    }
    if (intent.mode === 'free' && intent.focus) {
      const tank = match.tanks[intent.focus]
      const bearing = intent.focus === 'player' ? s.aim.bearing : tank.bearing
      from.current = { eye: camera.position.clone(), target: (c ? c.target : lookTarget.current).clone(), up: up.current.clone() }
      goal.current = aimPose(tank, bearing)
      mode.current = 'transition'
      t.current = 0
      return
    }
    if (intent.mode === 'follow') mode.current = 'follow'
    if (intent.mode === 'linger') mode.current = 'linger'
  }, [intent, matchId, camera])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const s = store.get()
    const match = s.match
    if (!match || s.paused) return
    const R = match.planet.radius
    if (s.shake > 0) { shake.current = s.shake; store.set({ shake: 0 }) }
    shake.current *= Math.exp(-dt * 2.6)

    switch (mode.current) {
      case 'flyover': {
        t.current += dt / 7.5
        const k = Math.min(1, t.current)
        const player = match.tanks.player
        const e = easeInOut(k)
        const ang = flyoverStart.current + e * Math.PI * 0.9
        const dist = R * (3.4 - 1.6 * e)
        const height = R * (1.0 - 1.2 * e)
        tmp.a.set(Math.cos(ang) * dist, height, Math.sin(ang) * dist)
        // Blend the orbit into an approach on the player's tank.
        const approach = easeInOut(Math.max(0, (k - 0.55) / 0.45))
        const pose = aimPose(player, s.aim.bearing)
        tmp.b.copy(pose.eye).addScaledVector(pose.up, 14).addScaledVector(v(player.pos).normalize(), 10)
        camera.position.lerpVectors(tmp.a, tmp.b, approach)
        tmp.c.set(0, 0, 0).lerp(v(player.pos), approach)
        settleUp(approach > 0 ? pose.up : new THREE.Vector3(0, 1, 0), Math.min(1, approach * 0.6 + dt * 0.5))
        lookAt(tmp.c)
        if (k >= 1) game.skipFlyover()
        break
      }
      case 'transition': {
        t.current += dt / 1.3
        const k = easeInOut(Math.min(1, t.current))
        camera.position.lerpVectors(from.current.eye, goal.current.eye, k)
        up.current.lerpVectors(from.current.up, goal.current.up, k).normalize()
        lookAt(tmp.a.lerpVectors(from.current.target, goal.current.target, k))
        if (t.current >= 1) {
          mode.current = 'free'
          up.current.copy(goal.current.up)
          camera.up.copy(up.current)
          setControlsKey((n) => n + 1)
          setFree(true)
        }
        break
      }
      case 'free':
        break
      case 'follow': {
        const shot = s.shot
        if (!shot) break
        const simTime = (s.time - shot.startedAt) * shot.timeScale
        const p = sampleTrajectory(shot.trajectory, simTime, tmp.a)
        const prev = sampleTrajectory(shot.trajectory, Math.max(0, simTime - 0.2), tmp.b)
        const vel = tmp.c.subVectors(p, prev)
        const localUp = p.clone().normalize()
        const altitude = p.length() - R
        const speedDir = vel.lengthSq() > 1e-6 ? vel.normalize() : localUp.clone()
        const back = 9 + Math.min(30, altitude * 0.35)
        const goalEye = p.clone().addScaledVector(speedDir, -back).addScaledVector(localUp, 4 + Math.min(12, altitude * 0.2))
        // Keep the camera out of the ground.
        const ground = Math.max(match.planet.radiusAt({ x: goalEye.x, y: goalEye.y, z: goalEye.z }), match.planet.waterRadius) + 1.5
        if (goalEye.length() < ground) goalEye.setLength(ground)
        camera.position.lerp(goalEye, 1 - Math.exp(-dt * 4))
        settleUp(localUp, 1 - Math.exp(-dt * 3))
        lookAt(lookTarget.current.lerp(p, 1 - Math.exp(-dt * 8)))
        break
      }
      case 'linger': {
        const impact = s.camera.impact
        if (!impact) break
        const ip = v(impact)
        const localUp = ip.clone().normalize()
        const away = camera.position.clone().sub(ip)
        const dist = away.length()
        const goalEye = ip.clone().addScaledVector(away.normalize(), Math.max(12, Math.min(dist, 24))).addScaledVector(localUp, 5)
        const ground = Math.max(match.planet.radiusAt({ x: goalEye.x, y: goalEye.y, z: goalEye.z }), match.planet.waterRadius) + 1.5
        if (goalEye.length() < ground) goalEye.setLength(ground)
        camera.position.lerp(goalEye, 1 - Math.exp(-dt * 1.5))
        settleUp(localUp, 1 - Math.exp(-dt * 3))
        lookAt(lookTarget.current.lerp(ip, 1 - Math.exp(-dt * 6)))
        break
      }
    }
    if (shake.current > 0.01) {
      const a = shake.current * 0.5
      camera.position.x += (Math.random() - 0.5) * a
      camera.position.y += (Math.random() - 0.5) * a
      camera.position.z += (Math.random() - 0.5) * a
    }
  })

  const maxDistance = useStore((s) => (s.match ? s.match.planet.radius * 5 : 500))

  return (
    <OrbitControls
      key={controlsKey}
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      rotateSpeed={0.7}
      zoomSpeed={0.9}
      panSpeed={0.7}
      minDistance={2.5}
      maxDistance={maxDistance}
      enabled={free}
      target={goal.current.target}
    />
  )
}
