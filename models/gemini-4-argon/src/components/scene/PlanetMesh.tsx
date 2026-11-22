import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PlanetWorld } from '../../simulation/planet';

interface PlanetMeshProps {
  planet: PlanetWorld;
  cratersVersion: number;
  onCraterMeshUpdated: (durationMs: number) => void;
}

const SUBDIVISIONS = 40;

export const PlanetMesh: React.FC<PlanetMeshProps> = ({
  planet,
  cratersVersion,
  onCraterMeshUpdated,
}) => {
  const terrainMeshRef = useRef<THREE.Mesh>(null);
  const cloudsMeshRef = useRef<THREE.Mesh>(null);

  // Create base unit icosahedron geometry once per planet seed/preset
  const { geometry, unitDirections } = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, SUBDIVISIONS);
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const count = posAttr.count;
    const dirs = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      const len = Math.sqrt(x * x + y * y + z * z) || 1;
      dirs[i * 3] = x / len;
      dirs[i * 3 + 1] = y / len;
      dirs[i * 3 + 2] = z / len;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.name = `planet-geo-${planet.seed}`;
    return { geometry: geo, unitDirections: dirs };
  }, [planet.seed]);

  // Deform terrain vertices & compute vertex colours whenever planet or craters change
  useEffect(() => {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const posAttr = geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = geometry.attributes.color as THREE.BufferAttribute;
    const count = posAttr.count;

    for (let i = 0; i < count; i++) {
      const ux = unitDirections[i * 3];
      const uy = unitDirections[i * 3 + 1];
      const uz = unitDirections[i * 3 + 2];
      const unitDir = { x: ux, y: uy, z: uz };

      const r = planet.sampleTerrainRadius(unitDir);
      posAttr.setXYZ(i, ux * r, uy * r, uz * r);

      const [cr, cg, cb] = planet.sampleTerrainColor(unitDir, r);
      colAttr.setXYZ(i, cr, cg, cb);
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    onCraterMeshUpdated(Math.round((t1 - t0) * 100) / 100);
  }, [planet, cratersVersion, geometry, unitDirections, onCraterMeshUpdated]);

  useFrame((_, delta) => {
    if (cloudsMeshRef.current) {
      cloudsMeshRef.current.rotation.y += delta * 0.025;
      cloudsMeshRef.current.rotation.x += delta * 0.006;
    }
  });

  const atmosphereRadius = planet.baseRadius + planet.terrainAmplitude * 1.35;
  const cloudRadius = planet.baseRadius + planet.terrainAmplitude * 0.92;

  return (
    <group name="planet-group">
      {/* Main deformable terrain mesh */}
      <mesh ref={terrainMeshRef} geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial
          vertexColors
          roughness={planet.presetId === 'mars' ? 0.92 : 0.84}
          metalness={0.06}
          flatShading={false}
        />
      </mesh>

      {/* Water sphere on Earth-like worlds */}
      {planet.preset.hasWater && (
        <mesh receiveShadow>
          <sphereGeometry args={[planet.waterRadius, 64, 64]} />
          <meshStandardMaterial
            color={planet.preset.waterColor}
            transparent
            opacity={0.84}
            roughness={0.2}
            metalness={0.15}
          />
        </mesh>
      )}

      {/* Subtle cloud bands on Earth-like worlds */}
      {planet.preset.hasClouds && (
        <mesh ref={cloudsMeshRef}>
          <icosahedronGeometry args={[cloudRadius, 3]} />
          <meshStandardMaterial
            color="#ffffff"
            transparent
            opacity={0.14}
            wireframe={false}
            roughness={1}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Atmospheric haze halo */}
      <mesh>
        <sphereGeometry args={[atmosphereRadius, 48, 48]} />
        <meshBasicMaterial
          color={planet.preset.atmosphereColor}
          transparent
          opacity={planet.presetId === 'mars' ? 0.12 : 0.1}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
