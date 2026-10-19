export const FALL_DAMAGE_QUARTERS = 4;

/** Apply one heart of fall damage and put a unit back on its last safe ground position. */
export function recoverAfterFall(body, safePosition, damage = FALL_DAMAGE_QUARTERS) {
  if (!body || !Number.isFinite(safePosition?.x) || !Number.isFinite(safePosition?.z)) return null;
  const healthBefore = Number.isFinite(body.health) ? body.health : 0;
  const appliedDamage = Math.min(Math.max(0, healthBefore), Math.max(0, Math.trunc(damage)));
  body.health = Math.max(0, healthBefore - appliedDamage);
  body.x = safePosition.x; body.z = safePosition.z;
  body.vx = 0; body.vz = 0; body.fell = false;
  return { damage: appliedDamage, health: body.health, defeated: body.health === 0 };
}
