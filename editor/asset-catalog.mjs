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
export const ASSET_CATALOG = [
  ...foliage.map(([id, label, size]) => ({ id, label, size, group: 'Природа', asset: sceneryAsset(id) })),
  ...props.map(([id, label, size]) => ({ id, label, size, group: 'Декорации', asset: sceneryAsset(id) })),
  { id: 'troll-hut', label: 'Хижина', size: 3.2, group: 'Декорации', asset: 'assets/env-troll-hut.png' },
  { id: 'fortress', label: 'Крепость', size: 4, group: 'Декорации', asset: 'assets/env-fortress.png' },
];
export const catalogAsset = asset => ASSET_CATALOG.find(item => item.asset === asset);
