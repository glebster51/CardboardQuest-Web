export const WORLD_ITEM_IDS = Object.freeze([
  'berries', 'hardtack', 'jerky', 'bandage', 'scrap', 'nuts', 'bladeShard',
]);

export function rollEnemyLoot(random = Math.random) {
  const roll = random();
  return roll < .65 ? { berries: 1 } : roll < .93 ? { hardtack: 1 } : { jerky: 1 };
}

export function scatterWorldLoot({ sourceId, x, z, rewards, random = Math.random,
  isInside = () => true, spread = [1.35, 2.8] }) {
  const drops = [];
  for (const [itemId, count] of Object.entries(rewards ?? {})) {
    if (!WORLD_ITEM_IDS.includes(itemId) || !Number.isFinite(count)) continue;
    for (let index = 0; index < Math.max(0, Math.trunc(count)); index++) {
      let position = { x, z };
      for (let attempt = 0; attempt < 16; attempt++) {
        const angle = random() * Math.PI * 2;
        const radius = spread[0] + random() * (spread[1] - spread[0]);
        const candidate = { x: x + Math.cos(angle) * radius, z: z + Math.sin(angle) * radius };
        if (isInside(candidate.x, candidate.z)) { position = candidate; break; }
      }
      drops.push({ id: `loot-${sourceId}-${drops.length + 1}`, itemId, ...position });
    }
  }
  return drops;
}

export function normalizeWorldLoot(records) {
  if (!Array.isArray(records)) return [];
  const seen = new Set();
  return records.filter(item => item && typeof item.id === 'string' && item.id.length <= 140
    && !seen.has(item.id) && WORLD_ITEM_IDS.includes(item.itemId)
    && Number.isFinite(item.x) && Number.isFinite(item.z)
    && (seen.add(item.id), true))
    .map(({ id, itemId, x, z }) => ({ id, itemId, x, z }));
}

export function takeWorldLoot(records, id) {
  const index = records.findIndex(item => item.id === id);
  return index < 0 ? null : records.splice(index, 1)[0];
}
