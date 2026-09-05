import { useEffect, useMemo, useRef } from 'react';
import type { Planet } from '../game/planet';
import { perf } from '../game/perf';
import { useGame } from '../state/store';
import { createFaceGeometry, updateFaceGeometry } from './terrainGeometry';

/**
 * The planet itself: six cube-sphere faces sharing one material. When a crater is
 * carved, only the faces it touched are rebuilt and re-uploaded.
 */
export function PlanetMesh({ planet }: { planet: Planet }) {
  const terrainVersion = useGame((s) => s.terrainVersion);
  const seen = useRef(-1);

  const geometries = useMemo(() => {
    const list = Array.from({ length: 6 }, (_, face) => createFaceGeometry(planet, face));
    perf.triangles = list.length * (planet.resolution - 1) * (planet.resolution - 1) * 2;
    return list;
  }, [planet]);

  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  useEffect(() => {
    if (seen.current === terrainVersion) return;
    seen.current = terrainVersion;
    if (planet.dirtyFaces.size === 0) return;
    for (const face of planet.dirtyFaces) updateFaceGeometry(planet, face, geometries[face]);
    planet.dirtyFaces.clear();
  }, [terrainVersion, planet, geometries]);

  return (
    <group>
      {geometries.map((geometry, i) => (
        <mesh key={i} geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.92} metalness={0.02} flatShading={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Ocean shell. Only rendered for presets that actually have water. */
export function Ocean({ planet }: { planet: Planet }) {
  if (!planet.hasOcean) return null;
  return (
    <mesh>
      <sphereGeometry args={[planet.seaLevel, 128, 96]} />
      <meshStandardMaterial
        color={planet.preset.palette.shallowWater}
        transparent
        opacity={0.86}
        roughness={0.08}
        metalness={0.25}
      />
    </mesh>
  );
}
