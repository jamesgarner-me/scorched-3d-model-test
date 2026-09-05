import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { createNoise3, fbm } from '../sim/noise'
import type { Planet } from '../sim/planet'

const atmosphereVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const atmosphereFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float d = dot(vNormal, vView);
    float f = 1.0 - max(d, 0.0);
    // Soft inner haze that fades out right at the silhouette.
    float a = pow(f, 3.0) * (1.0 - smoothstep(0.75, 1.0, f) * 0.85) * uStrength;
    gl_FragColor = vec4(uColor, a);
  }
`
const haloFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // Back faces: strongest just outside the planet's limb, fading outward.
    float d = clamp(-dot(vNormal, vView) * 2.4, 0.0, 1.0);
    gl_FragColor = vec4(uColor, pow(d, 3.0) * uStrength * 0.3);
  }
`

/** Fresnel rim glow that reads as haze around the limb. */
export function Atmosphere({ planet }: { planet: Planet }) {
  const c = planet.preset.colors
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color(c.atmosphere) }, uStrength: { value: c.atmosphereStrength } }), [c])
  const haloUniforms = useMemo(() => ({ uColor: { value: new THREE.Color(c.atmosphere) }, uStrength: { value: c.atmosphereStrength } }), [c])
  const inner = useRef<THREE.Mesh>(null)
  const halo = useRef<THREE.Mesh>(null)
  // Both shells only make sense from outside; hide each when the camera is within it.
  useFrame(({ camera }) => {
    const d = camera.position.length()
    const R = planet.radius
    // Fade the shells in as the camera climbs away from the surface.
    const k = THREE.MathUtils.smoothstep(d, R * 1.2, R * 1.9)
    uniforms.uStrength.value = c.atmosphereStrength * k
    haloUniforms.uStrength.value = c.atmosphereStrength * k
    if (inner.current) inner.current.visible = d > R * 1.06 + 1 && k > 0
    if (halo.current) halo.current.visible = d > R * 1.16 + 1 && k > 0
  })
  return (
    <group>
      <mesh ref={inner} scale={planet.radius * 1.06}>
        <sphereGeometry args={[1, 96, 64]} />
        <shaderMaterial vertexShader={atmosphereVert} fragmentShader={atmosphereFrag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={halo} scale={planet.radius * 1.16}>
        <sphereGeometry args={[1, 96, 64]} />
        <shaderMaterial vertexShader={atmosphereVert} fragmentShader={haloFrag} uniforms={haloUniforms} transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  )
}

export function Water({ planet }: { planet: Planet }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.004
  })
  if (planet.minHeight - planet.preset.waterLevel > -0.05 && planet.waterRadius < planet.radius) return null
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[planet.waterRadius, 512, 256]} />
      <meshPhysicalMaterial color={planet.preset.colors.water} roughness={0.18} metalness={0.05} transparent opacity={0.86} clearcoat={0.6} clearcoatRoughness={0.3} />
    </mesh>
  )
}

function makeCloudTexture(seed: string, mars: boolean): THREE.CanvasTexture {
  const w = 1024, h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)
  const noise = createNoise3(seed + ':clouds')
  for (let y = 0; y < h; y++) {
    const lat = (y / h - 0.5) * Math.PI
    for (let x = 0; x < w; x++) {
      const lon = (x / w) * Math.PI * 2
      const cx = Math.cos(lat) * Math.cos(lon), cy = Math.sin(lat), cz = Math.cos(lat) * Math.sin(lon)
      let v: number
      if (mars) {
        const bands = fbm(noise, cx * 2.5 + cy * 5, cy * 5, cz * 2.5, 4) * 0.5 + 0.5
        v = Math.max(0, (bands - 0.52) * 1.2)
      } else {
        const n = fbm(noise, cx * 3.5, cy * 3.5, cz * 3.5, 6, 2.2, 0.55) * 0.5 + 0.5
        const swirl = fbm(noise, cx * 1.2 + 10, cy * 1.2, cz * 1.2, 3) * 0.5 + 0.5
        v = Math.max(0, (n - 0.57 + swirl * 0.12) * 2.4)
      }
      v = Math.min(1, v)
      const i = (y * w + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
      img.data[i + 3] = Math.round(v * 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function Clouds({ planet }: { planet: Planet }) {
  const mars = planet.preset.id === 'mars'
  const texture = useMemo(() => makeCloudTexture(planet.seed, mars), [planet.seed, mars])
  const ref = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const shell = planet.radius * (mars ? 1.1 : 1.12)
  useFrame(({ camera }, dt) => {
    if (ref.current) ref.current.rotation.y += dt * (mars ? 0.01 : 0.006)
    // Clouds are a distant layer: fade them out when the camera is near the shell.
    if (mat.current) mat.current.opacity = planet.preset.colors.cloudOpacity * THREE.MathUtils.smoothstep(Math.abs(camera.position.length() - shell), planet.radius * 0.08, planet.radius * 0.5)
  })
  return (
    <mesh ref={ref} scale={shell}>
      <sphereGeometry args={[1, 96, 64]} />
      <meshStandardMaterial ref={mat} color={planet.preset.colors.cloud} alphaMap={texture} transparent opacity={planet.preset.colors.cloudOpacity} depthWrite={false} roughness={1} emissive={planet.preset.colors.cloud} emissiveIntensity={0.12} />
    </mesh>
  )
}

export function Sun({ direction }: { direction: THREE.Vector3 }) {
  const pos = useMemo(() => direction.clone().normalize().multiplyScalar(6000), [direction])
  return (
    <mesh position={pos}>
      <sphereGeometry args={[40, 24, 24]} />
      <meshBasicMaterial color="#fff4d6" toneMapped={false} />
    </mesh>
  )
}
