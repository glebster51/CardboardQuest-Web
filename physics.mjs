import { hazardAtPoint } from './game/world-hazards.mjs';

// World-space XZ motion. Constant friction gives a finite, frame-independent stop.
export const MAX_PULL = 1.8;
// Distance under constant friction is proportional to speed squared.
export const LAUNCH_GAIN = 8.5 * Math.SQRT2;
export const FRICTION = 6.5;
export const REBOUND = 0.55;
export const LIMIT_X = 11.1;
export const LIMIT_Z = 9.1;
export const PUCK_RADIUS = .8;
export const COLLISION_RESTITUTION = .82;
export const ATTACK_SPEED = 5;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
// Authored walkable footprint. The same polygon drives puck collision and the
// tabletop top face; the surrounding cardboard terraces occupy its exterior.
export const WALKABLE_POINTS = [
  { x: -8.4, z: -6.4 }, { x: -5.8, z: -7.7 }, { x: -2.9, z: -7.5 },
  { x: -.1, z: -8.1 }, { x: 2.7, z: -7.4 }, { x: 5.8, z: -7.7 },
  { x: 8.5, z: -6.1 }, { x: 10.3, z: -3.7 }, { x: 10.7, z: -.8 },
  { x: 9.8, z: 1.8 }, { x: 10.4, z: 4.5 }, { x: 8.2, z: 6.8 },
  { x: 5.5, z: 7.5 }, { x: 2.9, z: 7.2 }, { x: .1, z: 8.15 },
  { x: -2.6, z: 7.6 }, { x: -5.7, z: 7.8 }, { x: -8.6, z: 6.2 },
  { x: -10.2, z: 3.8 }, { x: -10.7, z: .7 }, { x: -9.8, z: -2.1 },
  { x: -10.5, z: -4.7 },
];
export const ARENA_POINTS = WALKABLE_POINTS;

export function isAttacking(body) {
  return Math.hypot(body.vx, body.vz) >= ATTACK_SPEED;
}

export function turnToward(current, target, dt) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-16 * Math.max(0, dt)));
}

// The printed front faces local +Z; retain the last direction when stopped.
export function facingAngle(x, z, previous) {
  return Math.hypot(x, z) > 0.0001 ? Math.atan2(x, z) : previous;
}

export function clampPull(x, z) {
  const length = Math.hypot(x, z);
  const scale = length > MAX_PULL ? MAX_PULL / length : 1;
  return { x: x * scale, z: z * scale };
}

export function launch(state, drag) {
  const pull = clampPull(drag.x, drag.z);
  state.vx = -pull.x * LAUNCH_GAIN || 0;
  state.vz = -pull.z * LAUNCH_GAIN || 0;
}

export function advance(state, dt, arenaPoints = ARENA_POINTS, fallZones = [], canFall = false) {
  const speed = Math.hypot(state.vx, state.vz);
  if (speed === 0 || dt <= 0) return 0;
  const travelTime = Math.min(dt, speed / FRICTION);
  const displacement = speed * travelTime - 0.5 * FRICTION * travelTime ** 2;
  const nx = state.vx / speed, nz = state.vz / speed;
  state.x += nx * displacement;
  state.z += nz * displacement;
  const nextSpeed = Math.max(0, speed - FRICTION * dt);
  state.vx = nx * nextSpeed;
  state.vz = nz * nextSpeed;
  return confine(state, arenaPoints, fallZones, canFall);
}

