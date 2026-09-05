import type { Vec3 } from './vec';

/**
 * Tangent-warped cube sphere. Six square grids wrap the planet with near-uniform
 * spacing, and — crucially for physics — the direction→(face, u, v) mapping is exact,
 * so a height lookup is a bilinear fetch rather than a search.
 */
export interface Face {
  /** Outward normal of the cube face. */
  n: Vec3;
  /** Tangent along +u. */
  t: Vec3;
  /** Tangent along +v. */
  b: Vec3;
}

/** Ordered +X, -X, +Y, -Y, +Z, -Z. `t x b == n` on every face, so triangle winding is uniform. */
export const FACES: readonly Face[] = [
  { n: { x: 1, y: 0, z: 0 }, t: { x: 0, y: 0, z: -1 }, b: { x: 0, y: 1, z: 0 } },
  { n: { x: -1, y: 0, z: 0 }, t: { x: 0, y: 0, z: 1 }, b: { x: 0, y: 1, z: 0 } },
  { n: { x: 0, y: 1, z: 0 }, t: { x: 1, y: 0, z: 0 }, b: { x: 0, y: 0, z: -1 } },
  { n: { x: 0, y: -1, z: 0 }, t: { x: 1, y: 0, z: 0 }, b: { x: 0, y: 0, z: 1 } },
  { n: { x: 0, y: 0, z: 1 }, t: { x: 1, y: 0, z: 0 }, b: { x: 0, y: 1, z: 0 } },
  { n: { x: 0, y: 0, z: -1 }, t: { x: -1, y: 0, z: 0 }, b: { x: 0, y: 1, z: 0 } },
];

const QUARTER_PI = Math.PI / 4;

/** Grid coordinate (u, v in [-1, 1]) on a face → unit direction. */
export function faceDirection(face: number, u: number, v: number): Vec3 {
  const f = FACES[face];
  const su = Math.tan(u * QUARTER_PI);
  const sv = Math.tan(v * QUARTER_PI);
  const x = f.n.x + f.t.x * su + f.b.x * sv;
  const y = f.n.y + f.t.y * su + f.b.y * sv;
  const z = f.n.z + f.t.z * su + f.b.z * sv;
  const l = Math.sqrt(x * x + y * y + z * z);
  return { x: x / l, y: y / l, z: z / l };
}

export interface FaceUV {
  face: number;
  u: number;
  v: number;
}

/** Unit direction → the face it belongs to and its (u, v) in [-1, 1]. Exact inverse of `faceDirection`. */
export function directionToFaceUV(d: Vec3): FaceUV {
  const ax = Math.abs(d.x);
  const ay = Math.abs(d.y);
  const az = Math.abs(d.z);
  let face: number;
  if (ax >= ay && ax >= az) face = d.x >= 0 ? 0 : 1;
  else if (ay >= az) face = d.y >= 0 ? 2 : 3;
  else face = d.z >= 0 ? 4 : 5;
  const f = FACES[face];
  const a = d.x * f.n.x + d.y * f.n.y + d.z * f.n.z;
  const su = (d.x * f.t.x + d.y * f.t.y + d.z * f.t.z) / a;
  const sv = (d.x * f.b.x + d.y * f.b.y + d.z * f.b.z) / a;
  return { face, u: Math.atan(su) / QUARTER_PI, v: Math.atan(sv) / QUARTER_PI };
}
