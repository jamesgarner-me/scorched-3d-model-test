import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { store, type Effect } from '../state/store'
import { useStore } from '../state/store'

type Particle = { p: THREE.Vector3; v: THREE.Vector3; life: number; size: number; kind: 'fire' | 'smoke' | 'spray' | 'ember' }

let spriteTexture: THREE.Texture | null = null
/** Soft radial sprite so particles read as glowing puffs rather than squares. */
function particleSprite(): THREE.Texture {
  if (spriteTexture) return spriteTexture
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.6)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  spriteTexture = new THREE.CanvasTexture(canvas)
  return spriteTexture
}

const PALETTE = {
  fire: [new THREE.Color('#fff1b0'), new THREE.Color('#ff7a1a')],
  smoke: [new THREE.Color('#6a6560'), new THREE.Color('#1d1b19')],
  spray: [new THREE.Color('#e8f6ff'), new THREE.Color('#5aa7d8')],
  ember: [new THREE.Color('#ffd070'), new THREE.Color('#ff3c00')],
}

function spawn(effect: Effect): Particle[] {
  const up = new THREE.Vector3(effect.up.x, effect.up.y, effect.up.z)
  const origin = new THREE.Vector3(effect.pos.x, effect.pos.y, effect.pos.z)
  const out: Particle[] = []
  const rnd = () => Math.random() * 2 - 1
  const big = effect.kind === 'destroy'
  const push = (kind: Particle['kind'], n: number, speed: number, spread: number, life: number, size: number) => {
    for (let i = 0; i < n; i++) {
      const dir = new THREE.Vector3(rnd(), rnd(), rnd()).normalize().multiplyScalar(spread).add(up).normalize()
      out.push({ p: origin.clone(), v: dir.multiplyScalar(speed * (0.4 + Math.random() * 0.9)), life: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8), kind })
    }
  }
  if (effect.kind === 'splash') {
    push('spray', 140, 9, 0.5, 1.4, 0.5)
    push('smoke', 30, 3, 0.6, 1.6, 1.2)
  } else if (effect.kind === 'lost') {
    push('ember', 20, 2, 1, 0.8, 0.4)
  } else if (big) {
    push('fire', 220, 14, 0.9, 1.5, 1.4)
    push('ember', 160, 18, 1, 2.6, 0.5)
    push('smoke', 160, 5, 0.8, 5.5, 2.4)
  } else {
    push('fire', 110, 10, 0.8, 0.9, 1)
    push('ember', 70, 13, 1, 1.5, 0.4)
    push('smoke', 70, 4, 0.7, 2.2, 1.6)
  }
  return out
}

