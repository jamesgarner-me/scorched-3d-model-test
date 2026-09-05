import { useMemo, useRef } from 'react';
import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TankState } from '../game/match';
import { TANK, PIVOT_HEIGHT } from '../game/tank';
import { aimDirection, DEG, type Frame } from '../game/vec';

const forwardVector = new THREE.Vector3();
const upVector = new THREE.Vector3();
const backVector = new THREE.Vector3();
const rightVector = new THREE.Vector3();
const trueUp = new THREE.Vector3();
const basis = new THREE.Matrix4();

/** Orient the hull so it stands on the terrain and faces its firing bearing. */
function applyHullOrientation(object: THREE.Object3D, frame: Frame, bearing: number): void {
  const forward = aimDirection(frame, bearing, 0);
  forwardVector.set(forward.x, forward.y, forward.z);
  upVector.set(frame.up.x, frame.up.y, frame.up.z);
  backVector.copy(forwardVector).negate();
  rightVector.crossVectors(upVector, backVector).normalize();
  trueUp.crossVectors(backVector, rightVector).normalize();
  basis.makeBasis(rightVector, trueUp, backVector);
  object.quaternion.setFromRotationMatrix(basis);
}

/**
 * A tank. Turret bearing, barrel elevation and the health bar are read straight from
 * the (mutable) match state every frame, so aiming stays smooth without re-rendering.
 */
export function TankModel({
  tank,
  color,
  accent,
  label,
}: {
  tank: TankState;
  color: string;
  accent: string;
  label: string;
}) {
  const group = useRef<THREE.Group>(null);
  const chassis = useRef<THREE.Group>(null);
  const barrel = useRef<THREE.Group>(null);
  const healthBar = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.PointLight>(null);
  const wrecked = useRef(false);

  const position = useMemo(
    () => new THREE.Vector3(tank.position.x, tank.position.y, tank.position.z),
    [tank.position],
  );

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    applyHullOrientation(g, tank.frame, tank.bearing);
    if (barrel.current) barrel.current.rotation.x = -tank.elevation * DEG;

    const destroyed = tank.health <= 0;
    if (destroyed !== wrecked.current) {
      wrecked.current = destroyed;
      if (chassis.current) chassis.current.rotation.set(destroyed ? 0.34 : 0, destroyed ? 0.22 : 0, destroyed ? 0.16 : 0);
    }
    if (glow.current) glow.current.intensity = destroyed ? 0 : 6;

    const fraction = Math.max(0, tank.health) / tank.maxHealth;
    if (healthBar.current) {
      healthBar.current.scale.x = Math.max(0.0001, fraction);
      healthBar.current.position.x = -(3.0 * (1 - fraction)) / 2;
      const mat = healthBar.current.material as THREE.MeshBasicMaterial;
      mat.color.set(destroyed ? '#555555' : fraction > 0.35 ? accent : '#ff5a3c');
    }
  });

  return (
    <group ref={group} name={label} position={position}>
      <group ref={chassis}>
        <mesh position={[-TANK.width / 2 + 0.28, TANK.trackHeight / 2, 0]}>
          <boxGeometry args={[0.56, TANK.trackHeight, TANK.length]} />
          <meshStandardMaterial color="#26282c" roughness={0.95} />
        </mesh>
        <mesh position={[TANK.width / 2 - 0.28, TANK.trackHeight / 2, 0]}>
          <boxGeometry args={[0.56, TANK.trackHeight, TANK.length]} />
          <meshStandardMaterial color="#26282c" roughness={0.95} />
        </mesh>
        <mesh position={[0, TANK.trackHeight + TANK.bodyHeight / 2, 0]}>
          <boxGeometry args={[TANK.width, TANK.bodyHeight, TANK.length * 0.94]} />
          <meshStandardMaterial color={color} roughness={0.55} metalness={0.25} />
        </mesh>
        <mesh position={[0, PIVOT_HEIGHT - 0.1, -0.2]}>
          <cylinderGeometry args={[TANK.turretRadius, TANK.turretRadius * 1.12, TANK.turretHeight, 16]} />
          <meshStandardMaterial color={accent} roughness={0.45} metalness={0.35} />
        </mesh>
        <group ref={barrel} position={[0, PIVOT_HEIGHT, 0]}>
          <mesh position={[0, 0, TANK.barrelLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[TANK.barrelRadius, TANK.barrelRadius * 1.15, TANK.barrelLength, 12]} />
            <meshStandardMaterial color="#3a3d42" roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[0, 0, TANK.barrelLength]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[TANK.barrelRadius * 1.5, TANK.barrelRadius * 1.5, 0.3, 12]} />
            <meshStandardMaterial color="#2a2d31" roughness={0.4} metalness={0.6} />
          </mesh>
        </group>
      </group>

      {/* Floating marker so both tanks stay findable from orbit. */}
      <Billboard position={[0, 3.6, 0]}>
        <mesh renderOrder={10}>
          <planeGeometry args={[3.3, 0.4]} />
          <meshBasicMaterial color="#0b0e14" transparent opacity={0.7} depthTest={false} />
        </mesh>
        <mesh ref={healthBar} position={[0, 0, 0.01]} renderOrder={11}>
          <planeGeometry args={[3.0, 0.22]} />
          <meshBasicMaterial color={accent} transparent depthTest={false} />
        </mesh>
      </Billboard>
      <pointLight ref={glow} position={[0, 3, 0]} color={accent} intensity={6} distance={9} />
    </group>
  );
}
