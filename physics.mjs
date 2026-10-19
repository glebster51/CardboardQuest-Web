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
  if (speed === 0 || dt <= 0) return;
  const travelTime = Math.min(dt, speed / FRICTION);
  const displacement = speed * travelTime - 0.5 * FRICTION * travelTime ** 2;
  const nx = state.vx / speed, nz = state.vz / speed;
  state.x += nx * displacement;
  state.z += nz * displacement;
  const nextSpeed = Math.max(0, speed - FRICTION * dt);
  state.vx = nx * nextSpeed;
  state.vz = nz * nextSpeed;
  confine(state);
}

function confine(state) {
  if (Math.abs(state.x) > LIMIT_X) {
    state.x = Math.sign(state.x) * LIMIT_X;
    state.vx = -Math.sign(state.x) * Math.abs(state.vx) * REBOUND;
  }
  if (Math.abs(state.z) > LIMIT_Z) {
    state.z = Math.sign(state.z) * LIMIT_Z;
    state.vz = -Math.sign(state.z) * Math.abs(state.vz) * REBOUND;
  }
}

// Equal-mass discs. A disc held for aiming has zero inverse mass.
export function collide(a, b, held = null) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const distance = Math.hypot(dx, dz);
  const diameter = PUCK_RADIUS * 2;
  if (distance >= diameter) return;
  const nx = distance > 1e-8 ? dx / distance : 1;
  const nz = distance > 1e-8 ? dz / distance : 0;
  const ia = a === held ? 0 : 1, ib = b === held ? 0 : 1;
  const inverseMass = ia + ib;
  if (!inverseMass) return;
  const separation = (diameter - distance) / inverseMass;
  a.x -= nx * separation * ia; a.z -= nz * separation * ia;
  b.x += nx * separation * ib; b.z += nz * separation * ib;
  const closingSpeed = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  if (closingSpeed >= 0) return;
  const impulse = -(1 + COLLISION_RESTITUTION) * closingSpeed / inverseMass;
  a.vx -= nx * impulse * ia; a.vz -= nz * impulse * ia;
  b.vx += nx * impulse * ib; b.vz += nz * impulse * ib;
}

export function advanceWorld(bodies, dt, held = null) {
  for (const body of bodies) if (body !== held) advance(body, dt);
  // Reconcile overlap with the table edges after each contact pass.
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) collide(bodies[i], bodies[j], held);
    }
    for (const body of bodies) if (body !== held) confine(body);
  }
}
