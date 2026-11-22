import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { TankState } from '../../simulation/types';

interface TankModelProps {
  tank: TankState;
  isCurrentTurn: boolean;
  isDestroyed: boolean;
}

export const TankModel: React.FC<TankModelProps> = ({
  tank,
  isCurrentTurn,
  isDestroyed,
}) => {
  // Construct basis matrix aligning local +Y with surface normal, +Z with North, +X with East
  const orientationQuaternion = useMemo(() => {
    const m = new THREE.Matrix4();
    const xAxis = new THREE.Vector3(
      tank.frame.east.x,
      tank.frame.east.y,
      tank.frame.east.z,
    );
    const yAxis = new THREE.Vector3(
      tank.frame.normal.x,
      tank.frame.normal.y,
      tank.frame.normal.z,
    );
    const zAxis = new THREE.Vector3(
      tank.frame.north.x,
      tank.frame.north.y,
      tank.frame.north.z,
    );
    m.makeBasis(xAxis, yAxis, zAxis);
    const q = new THREE.Quaternion();
    q.setFromRotationMatrix(m);
    return q;
  }, [tank.frame]);

  // Bearing rotates around local +Y (surface normal); 0 deg = +Z (north), +90 deg = +X (east)
  const turretYawRad = (tank.bearingDeg * Math.PI) / 180;
  // Elevation pitches barrel up from horizontal (+Z toward +Y)
  const barrelPitchRad = ((90 - tank.elevationDeg) * Math.PI) / 180;

  const hullColor = isDestroyed ? '#27272a' : tank.color;
  const accentColor = isDestroyed ? '#18181b' : '#e2e8f0';

  return (
    <group
      position={[tank.position.x, tank.position.y, tank.position.z]}
      quaternion={orientationQuaternion}
    >
      {/* Protected footprint ring on ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry
          args={[tank.footprintRadius * 0.52, tank.footprintRadius * 0.65, 32]}
        />
        <meshBasicMaterial
          color={isCurrentTurn ? tank.color : '#64748b'}
          transparent
          opacity={isCurrentTurn ? 0.55 : 0.25}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Left & Right Treads */}
      <mesh position={[-0.55, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.28, 0.36, 1.45]} />
        <meshStandardMaterial color="#1e293b" roughness={0.85} />
      </mesh>
      <mesh position={[0.55, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.28, 0.36, 1.45]} />
        <meshStandardMaterial color="#1e293b" roughness={0.85} />
      </mesh>

      {/* Main Armoured Hull */}
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.96, 0.42, 1.32]} />
        <meshStandardMaterial color={hullColor} roughness={0.45} metalness={0.35} />
      </mesh>

      {/* Rotating Turret Assembly */}
      <group position={[0, 0.78, 0]} rotation={[0, turretYawRad, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.38, 0.46, 0.34, 16]} />
          <meshStandardMaterial color={hullColor} roughness={0.4} metalness={0.4} />
        </mesh>

        {/* Turret cupola */}
        <mesh position={[0, 0.2, -0.08]}>
          <sphereGeometry args={[0.22, 12, 12]} />
          <meshStandardMaterial color={accentColor} roughness={0.35} />
        </mesh>

        {/* Elevating Cannon Barrel */}
        <group position={[0, 0.07, 0.18]} rotation={[barrelPitchRad, 0, 0]}>
          <mesh position={[0, 0.62, 0]} castShadow>
            <cylinderGeometry args={[0.085, 0.11, 1.25, 12]} />
            <meshStandardMaterial color={accentColor} roughness={0.3} metalness={0.6} />
          </mesh>
          {/* Muzzle brake */}
          <mesh position={[0, 1.22, 0]}>
            <cylinderGeometry args={[0.13, 0.12, 0.18, 12]} />
            <meshStandardMaterial color={hullColor} roughness={0.4} />
          </mesh>
        </group>
      </group>

      {/* Floating tank marker for easy target spotting across the curved horizon */}
      <Html position={[0, 2.35, 0]} center distanceFactor={38} zIndexRange={[10, 0]}>
        <div
          className={`tank-marker ${tank.id === 'player' ? 'tank-marker--player' : 'tank-marker--ai'} ${isCurrentTurn ? 'tank-marker--active' : ''}`}
        >
          <span className="tank-marker__label">
            {tank.id === 'player' ? 'YOU' : 'AI'}
          </span>
          <span className="tank-marker__hp">{Math.ceil(tank.health)} HP</span>
        </div>
      </Html>
    </group>
  );
};
