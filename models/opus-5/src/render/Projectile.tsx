import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { tuning } from '../game/tuning';
import type { ShotPath } from '../game/physics';
import { focus } from './focus';

const TRAIL_POINTS = 90;

/**
 * Replays a precomputed shot path. The path came out of the shared simulation at
 * launch, so what you watch is exactly what was resolved — no second integration.
 */
export function Projectile({
  path,
  planetRadius,
  onLanded,
}: {
  path: ShotPath;
  planetRadius: number;
  onLanded: () => void;
}) {
  const shell = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const cursor = useRef(0);
  const done = useRef(false);

  const trail = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3));
    const alphas = new Float32Array(TRAIL_POINTS);
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    geometry.setDrawRange(0, 0);
    return geometry;
  }, []);

  useEffect(() => {
    cursor.current = 0;
    done.current = false;
  }, [path]);

  useEffect(() => () => trail.dispose(), [trail]);

  useFrame((_, delta) => {
    if (done.current) return;
    const points = path.points;
    if (points.length === 0) {
      done.current = true;
      onLanded();
      return;
    }

    // The path was integrated at a fixed timestep, so index advance is just time / dt.
    cursor.current += (Math.min(delta, 0.05) * tuning.flightTimeScale) / tuning.simStep;
    const index = Math.min(Math.floor(cursor.current), points.length - 1);
    const p = points[index];

    if (shell.current) shell.current.position.set(p.x, p.y, p.z);
    if (light.current) light.current.position.set(p.x, p.y, p.z);

    const start = Math.max(0, index - TRAIL_POINTS + 1);
    const count = index - start + 1;
    const array = trail.getAttribute('position').array as Float32Array;
    for (let i = 0; i < count; i++) {
      const q = points[start + i];
      array[i * 3] = q.x;
      array[i * 3 + 1] = q.y;
      array[i * 3 + 2] = q.z;
    }
    trail.getAttribute('position').needsUpdate = true;
    trail.setDrawRange(0, count);

    // Chase camera: sit off the shell, framed so the ground below stays in shot.
    focus.target.set(p.x, p.y, p.z);
    focus.up.set(p.x, p.y, p.z).normalize();
    const altitude = Math.hypot(p.x, p.y, p.z) - planetRadius;
    focus.distance = THREE.MathUtils.clamp(16 + altitude * 0.85, 18, planetRadius * 1.4);
    focus.urgency = 2.4;

    if (index >= points.length - 1) {
      done.current = true;
      onLanded();
    }
  });

  return (
    <group>
      <mesh ref={shell}>
        <sphereGeometry args={[0.42, 12, 12]} />
        <meshBasicMaterial color="#ffd9a0" />
      </mesh>
      <pointLight ref={light} color="#ffb066" intensity={90} distance={26} />
      <line>
        <primitive object={trail} attach="geometry" />
        <lineBasicMaterial color="#ffb066" transparent opacity={0.75} depthWrite={false} />
      </line>
    </group>
  );
}
