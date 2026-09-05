import { Stars } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { game } from '../state/game'
import { store, useStore } from '../state/store'
import { CameraRig } from './CameraRig'
import { Effects } from './Effects'
import { Guide } from './Guide'
import { Atmosphere, Clouds, Sun, Water } from './PlanetVisuals'
import { Projectile } from './Projectile'
import { TankMesh } from './Tank'
import { Terrain } from './Terrain'

/** Advances the game clock each frame and samples frame-time metrics. */
function FrameDriver() {
  const acc = useRef({ frames: 0, time: 0, worst: 0 })
  useFrame((_, dt) => {
    game.update(Math.min(dt, 0.1))
    const a = acc.current
    a.frames++
    a.time += dt
    a.worst = Math.max(a.worst, dt)
    if (a.time >= 0.5) {
      const fps = a.frames / a.time
      const frameMs = (a.time / a.frames) * 1000
      store.set((s) => ({ metrics: { ...s.metrics, fps: Math.round(fps), frameMs: Math.round(frameMs * 10) / 10 } }))
      acc.current = { frames: 0, time: 0, worst: 0 }
    }
  })
  return null
}

function World() {
  const match = useStore((s) => s.match)
  const matchId = useStore((s) => s.matchId)
  // Light the hemisphere both tanks share so the fight is never in the dark.
  const sunDir = useMemo(() => {
    if (!match) return new THREE.Vector3(1, 0.35, 0.55)
    const a = new THREE.Vector3().copy(match.tanks.player.pos as THREE.Vector3).normalize()
    const b = new THREE.Vector3().copy(match.tanks.ai.pos as THREE.Vector3).normalize()
    const side = new THREE.Vector3().crossVectors(a, b).normalize()
    return a.add(b).normalize().addScaledVector(side, 0.55).normalize()
  }, [match])
  if (!match) return null
  const planet = match.planet
  return (
    <group key={matchId}>
      <directionalLight position={sunDir.clone().multiplyScalar(1000)} intensity={2.6} color="#fff6e6" />
      <ambientLight intensity={0.3} color={planet.preset.colors.ambient} />
      <hemisphereLight args={[planet.preset.colors.skyLight, planet.preset.colors.groundLight, 0.5]} />
      <Sun direction={sunDir} />
      <Terrain planet={planet} />
      <Water planet={planet} />
      <Clouds planet={planet} />
      <Atmosphere planet={planet} />
      <TankMesh tank={match.tanks.player} />
      <TankMesh tank={match.tanks.ai} />
      <Guide />
      <Projectile />
      <Effects />
    </group>
  )
}

export function Scene() {
  const preset = useStore((s) => s.match?.planet.preset.colors.sky ?? '#02040a')
  return (
    <Canvas
      camera={{ fov: 50, near: 0.2, far: 20000, position: [0, 80, 260] }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
      style={{ position: 'absolute', inset: 0, background: preset }}
    >
      <color attach="background" args={[preset]} />
      <Stars radius={4000} depth={800} count={5000} factor={12} saturation={0.1} fade speed={0} />
      <World />
      <CameraRig />
      <FrameDriver />
    </Canvas>
  )
}
