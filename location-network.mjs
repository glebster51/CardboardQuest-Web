export const PORTAL_RADIUS = .82;
export const FOREST_WAKE_RADIUS = 3.1;
export const CAMP_REINFORCEMENT_DELAY = 2;
export const CAMP_LIVING_CAP = 4;
export const CAMP_BOSS_DEFEATS = 8;

const point = (x, z) => ({ x, z });

export function createLocationNetwork() {
  return {
    home: {
      id: 'home', title: 'Хижина в лесу', kind: 'home', enemies: [], scenery: [], combatTriggered: false,
      entry: point(1.8, .7), arrivals: { forest: point(0, -4.4) },
      exits: [{ x: 0, z: -6.35, to: 'forest', label: 'Лесная тропа' }],
    },
    forest: {
      id: 'forest', title: 'Лесная тропа', kind: 'forest', enemies: [], scenery: [], combatTriggered: false,
      arrivals: { home: point(0, -4.4), camp: point(0, 4.4) },
      exits: [
        { x: 0, z: -6.35, to: 'home', label: 'Домой' },
        { x: 0, z: 6.35, to: 'camp', label: 'Лагерь гоблинов' },
      ],
    },
    camp: {
      id: 'camp', title: 'Лагерь гоблинов', kind: 'camp', enemies: [], scenery: [], combatTriggered: true,
      arrivals: { forest: point(0, 4.4) },
      exits: [{ x: 0, z: 6.35, to: 'forest', label: 'Лесная тропа' }],
      defeats: 0, reinforcementQueue: [], pendingSpawns: 0, bossSpawned: false, initialized: false,
    },
  };
}

export function findNearbyExit(location, body, radius = PORTAL_RADIUS) {
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
