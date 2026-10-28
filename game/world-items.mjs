import { EQUIPMENT_ITEMS } from './equipment.mjs?v=7c14a71de3a9af87';
import { rollCoins, validCoinDrop } from './currency.mjs?v=7c14a71de3a9af87';
export const LOOT_ITEM_IDS = Object.freeze([
  'berries', 'hardtack', 'jerky', 'bandage', 'scrap', 'nuts', 'bladeShard',
  ...EQUIPMENT_ITEMS.map(item => item.id),
]);
export const WORLD_ITEM_IDS = Object.freeze([...LOOT_ITEM_IDS, 'coins']);

/** Loot visuals must be ready before any authored spawner can activate an enemy. */
export function locationNeedsLootSprites(location) {
  return Boolean(location && ((location.enemies?.length ?? 0) > 0
    || (location.spawners?.length ?? 0) > 0 || location.secret || (location.loot?.length ?? 0) > 0));
}

export function rollEditorChestLoot(random = Math.random) {
  const rewardCount = 2 + Math.floor(Math.max(0, Math.min(.999999, random())) * 3);
  const rewards = {};
  for (let index = 0; index < rewardCount; index++) {
    const itemId = LOOT_ITEM_IDS[Math.floor(Math.max(0, Math.min(.999999, random())) * LOOT_ITEM_IDS.length)];
    rewards[itemId] = (rewards[itemId] ?? 0) + 1;
  }
  return { ...rewards, coins: rollCoins('chest', random) };
}

export function rollEnemyLoot(random = Math.random, enemy = {}) {
  const roll = random();
  return { ...(roll < .65 ? { berries: 1 } : roll < .93 ? { hardtack: 1 } : { jerky: 1 }),
    coins: rollCoins(enemy.boss ? 'boss' : enemy.archetype === 'boar' ? 'boar' : 'enemy', random) };
}

export function scatterWorldLoot({ sourceId, x, z, rewards, random = Math.random,
  isInside = () => true, spread = [1.35, 2.8] }) {
  const drops = [];
  for (const [itemId, count] of Object.entries(rewards ?? {})) {
    if (!WORLD_ITEM_IDS.includes(itemId) || !Number.isFinite(count)) continue;
    if (itemId === 'coins' && !validCoinDrop(count)) continue;
    for (let index = 0; index < (itemId === 'coins' ? 1 : Math.max(0, Math.trunc(count))); index++) {
      let position = { x, z };
      for (let attempt = 0; attempt < 16; attempt++) {
        const angle = random() * Math.PI * 2;
        const radius = spread[0] + random() * (spread[1] - spread[0]);
        const candidate = { x: x + Math.cos(angle) * radius, z: z + Math.sin(angle) * radius };
        if (isInside(candidate.x, candidate.z)) { position = candidate; break; }
      }
      drops.push({ id: `loot-${sourceId}-${drops.length + 1}`, itemId, ...position, ...(itemId === 'coins' ? { amount: count } : {}) });
    }
  }
  return drops;
}

export function normalizeWorldLoot(records) {
  if (!Array.isArray(records)) return [];
  const seen = new Set();
  return records.filter(item => item && typeof item.id === 'string' && item.id.length <= 140
    && !seen.has(item.id) && WORLD_ITEM_IDS.includes(item.itemId)
    && (item.itemId !== 'coins' || validCoinDrop(item.amount ?? 1))
    && Number.isFinite(item.x) && Number.isFinite(item.z)
    && (seen.add(item.id), true))
    .map(({ id, itemId, x, z, amount, pickupBlocked }) => ({ id, itemId, x, z,
      ...(itemId === 'coins' ? { amount: amount ?? 1 } : {}), ...(pickupBlocked === true ? { pickupBlocked: true } : {}) }));
}

/** A deliberately dropped item stays inert until the player has left its pickup radius once. */
export function unlockDroppedLootAfterLeaving(item, playerX, playerZ, radius) {
  if (item?.pickupBlocked !== true || ![playerX, playerZ, radius].every(Number.isFinite)) return false;
  if (Math.hypot(playerX - item.x, playerZ - item.z) <= Math.max(0, radius)) return false;
  item.pickupBlocked = false;
  return true;
}

export function takeWorldLoot(records, id) {
  const index = records.findIndex(item => item.id === id);
  return index < 0 ? null : records.splice(index, 1)[0];
}
