export const VICTORY_MOTION = Object.freeze({
  crouch: .2,
  takeoff: .25,
  float: .38,
  landing: .2,
  recover: .22,
});
export const VICTORY_MOTION_DURATION = Object.values(VICTORY_MOTION).reduce((sum, duration) => sum + duration, 0);

const smooth = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export function createVictoryLoop(random = Math.random) {
  return { time: 0, wait: 1 + random() * 2, spin: random() < .38, cycles: 0 };
}

export function canCelebrateLocationVictory(location, campGoblinTotal = 8) {
  const enemies = location?.enemies;
  if (!Array.isArray(enemies) || enemies.length === 0 || enemies.some(enemy => enemy.health > 0)) return false;
  if (location.kind === 'forest' && !location.combatTriggered) return false;
  if (location.kind === 'camp') return Boolean(location.bossSpawned)
    && (location.goblinsSpawned ?? 0) >= campGoblinTotal
    && (location.pendingSpawns ?? 0) === 0
    && (location.reinforcementQueue?.length ?? 0) === 0
    && enemies.some(enemy => enemy.boss);
  return true;
}

export function advanceVictoryLoop(loop, dt, random = Math.random) {
  loop.time += Math.max(0, dt);
  while (loop.time >= loop.wait + VICTORY_MOTION_DURATION) {
    loop.time -= loop.wait + VICTORY_MOTION_DURATION;
    loop.wait = 1 + random() * 2;
    loop.spin = random() < .38;
    loop.cycles++;
  }
  const actionTime = loop.time - loop.wait;
  if (actionTime < 0) return { phase: 'idle', sprite: 'idle', lift: 0, scaleX: 1, scaleY: 1, spinY: 0 };

  let t = actionTime;
  if (t < VICTORY_MOTION.crouch) {
    const amount = smooth(t / VICTORY_MOTION.crouch);
    return { phase: 'crouch', sprite: 'idle', lift: 0,
      scaleX: 1 + .2 * amount, scaleY: 1 - .34 * amount, spinY: 0 };
  }
  t -= VICTORY_MOTION.crouch;
  const flightDuration = VICTORY_MOTION.takeoff + VICTORY_MOTION.float + VICTORY_MOTION.landing;
  if (t < VICTORY_MOTION.takeoff) {
    const amount = smooth(t / VICTORY_MOTION.takeoff);
    return { phase: 'takeoff', sprite: 'attack', lift: .78 * amount,
      scaleX: 1.2 - .2 * amount, scaleY: .66 + .34 * amount,
      spinY: loop.spin ? Math.PI * 2 * t / flightDuration : 0 };
  }
  t -= VICTORY_MOTION.takeoff;
  if (t < VICTORY_MOTION.float) {
    const amount = t / VICTORY_MOTION.float;
    return { phase: 'air', sprite: 'attack', lift: .78 + .12 * Math.sin(Math.PI * amount),
      scaleX: 1, scaleY: 1,
      spinY: loop.spin ? Math.PI * 2 * (VICTORY_MOTION.takeoff + t) / flightDuration : 0 };
  }
  t -= VICTORY_MOTION.float;
  if (t < VICTORY_MOTION.landing) {
    const amount = smooth(t / VICTORY_MOTION.landing);
    return { phase: 'landing', sprite: 'attack', lift: .78 * (1 - amount),
      scaleX: 1 + .2 * amount, scaleY: 1 - .34 * amount,
      spinY: loop.spin ? Math.PI * 2 * (VICTORY_MOTION.takeoff + VICTORY_MOTION.float + t) / flightDuration : 0 };
  }
  t -= VICTORY_MOTION.landing;
  const amount = smooth(t / VICTORY_MOTION.recover);
  return { phase: 'recover', sprite: 'idle', lift: .1 * Math.sin(Math.PI * amount),
    scaleX: 1.2 - .2 * amount, scaleY: .66 + .34 * amount, spinY: 0 };
}

export function settleEnemiesForVictory(enemies) {
  let settled = 0;
  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    enemy.aiPhase = 'victory';
    enemy.aiTimer = 0;
    enemy.aiStunRemaining = 0;
    enemy.aiTargetX = undefined;
    enemy.aiTargetZ = undefined;
    enemy.aiAimDuration = 0;
    enemy.vx = 0;
    enemy.vz = 0;
    settled++;
  }
  return settled;
}
