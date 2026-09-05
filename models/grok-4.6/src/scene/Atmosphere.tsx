import { BackSide } from 'three'
import type { PresetId } from '../game/types.ts'

export function Atmosphere({ radius, preset }: { radius: number; preset: PresetId }) {
  const color = preset === 'earth' ? '#7eb6ff' : '#d9894a'
  return (
    <mesh scale={radius * 1.08}>
      <sphereGeometry args={[1, 48, 32]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        side={BackSide}
        uniforms={{
          glowColor: { value: preset === 'earth' ? [0.42, 0.68, 1.0] : [0.85, 0.48, 0.22] },
        }}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vWorld;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `}
        fragmentShader={`
          uniform vec3 glowColor;
          varying vec3 vNormal;
          varying vec3 vWorld;
          void main() {
            vec3 viewDir = normalize(cameraPosition - vWorld);
            float fresnel = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 2.4);
            gl_FragColor = vec4(glowColor, fresnel * 0.55);
          }
        `}
      />
      <mesh scale={0.985}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshBasicMaterial color={color} transparent opacity={preset === 'earth' ? 0.07 : 0.1} />
      </mesh>
    </mesh>
  )
}
