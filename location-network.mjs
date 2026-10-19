export const EXIT_ZONE_RADIUS = 1.05;
export const LOCATION_SCALE = 1.5;
export const FOREST_WAKE_RADIUS = 3.1 * LOCATION_SCALE;
export const CAMP_REINFORCEMENT_DELAY = 2;
export const CAMP_LIVING_CAP = 4;
export const CAMP_GOBLIN_TOTAL = 8;
export const CAMP_BOSS_DEFEATS = 5;
export const CAMP_HUT_ANCHORS = [
  { x: -5.8, z: -4.4 }, { x: 5.8, z: -4.4 },
  { x: -5.8, z: 4.4 }, { x: 5.8, z: 4.4 },
];
export const CAMP_GOBLIN_SPAWNS = [
  { x: -3.7, z: -2.3 }, { x: 3.7, z: -2.3 },
  { x: -3.7, z: 2.3 }, { x: 3.7, z: 2.3 },
];

const point = (x, z) => ({ x, z });

const homeWalkable = [
  point(-7, -5.5), point(-4.5, -7), point(-2.5, -6.5), point(-2.05, -7.25), point(-2.05, -9.2),
  point(2.05, -9.2), point(2.05, -7.25), point(1.5, -6.4), point(4.5, -6.5),
  point(7, -4), point(6.2, -1.4), point(7.1, 1.4), point(6, 4.4), point(3.4, 6), point(.3, 5.5),
  point(-2.8, 6.5), point(-5.7, 5.2), point(-6.8, 2.3), point(-6.2, -.8), point(-7.3, -3.1),
];
const forestWalkable = [
  point(-4.4, -8.1), point(-2.35, -7.55), point(-2.05, -8.35), point(-2.05, -10.2),
  point(2.05, -10.2), point(2.05, -8.35), point(2.5, -7.6), point(4.2, -7.2), point(6.3, -5),
  point(5.7, -2), point(6.7, .5), point(5.8, 3.2), point(6.4, 5.4), point(3.5, 8),
  point(2.1, 7.6), point(2.05, 8.4), point(2.05, 10.2), point(-2.05, 10.2),
  point(-2.05, 8.4), point(-2.5, 7.65), point(-5.5, 6.4), point(-6.3, 3.4), point(-5.6, .2),
  point(-6.4, -3.1), point(-5.5, -5.8),
];
const campWalkable = [
  point(-8.5, -4.7), point(-6.2, -7.1), point(-3.2, -6.4), point(-2.05, -7.15), point(-2.05, -9.2),
  point(2.05, -9.2), point(2.05, -7.15), point(2.8, -6.8),
  point(6.1, -7.2), point(8.5, -4.8), point(7.6, -2), point(8.6, .8), point(7.7, 3.4),
  point(5.2, 6), point(2, 5.6), point(-1, 6.4), point(-4.2, 5.7), point(-7.3, 6.3),
  point(-8.2, 3.7), point(-7.6, .5), point(-8.4, -2.1),
];

function scalePoint(value, scale) { return point(value.x * scale, value.z * scale); }
function scaleLocationFootprint(walkablePoints, arrivals, exits, entry, scale) {
  return {
    walkablePoints: walkablePoints.map(value => scalePoint(value, scale)),
    ...(entry ? { entry: scalePoint(entry, scale) } : {}),
    arrivals: Object.fromEntries(Object.entries(arrivals).map(([id, value]) => [id, scalePoint(value, scale)])),
    exits: exits.map(exit => ({ ...exit, ...scalePoint(exit, scale) })),
  };
}

export function createLocationNetwork(scale = LOCATION_SCALE) {
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('Location scale must be a positive number');
  const homePoints = homeWalkable.map(value => point(value.x, -value.z));
  const home = scaleLocationFootprint(homePoints, { forest: point(0, 4.6) },
    [{ x: 0, z: 8.55, to: 'forest', label: 'Проход между холмами' }], point(0, 0), scale);
  const forest = scaleLocationFootprint(forestWalkable, { home: point(0, -7), camp: point(0, 7) }, [
    { x: 0, z: -9.55, to: 'home', label: 'Домой' },
    { x: 0, z: 9.55, to: 'camp', label: 'Лагерь гоблинов' },
  ], null, scale);
  const camp = scaleLocationFootprint(campWalkable, { forest: point(0, -6.8) },
    [{ x: 0, z: -8.55, to: 'forest', label: 'Проход между холмами' }], null, scale);
  return {
    home: {
      id: 'home', title: 'Хижина в лесу', kind: 'home', enemies: [], scenery: [], combatTriggered: false,
      lastExitPositions: {}, ...home,
    },
    forest: {
      id: 'forest', title: 'Лес', kind: 'forest', enemies: [], scenery: [], combatTriggered: false,
      lastExitPositions: {}, ...forest,
    },
    camp: {
      id: 'camp', title: 'Лагерь гоблинов', kind: 'camp', enemies: [], scenery: [], combatTriggered: true,
      ...camp,
      defeats: 0, goblinsSpawned: CAMP_LIVING_CAP, reinforcementQueue: [], pendingSpawns: 0,
      bossSpawned: false, initialized: false, lastExitPositions: {},
    },
  };
}

