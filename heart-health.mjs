export const QUARTERS_PER_HEART = 4;
export const HEALTH_HEART_SIZE = .23;
export const HEALTH_HEART_SPACING = .245;
export const HEALTH_BAR_WIDTH_AT_THREE = HEALTH_HEART_SIZE + HEALTH_HEART_SPACING * 2;
export const HEALTH_BAR_MAX_WIDTH = 1.52;
export const HEALTH_BAR_MAX_HEARTS = 8;
export const HEALTH_RESTORE_ANIMATION_DURATION = .5;

export function ricochetDamageQuarters(ricochetCount) {
  return Math.max(1, QUARTERS_PER_HEART >> Math.max(0, Math.trunc(ricochetCount)));
}

export function heartHealthLevels(healthQuarters, maxHealthQuarters) {
  const heartCount = Math.ceil(maxHealthQuarters / QUARTERS_PER_HEART);
  return Array.from({ length: heartCount }, (_, index) =>
    Math.max(0, Math.min(QUARTERS_PER_HEART, Math.trunc(healthQuarters) - index * QUARTERS_PER_HEART)));
}

/** Heart slots whose filled quarter count increased between two health values. */
export function restoredHeartIndices(previousHealth, nextHealth, maxHealth) {
  const before = Math.max(0, Math.min(Math.trunc(maxHealth), Math.trunc(previousHealth)));
  const after = Math.max(0, Math.min(Math.trunc(maxHealth), Math.trunc(nextHealth)));
  if (after <= before) return [];
  const indices = [];
  for (let quarter = before; quarter < after; quarter++) {
    const index = Math.floor(quarter / QUARTERS_PER_HEART);
    if (!indices.includes(index)) indices.push(index);
  }
  return indices;
}

/** Two quick green flashes with a brief normal-heart beat, then a lasting green fill. */
export function healthRestoreVisual(ageSeconds) {
  const age = Math.max(0, Number(ageSeconds) || 0);
  const green = age < .12 || (age >= .22 && age < .32);
  const squash = age >= HEALTH_RESTORE_ANIMATION_DURATION ? 0
    : .17 * Math.exp(-age * 5) * (.35 + .65 * Math.abs(Math.sin(age * Math.PI * 2 / .22)));
  return { green, squash, active: age < HEALTH_RESTORE_ANIMATION_DURATION };
}

/** Center hearts in a compact bar, easing its total width from 3 to 8 hearts. */
export function healthHeartLayout(heartCount) {
  const count = Math.max(0, Math.trunc(Number(heartCount) || 0));
  if (!count) return { width: 0, spacing: 0, positions: [] };
  if (count === 1) return { width: HEALTH_HEART_SIZE, spacing: 0, positions: [0] };

  const width = count <= 3
    ? HEALTH_HEART_SIZE + (count - 1) * HEALTH_HEART_SPACING
    : HEALTH_BAR_WIDTH_AT_THREE + (HEALTH_BAR_MAX_WIDTH - HEALTH_BAR_WIDTH_AT_THREE)
      * Math.min(1, (count - 3) / (HEALTH_BAR_MAX_HEARTS - 3));
  const spacing = (width - HEALTH_HEART_SIZE) / (count - 1);
  return { width, spacing, positions: Array.from({ length: count }, (_, index) =>
    (index - (count - 1) / 2) * spacing) };
}

/** Empty hearts sit behind filled hearts; the current last heart sits above all. */
export function healthHeartRenderOrder(level, index, currentLastIndex) {
  if (level <= 0) return 20 + index;
  if (index === currentLastIndex) return 1000;
  return 100 + index;
}

export function shouldShowHealthHud(team, health, maxHealth) {
  return health > 0 && (team !== 'enemy' || health < maxHealth);
}
