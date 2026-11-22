import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { PlanetWorld } from '../../simulation/planet';
import {
  GamePhase,
  ImpactOutcome,
  TankState,
  TrajectoryPoint,
  TurnOwner,
  Vec3,
} from '../../simulation/types';
import { ActiveProjectile, ImpactExplosion, TrajectoryGuide } from './EffectsAndGuide';
import { PlanetMesh } from './PlanetMesh';
import { TankModel } from './TankModel';

interface GameCanvasProps {
  planet: PlanetWorld;
  cratersVersion: number;
  tanks: Record<TurnOwner, TankState>;
  currentTurn: TurnOwner;
  phase: GamePhase;
  previewPoints: Vec3[];
  guideOpacity: number;
  activeTrajectory: TrajectoryPoint[];
  flightProgressIndex: number;
  lastImpact: ImpactOutcome | null;
  cameraFocusRequest: number;
  onCraterMeshUpdated: (ms: number) => void;
  onFrameSample: (fps: number, frameTimeMs: number) => void;
}

interface CameraDirectorProps {
  planet: PlanetWorld;
  tanks: Record<TurnOwner, TankState>;
  phase: GamePhase;
  activeTrajectory: TrajectoryPoint[];
  flightProgressIndex: number;
  lastImpact: ImpactOutcome | null;
  cameraFocusRequest: number;
  onFrameSample: (fps: number, frameTimeMs: number) => void;
}

const CameraDirector: React.FC<CameraDirectorProps> = ({
  planet,
  tanks,
  phase,
  activeTrajectory,
  flightProgressIndex,
  lastImpact,
  cameraFocusRequest,
  onFrameSample,
}) => {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const flyoverAngleRef = useRef(0);
  const frameCounterRef = useRef({ count: 0, accDelta: 0, lastReport: 0 });
  const prevPhaseRef = useRef<GamePhase>(phase);
  const lastFocusReqRef = useRef<number>(cameraFocusRequest);

  // Snap or smoothly settle camera behind player tank when entering aiming phase or on user focus request
  useEffect(() => {
    const enteringInitialAim = prevPhaseRef.current === 'flyover' && phase === 'aiming';
    const focusRequested = cameraFocusRequest !== lastFocusReqRef.current;

    prevPhaseRef.current = phase;
    lastFocusReqRef.current = cameraFocusRequest;

    if (enteringInitialAim || focusRequested) {
      const pTank = tanks.player;
      const bearingRad = (pTank.bearingDeg * Math.PI) / 180;
      const forward = new THREE.Vector3(
        pTank.frame.north.x * Math.cos(bearingRad) +
          pTank.frame.east.x * Math.sin(bearingRad),
        pTank.frame.north.y * Math.cos(bearingRad) +
          pTank.frame.east.y * Math.sin(bearingRad),
        pTank.frame.north.z * Math.cos(bearingRad) +
          pTank.frame.east.z * Math.sin(bearingRad),
      ).normalize();

      const normal = new THREE.Vector3(pTank.normal.x, pTank.normal.y, pTank.normal.z);
      const tankPos = new THREE.Vector3(
        pTank.position.x,
        pTank.position.y,
        pTank.position.z,
      );

      // Position camera elevated behind the player's tank looking out across the planet curvature
      const desiredCamPos = tankPos
        .clone()
        .addScaledVector(normal, planet.baseRadius * 0.65)
        .addScaledVector(forward, -planet.baseRadius * 0.72);

      camera.position.copy(desiredCamPos);
      camera.up.set(0, 1, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    }
  }, [phase, cameraFocusRequest, tanks.player, planet.baseRadius, camera]);

  useFrame((state, delta) => {
    // 1. Telemetry sampling
    const fc = frameCounterRef.current;
    fc.count += 1;
    fc.accDelta += delta;
    if (state.clock.elapsedTime - fc.lastReport >= 0.45) {
      const avgDelta = fc.accDelta / Math.max(1, fc.count);
      const fps = Math.min(240, Math.round(1 / Math.max(0.001, avgDelta)));
      const frameMs = Math.round(avgDelta * 1000 * 10) / 10;
      onFrameSample(fps, frameMs);
      fc.count = 0;
      fc.accDelta = 0;
      fc.lastReport = state.clock.elapsedTime;
    }

    // 2. Phase-specific camera motion
    if (phase === 'flyover') {
      flyoverAngleRef.current += delta * 1.15;
      const orbitDist = planet.baseRadius * 2.55;
      const angle = flyoverAngleRef.current;
      camera.position.set(
        Math.sin(angle) * orbitDist,
        planet.baseRadius * 0.65 * Math.cos(angle * 0.5),
        Math.cos(angle) * orbitDist,
      );
      camera.lookAt(0, 0, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
      }
      return;
    }

    if (phase === 'flight' && activeTrajectory.length > 0) {
      const idx = Math.min(
        activeTrajectory.length - 1,
        Math.max(0, flightProgressIndex),
      );
      const pt = activeTrajectory[idx].position;
      const projPos = new THREE.Vector3(pt.x, pt.y, pt.z);
      const radialOut = projPos.clone().normalize();

      // Keep camera smoothly following the projectile from an elevated side-orbital vantage
      const sideOffset = new THREE.Vector3(-radialOut.z, 0.35, radialOut.x)
        .normalize()
        .multiplyScalar(planet.baseRadius * 0.85);
      const desiredPos = projPos
        .clone()
        .addScaledVector(radialOut, planet.baseRadius * 0.78)
        .add(sideOffset);

      camera.position.lerp(desiredPos, Math.min(1, delta * 3.8));
      if (controlsRef.current) {
        controlsRef.current.target.lerp(
          projPos.clone().multiplyScalar(0.35),
          Math.min(1, delta * 5.0),
        );
        controlsRef.current.update();
      }
      return;
    }

    if ((phase === 'impact' || phase === 'destruction') && lastImpact) {
      const hitVec = new THREE.Vector3(
        lastImpact.hitPoint.x,
        lastImpact.hitPoint.y,
        lastImpact.hitPoint.z,
      );
      const hitNormal = hitVec.clone().normalize();
      const desiredCam = hitVec
        .clone()
        .addScaledVector(hitNormal, planet.baseRadius * 0.95)
        .add(new THREE.Vector3(6, 5, 6));

      camera.position.lerp(desiredCam, Math.min(1, delta * 2.5));

      // Subtle camera shake during match-ending destruction sequence (User Story 43)
      if (phase === 'destruction') {
        const shakeAmp = 0.32;
        camera.position.x += Math.sin(state.clock.elapsedTime * 48) * shakeAmp;
        camera.position.y += Math.cos(state.clock.elapsedTime * 53) * shakeAmp;
      }

      if (controlsRef.current) {
        controlsRef.current.target.lerp(
          hitVec.clone().multiplyScalar(0.45),
          Math.min(1, delta * 4.0),
        );
        controlsRef.current.update();
      }
    }
  });

  const orbitEnabled =
    phase === 'aiming' || phase === 'charging' || phase === 'gameover';

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={orbitEnabled}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.75}
      zoomSpeed={0.9}
      panSpeed={0.65}
      minDistance={planet.baseRadius * 1.32}
      maxDistance={planet.baseRadius * 4.2}
    />
  );
};

