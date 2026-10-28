import { statusCombatBonuses } from './status-effects.mjs?v=7c14a71de3a9af87';

export const EQUIPMENT_ITEMS = Object.freeze([
  { id: 'ironSword', name: 'Дорожный клинок', slot: 'weapon', image: 'assets/equipment/sword.png', damage: 2,
    description: 'Широкий картонный клинок. Прикрепляется поверх оружия в каждой позе.', hint: 'Урон +2' },
  { id: 'ironHelmet', name: 'Шлем путника', slot: 'helmet', image: 'assets/equipment/helmet.png', defense: 1,
    description: 'Лёгкий стальной колпак на крепкой картонной основе.', hint: 'Защита +1' },
  { id: 'woodShield', name: 'Деревянный щит', slot: 'shield', image: 'assets/equipment/shield.png', defense: 1,
    description: 'Небольшой щит в свободной руке. Держит удар вместе с шайбой.', hint: 'Защита +1' },
  { id: 'emberOrb', name: 'Сфера углей', slot: 'orb', image: 'assets/equipment/orb-ember.svg', color: '#f69a44', damage: 1,
    description: 'Тёплая искра кружит вокруг тебя по наклонной орбите и усиливает удары.', hint: 'Урон +1' },
  { id: 'mossOrb', name: 'Сфера мха', slot: 'orb', image: 'assets/equipment/orb-moss.svg', color: '#81d388', defense: 1,
    description: 'Лесной огонёк летает вокруг героя и укрепляет защиту.', hint: 'Защита +1' },
  { id: 'stormOrb', name: 'Сфера грозы', slot: 'orb', image: 'assets/equipment/orb-storm.svg', color: '#9da7ff', damage: 1,
    description: 'Маленькая гроза на собственной орбите. Её сила прибавляется к силе оружия.', hint: 'Урон +1' },
].map(Object.freeze));
const definitions = new Map(EQUIPMENT_ITEMS.map(item => [item.id, item]));
export const equipmentItem = id => definitions.get(id) ?? null;
export const EQUIPMENT_SLOT_LABELS = Object.freeze({ weapon: 'Оружие', helmet: 'Голова', shield: 'Щит', orb: 'Сфера' });
export function grantEquipmentStarter(state) {
  state.flags ??= {}; state.items ??= {};
  if (state.flags.equipmentKitReceived) return false;
  for (const item of EQUIPMENT_ITEMS) state.items[item.id] = Math.min(99, (Number(state.items[item.id]) || 0) + 1);
  state.flags.equipmentKitReceived = true; return true;
}
export function normalizeEquipment(raw) {
  const matching = (id, slot) => equipmentItem(id)?.slot === slot ? id : null;
  const seen = new Set();
  return { weapon: matching(raw?.weapon, 'weapon'), helmet: matching(raw?.helmet, 'helmet'), shield: matching(raw?.shield, 'shield'),
    orbs: Array.from({ length: 3 }, (_, index) => {
      const id = matching(raw?.orbs?.[index], 'orb');
      if (!id || seen.has(id)) return null; seen.add(id); return id;
    }) };
}
export function equipmentBonuses(state) {
  const gear = normalizeEquipment(state.equipment);
  return [gear.weapon, gear.helmet, gear.shield, ...gear.orbs].reduce((bonus, id) => {
    const item = equipmentItem(id);
    bonus.damage += item?.damage ?? 0; bonus.defense += item?.defense ?? 0; return bonus;
  }, { damage: 0, defense: 0 });
}
export function combatBonuses(state) {
  const bonus = equipmentBonuses(state);
  const effects = statusCombatBonuses(state);
  return { damage: (state.damageBonus || 0) + bonus.damage + effects.damage,
    defense: (state.defenseBonus || 0) + bonus.defense + effects.defense };
}
export function playerDamageTaken(state, damageQuarters) {
  return Math.max(1, Math.max(1, Math.trunc(damageQuarters)) - combatBonuses(state).defense);
}
/** Equipped items leave the bag; replacements return to the same freed cell. No copies or implicit consumption. */
export function equipInventoryItem(state, id, slotIndex) {
  const item = equipmentItem(id);
  if (!item || !(state.items?.[id] > 0) || !Number.isInteger(slotIndex) || state.inventorySlots?.[slotIndex] !== id)
    return { changed: false, error: 'Предмет больше не находится в этой ячейке' };
  const gear = normalizeEquipment(state.equipment);
  let previous;
  if (item.slot === 'orb') {
    if (gear.orbs.includes(id)) return { changed: false, error: 'Эта сфера уже надета' };
    const index = gear.orbs.indexOf(null);
    if (index < 0) return { changed: false, error: 'Сначала сними одну из трёх сфер' };
    gear.orbs[index] = id;
  } else {
    previous = gear[item.slot];
    if (previous && previous !== id && (state.items[previous] || 0) >= 99)
      return { changed: false, error: 'Не хватает места для снимаемого предмета' };
    gear[item.slot] = id;
  }
  state.items[id]--; state.inventorySlots[slotIndex] = previous ?? null;
  if (previous) state.items[previous] = (state.items[previous] || 0) + 1;
  state.equipment = gear;
  return { changed: true, equipped: id, replaced: previous ?? null };
}
export function unequipItem(state, slot, orbIndex = 0) {
  const gear = normalizeEquipment(state.equipment);
  if (!['weapon', 'helmet', 'shield', 'orb'].includes(slot) || (slot === 'orb' && (!Number.isInteger(orbIndex) || orbIndex < 0 || orbIndex > 2)))
    return { changed: false };
  const id = slot === 'orb' ? gear.orbs[orbIndex] : gear[slot];
  if (!id) return { changed: false };
  if ((state.items[id] || 0) >= 99) return { changed: false, error: 'В рюкзаке уже 99 таких предметов' };
  state.items[id] = (state.items[id] || 0) + 1;
  state.inventorySlots ??= [];
  const empty = state.inventorySlots.findIndex(item => item === null);
  if (empty < 0) state.inventorySlots.push(id); else state.inventorySlots[empty] = id;
  if (slot === 'orb') gear.orbs[orbIndex] = null; else gear[slot] = null;
  state.equipment = gear;
  return { changed: true, unequipped: id };
}
/** Three different intersecting planes, with continuous motion independent of frame rate. */
export function equipmentOrbPosition(index, time) {
  const angle = time * (1.2 + index * .17) + index * Math.PI * 2 / 3;
  const yaw = index * Math.PI * 2 / 3, tilt = .5 + index * .3, radius = 1.04;
  const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius * Math.cos(tilt);
  return { x: x * Math.cos(yaw) - z * Math.sin(yaw), y: 1.28 + Math.sin(angle) * radius * Math.sin(tilt),
    z: x * Math.sin(yaw) + z * Math.cos(yaw) };
}
