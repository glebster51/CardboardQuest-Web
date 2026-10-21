export const CACHE_OPEN_FRAME_DELAY = .12;
export const CACHE_SQUASH_DURATION = .62;
export const CACHE_LOOT_SPAWN_DURATION = .62;
export const CACHE_PUCK_SETTLE_DURATION = .28;
export const CACHE_VICTORY_MOTION = Object.freeze({ crouch: .2, takeoff: .25, float: .38, landing: .2 });
export const CACHE_VICTORY_DURATION = Object.values(CACHE_VICTORY_MOTION).reduce((sum, duration) => sum + duration, 0);
export const CACHE_OPENING_DURATION = CACHE_VICTORY_DURATION + CACHE_PUCK_SETTLE_DURATION
  + Math.max(CACHE_SQUASH_DURATION, CACHE_OPEN_FRAME_DELAY + CACHE_LOOT_SPAWN_DURATION) + .08;

const clamp01 = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };

function bounceOut(value) {
  let t = clamp01(value);
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + .75; }
  if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + .9375; }
  t -= 2.625 / 2.75;
  return 7.5625 * t * t + .984375;
}

export function createCacheOpening() {
  return { age: 0, landed: false, opened: false, spilled: false, complete: false };
}

export function cacheOpeningPhase(opening) {
  const settleEnd = CACHE_VICTORY_DURATION + CACHE_PUCK_SETTLE_DURATION;
  if (opening.age < CACHE_VICTORY_DURATION) return 'victory';
  if (opening.age < settleEnd) return 'settle';
  if (opening.age < CACHE_OPENING_DURATION) return 'squash';
  return 'complete';
}

export function advanceCacheOpening(opening, dt) {
  const previousAge = opening.age;
  opening.age = Math.min(CACHE_OPENING_DURATION, opening.age + Math.max(0, dt));
  const settleEnd = CACHE_VICTORY_DURATION + CACHE_PUCK_SETTLE_DURATION;
  const spillAt = settleEnd + CACHE_OPEN_FRAME_DELAY;
  const completeAt = CACHE_OPENING_DURATION;
  const landed = !opening.landed && previousAge < CACHE_VICTORY_DURATION && opening.age >= CACHE_VICTORY_DURATION;
  const opened = !opening.opened && previousAge < settleEnd && opening.age >= settleEnd;
  const spilled = !opening.spilled && previousAge < spillAt && opening.age >= spillAt;
  const complete = !opening.complete && previousAge < completeAt && opening.age >= completeAt;
  opening.landed ||= landed;
  opening.opened ||= opened;
  opening.spilled ||= spilled;
  opening.complete ||= complete;

  let lift = 0, scaleX = 1, scaleY = 1, puckScale = 1, holderY = .21;
  if (opening.age < CACHE_VICTORY_MOTION.crouch) {
    const amount = smooth(opening.age / CACHE_VICTORY_MOTION.crouch);
    scaleX = 1 + .2 * amount; scaleY = 1 - .34 * amount;
  } else if (opening.age < CACHE_VICTORY_MOTION.crouch + CACHE_VICTORY_MOTION.takeoff) {
    const t = opening.age - CACHE_VICTORY_MOTION.crouch;
    const amount = smooth(t / CACHE_VICTORY_MOTION.takeoff);
    lift = .78 * amount; scaleX = 1.2 - .2 * amount; scaleY = .66 + .34 * amount;
  } else if (opening.age < CACHE_VICTORY_MOTION.crouch + CACHE_VICTORY_MOTION.takeoff + CACHE_VICTORY_MOTION.float) {
    const t = opening.age - CACHE_VICTORY_MOTION.crouch - CACHE_VICTORY_MOTION.takeoff;
    lift = .78 + .12 * Math.sin(Math.PI * t / CACHE_VICTORY_MOTION.float);
  } else if (opening.age < CACHE_VICTORY_DURATION) {
    const t = opening.age - CACHE_VICTORY_MOTION.crouch - CACHE_VICTORY_MOTION.takeoff - CACHE_VICTORY_MOTION.float;
    const amount = smooth(t / CACHE_VICTORY_MOTION.landing);
    lift = .78 * (1 - amount); scaleX = 1 + .2 * amount; scaleY = 1 - .34 * amount;
  } else if (opening.age < settleEnd) {
    puckScale = 1 - bounceOut((opening.age - CACHE_VICTORY_DURATION) / CACHE_PUCK_SETTLE_DURATION);
    holderY = .21 * puckScale;
  } else {
    puckScale = 0; holderY = 0;
    const squashAge = opening.age - settleEnd;
    const squash = cacheSquashScale(Math.min(squashAge, CACHE_SQUASH_DURATION));
    scaleX = squash.x; scaleY = squash.y;
  }
  return { phase: cacheOpeningPhase(opening),
  lift, scaleX, scaleY, puckScale, holderY, spinY: 0, openSprite: opening.opened,
  landed, opened, spilled, complete };
}

export function cacheSquashScale(age) {
  const impact = .34 * Math.exp(-Math.max(0, age) * 8) * Math.sin(Math.max(0, age) * 26);
  return { x: 1 + impact * .72, y: 1 - impact, z: 1 };
}
