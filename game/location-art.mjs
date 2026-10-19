// Authored art direction: dimensions are in unscaled tabletop units.
// A low cardboard lip is enough to enclose a clearing. Tall rock faces belong
// to the quarry, caves and mountain passages, not to every forest path.
const grove = ['birch', 'tree', 'fern', 'bushes'];
const wetland = ['reeds', 'fern', 'moss-rocks', 'stump'];
const ruins = ['shrine', 'moss-rocks', 'root-arch', 'charred-tree'];
const profile = (rx, rz, relief, props, extra = {}) => ({ rx, rz, relief, props, ...extra });
export const LOCATION_ART = {
  home: profile(8.8, 8, 1.05, grove, { phase: .2, density: 40, focal: ['hero-house', -2.4, -2.4, 3.5], mood: 'Тёплая сосновая поляна; низкие травяные берега, берёзы и сад у дома.' }),
  forest: profile(9.1, 7.6, 1.4, ['tree', 'evergreen', 'birch', 'fern', 'stump'], { phase: 1.3, density: 62, mood: 'Широкая лесная опушка; чаща закрывает края, на дальнем плане мягкие холмы.' }),
  'stump-hollow': profile(6.8, 7.3, .72, ['stump', 'fern', 'bushes', 'birch'], { phase: 2.1, density: 38, focal: ['stump', -2, -3.5, 3.8], mood: 'Тесный уютный карман в корнях, огромный старый пень и папоротники.' }),
  'squirrel-cache': profile(7.2, 9.2, .9, ['birch', 'stump', 'bushes'], { phase: .7, density: 45, focal: ['birch', -3, -2, 4.4], mood: 'Длинная берёзовая роща, маленькие кочки и склад под корнями.' }),
  brook: profile(8.8, 7.5, .85, wetland, { phase: 2.8, density: 48, hazards: [['water', -4.1, 2.1, 2.3, 4.5, .2]], mood: 'Мелкий извилистый ручей слева, низкий пологий берег и заросли папоротника.' }),
  'cave-cache': profile(6.7, 7.1, 2.7, ['moss-rocks', 'reeds', 'fern'], { phase: 1.5, cliff: 1.4, density: 28, hazards: [['abyss', 3.8, 2, 1.7, 2.7, -.4]], mood: 'Нора в крутом берегу: каменная спина за тайником, тёмный провал сбоку.' }),
  'broken-bridge': profile(10.3, 8.9, 1.65, ['reeds', 'moss-rocks', 'charred-tree', 'birch'], { phase: .4, density: 44, riverCrossing: true, focal: ['broken-bridge', 0, 2.2, 6.6], mood: 'Речная промоина пересекает поляну; сломанный мост над водой, обход по правому берегу.' }),
  'moss-shrine': profile(8.2, 8.5, 1.35, ['birch', 'shrine', 'fern', 'moss-rocks'], { phase: 2.7, density: 42, focal: ['shrine', 0, -3.8, 3.7], mood: 'Круглая тихая священная роща; алтарь под берёзами и поросшие мхом уступы.' }),
  camp: profile(10, 9.1, 1.55, ['totem', 'charred-tree', 'stump', 'evergreen'], { phase: .8, density: 42, mood: 'Широкая истоптанная поляна; частокол из тотемов, вырубка и хижины.' }),
  'ash-road': profile(7.2, 10, 2, ['charred-tree', 'moss-rocks', 'stump'], { phase: 2, density: 44, falls: [[Math.PI, 'abyss', 3.4]], mood: 'Серый длинный склон после пожара; обугленные стволы, справа пологие гряды, слева осыпь.' }),
  'goblin-watch': profile(8.6, 6.9, 2.1, ['totem', 'moss-rocks', 'charred-tree'], { phase: 1.1, density: 32, focal: ['totem', -2.5, -3, 4.4], falls: [[2.2, 'abyss', 4.8]], mood: 'Сторожевой уступ с открытым обзором; флаги над крутым краем, дальние горы.' }),
  'herb-glen': profile(9.2, 7.2, .65, ['fern', 'bushes', 'birch', 'stump'], { phase: 3.1, density: 58, focal: ['stump', -3, -2, 2.1], mood: 'Солнечная лощина лекаря: мягкие луга, густые травы и небольшие берёзовые островки.' }),
  'black-creek': profile(7.8, 10.1, .9, wetland, { phase: 1.9, density: 54, hazards: [['peat', -4, 1.8, 1.75, 5.1, -.15], ['peat', 4.6, -3.5, 1.7, 2.4, .6]], mood: 'Чёрная торфяная вода вдоль двух разных берегов; сухой извилистый язык земли между ними.' }),
  'old-mill': profile(9.3, 8.1, 1.1, ['reeds', 'birch', 'moss-rocks', 'stump'], { phase: .9, density: 38, focal: ['mill', -3.6, -2.7, 4.9], hazards: [['water', 4.5, 2.8, 2.6, 2.1, .1]], mood: 'Заросший мельничный двор и широкий старый пруд, оставшийся без колеса.' }),
  quarry: profile(9.3, 9.8, 4.1, ['moss-rocks', 'totem', 'charred-tree'], { phase: 2.4, cliff: 1.8, density: 32, hazards: [['abyss', 3.9, 3.2, 2.3, 2.9, .4]], mood: 'Единственный настоящий карьер: высокие срезы стен, большой внутренний котлован и обходы.' }),
  cartographer: profile(8.1, 8.9, .8, ['birch', 'bushes', 'fern'], { phase: 3.7, density: 44, focal: ['hero-house', -3.2, -2.1, 4.1], mood: 'Дом картографа в саду; широкая зелёная поляна, тихие низкие складки рельефа.' }),
  'peat-marsh': profile(10.1, 8.2, .72, ['reeds', 'charred-tree', 'fern', 'stump'], { phase: 2.3, density: 64, hazards: [['peat', -4.8, -2.1, 2.4, 2.8, -.6], ['peat', 4.6, 2.8, 2.3, 2.1, .4], ['peat', -3.8, 5.5, 1.7, 1.25, 1]], mood: 'Торфяное море из трёх разных топей; кочки, камыш, редкие мёртвые деревья.' }),
  'sunken-cart': profile(8.6, 7, .6, ['reeds', 'stump', 'charred-tree'], { phase: 4.2, density: 42, focal: ['cart', -4.3, 3.1, 3.8], hazards: [['peat', -4.3, 3.1, 2.4, 1.7, .25]], mood: 'Маленький заболоченный залив; телега застряла в торфе, камыш скрывает дальний берег.' }),
  'bone-gate': profile(7, 10, 2.8, ['root-arch', 'charred-tree', 'moss-rocks', 'totem'], { phase: 1.7, cliff: .7, density: 38, focal: ['root-arch', 0, -4.4, 5], mood: 'Сдавленный корнями коридор; светлая арка, каменные плечи и тёмная чаща.' }),
  'hollow-tree': profile(8.6, 7.7, 1.05, ['stump', 'tree', 'fern', 'bushes'], { phase: 5, density: 65, focal: ['stump', -1.8, -3.3, 5], mood: 'Древнее дерево в замкнутом лесном кармане; мягкая земля и плотные кроны.' }),
  'scree-pass': profile(6.7, 10.6, 4, ['moss-rocks', 'charred-tree', 'evergreen'], { phase: 4.7, cliff: 1.7, density: 30, falls: [[Math.PI, 'abyss', 5.7]], mood: 'Узкое настоящее ущелье; высокие скалы, редкие сосны на гребнях и осыпь в пропасть.' }),
  'bell-gate': profile(8.1, 9.5, 2.65, ruins, { phase: 3.6, cliff: .65, density: 36, focal: ['root-arch', 0, -4.4, 5.3], mood: 'Нижняя каменная арка в складках склона; разрушенные святилища и корни.' }),
  'bell-vault': profile(9.2, 8.7, 2.3, ['root-arch', 'shrine', 'moss-rocks'], { phase: 5.4, density: 34, focal: ['bell', 0, -4.3, 5.4], hazards: [['abyss', 4.5, 2.5, 2.5, 2.2, -.3]], mood: 'Хранилище над подземной пустотой; колокол на сухом каменном языке, трещина сбоку.' }),
  grandpa: profile(9.8, 8, .95, ['charred-tree', 'reeds', 'shrine', 'stump'], { phase: 6, density: 32, focal: ['bell', -3.1, -3.5, 3.6], hazards: [['water', 4.8, 2.8, 2.9, 3.5, .7]], mood: 'Последняя затопленная терраса; вода отступает, разрушенный колокол и тихий пустой берег.' }),
};