export function findNearbyExit(location, body, radius = EXIT_ZONE_RADIUS) {
  return location.exits.find(exit => {
    if (!exit.halfWidth) return Math.hypot(exit.x - body.x, exit.z - body.z) <= radius;
    const length = Math.hypot(exit.x, exit.z) || 1;
    const ux = exit.dirX ?? exit.x / length, uz = exit.dirZ ?? exit.z / length;
    const dx = body.x - exit.x, dz = body.z - exit.z;
    return Math.abs(dx * ux + dz * uz) <= (exit.halfDepth ?? radius)
      && Math.abs(dx * uz - dz * ux) <= exit.halfWidth;
  }) ?? null;
}

export function locationArrival(location, fromLocationId) {
  return location.arrivals?.[fromLocationId] ?? location.entry ?? point(0, 0);
}

export function locationEntryDirection(location, fromLocationId) {
  const entrance = location.exits?.find(exit => exit.to === fromLocationId);
  const center = location.entry ?? point(0, 0);
  if (!entrance) return point(0, 1);
  if (Number.isFinite(entrance.dirX)) return point(-entrance.dirX, -entrance.dirZ);
  const dx = center.x - entrance.x, dz = center.z - entrance.z;
  const length = Math.hypot(dx, dz) || 1;
  return point(dx / length, dz / length);
}

export function rememberExitPosition(location, destinationId, position) {
  if (!location.lastExitPositions) location.lastExitPositions = {};
  location.lastExitPositions[destinationId] = point(position.x, position.z);
}

export function lastExitPosition(location, fromLocationId) {
  return location.lastExitPositions?.[fromLocationId] ?? null;
}

export function shouldIgnoreEntryExit(location, fromLocationId, body, radius = EXIT_ZONE_RADIUS * 1.5) {
  const entrance = location.exits?.find(exit => exit.to === fromLocationId);
  if (entrance?.halfWidth) {
    const length = Math.hypot(entrance.x, entrance.z) || 1;
    const ux = entrance.dirX ?? entrance.x / length, uz = entrance.dirZ ?? entrance.z / length;
    const dx = body.x - entrance.x, dz = body.z - entrance.z;
    return Math.abs(dx * ux + dz * uz) <= (entrance.halfDepth ?? 1) + radius
      && Math.abs(dx * uz - dz * ux) <= entrance.halfWidth + radius;
  }
  return Boolean(entrance && Math.hypot(body.x - entrance.x, body.z - entrance.z) <= radius);
}

export function wakeForestCombat(location, player, radius = FOREST_WAKE_RADIUS) {
  if (location.kind !== 'forest' || location.combatTriggered) return false;
  if (!location.enemies.some(enemy => enemy.health > 0
    && Math.hypot(player.x - enemy.x, player.z - enemy.z) <= radius)) return false;
  location.combatTriggered = true;
  for (const enemy of location.enemies) enemy.combatAwake = true;
  return true;
}

export function recordCampDefeat(location, now) {
  if (location.kind !== 'camp') return false;
  location.defeats++;
  if ((location.goblinsSpawned ?? 0) + (location.pendingSpawns ?? 0) < CAMP_GOBLIN_TOTAL) {
    location.reinforcementQueue.push(now + CAMP_REINFORCEMENT_DELAY);
  }
  if (location.defeats >= CAMP_BOSS_DEFEATS && !location.bossSpawned) {
    location.bossSpawned = true;
    return true;
  }
  return false;
}

export function takeDueReinforcement(location, now, livingCount) {
  if (location.kind !== 'camp' || !location.reinforcementQueue.length
    || location.reinforcementQueue[0] > now || livingCount + location.pendingSpawns >= CAMP_LIVING_CAP
    || (location.goblinsSpawned ?? 0) + location.pendingSpawns >= CAMP_GOBLIN_TOTAL) return false;
  location.reinforcementQueue.shift();
  location.pendingSpawns++;
  return true;
}

export function finishCampReinforcement(location, now, spawned) {
  if (location.kind !== 'camp' || location.pendingSpawns <= 0) return false;
  location.pendingSpawns--;
  if (spawned) location.goblinsSpawned++;
  else if ((location.goblinsSpawned ?? 0) + location.pendingSpawns < CAMP_GOBLIN_TOTAL) {
    location.reinforcementQueue.unshift(now + CAMP_REINFORCEMENT_DELAY);
  }
  return true;
}
