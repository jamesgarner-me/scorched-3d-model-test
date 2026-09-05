import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { perf } from '../game/perf';
import { useGame } from '../state/store';
import { DEG } from '../game/vec';
import { CameraRig } from './CameraRig';
import { Explosion } from './Explosion';
import { focus, resetPan } from './focus';
import { Ocean, PlanetMesh } from './PlanetMesh';
import { Projectile } from './Projectile';
import { Atmosphere, Clouds, Starfield } from './Sky';
import { TankModel } from './TankModel';
import { TrajectoryGuide } from './TrajectoryGuide';

const FLYOVER_SECONDS = 5;

export function Scene() {
  const match = useGame((s) => s.match);
  const phase = useGame((s) => s.phase);
  const activeShot = useGame((s) => s.activeShot);
  const blast = useGame((s) => s.blast);
  const matchVersion = useGame((s) => s.matchVersion);
  const onShotLanded = useGame((s) => s.onShotLanded);
  const flyoverClock = useRef(0);
  const { scene } = useThree();

  const planet = match?.planet ?? null;

  useEffect(() => {
    if (!planet) return;
    scene.background = new THREE.Color(planet.preset.sky.color);
  }, [planet, scene]);

  // A fresh planet: drop the camera straight into the opening flyover.
  useEffect(() => {
    if (!match) return;
    flyoverClock.current = 0;
    focus.immediate = true;
    focus.target.set(0, 0, 0);
    focus.distance = match.planet.radius * 3.2;
    resetPan();
  }, [matchVersion, match]);

  // At the start of your turn, settle behind the turret so the shot reads immediately.
  useEffect(() => {
    if (!match || phase !== 'aim') return;
    focus.snapAzimuth = (match.tanks.player.bearing + 205) * DEG;
    focus.snapPolar = 1.06;
    resetPan();
  }, [phase, match]);

  useFrame((_, delta) => {
    perf.frameMillis = delta * 1000;
    perf.fps = delta > 0 ? 1 / delta : 0;
    if (!match) return;
    const player = match.tanks.player;

    if (phase === 'flyover') {
      // Cinematic sweep: a wide orbit that descends and closes onto your tank.
      flyoverClock.current += delta;
      const t = Math.min(flyoverClock.current / FLYOVER_SECONDS, 1);
      const eased = t * t * (3 - 2 * t);
      focus.snapAzimuth = (player.bearing + 205) * DEG + (1 - eased) * Math.PI * 2.1;
      focus.snapPolar = 0.55 + eased * 0.47;
      focus.up.lerp(new THREE.Vector3(player.frame.up.x, player.frame.up.y, player.frame.up.z), 0.05);
      focus.target.lerp(
        new THREE.Vector3(player.position.x, player.position.y, player.position.z).multiplyScalar(eased),
        0.06,
      );
      focus.distance = match.planet.radius * 3.2 * (1 - eased) + 26 * eased;
      focus.urgency = 1;
      return;
    }

    if (phase === 'flight') return; // The shell drives the camera while it is airborne.

    focus.urgency = 1;
    if ((phase === 'impact' || phase === 'gameover') && blast) {
      focus.target.set(blast.position.x, blast.position.y, blast.position.z);
      focus.up.set(blast.dir.x, blast.dir.y, blast.dir.z).normalize();
      focus.distance = blast.fatal ? 32 : 30;
      return;
    }

    focus.target.set(player.position.x, player.position.y, player.position.z);
    focus.up.set(player.frame.up.x, player.frame.up.y, player.frame.up.z).normalize();
    focus.distance = 26;
  });

  if (!match || !planet) return null;
  const sunDirection = new THREE.Vector3(0.72, 0.52, 0.46).normalize().multiplyScalar(planet.radius * 9);

  return (
    <>
      <CameraRig maxDistance={planet.radius * 5} />
      <ambientLight intensity={planet.preset.ambient} />
      <hemisphereLight
        color={planet.preset.atmosphere.color}
        groundColor={planet.preset.palette.mid}
        intensity={0.3}
      />
      <directionalLight position={sunDirection} intensity={2.4} color={planet.preset.sunColor} />

      <Starfield planet={planet} />
      <PlanetMesh planet={planet} />
      <Ocean planet={planet} />
      <Clouds planet={planet} />
      <Atmosphere planet={planet} />

      <TankModel tank={match.tanks.player} color="#2f6fb5" accent="#63c9ff" label="player-tank" />
      <TankModel tank={match.tanks.ai} color="#a33528" accent="#ff8a5c" label="ai-tank" />

      {(phase === 'aim' || phase === 'charging') && <TrajectoryGuide match={match} />}

      {activeShot && (
        <Projectile
          key={`${matchVersion}:${activeShot.shooter}:${activeShot.path.flightTime}`}
          path={activeShot.path}
          planetRadius={planet.radius}
          onLanded={onShotLanded}
        />
      )}

      {blast && (
        <Explosion
          key={blast.id}
          blast={blast}
          gravity={planet.preset.gravity}
          onDone={() => undefined}
        />
      )}
    </>
  );
}