export function organicOval(x, z, rx, rz, phase = 0, count = 40) {
  return Array.from({ length: count }, (_, index) => {
    const a = index / count * Math.PI * 2;
    const r = 1 + .09 * Math.sin(a * 3 + phase) + .045 * Math.sin(a * 5 - phase * 2);
    return { x: x + Math.cos(a) * rx * r, z: z + Math.sin(a) * rz * r };
  });
}

/** Scenic continuation beyond the invisible transition band, not walkable space. */
export function exitRoadContinuation(exit, length = 27, halfWidth = (exit.halfWidth ?? 2.3) - .2) {
  const radius = Math.hypot(exit.x, exit.z), dx = exit.dirX ?? exit.x / radius, dz = exit.dirZ ?? exit.z / radius;
  const side = sign => Array.from({ length: 9 }, (_, index) => {
    const t = index / 8, along = -1.3 + t * length;
    const across = sign * halfWidth * (1 - .12 * t) + Math.sin(t * Math.PI) * .18;
    return { x: exit.x + dx * along - dz * across, z: exit.z + dz * along + dx * across };
  });
  return [...side(1), ...side(-1).reverse()];
}

export function createLocationArt(id, scale = 1.5) {
  const art = LOCATION_ART[id];
  if (!art) throw new Error(`Missing authored landscape: ${id}`);
  const hazards = (art.hazards ?? []).map(([kind, x, z, rx, rz, phase], index) => ({
    id: `${id}-hazard-${index}`, kind, points: organicOval(x * scale, z * scale, rx * scale, rz * scale, phase),
  }));
  if (art.riverCrossing) hazards.push({ id: 'broken-bridge-river', kind: 'water', points: [
    [-8.2, 1.1], [-5.6, .6], [-2, 1.15], [1.1, .85], [4.4, 1.3], [6.9, 1.05],
    [7.15, 3], [4.7, 3.6], [1.2, 3.15], [-2.4, 3.7], [-5.8, 3], [-8.4, 3.6],
  ].map(([x, z]) => ({ x: x * scale, z: z * scale })) });
  return { ...art, hazards, terrain: { maxHeight: art.relief, step: .24,
    edgeHeight: art.cliff ?? .245, nearSlope: art.cliff ? 2.1 : 6.8,
    ridgeStrength: art.cliff ? .65 : .22, peakAmplitude: art.cliff ? 1.35 : .65,
    peakCount: art.cliff ? 22 : 14, crestDistance: art.cliff ? 3.4 : 9.5 } };
}
