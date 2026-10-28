export const OPENING_OVERVIEW_HOLD = .65;
export const OPENING_APPROACH_DURATION = 2;
export const OPENING_ORBIT_DURATION = 1.45;

const clamp01 = value => Math.max(0, Math.min(1, value));
const easeInOut = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

function interpolateView(from, to, t) {
  const progress = easeInOut(t);
  return {
    target: {
      x: lerp(from.target.x, to.target.x, progress),
      y: lerp(from.target.y, to.target.y, progress),
      z: lerp(from.target.z, to.target.z, progress),
    },
    theta: lerpAngle(from.theta, to.theta, progress),
    phi: lerp(from.phi, to.phi, progress),
    distance: lerp(from.distance, to.distance, progress),
    fov: lerp(from.fov, to.fov, progress),
  };
}

/** Sample the first-load camera move from a location overview to the spawn, then around the player. */
export function sampleOpeningCinematic(views, elapsed) {
  const time = Math.max(0, elapsed);
  if (time < OPENING_OVERVIEW_HOLD) return { phase: 'overview', view: views.overview, showPlayer: false, complete: false };
  const approachEnd = OPENING_OVERVIEW_HOLD + OPENING_APPROACH_DURATION;
  if (time < approachEnd) return {
    phase: 'approach',
    view: interpolateView(views.overview, views.arrival, (time - OPENING_OVERVIEW_HOLD) / OPENING_APPROACH_DURATION),
    showPlayer: false,
    complete: false,
  };
  const orbitEnd = approachEnd + OPENING_ORBIT_DURATION;
  if (time < orbitEnd) return {
    phase: 'orbit',
    view: interpolateView(views.arrival, views.gameplay, (time - approachEnd) / OPENING_ORBIT_DURATION),
    showPlayer: true,
    complete: false,
  };
  return { phase: 'complete', view: views.gameplay, showPlayer: true, complete: true };
}
