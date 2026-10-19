import { CAMPAIGN, CAMPAIGN_EDGES } from './story-campaign.mjs';

const COMPASS = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
const smoothPeak = delta => {
  const t = Math.min(1, Math.abs(delta) / .3);
  const smooth = t * t * (3 - 2 * t);
  return 1 - smooth;
};

function footprint(directions, scale) {
  const points = [];
  const count = 96;
  for (let index = 0; index < count; index++) {
    const angle = index / count * Math.PI * 2;
    let gate = 0;
    for (const direction of directions) {
      const delta = Math.atan2(Math.sin(angle - direction), Math.cos(angle - direction));
      gate = Math.max(gate, smoothPeak(delta));
    }
    const variation = 1 + .055 * Math.sin(angle * 3 + .7) + .035 * Math.sin(angle * 7 - 1.1);
    const radius = (8.1 * variation + 3.6 * gate) * scale;
    points.push({ x: Math.cos(angle) * radius, z: Math.sin(angle) * radius });
  }
  return points;
}

/** Expand the authored story graph into small playable arenas and throat exits. */
export function createCampaignLocations(locations, scale = 1.5) {
  if (!locations || !locations.home || !Number.isFinite(scale) || scale <= 0) {
    throw new TypeError('Campaign locations need the base game world and a positive scale');
  }
  const exitsById = new Map(CAMPAIGN.map(location => [location.id, []]));
  for (const [from, to] of CAMPAIGN_EDGES) exitsById.get(from).push(to);

  for (const authored of CAMPAIGN) {
    const location = locations[authored.id] ?? {
      id: authored.id, enemies: [], obstacles: [], scenery: [], combatTriggered: false,
      defeats: 0, goblinsSpawned: 0, reinforcementQueue: [], pendingSpawns: 0,
      bossSpawned: false, initialized: false,
    };
    const neighbors = exitsById.get(authored.id);
    const directions = neighbors.map((_, index) => COMPASS[index % COMPASS.length]);
    const walkablePoints = footprint(directions, scale);
    const exits = neighbors.map((to, index) => ({
      x: Math.cos(directions[index]) * 10.15 * scale,
      z: Math.sin(directions[index]) * 10.15 * scale,
      to,
      label: 'Проход между холмами',
    }));
    const arrivals = {};
    for (const [from, to] of CAMPAIGN_EDGES) if (to === authored.id) {
      const arrivalAngle = directions[neighbors.indexOf(from)];
      if (Number.isFinite(arrivalAngle)) arrivals[from] = {
        x: Math.cos(arrivalAngle) * 6.6 * scale,
        z: Math.sin(arrivalAngle) * 6.6 * scale,
      };
    }
    Object.assign(location, {
      id: authored.id,
      title: authored.title,
      kind: authored.id === 'home' || authored.id === 'forest' || authored.id === 'camp' ? authored.id : 'story',
      biome: authored.biome,
      campaignIntro: authored.intro,
      campaignScene: authored.scene,
      campaignOptions: authored.options,
      secret: authored.options === 'secret',
      exits,
      arrivals,
      entry: { x: 0, z: 0 },
      walkablePoints,
      lastExitPositions: location.lastExitPositions ?? {},
      heightSeed: 7049 + [...authored.id].reduce((seed, char) => (Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0), 2166136261),
      terrainStyle: authored.biome,
    });
    locations[authored.id] = location;
  }
  return locations;
}
