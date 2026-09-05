import { aimDirection, mulAdd, type Frame, type Vec3 } from './vec';

/** Tank dimensions in world units. Shared by the renderer and the simulation. */
export const TANK = {
  length: 3.2,
  width: 2.2,
  bodyHeight: 0.95,
  trackHeight: 0.5,
  turretRadius: 0.9,
  turretHeight: 0.7,
  barrelLength: 2.8,
  barrelRadius: 0.17,
} as const;

/** Height of the barrel pivot above the ground contact point. */
export const PIVOT_HEIGHT = TANK.trackHeight + TANK.bodyHeight * 0.5 + TANK.turretHeight * 0.6;

/** World position the shell leaves from — the tip of the barrel. */
export function muzzlePoint(
  position: Vec3,
  frame: Frame,
  bearingDeg: number,
  elevationDeg: number,
): Vec3 {
  const pivot = mulAdd(position, frame.up, PIVOT_HEIGHT);
  const dir = aimDirection(frame, bearingDeg, elevationDeg);
  return mulAdd(pivot, dir, TANK.barrelLength);
}
