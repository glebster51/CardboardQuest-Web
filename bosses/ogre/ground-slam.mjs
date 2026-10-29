import { OGRE_SETTINGS as settings } from './settings.mjs?v=ab782efa5048549c';
import { createEarthShatterKnockback } from '../../game/earth-shatter.mjs?v=ab782efa5048549c';

export const GROUND_SLAM_TRIGGER_DISTANCE = 2.6;
export const GROUND_SLAM_RADIUS = 3.4;
export const GROUND_SLAM_DURATION = 1.2;
export const GROUND_SLAM_JUMP_START = .75;
export const GROUND_SLAM_ROCK_COUNT = 12;

export function groundSlamProgress(remaining) {
  return Math.max(0, Math.min(1, 1 - remaining / settings.circleDuration));
}

export function groundSlamJumpHeight(progress) {
  if (progress <= settings.circleJumpStart || progress >= 1) return 0;
  return Math.sin((progress - settings.circleJumpStart) / (1 - settings.circleJumpStart) * Math.PI) * settings.circleJumpHeight;
}

export function groundSlamPositions(zone) {
  return Array.from({ length: settings.circleRockCount }, (_, index) => {
    const angle = index / settings.circleRockCount * Math.PI * 2;
    const forwardX = Math.sin(angle), forwardZ = Math.cos(angle);
    return { x: zone.x + forwardX * settings.circleRockRadius, z: zone.z + forwardZ * settings.circleRockRadius,
      forwardX, forwardZ, spawnAt: 0 };
  });
}

export function groundSlamContains(zone, body) {
  return Math.hypot(body.x - zone.x, body.z - zone.z) <= zone.radius + (body.radius ?? 0) + 1e-8;
}

export function createGroundSlamKnockback(body, zone) {
  const dx = body.x - zone.x, dz = body.z - zone.z, distance = Math.hypot(dx, dz);
  const motion = createEarthShatterKnockback(body, zone.x, zone.z, 0, 1);
  motion.sideX = distance > .001 ? dx / distance : 0;
  motion.sideZ = distance > .001 ? dz / distance : 1;
  return motion;
}
