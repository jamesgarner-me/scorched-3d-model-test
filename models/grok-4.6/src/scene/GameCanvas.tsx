import { Canvas, useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import { Color } from 'three'
import type { MatchEngine, Snapshot } from '../game/match.ts'
import type { InputState } from '../game/types.ts'
import { PlanetMesh } from './PlanetMesh.tsx'
import { Atmosphere } from './Atmosphere.tsx'
import { Water } from './Water.tsx'
import { Clouds, DustHaze } from './Clouds.tsx'
import { TankMesh } from './TankMesh.tsx'
import { Projectile } from './Projectile.tsx'
import { TrajectoryGuide } from './TrajectoryGuide.tsx'
import { Effects } from './Effects.tsx'
import { CameraRig } from './CameraRig.tsx'

function SimTicker({
  engine,
  input,
}: {
  engine: MatchEngine
  input: InputState
}) {
  useFrame((_, dt) => {
    engine.tick(Math.min(0.05, dt), input)
  })
  return null
}

export function GameCanvas({
  engine,
  snap,
  input,
}: {
  engine: MatchEngine
  snap: Snapshot
  input: InputState
}) {
  const planet = engine.planet
  if (!planet) return null
  const fog = planet.preset === 'earth' ? '#071018' : '#140b07'
  const sun = planet.preset === 'earth' ? '#fff4d8' : '#ffd0a0'
  const wreckedPlayer = snap.player.health <= 0
  const wreckedEnemy = snap.enemy.health <= 0
  const showGuide =
    (snap.phase === 'playerTurn' || snap.phase === 'charging') && snap.guide.length > 1

  return (
    <Canvas
      camera={{ position: [0, planet.baseRadius * 2.6, planet.baseRadius * 2.2], fov: 48, near: 0.1, far: 2000 }}
      onCreated={({ scene }) => {
        scene.background = new Color(fog)
        scene.fog = null
      }}
    >
      <color attach="background" args={[fog]} />
      <ambientLight intensity={planet.preset === 'earth' ? 0.28 : 0.22} />
      <hemisphereLight
        args={planet.preset === 'earth' ? ['#9ecbff', '#1a2a18', 0.45] : ['#ffb07a', '#3a1c10', 0.4]}
      />
      <directionalLight
        position={[planet.baseRadius * 2.4, planet.baseRadius * 1.8, planet.baseRadius * 1.2]}
        intensity={2.1}
        color={sun}
      />
      <Stars radius={planet.baseRadius * 18} depth={40} count={1800} factor={3} fade speed={0.4} />
      <PlanetMesh planet={planet} version={snap.planetVersion} />
      <Water planet={planet} />
      <Clouds planet={planet} />
      <DustHaze planet={planet} />
      <Atmosphere radius={planet.baseRadius} preset={planet.preset} />
      <TankMesh tank={snap.player} wrecked={wreckedPlayer} />
      <TankMesh tank={snap.enemy} wrecked={wreckedEnemy} />
      {showGuide && <TrajectoryGuide points={snap.guide} />}
      {snap.shot && snap.phase === 'inFlight' && <Projectile shot={snap.shot} />}
      <Effects event={snap.effect} />
      <CameraRig snap={snap} />
      <SimTicker engine={engine} input={input} />
    </Canvas>
  )
}
