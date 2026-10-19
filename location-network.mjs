export const EXIT_ZONE_RADIUS = 1.05;
export const FOREST_WAKE_RADIUS = 3.1;
export const CAMP_REINFORCEMENT_DELAY = 2;
export const CAMP_LIVING_CAP = 4;
export const CAMP_BOSS_DEFEATS = 8;

const point = (x, z) => ({ x, z });

const homeWalkable = [
  point(-7, -5.5), point(-4.5, -7), point(-1.6, -6.6), point(1.2, -7.2), point(4.5, -6.5),
  point(7, -4), point(6.2, -1.4), point(7.1, 1.4), point(6, 4.4), point(3.4, 6), point(.3, 5.5),
  point(-2.8, 6.5), point(-5.7, 5.2), point(-6.8, 2.3), point(-6.2, -.8), point(-7.3, -3.1),
];
const forestWalkable = [
  point(-4.4, -8.1), point(-1.4, -7.5), point(1.3, -8), point(4.2, -7.2), point(6.3, -5),
  point(5.7, -2), point(6.7, .5), point(5.8, 3.2), point(6.4, 5.4), point(3.5, 8),
  point(.5, 7.4), point(-2.4, 8.1), point(-5.5, 6.4), point(-6.3, 3.4), point(-5.6, .2),
  point(-6.4, -3.1), point(-5.5, -5.8),
];
const campWalkable = [
  point(-8.5, -4.7), point(-6.2, -7.1), point(-3.2, -6.4), point(-.2, -7.2), point(2.8, -6.8),
  point(6.1, -7.2), point(8.5, -4.8), point(7.6, -2), point(8.6, .8), point(7.7, 3.4),
  point(5.2, 6), point(2, 5.6), point(-1, 6.4), point(-4.2, 5.7), point(-7.3, 6.3),
  point(-8.2, 3.7), point(-7.6, .5), point(-8.4, -2.1),
];

export function createLocationNetwork() {
  return {
    home: {
      id: 'home', title: 'Хижина в лесу', kind: 'home', enemies: [], scenery: [], combatTriggered: false,
      walkablePoints: homeWalkable,
      entry: point(1.8, .7), arrivals: { forest: point(0, 4.6) },
      exits: [{ x: 0, z: -5.8, to: 'forest', label: 'Лесная тропа' }],
    },
    forest: {
      id: 'forest', title: 'Лесная тропа', kind: 'forest', enemies: [], scenery: [], combatTriggered: false,
      walkablePoints: forestWalkable,
      arrivals: { home: point(0, -5.5), camp: point(0, 5.5) },
      exits: [
        { x: 0, z: -7.05, to: 'home', label: 'Домой' },
        { x: 0, z: 7.05, to: 'camp', label: 'Лагерь гоблинов' },
      ],
    },
    camp: {
      id: 'camp', title: 'Лагерь гоблинов', kind: 'camp', enemies: [], scenery: [], combatTriggered: true,
      walkablePoints: campWalkable,
      arrivals: { forest: point(0, -4.3) },
      exits: [{ x: 0, z: -5.9, to: 'forest', label: 'Лесная тропа' }],
      defeats: 0, reinforcementQueue: [], pendingSpawns: 0, bossSpawned: false, initialized: false,
    },
  };
}

export function findNearbyExit(location, body, radius = EXIT_ZONE_RADIUS) {
  return location.exits.find(exit => Math.hypot(body.x - exit.x, body.z - exit.z) <= radius) ?? null;
}

export function locationArrival(location, fromLocationId) {
  return location.arrivals?.[fromLocationId] ?? location.entry ?? point(0, 0);
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
  location.reinforcementQueue.push(now + CAMP_REINFORCEMENT_DELAY);
  if (location.defeats >= CAMP_BOSS_DEFEATS && !location.bossSpawned) {
    location.bossSpawned = true;
    return true;
  }
  return false;
}

export function takeDueReinforcement(location, now, livingCount) {
  if (location.kind !== 'camp' || !location.reinforcementQueue.length
    || location.reinforcementQueue[0] > now || livingCount + location.pendingSpawns >= CAMP_LIVING_CAP) return false;
  location.reinforcementQueue.shift();
  location.pendingSpawns++;
  return true;
}
