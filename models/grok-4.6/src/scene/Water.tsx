import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import type { Planet } from '../game/planet.ts'

export function Water({ planet }: { planet: Planet }) {
  const ref = useRef<Mesh>(null)
  const visible = planet.preset === 'earth'
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.y = clock.elapsedTime * 0.012
  })
  if (!visible) return null
  return (
    <mesh ref={ref} scale={planet.seaLevel * 0.999}>
      <sphereGeometry args={[1, 96, 64]} />
      <meshPhysicalMaterial
        color="#14607a"
        roughness={0.18}
        metalness={0.12}
        transmission={0.28}
        thickness={0.6}
        transparent
        opacity={0.86}
        envMapIntensity={0.7}
      />
    </mesh>
  )
}
