const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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