function EffectView({ effect }: { effect: Effect }) {
  const particles = useMemo(() => spawn(effect), [effect])
  const n = particles.length
  const positions = useMemo(() => new Float32Array(n * 3), [n])
  const colors = useMemo(() => new Float32Array(n * 3), [n])
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [positions, colors])
  const flash = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const debris = useRef<THREE.InstancedMesh>(null)
  const debrisState = useMemo(() => {
    if (effect.kind !== 'destroy') return []
    const up = new THREE.Vector3(effect.up.x, effect.up.y, effect.up.z)
    return Array.from({ length: 16 }, () => ({
      p: new THREE.Vector3(effect.pos.x, effect.pos.y, effect.pos.z),
      v: new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).multiplyScalar(0.7).add(up).normalize().multiplyScalar(6 + Math.random() * 10),
      rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      spin: new THREE.Vector3(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3),
      landed: false,
    }))
  }, [effect])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const lastTime = useRef(effect.startedAt)
  const tmpColor = useMemo(() => new THREE.Color(), [])
  const big = effect.kind === 'destroy'

  useFrame(() => {
    const s = store.get()
    const age = s.time - effect.startedAt
    const dt = Math.max(0, s.time - lastTime.current)
    lastTime.current = s.time
    const planet = s.match?.planet
    const gDir = new THREE.Vector3()
    for (let i = 0; i < n; i++) {
      const q = particles[i]
      if (q.life <= 0) { positions[i * 3 + 1] = 1e6; continue }
      if (dt > 0) {
        gDir.copy(q.p).normalize()
        const g = q.kind === 'smoke' ? -1.2 : q.kind === 'spray' ? 9 : 6
        q.v.addScaledVector(gDir, -g * dt)
        q.v.multiplyScalar(q.kind === 'smoke' ? 1 - dt * 1.6 : 1 - dt * 0.9)
        q.p.addScaledVector(q.v, dt)
        q.life -= dt
        if (planet && q.kind !== 'smoke') {
          const r = q.p.length()
          const ground = Math.max(planet.radiusAt({ x: q.p.x, y: q.p.y, z: q.p.z }), planet.waterRadius)
          if (r < ground) { q.p.multiplyScalar(ground / r); q.v.multiplyScalar(0.2); q.life -= dt * 3 }
        }
      }
      positions[i * 3] = q.p.x; positions[i * 3 + 1] = q.p.y; positions[i * 3 + 2] = q.p.z
      const pal = PALETTE[q.kind]
      const t = Math.min(1, age / (q.kind === 'smoke' ? 3 : 0.8))
      tmpColor.copy(pal[0]).lerp(pal[1], t)
      const fade = Math.max(0, Math.min(1, q.life / 0.5))
      colors[i * 3] = tmpColor.r * fade; colors[i * 3 + 1] = tmpColor.g * fade; colors[i * 3 + 2] = tmpColor.b * fade
    }
    ;(geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    ;(geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
    geometry.computeBoundingSphere()
    if (flash.current) {
      const f = big ? 0.9 : 0.45
      const k = Math.max(0, 1 - age / f)
      flash.current.scale.setScalar((big ? 8 : 4) * (1 - k * k) + 0.4)
      ;(flash.current.material as THREE.MeshBasicMaterial).opacity = k * 0.9
      flash.current.visible = k > 0
    }
    if (light.current) light.current.intensity = Math.max(0, (big ? 600 : 180) * (1 - age / (big ? 2.5 : 0.8)))
    if (debris.current && debrisState.length) {
      for (let i = 0; i < debrisState.length; i++) {
        const d = debrisState[i]
        if (dt > 0 && !d.landed) {
          gDir.copy(d.p).normalize()
          d.v.addScaledVector(gDir, -9 * dt)
          d.p.addScaledVector(d.v, dt)
          d.rot.x += d.spin.x * dt; d.rot.y += d.spin.y * dt; d.rot.z += d.spin.z * dt
          if (planet && age > 0.2) {
            const r = d.p.length()
            const ground = Math.max(planet.radiusAt({ x: d.p.x, y: d.p.y, z: d.p.z }), planet.waterRadius)
            if (r < ground + 0.15) { d.p.multiplyScalar((ground + 0.15) / r); d.landed = true }
          }
        }
        dummy.position.copy(d.p)
        dummy.rotation.copy(d.rot)
        dummy.scale.setScalar(0.25 + (i % 3) * 0.12)
        dummy.updateMatrix()
        debris.current.setMatrixAt(i, dummy.matrix)
      }
      debris.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      <points geometry={geometry} frustumCulled={false}>
        <pointsMaterial map={particleSprite()} size={big ? 1.6 : 1} vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
      {effect.kind !== 'lost' && (
        <mesh ref={flash} position={[effect.pos.x, effect.pos.y, effect.pos.z]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshBasicMaterial color={effect.kind === 'splash' ? '#cfefff' : '#ffe2a8'} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <pointLight ref={light} position={[effect.pos.x + effect.up.x * 2, effect.pos.y + effect.up.y * 2, effect.pos.z + effect.up.z * 2]} color={effect.kind === 'splash' ? '#9fd6ff' : '#ffa040'} distance={big ? 60 : 30} intensity={0} />
      {debrisState.length > 0 && (
        <instancedMesh ref={debris} args={[undefined, undefined, debrisState.length]} frustumCulled={false}>
          <boxGeometry args={[1, 0.6, 1]} />
          <meshStandardMaterial color="#2b2622" roughness={0.9} />
        </instancedMesh>
      )}
    </group>
  )
}

export function Effects() {
  const effects = useStore((s) => s.effects)
  return (
    <>
      {effects.map((e) => (
        <EffectView key={e.id} effect={e} />
      ))}
    </>
  )
}
