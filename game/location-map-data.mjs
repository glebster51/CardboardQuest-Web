export const LOCATION_MAP_WIDTH = 520;
export const LOCATION_MAP_HEIGHT = 1220;

const mapPins = {
  home: ['Дом', 260, 44],
  forest: ['Опушка', 260, 110],
  'stump-hollow': ['Пень-тайник', 90, 176],
  brook: ['Ручей', 390, 176],
  'squirrel-cache': ['Белкин тайник', 90, 242],
  'cave-cache': ['Береговая нора', 390, 242],
  'broken-bridge': ['Сломанный мост', 390, 308],
  'moss-shrine': ['Святилище мха', 390, 374],
  camp: ['Лагерь', 390, 440],
  'ash-road': ['Пепельный путь', 390, 506],
  'goblin-watch': ['Сторожевой уступ', 220, 572],
  'black-creek': ['Чёрный ручей', 440, 572],
  'herb-glen': ['Лощина лекаря', 100, 638],
  'old-mill': ['Старая мельница', 300, 638],
  quarry: ['Карьер', 455, 638],
  cartographer: ['Дом картографа', 300, 704],
  'peat-marsh': ['Торфяное море', 300, 770],
  'sunken-cart': ['Телега', 185, 836],
  'bone-gate': ['Ворота из корней', 415, 836],
  'hollow-tree': ['Дупло с голосами', 415, 902],
  'scree-pass': ['Осыпной проход', 415, 968],
  'bell-gate': ['Нижняя арка', 415, 1034],
  'bell-vault': ['Хранилище колокола', 415, 1100],
  grandpa: ['Последняя тишина', 415, 1166],
};

export function buildLocationMapGraph(campaign, edges) {
  const nodes = campaign.map(location => {
    const pin = mapPins[location.id];
    if (!pin) throw new Error(`Location map pin is missing: ${location.id}`);
    return { id: location.id, label: pin[0], x: pin[1], y: pin[2] };
  });
  const known = new Set(nodes.map(node => node.id));
  const uniqueEdges = new Map();
  for (const [from, to] of edges) {
    if (!known.has(from) || !known.has(to)) throw new Error(`Location map edge is invalid: ${from} -> ${to}`);
    const key = [from, to].sort().join('|');
    if (!uniqueEdges.has(key)) uniqueEdges.set(key, { from, to });
  }
  return { width: LOCATION_MAP_WIDTH, height: LOCATION_MAP_HEIGHT, nodes, edges: [...uniqueEdges.values()] };
}
