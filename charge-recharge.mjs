const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function shouldMaintainFullCharges(location, encounterCleared = false) {
  if (!location || (location.pendingSpawns ?? 0) > 0 || (location.reinforcementQueue?.length ?? 0) > 0) {
    return false;
  }
  // The goblin camp can have an empty field between waves, so only its
  // explicit encounter-clear state grants unlimited charges.
  if (location.kind === 'camp') return encounterCleared;
  const enemies = Array.isArray(location.enemies) ? location.enemies : [];
  return enemies.length === 0 || encounterCleared;
}

export function advanceChargeRecharge(unit, deltaSeconds, intervalSeconds = 3) {
  if (!unit || !Number.isFinite(deltaSeconds) || deltaSeconds < 0 || !(intervalSeconds > 0)) {
    throw new RangeError('Charge recharge parameters are invalid');
  }
  unit.rechargeTimer = (unit.rechargeTimer ?? 0) + deltaSeconds;
  let restored = 0;
  while (unit.rechargeTimer >= intervalSeconds) {
    unit.rechargeTimer -= intervalSeconds;
    if (unit.charges < unit.maxCharges) {
      unit.charges++;
      unit.chargePop ??= Array(unit.maxCharges).fill(0);
      unit.chargePop[unit.charges - 1] = .48;
      restored++;
    }
  }
  return restored;
}

export function chargeRechargeProgress(unit, intervalSeconds = 3) {
  if (!unit || !(intervalSeconds > 0)) throw new RangeError('Charge recharge parameters are invalid');
  return unit.charges < unit.maxCharges
    ? clamp((unit.rechargeTimer ?? 0) / intervalSeconds, 0, 1)
    : 0;
}
