import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { Planet } from '../sim/planet'
import { useStore } from '../state/store'

/** The planet surface: a CPU heightmap mesh uploaded once, patched after each crater. */
export function Terrain({ planet }: { planet: Planet }) {
  const version = useStore((s) => s.planetVersion)
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(planet.positions, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(planet.normals, 3))
    g.setAttribute('color', new THREE.BufferAttribute(planet.colors, 3))
    g.setIndex(new THREE.BufferAttribute(planet.indices, 1))
    g.computeBoundingSphere()
    return g
  }, [planet])

  useEffect(() => () => geometry.dispose(), [geometry])

  useEffect(() => {
    const dirty = planet.dirty
    if (!dirty) return
    for (const name of ['position', 'normal', 'color'] as const) {
      const attr = geometry.getAttribute(name) as THREE.BufferAttribute
      attr.clearUpdateRanges()
      attr.addUpdateRange(dirty.start * 3, dirty.count * 3)
      attr.needsUpdate = true
    }
  }, [geometry, planet, version])

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <meshStandardMaterial vertexColors roughness={0.92} metalness={0.02} />
    </mesh>
  )
}
