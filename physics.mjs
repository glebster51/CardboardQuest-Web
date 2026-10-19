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
export const ARENA_POINTS = Array.from({ length: 48 }, (_, index) => {
  const angle = index / 48 * Math.PI * 2;
  const radius = 1 + .035 * Math.sin(angle * 3 + .4) + .02 * Math.sin(angle * 7);
  return { x: Math.cos(angle) * 10.8 * radius, z: Math.sin(angle) * 8.55 * radius };
});

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

export function advance(state, dt) {
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
  return confine(state);
}

function confine(state) {
  let inside = false;
  for (let i = 0, j = ARENA_POINTS.length - 1; i < ARENA_POINTS.length; j = i++) {
    const a = ARENA_POINTS[i], b = ARENA_POINTS[j];
    if ((a.z > state.z) !== (b.z > state.z) && state.x < (b.x - a.x) * (state.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  let nearestX = 0, nearestZ = 0, nearestDistance = Infinity;
  for (let i = 0; i < ARENA_POINTS.length; i++) {
    const a = ARENA_POINTS[i], b = ARENA_POINTS[(i + 1) % ARENA_POINTS.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = clamp(((state.x - a.x) * dx + (state.z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
    const x = a.x + dx * t, z = a.z + dz * t;
    const distance = (state.x - x) ** 2 + (state.z - z) ** 2;
    if (distance < nearestDistance) { nearestDistance = distance; nearestX = x; nearestZ = z; }
  }
  if (inside && nearestDistance >= PUCK_RADIUS ** 2) return 0;
  let inX = inside ? state.x - nearestX : nearestX - state.x;
  let inZ = inside ? state.z - nearestZ : nearestZ - state.z;
  const length = Math.hypot(inX, inZ) || 1;
  inX /= length; inZ /= length;
  state.x = nearestX + inX * (PUCK_RADIUS - .001);
  state.z = nearestZ + inZ * (PUCK_RADIUS - .001);
  const outX = -inX, outZ = -inZ;
  const outwardSpeed = state.vx * outX + state.vz * outZ;
  if (outwardSpeed <= 0) return 0;
  state.vx -= (1 + REBOUND) * outwardSpeed * outX;
  state.vz -= (1 + REBOUND) * outwardSpeed * outZ;
  return outwardSpeed;
}

// Equal-mass discs. A disc held for aiming has zero inverse mass.
export function collide(a, b, held = null) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const distance = Math.hypot(dx, dz);
  const diameter = PUCK_RADIUS * 2;
  if (distance >= diameter) return 0;
  const nx = distance > 1e-8 ? dx / distance : 1;
  const nz = distance > 1e-8 ? dz / distance : 0;
  const ia = a === held ? 0 : 1, ib = b === held ? 0 : 1;
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

export function advanceWorld(bodies, dt, held = null, onImpact = null) {
  for (const body of bodies) if (body !== held) {
    const strength = advance(body, dt);
    if (strength > .4) onImpact?.(body, null, strength);
  }
  // Reconcile overlap with the table edges after each contact pass.
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        const attackingA = isAttacking(a), attackingB = isAttacking(b);
        const strength = collide(a, b, held);
        if (strength > .4) onImpact?.(a, b, strength, attackingA, attackingB);
      }
    }
    for (const body of bodies) if (body !== held) {
      const strength = confine(body);
      if (strength > .4) onImpact?.(body, null, strength);
    }
  }
}
