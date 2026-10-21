import { ITEM_LABELS, CONSUMABLE_HEALING } from './story-campaign.mjs?v=7';

export const INVENTORY_CAPACITY = 25;
export const INVENTORY_ITEMS = Object.freeze([
  { id: 'berries', frame: 0, description: 'Горсть кислых лесных ягод. Дед всегда оставлял немного на дорогу.', action: 'Съесть' },
  { id: 'hardtack', frame: 1, description: 'Хрустящий дорожный сухарь. Переживёт любой поход — если не съесть раньше.', action: 'Съесть' },
  { id: 'jerky', frame: 2, description: 'Полоска вяленого мяса. Сытный запас для долгой дороги.', action: 'Съесть' },
  { id: 'bandage', frame: 3, description: 'Чистая льняная перевязь. Поможет залечить раны и продолжить путь.', action: 'Перевязаться' },
  { id: 'scrap', frame: 4, description: 'Потемневший медный обломок. Небольшая находка из старых тайников.' },
  { id: 'nuts', frame: 5, description: 'Лесные орехи в крепкой скорлупе. Белка наверняка оценила бы такой запас.' },
  { id: 'bladeShard', frame: 6, description: 'Тонкий острый осколок. Трофей из гоблинских запасов.' },
].map(item => Object.freeze({ ...item, name: ITEM_LABELS[item.id], healing: CONSUMABLE_HEALING[item.id] ?? 0 })));

export function inventoryEntries(state) {
  const definitions = new Map(INVENTORY_ITEMS.map(item => [item.id, item]));
  const counts = new Map(Object.entries(state.items).filter(([, count]) => Number(count) > 0)
    .map(([id, count]) => [id, Math.min(99, Math.trunc(Number(count)))]));
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const previousSlots = Array.isArray(state.inventorySlots) ? state.inventorySlots : [];
  // Keep saved positions and holes. Additional pages preserve large old saves
  // without silently deleting items or turning them back into stacks.
  const length = Math.max(INVENTORY_CAPACITY, Math.ceil(total / INVENTORY_CAPACITY) * INVENTORY_CAPACITY,
    Math.ceil(previousSlots.length / INVENTORY_CAPACITY) * INVENTORY_CAPACITY);
  const slots = Array.from({ length }, (_, index) => {
    const id = previousSlots[index];
    if (!(counts.get(id) > 0)) return null;
    counts.set(id, counts.get(id) - 1); return id;
  });
  let empty = 0;
  for (const [id, count] of counts) for (let index = 0; index < count; index++) {
    while (slots[empty]) empty++;
    slots[empty++] = id;
  }
  while (slots.length > INVENTORY_CAPACITY && slots.slice(-INVENTORY_CAPACITY).every(id => id === null)) slots.length -= INVENTORY_CAPACITY;
  state.inventorySlots = slots;
  return slots.map((id, slotIndex) => id ? { ...(definitions.get(id) ?? {
    id, name: ITEM_LABELS[id] ?? 'Неизвестная находка', description: 'Находка из твоего путешествия.', frame: 4, healing: 0 }),
  slotIndex, key: `${slotIndex}:${id}`, count: 1 } : null);
}

export function inventoryItemAction(item, health, maxHealth) {
  if (!item?.healing) return { usable: false, hint: 'Предмет из путешествия' };
  if (health <= 0) return { usable: false, hint: 'Сейчас нельзя использовать' };
  if (health >= maxHealth) return { usable: false, hint: 'Здоровье уже полное' };
  return { usable: item.count > 0, hint: `Восстанавливает ${String(item.healing / 4).replace('.', ',')} ♥` };
}
