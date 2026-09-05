import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, DoubleSide, RepeatWrapping } from 'three'
import type { Mesh } from 'three'
import type { Planet } from '../game/planet.ts'
import { createRng } from '../game/rng.ts'

function cloudTexture(seed: string): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgba(0,0,0,0)'
  ctx.fillRect(0, 0, 512, 256)
  const rng = createRng(`${seed}:clouds`)
  for (let i = 0; i < 90; i += 1) {
    const x = rng() * 512
    const y = 40 + rng() * 176
    const r = 18 + rng() * 46
    const g = ctx.createRadialGradient(x, y, 2, x, y, r)
    const a = 0.18 + rng() * 0.28
    g.addColorStop(0, `rgba(245,248,252,${a})`)
    g.addColorStop(1, 'rgba(245,248,252,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new CanvasTexture(canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  return tex
}

export function Clouds({ planet }: { planet: Planet }) {
  const ref = useRef<Mesh>(null)
  const map = useMemo(() => cloudTexture(planet.seed), [planet.seed])
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.018
  })
  if (planet.preset !== 'earth') return null
  return (
    <mesh ref={ref} scale={planet.baseRadius * 1.045}>
      <sphereGeometry args={[1, 64, 40]} />
      <meshBasicMaterial map={map} transparent depthWrite={false} side={DoubleSide} opacity={0.85} />
    </mesh>
  )
}

export function DustHaze({ planet }: { planet: Planet }) {
  if (planet.preset !== 'mars') return null
  return (
    <mesh scale={planet.baseRadius * 1.03}>
      <sphereGeometry args={[1, 32, 20]} />
      <meshBasicMaterial color="#c56a32" transparent opacity={0.08} depthWrite={false} />
    </mesh>
  )
}
