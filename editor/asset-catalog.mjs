import { sceneryAsset } from '../render/location-scenery.mjs?v=7c14a71de3a9af87';
import { EQUIPMENT_ITEMS } from '../game/equipment.mjs?v=7c14a71de3a9af87';
import { COIN_SKINS } from '../game/currency.mjs?v=7c14a71de3a9af87';
import { MERCHANTS } from '../game/merchants.mjs?v=7c14a71de3a9af87';

const foliage = [
  ['tree', 'Дуб', 4], ['evergreen', 'Ель', 3.8], ['birch', 'Берёза', 4], ['bushes', 'Куст', 1.8],
  ['fern', 'Папоротник', 1.5], ['reeds', 'Камыш', 2.2], ['wildflowers', 'Цветы', 1.2],
  ['mushrooms', 'Грибы', 1.2], ['charred-tree', 'Обгоревшее дерево', 3.5],
];
const props = [
  ['moss-rocks', 'Камни во мху', 2], ['rock-cluster', 'Камни', 1.6], ['fallen-log', 'Бревно', 2.2],
  ['stump', 'Пень', 2.4], ['totem', 'Тотем', 3], ['shrine', 'Святилище', 2.2],
  ['root-arch', 'Арка из корней', 3], ['cart', 'Телега', 2.8], ['mill', 'Мельница', 4],
  ['healer-stump', 'Пень лекаря', 2.4], ['broken-bridge', 'Сломанный мост', 2.5], ['bell', 'Колокол', 3],
  ['hero-house', 'Дом героя', 3.6], ['cartographer-house', 'Дом картографа', 3.8],
];
const scenery = [
  ...foliage.map(([id, label, size]) => ({ id, label, size, group: 'Природа', category: 'ordinary', asset: sceneryAsset(id) })),
  ...props.map(([id, label, size]) => ({ id, label, size, group: 'Декорации',
    category: ['totem', 'shrine', 'root-arch', 'cart', 'mill', 'healer-stump', 'broken-bridge', 'bell', 'hero-house', 'cartographer-house'].includes(id)
      ? 'unique' : 'ordinary', asset: sceneryAsset(id) })),
  { id: 'troll-hut', label: 'Хижина', size: 3.2, group: 'Декорации', category: 'unique', asset: 'assets/env-troll-hut.png' },
  { id: 'fortress', label: 'Крепость', size: 4, group: 'Декорации', category: 'unique', asset: 'assets/env-fortress.png' },
];

const sprite = (id, label, category, file, size, group, extra = {}) => ({ id, label, category, asset: `${id === 'ogre' ? 'bosses/ogre/textures/' : 'assets/'}${file}.png`, size, group, ...extra });
const reference = (id, label, category, preview, hint) => ({ id, label, category, preview: `assets/${preview}.png`, hint, kind: 'reference' });
const worldItem = (itemId, label, frame) => ({ id: `world-item-${itemId}`, itemId, label, category: 'interactive',
  asset: `assets/loot-atlas.png#${itemId}`, preview: 'assets/loot-atlas.png', frame, size: .54,
  group: 'Предмет', kind: 'world-item', hint: 'Подбирается магнитом и отправляется в рюкзак.' });

