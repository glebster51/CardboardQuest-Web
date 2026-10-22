export const QUARTERS_PER_HEART = 4;

export function ricochetDamageQuarters(ricochetCount) {
  return Math.max(1, QUARTERS_PER_HEART >> Math.max(0, Math.trunc(ricochetCount)));
}

export function heartHealthLevels(healthQuarters, maxHealthQuarters) {
  const heartCount = Math.ceil(maxHealthQuarters / QUARTERS_PER_HEART);
  return Array.from({ length: heartCount }, (_, index) =>
    Math.max(0, Math.min(QUARTERS_PER_HEART, Math.trunc(healthQuarters) - index * QUARTERS_PER_HEART)));
}

export function shouldShowHealthHud(team, health, maxHealth) {
  return health > 0 && (team !== 'enemy' || health < maxHealth);
}