export const GameCanvas: React.FC<GameCanvasProps> = ({
  planet,
  cratersVersion,
  tanks,
  currentTurn,
  phase,
  previewPoints,
  guideOpacity,
  activeTrajectory,
  flightProgressIndex,
  lastImpact,
  cameraFocusRequest,
  onCraterMeshUpdated,
  onFrameSample,
}) => {
  const showGuide =
    (phase === 'aiming' || phase === 'charging') && currentTurn === 'player';

  return (
    <div className="canvas-container" data-testid="game-canvas-container">
      <Canvas
        shadows
        camera={{ position: [0, 28, 72], fov: 46, near: 0.5, far: 600 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={[planet.preset.skyTint]} />
        <fogExp2 attach="fog" args={[planet.preset.skyTint, 0.0028]} />

        <ambientLight
          intensity={planet.presetId === 'mars' ? 0.68 : 0.62}
          color={planet.presetId === 'mars' ? '#fed7aa' : '#e0f2fe'}
        />
        <directionalLight
          position={[85, 110, 65]}
          intensity={1.65}
          color={planet.presetId === 'mars' ? '#ffedd5' : '#ffffff'}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight
          position={[-75, -60, -50]}
          intensity={0.45}
          color={planet.preset.atmosphereColor}
        />

        <Stars
          radius={180}
          depth={60}
          count={2400}
          factor={4}
          saturation={0.2}
          fade
          speed={0.4}
        />

        <PlanetMesh
          planet={planet}
          cratersVersion={cratersVersion}
          onCraterMeshUpdated={onCraterMeshUpdated}
        />

        <TankModel
          tank={tanks.player}
          isCurrentTurn={currentTurn === 'player' && phase !== 'gameover'}
          isDestroyed={tanks.player.health <= 0}
        />

        <TankModel
          tank={tanks.ai}
          isCurrentTurn={currentTurn === 'ai' && phase !== 'gameover'}
          isDestroyed={tanks.ai.health <= 0}
        />

        <TrajectoryGuide
          previewPoints={previewPoints}
          opacity={guideOpacity}
          visible={showGuide}
        />

        {phase === 'flight' && (
          <ActiveProjectile
            points={activeTrajectory}
            progressIndex={flightProgressIndex}
          />
        )}

        {(phase === 'impact' || phase === 'destruction') && (
          <ImpactExplosion
            outcome={lastImpact}
            isDestructionSequence={phase === 'destruction'}
          />
        )}

        <CameraDirector
          planet={planet}
          tanks={tanks}
          phase={phase}
          activeTrajectory={activeTrajectory}
          flightProgressIndex={flightProgressIndex}
          lastImpact={lastImpact}
          cameraFocusRequest={cameraFocusRequest}
          onFrameSample={onFrameSample}
        />
      </Canvas>
    </div>
  );
};
