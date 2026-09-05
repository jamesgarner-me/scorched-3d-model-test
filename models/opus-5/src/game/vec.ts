/** Minimal headless 3D vector maths. No Three.js — the simulation must run in Node for tests. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
/** a + b * s — the workhorse of the integrator. */
export const mulAdd = (a: Vec3, b: Vec3, s: number): Vec3 => ({
  x: a.x + b.x * s,
  y: a.y + b.y * s,
  z: a.z + b.z * s,
});
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const len = (a: Vec3): number => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
export const dist = (a: Vec3, b: Vec3): number => len(sub(a, b));
export const norm = (a: Vec3): Vec3 => {
  const l = len(a);
  return l > 1e-9 ? scale(a, 1 / l) : { x: 0, y: 1, z: 0 };
};
export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

/** Angle in radians between two directions (they need not be unit length). */
export function angleBetween(a: Vec3, b: Vec3): number {
  const c = clamp(dot(norm(a), norm(b)), -1, 1);
  return Math.acos(c);
}

/** Rotate `v` about unit axis `axis` by `angle` radians (Rodrigues). */
export function rotateAbout(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = cross(axis, v);
  const d = dot(axis, v) * (1 - c);
  return {
    x: v.x * c + k.x * s + axis.x * d,
    y: v.y * c + k.y * s + axis.y * d,
    z: v.z * c + k.z * s + axis.z * d,
  };
}

/**
 * Local surface frame at a point on the sphere.
 * `up` points away from the planet centre; `north`/`east` span the tangent plane.
 * Bearing 0 aims north and increases towards east.
 */
export interface Frame {
  up: Vec3;
  north: Vec3;
  east: Vec3;
}

const POLAR: Vec3 = { x: 0, y: 1, z: 0 };
const FALLBACK: Vec3 = { x: 0, y: 0, z: 1 };

export function surfaceFrame(position: Vec3): Frame {
  const up = norm(position);
  const ref = Math.abs(dot(up, POLAR)) > 0.985 ? FALLBACK : POLAR;
  const north = norm(sub(ref, scale(up, dot(ref, up))));
  const east = cross(north, up);
  return { up, north, east };
}

/** Convert bearing/elevation (degrees) in a surface frame into a unit direction. */
export function aimDirection(frame: Frame, bearingDeg: number, elevationDeg: number): Vec3 {
  const b = bearingDeg * DEG;
  const e = elevationDeg * DEG;
  const ce = Math.cos(e);
  return norm({
    x: frame.north.x * ce * Math.cos(b) + frame.east.x * ce * Math.sin(b) + frame.up.x * Math.sin(e),
    y: frame.north.y * ce * Math.cos(b) + frame.east.y * ce * Math.sin(b) + frame.up.y * Math.sin(e),
    z: frame.north.z * ce * Math.cos(b) + frame.east.z * ce * Math.sin(b) + frame.up.z * Math.sin(e),
  });
}

/** Compass bearing (degrees, 0 = north, clockwise) of a world direction seen from `frame`. */
export function bearingOf(frame: Frame, direction: Vec3): number {
  const d = norm(direction);
  const n = dot(d, frame.north);
  const e = dot(d, frame.east);
  const deg = Math.atan2(e, n) * RAD;
  return (deg + 360) % 360;
}

/** Great-circle bearing from `origin` towards `target`, both on the sphere. */
export function bearingTo(frame: Frame, origin: Vec3, target: Vec3): number {
  const delta = sub(target, origin);
  const tangent = sub(delta, scale(frame.up, dot(delta, frame.up)));
  return bearingOf(frame, tangent);
}
