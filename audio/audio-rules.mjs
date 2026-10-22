export const AUDIO_SETTINGS_KEY = 'cardboardquest-audio-v1';
export const DEFAULT_AUDIO_SETTINGS = Object.freeze({ master: .75, music: .4, effects: .8, ambience: .35, muted: false });
export function normalizeAudioSettings(value = {}) {
  const settings = { ...DEFAULT_AUDIO_SETTINGS };
  for (const key of ['master', 'music', 'effects', 'ambience'])
    if (typeof value?.[key] === 'number' && Number.isFinite(value[key])) settings[key] = Math.max(0, Math.min(1, value[key]));
  settings.muted = value?.muted === true;
  return settings;
}
export function audioMood(location, health, encounterCleared = false) {
  if (health <= 0) return 'mystery';
  const enemies = (location?.enemies ?? []).filter(enemy => enemy.health > 0 && !enemy.fell && enemy.spawnReady !== false);
  const activeEnemies = enemies.filter(enemy => enemy.active !== false && enemy.health > 0);
  const fighting = !encounterCleared && activeEnemies.some(enemy => enemy.combatAwake !== false);
  if (fighting) return activeEnemies.some(enemy => enemy.boss) ? 'boss' : 'battle';
  if (!encounterCleared && location?.kind === 'camp' && ((location.pendingSpawns ?? 0) > 0 || location.reinforcementQueue?.length)) return 'battle';
  return /ruin|quarry|vault|bell|cave|crypt|mine|pass|shrine/.test(location?.id ?? '') ? 'mystery' : 'peace';
}
export function chargeReadyCue(mood) {
  return mood === 'battle' || mood === 'boss' ? 'ready' : 'readyPeace';
}
export function audioAmbience(location) {
  if (/brook|river|bridge|marsh|water|spring/.test(location?.id ?? '')) return 'water';
  if (/vault|crypt|cave|mine/.test(location?.id ?? '')) return 'cave';
  return 'forest';
}
