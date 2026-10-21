import { sceneryAsset } from '../render/location-scenery.mjs';

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

const sprite = (id, label, category, file, size, group) => ({ id, label, category, asset: `assets/${file}.png`, size, group });
const reference = (id, label, category, preview, hint) => ({ id, label, category, preview: `assets/${preview}.png`, hint, kind: 'reference' });

// This is the game's global palette. Entries describe reusable game resources,
// never the contents currently spawned in a particular location.
export const ASSET_CATALOG = [
  ...scenery,
  reference('exit', 'Выход: триггер и листва', 'technical', 'location-exit-foliage-v4', 'Настраивается связью локаций и параметрами выхода.'),
  reference('entry', 'Точка входа', 'technical', 'hero-idle', 'Точка задаётся в свойствах локации или редакторе карты.'),
  { id: 'fog-paths', label: 'Линии тумана', category: 'technical', icon: '〰', hint: 'Включает редактирование троп тумана.', kind: 'tool' },
  { id: 'level-graph', label: 'Граф карты уровней', category: 'technical', icon: '⌘', hint: 'Открывает глобальный граф связей между локациями.', kind: 'tool' },
  reference('chest', 'Сундук', 'interactive', 'chest-states', 'Интерактивный объект игры; включает состояния закрыт и открыт.'),
  { id: 'inspect', label: 'Осмотреть', category: 'interactive', icon: '⌕', hint: 'HUD-маркер точки интереса.', kind: 'reference' },
  sprite('goblin', 'Гоблин', 'enemies', 'goblin-idle', 1.8, 'Враг'),
  sprite('slinger', 'Гоблин-пращник', 'enemies', 'slinger-idle', 1.8, 'Враг'),
  sprite('boar', 'Кабан', 'enemies', 'boar-idle', 2.1, 'Враг'),
  sprite('ogre', 'Огр', 'enemies', 'ogre-idle', 3.2, 'Враг'),
  sprite('hero', 'Герой', 'characters', 'hero-idle', 1.8, 'Персонаж'),
  sprite('grandpa', 'Дедушка', 'characters', 'npc-grandpa-idle', 1.8, 'Персонаж'),
  sprite('cartographer', 'Картограф', 'characters', 'npc-cartographer-idle', 1.8, 'Персонаж'),
];

export const catalogAsset = asset => ASSET_CATALOG.find(item => item.asset === asset);
