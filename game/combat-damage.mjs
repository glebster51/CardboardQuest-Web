// @ts-check
/** @typedef {{health: number, hitCooldown?: number, aiStunRemaining?: number, team: string}} DamageTarget */
/** Pure damage/cooldown policy; presentation and rewards consume its result.
 * @param {DamageTarget} target
 * @param {number} quarters
 * @param {{statusTick?: boolean, mitigate?: (damage: number) => number}} options
 */
export function applyCombatDamage(target, quarters, { statusTick = false, mitigate = damage => damage } = {}) {
  if ((!statusTick && (target.hitCooldown ?? 0) > 0) || target.health <= 0) return null;
  const previousHealth = target.health, raw = Math.max(1, Math.trunc(quarters));
  target.health = Math.max(0, previousHealth - (target.team === 'player' && !statusTick ? mitigate(raw) : raw));
  if (!statusTick) {
    target.hitCooldown = .65;
    if (target.team === 'enemy') target.aiStunRemaining = Math.max(target.aiStunRemaining || 0, .55);
  }
  return { previousHealth, health: target.health, killed: target.health === 0 };
}
