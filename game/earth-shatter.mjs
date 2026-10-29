import { OGRE_SETTINGS as settings } from '../bosses/ogre/settings.mjs?v=ab782efa5048549c';
export const EARTH_SHATTER_ROCK_COUNT = 7;
export const EARTH_SHATTER_LINE_SPACING = 1.18;
export const EARTH_SHATTER_FIRST_OFFSET = 1.7;
export const EARTH_SHATTER_SPAWN_INTERVAL = .12;
export const EARTH_SHATTER_SPAWN_SPAN = (EARTH_SHATTER_ROCK_COUNT - 1) * EARTH_SHATTER_SPAWN_INTERVAL;
export const EARTH_SHATTER_DANGER_DURATION = 1;
export const EARTH_SHATTER_IDLE_DURATION = 5;
export const EARTH_SHATTER_DAMAGE_QUARTERS = 4;
export const EARTH_SHATTER_WINDUP_DURATION = .78;
export const EARTH_SHATTER_KNOCKBACK_DURATION = .58;
export const EARTH_SHATTER_KNOCKBACK_DISTANCE = 3;
export const EARTH_SHATTER_KNOCKBACK_HEIGHT = .58;
export const EARTH_SHATTER_ATTACK_POSE_DURATION = .2;

export function earthShatterAttackPoseActive(age) {
  return Number.isFinite(age) && age >= 0 && age < settings.attackPoseDuration;
}

export function earthShatterPositions(x, z, angle, count = settings.waveRockCount) {
  const size = Math.max(0, Math.trunc(count));
  const directionX = Math.sin(angle), directionZ = Math.cos(angle);
  return Array.from({ length: size }, (_, index) => {
    const distance = settings.waveFirstOffset + index * settings.waveRockSpacing;
    return { x: x + directionX * distance, z: z + directionZ * distance,
      forwardX: directionX, forwardZ: directionZ,
      spawnAt: index * settings.waveRockInterval };
  });
}

export function createEarthShatterKnockback(body, originX, originZ, forwardX, forwardZ, tieBreak = 0) {
  const forwardLength = Math.hypot(forwardX, forwardZ) || 1;
  const sideX = -forwardZ / forwardLength, sideZ = forwardX / forwardLength;
  const relativeSide = ((body.x - originX) * sideX + (body.z - originZ) * sideZ);
  const side = Math.abs(relativeSide) > .08
    ? Math.sign(relativeSide)
    : (tieBreak % 2 === 0 ? 1 : -1);
  return {
    elapsed: 0,
    duration: settings.knockbackDuration,
    startX: body.x,
    startZ: body.z,
    sideX: sideX * side,
    sideZ: sideZ * side,
    distance: settings.knockbackDistance,
    height: settings.knockbackHeight,
  };
}

export function advanceEarthShatterKnockback(body, dt) {
  const motion = body.earthShatterKnockback;
  if (!motion) return false;
  motion.elapsed = Math.min(motion.duration, motion.elapsed + Math.max(0, dt));
  const t = motion.duration > 0 ? motion.elapsed / motion.duration : 1;
  const eased = t * t * (3 - 2 * t);
  body.x = motion.startX + motion.sideX * motion.distance * eased;
  body.z = motion.startZ + motion.sideZ * motion.distance * eased;
  body.earthShatterHeight = Math.sin(Math.PI * t) * motion.height;
  if (t < 1) return true;
  body.earthShatterHeight = 0;
  body.earthShatterKnockback = null;
  return false;
}

export function createEarthShatterWave(positions, ownerId) {
  return { positions: positions.map(point => ({ ...point })), ownerId, age: 0, next: 0 };
}

export function advanceEarthShatterWave(wave, dt) {
  wave.age += Math.max(0, dt);
  const spawned = [];
  while (wave.next < wave.positions.length && wave.positions[wave.next].spawnAt <= wave.age + 1e-8)
    spawned.push(wave.positions[wave.next++]);
  return { spawned, complete: wave.next >= wave.positions.length };
}

export function earthShatterRockCanDamage(age) {
  return age >= 0 && age < settings.rockDangerDuration;
}

export function earthShatterRockLifetime() {
  return settings.rockDangerDuration + settings.rockIdleDuration;
}
