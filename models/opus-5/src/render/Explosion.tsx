import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { tuning } from '../game/tuning';
import type { Blast } from '../state/store';
import { focus, requestShake } from './focus';

const DEBRIS = 26;
const SMOKE = 14;
const dummy = new THREE.Object3D();

interface Particle {
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  scale: number;
  delay: number;
}

/**
 * Impact effect. A normal hit is a flash, a shockwave and some debris. A match-ending
 * hit gets the full treatment: a bigger fireball, fire, rolling smoke, more debris,
 * camera shake and a longer linger before the winner overlay.
 */
export function Explosion({ blast, gravity, onDone }: { blast: Blast; gravity: number; onDone: () => void }) {
  const elapsed = useRef(0);
  const finished = useRef(false);
  const flash = useRef<THREE.Mesh>(null);
  const shock = useRef<THREE.Mesh>(null);
  const debris = useRef<THREE.InstancedMesh>(null);
  const smoke = useRef<THREE.InstancedMesh>(null);
  const fire = useRef<THREE.PointLight>(null);

  const water = blast.kind === 'water';
  const radius = tuning.blastRadius * (water ? 0.8 : 1) * (blast.fatal ? 1.7 : 1);
  const duration = blast.fatal ? 3.6 : water ? 1.4 : 1.9;

  const origin = useMemo(
    () => new THREE.Vector3(blast.position.x, blast.position.y, blast.position.z),
    [blast],
  );
  const up = useMemo(() => new THREE.Vector3(blast.dir.x, blast.dir.y, blast.dir.z).normalize(), [blast]);
  const orientation = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), up),
    [up],
  );

  const particles = useMemo(() => {
    const rand = () => Math.random() * 2 - 1;
    const make = (count: number, speed: number, bias: number): Particle[] =>
      Array.from({ length: count }, () => {
        const lateral = new THREE.Vector3(rand(), rand(), rand()).normalize();
        const velocity = lateral
          .multiplyScalar(speed * (0.35 + Math.random() * 0.65))
          .addScaledVector(up, speed * bias * (0.5 + Math.random()));
        return {
          velocity,
          spin: new THREE.Vector3(rand(), rand(), rand()).multiplyScalar(6),
          scale: 0.25 + Math.random() * 0.55,
          delay: Math.random() * 0.12,
        };
      });
    return {
      debris: make(DEBRIS, radius * (blast.fatal ? 1.5 : 1.1), 1.1),
      smoke: make(SMOKE, radius * 0.26, 1.1),
    };
  }, [blast, radius, up]);

  useEffect(() => {
    requestShake(blast.fatal ? 2.6 : water ? 0.35 : 0.75);
  }, [blast, water]);

  useFrame((_, delta) => {
    if (finished.current) return;
    const dt = Math.min(delta, 0.05);
    elapsed.current += dt;
    const t = elapsed.current;
    const life = Math.min(t / duration, 1);

    if (flash.current) {
      const grow = blast.fatal ? 1 - Math.exp(-t * 4.5) : 1 - Math.exp(-t * 9);
      flash.current.scale.setScalar(Math.max(0.001, radius * (0.1 + grow * 0.3)));
      const mat = flash.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.9 * (1 - t / (blast.fatal ? 0.95 : 0.42)));
      flash.current.visible = mat.opacity > 0.01;
    }

    if (shock.current) {
      const s = Math.max(0.001, radius * (0.15 + Math.min(t * 2.0, 0.95)));
      shock.current.scale.set(s, s, s);
      const mat = shock.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.34 * (1 - t / 0.7));
      shock.current.visible = mat.opacity > 0.01;
    }

    if (fire.current) {
      fire.current.intensity = Math.max(0, (blast.fatal ? 620 : 240) * (1 - life) * (0.7 + Math.random() * 0.3));
    }

    if (debris.current) {
      for (let i = 0; i < DEBRIS; i++) {
        const p = particles.debris[i];
        const age = Math.max(0, t - p.delay);
        const fall = 0.5 * gravity * age * age;
        dummy.position
          .copy(origin)
          .addScaledVector(p.velocity, age)
          .addScaledVector(up, -fall);
        dummy.rotation.set(p.spin.x * age, p.spin.y * age, p.spin.z * age);
        const shrink = Math.max(0, 1 - life);
        dummy.scale.setScalar(Math.max(0.0001, p.scale * shrink));
        dummy.updateMatrix();
        debris.current.setMatrixAt(i, dummy.matrix);
      }
      debris.current.instanceMatrix.needsUpdate = true;
      (debris.current.material as THREE.MeshStandardMaterial).opacity = 1;
    }

    if (smoke.current) {
      for (let i = 0; i < SMOKE; i++) {
        const p = particles.smoke[i];
        const age = Math.max(0, t - p.delay - 0.14);
        dummy.position
          .copy(origin)
          .addScaledVector(p.velocity, age * 0.5)
          .addScaledVector(up, age * radius * 0.18);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(
          Math.max(0.0001, p.scale * radius * (blast.fatal ? 0.3 : 0.22) * (0.45 + age * 0.7)),
        );
        dummy.updateMatrix();
        smoke.current.setMatrixAt(i, dummy.matrix);
      }
      smoke.current.instanceMatrix.needsUpdate = true;
      const mat = smoke.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, (water ? 0.3 : blast.fatal ? 0.46 : 0.34) * (1 - life) * (1 - life));
    }

    if (blast.fatal) {
      // Linger on the wreck rather than cutting straight to the overlay.
      focus.target.copy(origin);
      focus.up.copy(up);
      focus.distance = radius * 1.7;
      focus.urgency = 1;
    }

    if (life >= 1) {
      finished.current = true;
      onDone();
    }
  });

  const hot = water ? '#bfe2ff' : blast.fatal ? '#ffd48a' : '#ffab55';
  const smokeColor = water ? '#dceaf5' : '#8a7a68';

  return (
    <group>
      <mesh ref={flash} position={origin}>
        <sphereGeometry args={[1, 20, 16]} />
        <meshBasicMaterial color={hot} transparent opacity={1} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={shock} position={origin} quaternion={orientation}>
        <ringGeometry args={[0.82, 1, 48]} />
        <meshBasicMaterial
          color={hot}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <pointLight ref={fire} position={origin} color={water ? '#9fd8ff' : '#ff9a44'} distance={radius * 9} />
      <instancedMesh ref={debris} args={[undefined, undefined, DEBRIS]} frustumCulled={false}>
        <boxGeometry args={[0.55, 0.55, 0.55]} />
        <meshStandardMaterial color={water ? '#bcd9ec' : '#4a3d31'} roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={smoke} args={[undefined, undefined, SMOKE]} frustumCulled={false}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshBasicMaterial color={smokeColor} transparent opacity={0.4} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
