export const ENEMY_SPAWNER_TYPES = Object.freeze([
  'goblin', 'slinger', 'boar', 'ogre', 'acid-spitter', 'shellguard', 'burrower', 'flanker', 'ember-moth', 'hexer',
]);

export const ENEMY_SPAWNER_DEFAULTS = Object.freeze({
  archetype: 'goblin', count: 1, interval: 1, maxAlive: 1, autoSpawn: true, spawnAnimation: true,
});

export function normalizeEnemySpawner(value = {}) {
  const result = { ...ENEMY_SPAWNER_DEFAULTS, ...value };
  if (!ENEMY_SPAWNER_TYPES.includes(result.archetype)
    || !Number.isInteger(result.count) || result.count < 1 || result.count > 50
    || !Number.isFinite(result.interval) || result.interval < .1 || result.interval > 60
    || !Number.isInteger(result.maxAlive) || result.maxAlive < 1 || result.maxAlive > 20
    || typeof result.autoSpawn !== 'boolean' || typeof result.spawnAnimation !== 'boolean')
    throw new Error('Invalid enemy spawner settings');
  return result;
}

/** Async spawn work is valid only while it belongs to the current, non-deleted spawner state. */
export function isEnemySpawnerRequestCurrent(currentState, requestState, deleted = false) {
  return currentState === requestState && !deleted;
}

export function advanceEnemySpawner(state, settings, livingCount, dt) {
  const config = normalizeEnemySpawner(settings);
  const next = { spawned: Math.max(0, Math.min(config.count, Math.floor(state?.spawned ?? 0))),
    timer: Math.max(0, Number(state?.timer) || 0) };
  if (!config.autoSpawn || next.spawned >= config.count || livingCount >= config.maxAlive) return { state: next, spawn: false };
  next.timer -= Math.max(0, dt);
  if (next.timer > 0) return { state: next, spawn: false };
  next.spawned++;
  next.timer = config.interval;
  return { state: next, spawn: true };
}
