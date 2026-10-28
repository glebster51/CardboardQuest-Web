const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const PLAYER_COMBAT_CHARGE_RECHARGE_INTERVAL = 3;
export const PLAYER_PEACEFUL_CHARGE_RECHARGE_INTERVAL = 1;

export function playerChargeRechargeInterval(enemies = []) {
  return enemies.some(enemy => enemy.active !== false && enemy.health > 0 && !enemy.fell && enemy.combatAwake)
    ? PLAYER_COMBAT_CHARGE_RECHARGE_INTERVAL
    : PLAYER_PEACEFUL_CHARGE_RECHARGE_INTERVAL;
}

export function spendCharge(unit) {
  if (!unit || unit.charges <= 0) return false;
  if (unit.charges >= unit.maxCharges) unit.rechargeTimer = 0;
  unit.charges--;
  if (unit.chargePop) unit.chargePop[unit.charges] = 0;
  return true;
}

export function refillCharges(unit) {
  if (!unit || !Number.isFinite(unit.maxCharges) || unit.maxCharges < 0) return false;
  unit.charges = unit.maxCharges;
  unit.rechargeTimer = 0;
  if (Array.isArray(unit.chargePop)) unit.chargePop.fill(0);
  return true;
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
