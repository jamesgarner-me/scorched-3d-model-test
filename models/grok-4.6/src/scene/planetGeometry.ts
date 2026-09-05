import { BufferAttribute, BufferGeometry } from 'three'
import { vertexDir, type Planet } from '../game/planet.ts'

export function buildPlanetGeometry(planet: Planet): BufferGeometry {
  const { lats, lons } = planet
  const positions = new Float32Array(lats * lons * 3)
  const colors = new Float32Array(lats * lons * 3)
  const uvs = new Float32Array(lats * lons * 2)

  for (let lat = 0; lat < lats; lat += 1) {
    for (let lon = 0; lon < lons; lon += 1) {
      const i = lat * lons + lon
      const dir = vertexDir(planet, lat, lon)
      const h = planet.heights[i]!
      positions[i * 3] = dir[0] * h
      positions[i * 3 + 1] = dir[1] * h
      positions[i * 3 + 2] = dir[2] * h
      colors[i * 3] = planet.colors[i * 3]!
      colors[i * 3 + 1] = planet.colors[i * 3 + 1]!
      colors[i * 3 + 2] = planet.colors[i * 3 + 2]!
      uvs[i * 2] = lon / (lons - 1)
      uvs[i * 2 + 1] = lat / (lats - 1)
    }
  }

  const indices: number[] = []
  for (let lat = 0; lat < lats - 1; lat += 1) {
    for (let lon = 0; lon < lons; lon += 1) {
      const a = lat * lons + lon
      const b = lat * lons + ((lon + 1) % lons)
      const c = (lat + 1) * lons + lon
      const d = (lat + 1) * lons + ((lon + 1) % lons)
      indices.push(a, c, b, b, c, d)
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(positions, 3))
  geo.setAttribute('color', new BufferAttribute(colors, 3))
  geo.setAttribute('uv', new BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

export function updatePlanetGeometry(geo: BufferGeometry, planet: Planet): void {
  const pos = geo.getAttribute('position')
  const col = geo.getAttribute('color')
  for (let lat = 0; lat < planet.lats; lat += 1) {
    for (let lon = 0; lon < planet.lons; lon += 1) {
      const i = lat * planet.lons + lon
      const dir = vertexDir(planet, lat, lon)
      const h = planet.heights[i]!
      pos.setXYZ(i, dir[0] * h, dir[1] * h, dir[2] * h)
      col.setXYZ(i, planet.colors[i * 3]!, planet.colors[i * 3 + 1]!, planet.colors[i * 3 + 2]!)
    }
  }
  pos.needsUpdate = true
  col.needsUpdate = true
  geo.computeVertexNormals()
}
