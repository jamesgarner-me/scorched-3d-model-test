import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { EffectEvent } from '../game/types.ts'
import { createRng } from '../game/rng.ts'

export function Effects({ event }: { event: EffectEvent | null }) {
  if (!event) return null
  return <Burst key={event.id} event={event} />
}

function Burst({ event }: { event: EffectEvent }) {
  const group = useRef<Group>(null)
  const bits = useMemo(() => {
    const rng = createRng(`fx:${event.id}`)
    return Array.from({ length: event.kind === 'destruction' ? 36 : 22 }, () => ({
      dir: [
        rng() * 2 - 1,
        rng() * 2 - 0.2,
        rng() * 2 - 1,
      ] as [number, number, number],
      speed: 3 + rng() * 9,
      size: 0.08 + rng() * 0.22,
    }))
  }, [event.id, event.kind])
  const born = useRef(-1)

  useFrame(({ clock }) => {
    if (!group.current) return
    if (born.current < 0) born.current = clock.elapsedTime
    const age = clock.elapsedTime - born.current
    const life = event.kind === 'destruction' ? 2.4 : 1.1
    const t = Math.min(1, age / life)
    group.current.children.forEach((child, i) => {
      const bit = bits[i]
      if (!bit) return
      child.position.set(
        event.position[0] + bit.dir[0] * bit.speed * age,
        event.position[1] + bit.dir[1] * bit.speed * age,
        event.position[2] + bit.dir[2] * bit.speed * age,
      )
      const s = bit.size * (1 - t)
      child.scale.setScalar(Math.max(0.01, s))
    })
    group.current.visible = t < 1
  })

  const color =
    event.kind === 'splash' ? '#9ad4e0' : event.kind === 'destruction' ? '#ff8a3a' : '#ffb347'

  return (
    <group ref={group}>
      <mesh position={event.position}>
        <sphereGeometry args={[event.kind === 'destruction' ? 1.8 : 0.9, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} />
      </mesh>
      {bits.map((bit, i) => (
        <mesh key={i} position={event.position}>
          <sphereGeometry args={[bit.size, 6, 6]} />
          <meshBasicMaterial color={i % 3 === 0 ? '#2a1c14' : color} />
        </mesh>
      ))}
      {(event.kind === 'explosion' || event.kind === 'destruction') && (
        <pointLight position={event.position} color="#ff7a30" intensity={event.kind === 'destruction' ? 40 : 22} distance={24} />
      )}
    </group>
  )
}
