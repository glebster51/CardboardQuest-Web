import { CAMPAIGN, CAMPAIGN_EDGES } from './story-campaign.mjs?v=3';
import { createLocationArt } from './location-art.mjs';
import { createAuthoredLayout } from './location-layout.mjs';
import { hazardAtPoint } from './world-hazards.mjs';

function pointInside(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.z > point.z) !== (b.z > point.z)
      && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function boundaryClearance(point, polygon) {
  let nearest = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz)));
    nearest = Math.min(nearest, Math.hypot(point.x - a.x - dx * t, point.z - a.z - dz * t));
  }
  return nearest;
}

export function isCampaignPositionSafe(location, point, clearance = 1.2) {
  const points = location?.walkablePoints ?? [];
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.z) && points.length >= 3
    && pointInside(point, points) && boundaryClearance(point, points) >= clearance
    && !hazardAtPoint(point.x, point.z, location.hazards, clearance)
    && !(location.exits ?? []).some(exit => Math.hypot(point.x - exit.x, point.z - exit.z) <= 2.1));
}

/** Restore a save without starting the player dead, outside the field, or inside an exit trigger. */
export function resolveCampaignPlayerStart(location, { health, maxHealth, position } = {}) {
  const maximum = Math.max(1, Math.trunc(Number.isFinite(maxHealth) ? maxHealth : 20));
  const numericHealth = Number.isFinite(health) ? Math.trunc(health) : maximum;
  const restoredHealth = numericHealth <= 0 ? maximum : Math.min(numericHealth, maximum);
  const points = location?.walkablePoints ?? [];
  const isSafe = candidate => isCampaignPositionSafe(location, candidate);

  let spawn = isSafe(position) ? { x: position.x, z: position.z } : null;
  if (!spawn) {
    const entry = location?.entry ?? { x: 0, z: 0 };
    if (isSafe(entry)) spawn = { x: entry.x, z: entry.z };
  }
  if (!spawn && points.length >= 3) {
    const bounds = points.reduce((result, point) => ({
      minX: Math.min(result.minX, point.x), maxX: Math.max(result.maxX, point.x),
      minZ: Math.min(result.minZ, point.z), maxZ: Math.max(result.maxZ, point.z),
    }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
    let best = null, bestClearance = -Infinity;
    for (let z = bounds.minZ; z <= bounds.maxZ; z += .5) for (let x = bounds.minX; x <= bounds.maxX; x += .5) {
      const candidate = { x, z };
      if (!isSafe(candidate)) continue;
      const clearance = boundaryClearance(candidate, points);
      if (clearance > bestClearance) { best = candidate; bestClearance = clearance; }
    }
    spawn = best;
  }
  return { health: restoredHealth, position: spawn ?? { x: 0, z: 0 }, recovered: numericHealth <= 0 || !isSafe(position) };
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
    const art = createLocationArt(authored.id, scale);
    const layout = createAuthoredLayout(authored.id, art, scale);
    if (layout.exits.length !== neighbors.length) throw new Error(`Exit layout does not match story graph: ${authored.id}`);
    const walkablePoints = layout.points;
    const exits = neighbors.map((to, index) => ({
      ...layout.exits[index],
      to,
      label: 'Проход между холмами',
    }));
    const dropZones = (art.falls ?? []).map(([angle, kind, radius]) => {
      const candidates = walkablePoints.filter(point => exits.every(exit => Math.hypot(exit.x - point.x, exit.z - point.z) > radius + 4));
      const point = candidates.sort((a, b) => Math.abs(Math.atan2(Math.sin(Math.atan2(a.z, a.x) - angle), Math.cos(Math.atan2(a.z, a.x) - angle)))
        - Math.abs(Math.atan2(Math.sin(Math.atan2(b.z, b.x) - angle), Math.cos(Math.atan2(b.z, b.x) - angle))))[0];
      return point ? { ...point, radius, kind } : null;
    }).filter(Boolean);
    const arrivals = {};
    for (const [from, to] of CAMPAIGN_EDGES) if (to === authored.id) {
      const gate = layout.exits[neighbors.indexOf(from)];
      if (gate) arrivals[from] = { ...gate.arrival };
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
      dropZones,
      hazards: art.hazards,
      art,
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
