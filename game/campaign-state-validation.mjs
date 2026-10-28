import { normalizeStatusEffects } from './status-effects.mjs?v=7c14a71de3a9af87';

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const finiteNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const record = value => isRecord(value) ? value : {};
const list = value => Array.isArray(value) ? value : [];
const nonnegative = value => Math.max(0, finiteNumber(value));
const count = value => Math.trunc(nonnegative(value));
const position = value => isRecord(value) && Number.isFinite(value.x) && Number.isFinite(value.z)
  ? { x: value.x, z: value.z } : null;
const strings = value => [...new Set(list(value).filter(id => typeof id === 'string'))];

function enemyRecord(value) {
  if (!isRecord(value) || typeof value.id !== 'string' || !position(value) || !Number.isFinite(value.health)) return null;
  // Preserve new AI fields while preventing non-finite numeric state from reaching physics.
  const enemy = Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item !== 'number' || Number.isFinite(item)));
  for (const key of ['vx', 'vz', 'rechargeTimer', 'aiTimer', 'aiStunRemaining', 'attackRicochets', 'hitCooldown'])
    enemy[key] = finiteNumber(enemy[key]);
  enemy.health = Math.max(0, enemy.health);
  enemy.charges = Math.min(3, count(enemy.charges ?? 3));
  for (const key of ['active', 'spawnReady']) enemy[key] = enemy[key] !== false;
  for (const key of ['combatAwake', 'fell', 'lootDropped', 'defeatRecorded', 'directHitProtection']) enemy[key] = enemy[key] === true;
  enemy.pendingEarthShatterPositions = Array.isArray(enemy.pendingEarthShatterPositions)
    ? enemy.pendingEarthShatterPositions.map(point => position(point) ? point : null).filter(Boolean) : null;
  enemy.statusEffects = normalizeStatusEffects(enemy.statusEffects);
  return enemy;
}

function worldRecord(value) {
  const source = record(value);
  return { ...source,
    enemies: list(source.enemies).map(enemyRecord).filter(Boolean),
    actors: list(source.actors).filter(actor => typeof actor?.id === 'string' && position(actor))
      .map(actor => ({ id: actor.id, ...position(actor) })),
    loot: list(source.loot).filter(item => typeof item?.id === 'string' && typeof item.itemId === 'string' && position(item)),
    spawners: Object.fromEntries(Object.entries(record(source.spawners)).map(([id, state]) =>
      [id, { spawned: count(state?.spawned), timer: nonnegative(state?.timer) }])),
    defeats: count(source.defeats), goblinsSpawned: count(source.goblinsSpawned),
    reinforcementQueue: list(source.reinforcementQueue).filter(Number.isFinite).map(nonnegative),
    bossSpawned: source.bossSpawned === true, initialized: source.initialized === true, combatTriggered: source.combatTriggered === true,
    lastExitPositions: Object.fromEntries(Object.entries(record(source.lastExitPositions)).filter(([, point]) => position(point))
      .map(([id, point]) => [id, position(point)])),
    openedPlacedChests: strings(source.openedPlacedChests), collectedPlacedItems: strings(source.collectedPlacedItems),
  };
}

/** Schema v1 migration/repair; malformed sections cannot change the shape of runtime collections. */
export function normalizeCampaignSaveFields(state, locationIds) {
  for (const key of ['introSeen', 'seen', 'collected', 'flags', 'items', 'merchantPurchases', 'merchantReturns']) state[key] = record(state[key]);
  state.items = Object.fromEntries(Object.entries(state.items).map(([id, value]) => [id, Math.min(99, count(value))]).filter(([, n]) => n > 0));
  state.inventorySlots = list(state.inventorySlots).map(id => typeof id === 'string' ? id : null);
  state.world = Object.fromEntries(Object.entries(record(state.world)).filter(([id]) => locationIds.has(id))
    .map(([id, value]) => [id, worldRecord(value)]));
  for (const key of ['playerPosition', 'lastSafePosition']) {
    const point = position(state[key]); if (point) state[key] = point; else delete state[key];
  }
  if (Number.isFinite(state.playerHealth)) state.playerHealth = Math.max(0, Math.min(28, state.playerHealth));
  else delete state.playerHealth;
  state.elapsed = nonnegative(state.elapsed);
  const checkpoint = state.entryCheckpoint;
  if (checkpoint?.version === 1 && isRecord(checkpoint.state) && checkpoint.state.version === 1
    && locationIds.has(checkpoint.locationId) && checkpoint.state.currentLocationId === checkpoint.locationId) {
    delete checkpoint.state.entryCheckpoint;
    normalizeCampaignSaveFields(checkpoint.state, locationIds);
  } else delete state.entryCheckpoint;
  return state;
}
