import * as THREE from 'three';
import type { Planet } from '../game/planet';
import { terrainColor } from '../game/palette';
import { perf } from '../game/perf';

const indexCache = new Map<number, THREE.BufferAttribute>();

/** Shared triangle topology — every face has the same grid, so build it once. */
function indexFor(n: number): THREE.BufferAttribute {
  const cached = indexCache.get(n);
  if (cached) return cached;
  const quads = (n - 1) * (n - 1);
  const array = quads * 4 > 65535 ? new Uint32Array(quads * 6) : new Uint16Array(quads * 6);
  let o = 0;
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const k = j * n + i;
      array[o++] = k;
      array[o++] = k + 1;
      array[o++] = k + n;
      array[o++] = k + 1;
      array[o++] = k + n + 1;
      array[o++] = k + n;
    }
  }
  const attribute = new THREE.BufferAttribute(array, 1);
  indexCache.set(n, attribute);
  return attribute;
}

export function createFaceGeometry(planet: Planet, face: number): THREE.BufferGeometry {
  const n = planet.resolution;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
  geometry.setIndex(indexFor(n));
  updateFaceGeometry(planet, face, geometry);
  return geometry;
}

/**
 * Recompute positions, normals and vertex colours for one face.
 * Interior normals come from grid differences; edge normals are sampled through the
 * planet's global height lookup so neighbouring faces agree and seams stay invisible.
 */
export function updateFaceGeometry(planet: Planet, face: number, geometry: THREE.BufferGeometry): void {
  const started = performance.now();
  const n = planet.resolution;
  const dirs = planet.dirs[face];
  const heights = planet.heights[face];
  const carved = planet.carved[face];
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute;
  const color = geometry.getAttribute('color') as THREE.BufferAttribute;
  const px = position.array as Float32Array;
  const nx = normal.array as Float32Array;
  const cx = color.array as Float32Array;

  for (let k = 0; k < n * n; k++) {
    const o = k * 3;
    const h = heights[k];
    px[o] = dirs[o] * h;
    px[o + 1] = dirs[o + 1] * h;
    px[o + 2] = dirs[o + 2] * h;
  }

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const o = k * 3;
      let ny: [number, number, number];
      if (i === 0 || j === 0 || i === n - 1 || j === n - 1) {
        const d = planet.normalAt({ x: dirs[o], y: dirs[o + 1], z: dirs[o + 2] });
        ny = [d.x, d.y, d.z];
      } else {
        const a = (k - 1) * 3;
        const b = (k + 1) * 3;
        const c = (k - n) * 3;
        const d = (k + n) * 3;
        const ux = px[b] - px[a];
        const uy = px[b + 1] - px[a + 1];
        const uz = px[b + 2] - px[a + 2];
        const vx = px[d] - px[c];
        const vy = px[d + 1] - px[c + 1];
        const vz = px[d + 2] - px[c + 2];
        let ex = uy * vz - uz * vy;
        let ey = uz * vx - ux * vz;
        let ez = ux * vy - uy * vx;
        const l = Math.hypot(ex, ey, ez) || 1;
        ex /= l;
        ey /= l;
        ez /= l;
        if (ex * dirs[o] + ey * dirs[o + 1] + ez * dirs[o + 2] < 0) {
          ex = -ex;
          ey = -ey;
          ez = -ez;
        }
        ny = [ex, ey, ez];
      }
      nx[o] = ny[0];
      nx[o + 1] = ny[1];
      nx[o + 2] = ny[2];

      const slope = 1 - Math.min(1, Math.abs(ny[0] * dirs[o] + ny[1] * dirs[o + 1] + ny[2] * dirs[o + 2]));
      const rgb = terrainColor(planet.preset, {
        height: heights[k],
        seaLevel: planet.seaLevel,
        minHeight: planet.minHeight,
        maxHeight: planet.maxHeight,
        slope,
        carved: carved[k],
        latitude: Math.abs(dirs[o + 1]),
      });
      cx[o] = rgb[0];
      cx[o + 1] = rgb[1];
      cx[o + 2] = rgb[2];
    }
  }

  position.needsUpdate = true;
  normal.needsUpdate = true;
  color.needsUpdate = true;
  geometry.computeBoundingSphere();
  perf.terrainUploadMillis = performance.now() - started;
}