// This is the game's global palette. Entries describe reusable game resources,
// never the contents currently spawned in a particular location.
export const ASSET_CATALOG = [
  ...scenery,
  { id: 'environment-placeholder', label: 'Пустышка окружения', category: 'unique', asset: 'editor-placeholder', size: 2.2,
    group: 'Заметки локации', kind: 'placeholder', icon: '✎', hint: 'Аморфная картонка с именем и описанием недостающего окружения.' },
  { id: 'enemy-spawner', label: 'Спавнер врагов', category: 'technical', asset: 'editor-spawner', size: 1.15,
    group: 'Спавнеры', kind: 'spawner', icon: '👺', hint: 'Настраиваемая точка появления врагов.' },
  reference('exit', 'Выход: триггер и листва', 'technical', 'location-exit-foliage-v4', 'Настраивается связью локаций и параметрами выхода.'),
  reference('entry', 'Точка входа', 'technical', 'hero-idle', 'Точка задаётся в свойствах локации или редакторе карты.'),
  { id: 'fog-paths', label: 'Линии тумана', category: 'technical', icon: '〰', hint: 'Включает редактирование троп тумана.', kind: 'tool' },
  { id: 'level-graph', label: 'Граф карты уровней', category: 'technical', icon: '⌘', hint: 'Открывает глобальный граф связей между локациями.', kind: 'tool' },
  { id: 'chest', label: 'Сундук', category: 'interactive', asset: 'assets/chest-states.png', size: 1.72,
    group: 'Интерактивный объект', kind: 'chest', hint: 'Открывается от удара и выбрасывает случайные предметы.' },
  { id: 'inspect', label: 'Осмотреть', category: 'interactive', asset: 'assets/poi-inspection-bark.webp', size: .72,
    group: 'Интерактивный объект', hint: 'Картонный знак точки интереса; можно перетащить на сцену.', kind: 'inspection' },
  worldItem('berries', 'Лесные ягоды', 0),
  worldItem('hardtack', 'Дорожный сухарь', 1),
  worldItem('jerky', 'Вяленое мясо', 2),
  worldItem('bandage', 'Перевязь', 3),
  worldItem('scrap', 'Медный обломок', 4),
  worldItem('nuts', 'Лесные орехи', 5),
  worldItem('bladeShard', 'Острый осколок', 6),
  ...EQUIPMENT_ITEMS.map(item => ({ id: `world-item-${item.id}`, itemId: item.id, label: item.name, category: 'interactive',
    asset: item.image, preview: item.image, size: .54, group: 'Экипировка', kind: 'world-item',
    hint: `${item.hint}. Подбери и надень из рюкзака.` })),
  ...COIN_SKINS.map(skin => ({ id: `world-${skin.id}`, itemId: 'coins', amount: skin.amount,
    label: `${skin.label} · ${skin.amount}`, category: 'interactive', asset: `assets/economy/coins.png#${skin.id}`,
    preview: 'assets/economy/coins.png', frame: skin.frame, atlasColumns: 3, atlasRows: 1, size: .3,
    group: 'Деньги', kind: 'world-item', hint: 'Подбираются магнитом. Сумма зачисляется в кошелёк.' })),
  ...MERCHANTS.map(merchant => ({ id: `merchant-${merchant.id}`, merchantId: merchant.id,
    label: `${merchant.name} · торговец`, category: 'characters', asset: `assets/economy/merchant.png#${merchant.id}`,
    preview: 'assets/economy/merchant.png', size: 1.9, group: merchant.title, kind: 'merchant', hint: 'Подойди вне боя, чтобы открыть магазин.' })),
  sprite('goblin', 'Гоблин', 'enemies', 'goblin-idle', 1.8, 'Враг', { kind: 'enemy', archetype: 'goblin' }),
  sprite('slinger', 'Гоблин-пращник', 'enemies', 'slinger-idle', 1.8, 'Враг', { kind: 'enemy', archetype: 'slinger' }),
  sprite('boar', 'Кабан', 'enemies', 'boar-idle', 2.1, 'Враг', { kind: 'enemy', archetype: 'boar' }),
  sprite('ogre', 'Огр', 'enemies', 'ogre-idle', 3.2, 'Враг', { kind: 'enemy', archetype: 'ogre' }),
  sprite('acid-spitter', 'Кислотник', 'enemies', 'enemies/acid-spitter', 1.9, 'Дальняя атака', { kind: 'enemy', archetype: 'acid-spitter', customSprite: true }),
  sprite('shellguard', 'Панцирник', 'enemies', 'enemies/shellguard', 2.05, 'Защита и контратака', { kind: 'enemy', archetype: 'shellguard', customSprite: true }),
  sprite('burrower', 'Копатель', 'enemies', 'enemies/burrower', 1.85, 'Засада', { kind: 'enemy', archetype: 'burrower', customSprite: true }),
  sprite('flanker', 'Обходчик', 'enemies', 'enemies/flanker', 1.95, 'Обход и выпад', { kind: 'enemy', archetype: 'flanker', customSprite: true }),
  sprite('ember-moth', 'Угольная моль', 'enemies', 'enemies/ember-moth', 1.9, 'Серия выпадов', { kind: 'enemy', archetype: 'ember-moth', customSprite: true }),
  sprite('hexer', 'Порчевик', 'enemies', 'enemies/hexer', 1.95, 'Зональная атака', { kind: 'enemy', archetype: 'hexer', customSprite: true }),
  sprite('hero', 'Герой', 'characters', 'hero-idle', 1.8, 'Персонаж'),
  sprite('grandpa', 'Дедушка', 'characters', 'npc-grandpa-idle', 1.8, 'Персонаж'),
  sprite('cartographer', 'Картограф', 'characters', 'npc-cartographer-idle', 1.8, 'Персонаж'),
];

export const catalogAsset = asset => ASSET_CATALOG.find(item => item.asset === asset);
export const catalogPrefab = prefabId => ASSET_CATALOG.find(item => item.id === prefabId && item.asset && item.kind !== 'reference');
