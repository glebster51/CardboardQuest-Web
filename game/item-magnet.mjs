export const ITEM_MAGNET_DEFAULTS = Object.freeze({
  radius: 4,
  radiusSpread: 0,
  worldDuration: .48,
  worldDurationSpread: 0,
  worldArc: 3.4,
  worldArcSpread: 0,
  iconDuration: .7,
  iconDurationSpread: 0,
  iconArc: 220,
  iconArcSpread: 0,
});

export const ITEM_MAGNET_STORAGE_KEY = 'cardboardquest-item-magnet-settings-v1';

export function normalizeItemMagnetSettings(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
  const limits = { radius: [0, 14], radiusSpread: [0, 7], worldDuration: [.15, 1.5],
    worldDurationSpread: [0, .675], worldArc: [.5, 8], worldArcSpread: [0, 3.75],
    iconDuration: [.2, 2], iconDurationSpread: [0, .9], iconArc: [20, 600], iconArcSpread: [0, 290] };
  return Object.fromEntries(Object.entries(ITEM_MAGNET_DEFAULTS).map(([key, fallback]) => {
    const number = Number(value[key]);
    const [min, max] = limits[key];
    return [key, Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback];
  }));
}

function randomRange(value, spread, min, max, random) {
  return Math.min(max, Math.max(min, value + (random() * 2 - 1) * spread));
}

/** Sample one pickup's stable motion values; zero spreads preserve the base settings exactly. */
export function sampleItemMagnetMotion(value, random = Math.random) {
  const settings = normalizeItemMagnetSettings(value);
  return {
    radius: randomRange(settings.radius, settings.radiusSpread, 0, 14, random),
    worldDuration: randomRange(settings.worldDuration, settings.worldDurationSpread, .15, 1.5, random),
    worldArc: randomRange(settings.worldArc, settings.worldArcSpread, .5, 8, random),
    iconDuration: randomRange(settings.iconDuration, settings.iconDurationSpread, .2, 2, random),
    iconArc: randomRange(settings.iconArc, settings.iconArcSpread, 20, 600, random),
  };
}

/** Stable per-item pickup radius so a loot item never flickers in and out of range. */
export function itemMagnetRadiusForItem(itemId, value) {
  let seed = 2166136261;
  for (const char of String(itemId)) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  seed >>>= 0;
  const random = () => {
    seed += 0x6d2b79f5;
    let next = Math.imul(seed ^ seed >>> 15, seed | 1);
    next ^= next + Math.imul(next ^ next >>> 7, next | 61);
    return ((next ^ next >>> 14) >>> 0) / 4294967296;
  };
  const settings = normalizeItemMagnetSettings(value);
  return randomRange(settings.radius, settings.radiusSpread, 0, 14, random);
}

export function itemMagnetWorldPosition(flight, progress, target) {
  const t = Math.min(1, Math.max(0, progress));
  const eased = t * t * (3 - 2 * t);
  return {
    x: flight.from.x + (target.x - flight.from.x) * eased,
    y: flight.from.y + (target.y - flight.from.y) * eased + Math.sin(Math.PI * t) * flight.arc,
    z: flight.from.z + (target.z - flight.from.z) * eased,
    scale: t < .72 ? 1 : Math.max(0, 1 - (t - .72) / .28),
  };
}

export function createItemIconFlight(from, to, { duration, arc, random = Math.random }) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const sideX = -dy / length, sideY = dx / length;
  const sign = random() < .5 ? -1 : 1;
  return {
    from: { ...from }, to: { ...to },
    control: {
      x: (from.x + to.x) / 2 + sideX * arc * sign * (.55 + random() * .9),
      y: (from.y + to.y) / 2 + sideY * arc * sign * (.55 + random() * .9) - arc * (.45 + random() * .45),
    },
    duration,
    age: 0,
    rotation: (random() - .5) * .42,
    scale: .72 + random() * .25,
  };
}

export function itemIconFlightPosition(flight, progress) {
  const t = Math.min(1, Math.max(0, progress));
  const inverse = 1 - t;
  return {
    x: inverse * inverse * flight.from.x + 2 * inverse * t * flight.control.x + t * t * flight.to.x,
    y: inverse * inverse * flight.from.y + 2 * inverse * t * flight.control.y + t * t * flight.to.y,
    scale: flight.scale * (1 - .18 * t),
    rotation: flight.rotation * (1 - t),
    alpha: Math.min(1, (1 - t) * 5),
  };
}
