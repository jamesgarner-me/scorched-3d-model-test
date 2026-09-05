import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Match } from '../game/match';
import { perf } from '../game/perf';
import { tuning } from '../game/tuning';
import { useGame } from '../state/store';

const MAX_DOTS = 30;
const dummy = new THREE.Object3D();

/**
 * The aiming guide. It runs the same simulation the shell will, then draws only the
 * opening slice of the arc — you get a read on the launch, never a free landing point.
 */
export function TrajectoryGuide({ match }: { match: Match }) {
  const dots = useRef<THREE.InstancedMesh>(null);
  const bearing = useGame((s) => s.bearing);
  const elevation = useGame((s) => s.elevation);
  const charging = useGame((s) => s.charging);
  const power = useGame((s) => s.power);
  const lastPower = match.tanks.player.lastPower;
  const key = `${bearing.toFixed(2)}|${elevation.toFixed(2)}|${(charging ? power : lastPower).toFixed(1)}`;
  const previous = useRef('');

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#9fe8ff',
        transparent: true,
        opacity: tuning.guideOpacity,
        depthWrite: false,
      }),
    [],
  );

  useFrame(() => {
    const mesh = dots.current;
    if (!mesh) return;
    material.opacity = tuning.guideOpacity;
    if (key === previous.current) return;
    previous.current = key;

    const started = performance.now();
    // Before you start charging, the guide shows your last shot's power so you can range in.
    const shownPower = charging ? power : lastPower;
    const path = match.previewPath('player', { bearing, elevation, power: shownPower });
    const total = path.points.length;
    // Only the opening fraction of the arc is ever revealed.
    const visible = Math.max(2, Math.floor(total * tuning.guideFraction));
    const step = Math.max(1, Math.floor(visible / MAX_DOTS));

    let drawn = 0;
    for (let i = 0; i < MAX_DOTS; i++) {
      const index = i * step;
      if (index >= visible || drawn >= MAX_DOTS) break;
      const p = path.points[index];
      const t = i / MAX_DOTS;
      dummy.position.set(p.x, p.y, p.z);
      const s = 0.34 * (1 - t * 0.6);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(drawn++, dummy.matrix);
    }
    // Park unused instances at the planet centre where they are hidden.
    dummy.position.set(0, 0, 0);
    dummy.scale.setScalar(0.0001);
    dummy.updateMatrix();
    for (let i = drawn; i < MAX_DOTS; i++) mesh.setMatrixAt(i, dummy.matrix);

    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = MAX_DOTS;
    perf.guideMillis = performance.now() - started;
  });

  return (
    <instancedMesh ref={dots} args={[undefined, undefined, MAX_DOTS]} material={material} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 8]} />
    </instancedMesh>
  );
}
