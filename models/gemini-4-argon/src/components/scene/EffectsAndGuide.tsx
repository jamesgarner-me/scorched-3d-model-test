import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { ImpactOutcome, TrajectoryPoint, Vec3 } from '../../simulation/types';

interface TrajectoryGuideProps {
  previewPoints: Vec3[];
  opacity: number;
  visible: boolean;
}

/**
 * Renders the translucent ~25% ballistic trajectory guide emerging from the cannon.
 * Never reveals the landing point (User Stories 17 & 18).
 */
export const TrajectoryGuide: React.FC<TrajectoryGuideProps> = ({
  previewPoints,
  opacity,
  visible,
}) => {
  const linePoints = useMemo(() => {
    if (!visible || previewPoints.length < 2) {
      return [];
    }
    return previewPoints.map((p) => [p.x, p.y, p.z] as [number, number, number]);
  }, [previewPoints, visible]);

  if (!visible || linePoints.length < 2) {
    return null;
  }

  return (
    <group name="trajectory-guide">
      <Line
        points={linePoints}
        color="#38bdf8"
        lineWidth={3}
        transparent
        opacity={opacity}
        dashed
        dashScale={2.2}
        dashSize={0.55}
        gapSize={0.3}
      />
      {previewPoints.map((pt, idx) => {
        if (idx === 0 || idx % 3 !== 0) return null;
        const fade = Math.max(0.15, (1 - idx / previewPoints.length) * opacity);
        return (
          <mesh key={idx} position={[pt.x, pt.y, pt.z]}>
            <sphereGeometry args={[0.11, 8, 8]} />
            <meshBasicMaterial color="#7dd3fc" transparent opacity={fade} />
          </mesh>
        );
      })}
    </group>
  );
};

interface ActiveProjectileProps {
  points: TrajectoryPoint[];
  progressIndex: number;
}

export const ActiveProjectile: React.FC<ActiveProjectileProps> = ({
  points,
  progressIndex,
}) => {
  if (points.length === 0) return null;
  const clampedIdx = Math.min(points.length - 1, Math.max(0, progressIndex));
  const current = points[clampedIdx];
  const trailSlice = points
    .slice(Math.max(0, clampedIdx - 28), clampedIdx + 1)
    .map((p) => [p.position.x, p.position.y, p.position.z] as [number, number, number]);

  return (
    <group name="active-projectile">
      <mesh position={[current.position.x, current.position.y, current.position.z]}>
        <sphereGeometry args={[0.28, 14, 14]} />
        <meshBasicMaterial color="#fef08a" />
      </mesh>
      <pointLight
        position={[current.position.x, current.position.y, current.position.z]}
        color="#f97316"
        intensity={4}
        distance={8}
      />
      {trailSlice.length >= 2 && (
        <Line
          points={trailSlice}
          color="#fb923c"
          lineWidth={2.5}
          transparent
          opacity={0.75}
        />
      )}
    </group>
  );
};

interface ImpactExplosionProps {
  outcome: ImpactOutcome | null;
  isDestructionSequence: boolean;
}

export const ImpactExplosion: React.FC<ImpactExplosionProps> = ({
  outcome,
  isDestructionSequence,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const elapsedRef = useRef(0);

  // Reset timer when outcome changes
  React.useEffect(() => {
    elapsedRef.current = 0;
  }, [outcome]);

  const debrisVectors = useMemo(() => {
    if (!outcome) return [];
    const list: Array<{ dir: THREE.Vector3; speed: number; scale: number }> = [];
    const n = new THREE.Vector3(
      outcome.hitNormal.x,
      outcome.hitNormal.y,
      outcome.hitNormal.z,
    );
    const count = isDestructionSequence ? 24 : 12;
    for (let i = 0; i < count; i++) {
      const randVec = new THREE.Vector3(
        Math.sin(i * 17.3) * 0.8,
        Math.cos(i * 23.1) * 0.8,
        Math.sin(i * 31.7) * 0.8,
      );
      const dir = n.clone().multiplyScalar(1.1).add(randVec).normalize();
      list.push({
        dir,
        speed: (isDestructionSequence ? 5.5 : 3.5) + (i % 5) * 1.1,
        scale: isDestructionSequence ? 0.28 : 0.18,
      });
    }
    return list;
  }, [outcome, isDestructionSequence]);

  useFrame((_, delta) => {
    if (!outcome) return;
    elapsedRef.current += delta;
    const t = elapsedRef.current;
    const maxScale = isDestructionSequence ? 5.8 : outcome.hitWater ? 3.2 : 4.2;

    if (coreRef.current) {
      const s = Math.min(maxScale, 0.6 + t * (isDestructionSequence ? 7.5 : 6.0));
      coreRef.current.scale.setScalar(s);
      const mat = coreRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1 - t / (isDestructionSequence ? 2.1 : 1.1));
    }

    if (ringRef.current) {
      const rs = 0.8 + t * (isDestructionSequence ? 9.5 : 7.0);
      ringRef.current.scale.setScalar(rs);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.85 - t / (isDestructionSequence ? 1.8 : 1.0));
    }
  });

  if (!outcome) return null;

  const primaryColor = outcome.hitWater
    ? '#38bdf8'
    : isDestructionSequence
      ? '#ef4444'
      : '#f97316';
  const secondaryColor = outcome.hitWater
    ? '#e0f2fe'
    : isDestructionSequence
      ? '#fef08a'
      : '#fde047';

  return (
    <group
      ref={groupRef}
      position={[outcome.hitPoint.x, outcome.hitPoint.y, outcome.hitPoint.z]}
    >
      <mesh ref={coreRef}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshBasicMaterial color={primaryColor} transparent opacity={0.9} />
      </mesh>
      <mesh ref={ringRef}>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshBasicMaterial color={secondaryColor} transparent opacity={0.8} wireframe />
      </mesh>
      <pointLight
        color={primaryColor}
        intensity={isDestructionSequence ? 12 : 6}
        distance={18}
      />
      {debrisVectors.map((d, i) => (
        <DebrisParticle
          key={i}
          dir={d.dir}
          speed={d.speed}
          scale={d.scale}
          color={outcome.hitWater ? '#bae6fd' : i % 2 === 0 ? '#f97316' : '#57534e'}
        />
      ))}
    </group>
  );
};

const DebrisParticle: React.FC<{
  dir: THREE.Vector3;
  speed: number;
  scale: number;
  color: string;
}> = ({ dir, speed, scale, color }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const tRef = useRef(0);

  useFrame((_, delta) => {
    tRef.current += delta;
    if (meshRef.current) {
      const t = tRef.current;
      meshRef.current.position.set(
        dir.x * speed * t,
        dir.y * speed * t,
        dir.z * speed * t,
      );
      meshRef.current.rotation.x += delta * 4;
      meshRef.current.rotation.y += delta * 5;
      const s = Math.max(0.01, scale * (1 - t * 0.45));
      meshRef.current.scale.setScalar(s);
    }
  });

  return (
    <mesh ref={meshRef}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
    </mesh>
  );
};
