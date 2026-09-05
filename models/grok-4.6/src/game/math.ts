export type Vec3 = [number, number, number]

export const EPS = 1e-8

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return [x, y, z]
}

export function clone(v: Vec3): Vec3 {
  return [v[0], v[1], v[2]]
}

export function set(out: Vec3, x: number, y: number, z: number): Vec3 {
  out[0] = x
  out[1] = y
  out[2] = z
  return out
}

export function copy(out: Vec3, v: Vec3): Vec3 {
  out[0] = v[0]
  out[1] = v[1]
  out[2] = v[2]
  return out
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s]
}

export function addScaled(a: Vec3, b: Vec3, s: number): Vec3 {
  return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s]
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

export function lengthSq(v: Vec3): number {
  return dot(v, v)
}

export function length(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2])
}

export function normalize(v: Vec3): Vec3 {
  const len = length(v)
  if (len < EPS) return [0, 1, 0]
  return [v[0] / len, v[1] / len, v[2] / len]
}

export function dist(a: Vec3, b: Vec3): number {
  return length(sub(a, b))
}

export function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

export function reject(v: Vec3, n: Vec3): Vec3 {
  return sub(v, scale(n, dot(v, n)))
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function wrapAngle(rad: number): number {
  const tau = Math.PI * 2
  return ((rad % tau) + tau) % tau
}

export function deg(rad: number): number {
  return (rad * 180) / Math.PI
}

export function rad(degValue: number): number {
  return (degValue * Math.PI) / 180
}

export function mixColor(
  a: Vec3,
  b: Vec3,
  t: number,
): Vec3 {
  return lerpVec(a, b, clamp(t, 0, 1))
}

export interface LocalFrame {
  up: Vec3
  east: Vec3
  north: Vec3
}

export function localFrame(pos: Vec3): LocalFrame {
  const up = normalize(pos)
  const worldUp: Vec3 = Math.abs(up[1]) > 0.98 ? [1, 0, 0] : [0, 1, 0]
  const east = normalize(cross(worldUp, up))
  const north = cross(up, east)
  return { up, east, north }
}

export function aimDirection(frame: LocalFrame, bearing: number, elevation: number): Vec3 {
  const horiz = add(scale(frame.north, Math.cos(bearing)), scale(frame.east, Math.sin(bearing)))
  return normalize(add(scale(horiz, Math.cos(elevation)), scale(frame.up, Math.sin(elevation))))
}

export function greatCircleBearing(from: Vec3, to: Vec3): number {
  const frame = localFrame(from)
  const toward = reject(sub(to, from), frame.up)
  if (lengthSq(toward) < EPS) return 0
  const n = normalize(toward)
  return Math.atan2(dot(n, frame.east), dot(n, frame.north))
}

export function angularDistance(a: Vec3, b: Vec3): number {
  const na = normalize(a)
  const nb = normalize(b)
  return Math.acos(clamp(dot(na, nb), -1, 1))
}

export function dirFromLatLon(lat: number, lon: number): Vec3 {
  const cl = Math.cos(lat)
  return [cl * Math.sin(lon), Math.sin(lat), cl * Math.cos(lon)]
}

export function latLonFromDir(dir: Vec3): { lat: number; lon: number } {
  const n = normalize(dir)
  const lat = Math.asin(clamp(n[1], -1, 1))
  const lon = Math.atan2(n[0], n[2])
  return { lat, lon }
}
