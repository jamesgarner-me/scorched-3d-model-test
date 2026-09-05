import * as THREE from 'three';

/**
 * The camera's wish-list, written by the scene each frame and read by the rig.
 * Kept outside React so per-frame changes never trigger a re-render.
 */
export const focus = {
  target: new THREE.Vector3(),
  up: new THREE.Vector3(0, 1, 0),
  distance: 30,
  /** Set once to swing the camera behind the turret at the start of a turn. */
  snapAzimuth: null as number | null,
  snapPolar: null as number | null,
  /** Jump instead of easing — used when a new planet appears. */
  immediate: false,
  /** How hard to ease. 1 = normal, higher = snappier follow during flight. */
  urgency: 1,
  /** Bumped to clear the user's pan offset. */
  panEpoch: 0,
  shake: 0,
};

export function requestShake(amount: number): void {
  focus.shake = Math.max(focus.shake, amount);
}

export function resetPan(): void {
  focus.panEpoch += 1;
}
