/** Minimal allocation-light vector helpers for the headless sim. */
export type V3 = { x: number; y: number; z: number }

export const v3 = (x = 0, y = 0, z = 0): V3 => ({ x, y, z })
export const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
export const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
export const scale = (a: V3, s: number): V3 => ({ x: a.x * s, y: a.y * s, z: a.z * s })
export const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z
export const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
export const length = (a: V3): number => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z)
export const distance = (a: V3, b: V3): number => length(sub(a, b))
export const normalize = (a: V3): V3 => {
  const l = length(a) || 1
  return { x: a.x / l, y: a.y / l, z: a.z / l }
}
export const lerp = (a: V3, b: V3, t: number): V3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t })

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const DEG = Math.PI / 180
export const RAD = 180 / Math.PI

/** Unit direction from longitude/latitude (radians). */
export function dirFromLonLat(lon: number, lat: number): V3 {
  const c = Math.cos(lat)
  return { x: c * Math.cos(lon), y: Math.sin(lat), z: c * Math.sin(lon) }
}

/** Longitude in [0, 2π), latitude in [-π/2, π/2] from any non-zero vector. */
export function lonLatFromDir(d: V3): { lon: number; lat: number } {
  const r = length(d) || 1
  const lat = Math.asin(clamp(d.y / r, -1, 1))
  let lon = Math.atan2(d.z, d.x)
  if (lon < 0) lon += Math.PI * 2
  return { lon, lat }
}

/** Great-circle surface distance between two points on/above a planet of radius r. */
export function surfaceDistance(a: V3, b: V3, r: number): number {
  const d = dot(normalize(a), normalize(b))
  return r * Math.acos(clamp(d, -1, 1))
}

/** Local tangent frame at a surface point: up (radial), north, east. */
export type Frame = { up: V3; north: V3; east: V3 }

export function frameAt(p: V3): Frame {
  const up = normalize(p)
  const poleRef: V3 = Math.abs(up.y) > 0.99 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
  const north = normalize(sub(poleRef, scale(up, dot(poleRef, up))))
  const east = cross(north, up)
  return { up, north, east }
}

/** World-space direction for a turret at `frame` with bearing (clockwise from north) and elevation, both radians. */
export function aimDirection(frame: Frame, bearing: number, elevation: number): V3 {
  const flat = add(scale(frame.north, Math.cos(bearing)), scale(frame.east, Math.sin(bearing)))
  return add(scale(flat, Math.cos(elevation)), scale(frame.up, Math.sin(elevation)))
}

/** Bearing (radians, clockwise from north) from point a toward point b along the great circle. */
export function bearingTo(a: V3, b: V3): number {
  const f = frameAt(a)
  const t = normalize(sub(b, scale(f.up, dot(b, f.up))))
  return Math.atan2(dot(t, f.east), dot(t, f.north))
}

/** Express a world vector in the tangent frame at a point as (east, north) components. */
export function toLocalTangent(frame: Frame, v: V3): { east: number; north: number } {
  return { east: dot(v, frame.east), north: dot(v, frame.north) }
}

export function wrapAngle(a: number): number {
  a = a % (Math.PI * 2)
  if (a < 0) a += Math.PI * 2
  return a
}
