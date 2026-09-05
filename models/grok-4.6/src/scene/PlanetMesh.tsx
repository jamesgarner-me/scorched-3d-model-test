import { useEffect, useState } from 'react'
import type { BufferGeometry } from 'three'
import type { Planet } from '../game/planet.ts'
import { buildPlanetGeometry, updatePlanetGeometry } from './planetGeometry.ts'

export function PlanetMesh({
  planet,
  version,
}: {
  planet: Planet
  version: number
}) {
  const [geometry, setGeometry] = useState<BufferGeometry>(() => buildPlanetGeometry(planet))

  useEffect(() => {
    const geo = buildPlanetGeometry(planet)
    setGeometry(geo)
    return () => {
      geo.dispose()
    }
  }, [planet.seed, planet.preset])

  useEffect(() => {
    if (version <= 1) return
    updatePlanetGeometry(geometry, planet)
  }, [geometry, planet, version])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.86} metalness={0.04} />
    </mesh>
  )
}
