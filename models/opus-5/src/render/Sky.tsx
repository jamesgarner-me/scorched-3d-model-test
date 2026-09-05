import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Noise3D } from '../game/noise';
import type { Planet } from '../game/planet';

/**
 * Rim-lit halo around the planet. Earth's is a blue haze; Mars's is a thin dusty
 * orange, which is most of what separates the two silhouettes at a distance.
 */
export function Atmosphere({ planet }: { planet: Planet }) {
  const material = useMemo(() => {
    const { color, density } = planet.preset.atmosphere;
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uDensity: { value: density * 0.55 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uDensity;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float rim = 1.0 - abs(dot(normalize(vNormal), normalize(vView)));
          float glow = pow(clamp(rim, 0.0, 1.0), 4.2) * uDensity;
          gl_FragColor = vec4(uColor, glow);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, [planet]);

  return (
    <mesh material={material} renderOrder={2}>
      <sphereGeometry args={[planet.radius * 1.045, 64, 48]} />
    </mesh>
  );
}

/** Procedural cloud / dust shell, drifting slowly so the world never looks frozen. */
export function Clouds({ planet }: { planet: Planet }) {
  const ref = useRef<THREE.Mesh>(null);
  const { enabled, color, opacity, coverage } = planet.preset.clouds;

  const texture = useMemo(() => {
    if (!enabled) return null;
    const width = 768;
    const height = 384;
    const noise = new Noise3D(`${planet.seed}:clouds`);
    const data = new Uint8Array(width * height * 4);
    const threshold = 1 - coverage;
    for (let y = 0; y < height; y++) {
      const lat = (y / (height - 1)) * Math.PI;
      const sy = Math.cos(lat);
      const sr = Math.sin(lat);
      for (let x = 0; x < width; x++) {
        const lon = (x / width) * Math.PI * 2;
        const d = { x: sr * Math.cos(lon), y: sy, z: sr * Math.sin(lon) };
        const n = noise.fbm(d, 5, 2.6) * 0.5 + 0.5;
        const a = Math.max(0, Math.min(1, (n - threshold) / 0.22));
        const i = (y * width + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = Math.round(a * a * 255);
      }
    }
    const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }, [planet, enabled, coverage]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.012;
  });

  if (!enabled || !texture) return null;
  return (
    <mesh ref={ref} renderOrder={1}>
      <sphereGeometry args={[planet.radius * 1.028, 64, 48]} />
      <meshLambertMaterial
        map={texture}
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Distant starfield so the planet reads as a body in space rather than a ball in a void. */
export function Starfield({ planet }: { planet: Planet }) {
  const geometry = useMemo(() => {
    const count = 2400;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const radius = planet.radius * 24;
    for (let i = 0; i < count; i++) {
      const z = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.max(0, 1 - z * z));
      positions[i * 3] = r * Math.cos(a) * radius;
      positions[i * 3 + 1] = z * radius;
      positions[i * 3 + 2] = r * Math.sin(a) * radius;
      const warm = 0.75 + Math.random() * 0.25;
      colors[i * 3] = warm;
      colors[i * 3 + 1] = warm * (0.9 + Math.random() * 0.1);
      colors[i * 3 + 2] = 0.85 + Math.random() * 0.15;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [planet]);

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={planet.radius * 0.06}
        sizeAttenuation
        vertexColors
        transparent
        opacity={planet.preset.sky.starIntensity}
        depthWrite={false}
      />
    </points>
  );
}
