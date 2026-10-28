/** Mark only the enemy that took the player's first, direct hit in a launch. */
export function markDirectPlayerHit(attacker, target) {
  if (attacker.team !== 'player' || target.team !== 'enemy' || (attacker.attackRicochets || 0) !== 0) return false;
  target.directHitProtection = true;
  return true;
}

/** The directly hit enemy cannot hurt the player while its attack-speed rebound continues. */
export function canEnemyDamagePlayer(attacker, target, directHitProtection = attacker.directHitProtection) {
  return !(attacker.team === 'enemy' && target.team === 'player' && directHitProtection);
}

/** End protection once the hit enemy has left its attack phase. */
export function clearDirectHitProtectionWhenSafe(enemy, attacking) {
  if (!enemy.directHitProtection || attacking) return false;
  enemy.directHitProtection = false;
  return true;
}