function confine(state, arenaPoints, fallZones = [], canFall = false) {
  let inside = false;
  for (let i = 0, j = arenaPoints.length - 1; i < arenaPoints.length; j = i++) {
    const a = arenaPoints[i], b = arenaPoints[j];
    if ((a.z > state.z) !== (b.z > state.z) && state.x < (b.x - a.x) * (state.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  let nearestX = 0, nearestZ = 0, nearestDistance = Infinity;
  for (let i = 0; i < arenaPoints.length; i++) {
    const a = arenaPoints[i], b = arenaPoints[(i + 1) % arenaPoints.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = clamp(((state.x - a.x) * dx + (state.z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
    const x = a.x + dx * t, z = a.z + dz * t;
    const distance = (state.x - x) ** 2 + (state.z - z) ** 2;
    if (distance < nearestDistance) { nearestDistance = distance; nearestX = x; nearestZ = z; }
  }
  let inX = inside ? state.x - nearestX : nearestX - state.x;
  let inZ = inside ? state.z - nearestZ : nearestZ - state.z;
  const length = Math.hypot(inX, inZ) || 1;
  inX /= length; inZ /= length;
  const outX = -inX, outZ = -inZ;
  const outwardSpeed = state.vx * outX + state.vz * outZ;
  if (inside && nearestDistance >= PUCK_RADIUS ** 2) return 0;
  if (canFall && outwardSpeed > .02 && fallZones.some(zone => Math.hypot(zone.x - nearestX, zone.z - nearestZ) <= zone.radius)) {
    state.fell = true;
    state.vx = 0; state.vz = 0;
    return 0;
  }
  state.x = nearestX + inX * (PUCK_RADIUS - .001);
  state.z = nearestZ + inZ * (PUCK_RADIUS - .001);
  if (outwardSpeed <= 0) return 0;
  state.vx -= (1 + REBOUND) * outwardSpeed * outX;
  state.vz -= (1 + REBOUND) * outwardSpeed * outZ;
  return outwardSpeed;
}

// Equal-mass discs. A disc held for aiming has zero inverse mass.
export function collide(a, b, held = null) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const distance = Math.hypot(dx, dz);
  const radiusA = a.radius ?? PUCK_RADIUS, radiusB = b.radius ?? PUCK_RADIUS;
  const diameter = radiusA + radiusB;
  if (distance >= diameter) return 0;
  const nx = distance > 1e-8 ? dx / distance : 1;
  const nz = distance > 1e-8 ? dz / distance : 0;
  const ia = a.fixed || a === held ? 0 : 1, ib = b.fixed || b === held ? 0 : 1;
  const inverseMass = ia + ib;
  if (!inverseMass) return 0;
  const separation = (diameter - distance) / inverseMass;
  a.x -= nx * separation * ia; a.z -= nz * separation * ia;
  b.x += nx * separation * ib; b.z += nz * separation * ib;
  const closingSpeed = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  if (closingSpeed >= 0) return 0;
  const impulse = -(1 + COLLISION_RESTITUTION) * closingSpeed / inverseMass;
  a.vx -= nx * impulse * ia; a.vz -= nz * impulse * ia;
  b.vx += nx * impulse * ib; b.vz += nz * impulse * ib;
  return -closingSpeed;
}

export function advanceWorld(bodies, dt, held = null, onImpact = null, arenaPoints = ARENA_POINTS, options = {}) {
  const fallZones = options.fallZones ?? [];
  const canFall = body => options.fallable?.(body) ?? false;
  const fallIntoHole = body => {
    if (!body.fell && canFall(body) && hazardAtPoint(body.x, body.z, options.hazards)) {
      body.fell = true; body.vx = 0; body.vz = 0;
      options.onFall?.(body);
      return true;
    }
    return false;
  };
  const confineBody = body => {
    if (body.fell || fallIntoHole(body)) return;
    const strength = confine(body, arenaPoints, fallZones, canFall(body));
    if (body.fell) options.onFall?.(body);
    else if (strength > .4) onImpact?.(body, null, strength);
  };
  for (const body of bodies) if (!body.fixed && body !== held && !body.fell) {
    const strength = advance(body, dt, arenaPoints, fallZones, canFall(body));
    if (body.fell) { options.onFall?.(body); continue; }
    if (fallIntoHole(body)) continue;
    if (strength > .4) onImpact?.(body, null, strength);
  }
  // Reconcile overlap with the table edges after each contact pass.
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        if (a.fell || b.fell) continue;
        const attackingA = isAttacking(a), attackingB = isAttacking(b);
        const strength = collide(a, b, held);
        if (strength > .4) onImpact?.(a, b, strength, attackingA, attackingB);
      }
    }
    for (const body of bodies) if (!body.fixed && body !== held && !body.fell) confineBody(body);
  }
}
