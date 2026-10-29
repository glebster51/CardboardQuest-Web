import { hazardAtPoint } from './game/world-hazards.mjs?v=ab782efa5048549c';
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function pointInWalkableArea(x, z, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t));
}

function distanceToBoundary(x, z, polygon) {
  const point = { x, z };
  let nearest = Infinity;
  for (let i = 0; i < polygon.length; i++) nearest = Math.min(nearest,
    distanceToSegment(point, polygon[i], polygon[(i + 1) % polygon.length]));
  return nearest;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function polygonCentroid(polygon) {
  let areaTwice = 0, x = 0, z = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const cross = a.x * b.z - b.x * a.z;
    areaTwice += cross;
    x += (a.x + b.x) * cross;
    z += (a.z + b.z) * cross;
  }
  if (Math.abs(areaTwice) < 1e-8) {
    return polygon.reduce((center, point) => ({ x: center.x + point.x / polygon.length,
      z: center.z + point.z / polygon.length }), { x: 0, z: 0 });
  }
  return { x: x / (3 * areaTwice), z: z / (3 * areaTwice) };
}

function areaBounds(polygon) {
  return polygon.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x), maxX: Math.max(bounds.maxX, point.x),
    minZ: Math.min(bounds.minZ, point.z), maxZ: Math.max(bounds.maxZ, point.z),
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
}

function createWalkPath(center, anchor, seed) {
  const length = distance(center, anchor);
  const normal = { x: -(anchor.z - center.z) / (length || 1), z: (anchor.x - center.x) / (length || 1) };
  const random = seededRandom(seed);
  const bend = (random() - .5) * Math.min(1.1, length * .12);
  const points = [];
  const segments = Math.max(10, Math.ceil(length * 2.4));
  for (let index = 0; index <= segments; index++) {
    const t = index / segments;
    const curve = Math.sin(Math.PI * t) * bend;
    points.push({ x: center.x + (anchor.x - center.x) * t + normal.x * curve,
      z: center.z + (anchor.z - center.z) * t + normal.z * curve });
  }
  points[0] = { ...center };
  points[points.length - 1] = { ...anchor };
  return points;
}

export function createLocationWalkPaths(location, extraDestinations = []) {
  if (!location?.walkablePoints || location.walkablePoints.length < 3) throw new TypeError('Location needs a walkable polygon');
  const center = location.entry ?? polygonCentroid(location.walkablePoints);
  const anchors = [
    ...Object.values(location.arrivals ?? {}),
    ...(location.exits ?? []).map(({ x, z }) => ({ x, z })),
    ...extraDestinations,
  ];
  const unique = [];
  for (const anchor of anchors) {
    if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.z)
      || distance(center, anchor) < 1.2 || unique.some(other => distance(anchor, other) < .5)) continue;
    unique.push(anchor);
  }
  return unique.map((anchor, index) => {
    const direct = createWalkPath(center, anchor, 719 + index * 97);
    if (!direct.some(point => !pointInWalkableArea(point.x, point.z, location.walkablePoints)
      || hazardAtPoint(point.x, point.z, location.hazards, 1))) return direct;
    return findGroundRoute(location, location.entry ?? center, anchor);
  }).filter(path => path.length > 1);
}

/** Route trails around real holes rather than stamping dirt over water. */
export function findGroundRoute(location, start, end, clearance = 1) {
  const bounds = areaBounds(location.walkablePoints), spacing = .7;
  const cols = Math.ceil((bounds.maxX - bounds.minX) / spacing) + 1;
  const rows = Math.ceil((bounds.maxZ - bounds.minZ) / spacing) + 1;
  const position = index => ({ x: bounds.minX + index % cols * spacing,
    z: bounds.minZ + Math.floor(index / cols) * spacing });
  const safe = index => {
    const point = position(index);
    return pointInWalkableArea(point.x, point.z, location.walkablePoints)
      && distanceToBoundary(point.x, point.z, location.walkablePoints) >= .82
      && !hazardAtPoint(point.x, point.z, location.hazards, clearance);
  };
  const nearest = point => {
    let best = -1, bestDistance = Infinity;
    for (let index = 0; index < cols * rows; index++) {
      const p = position(index), d = distance(p, point);
      if (d < bestDistance && safe(index)) { best = index; bestDistance = d; }
    }
    return best;
  };
  const first = nearest(start), last = nearest(end);
  if (first < 0 || last < 0) return [];
  const queue = [first], parent = new Int32Array(cols * rows).fill(-1);
  parent[first] = first;
  for (let head = 0; head < queue.length && parent[last] < 0; head++) {
    const index = queue[head], x = index % cols, z = Math.floor(index / cols);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = x + dx, nz = z + dz, next = nz * cols + nx;
      if (nx < 0 || nx >= cols || nz < 0 || nz >= rows || parent[next] >= 0 || !safe(next)) continue;
      if (dx && dz && (!safe(z * cols + nx) || !safe(nz * cols + x))) continue;
      parent[next] = index; queue.push(next);
    }
  }
  if (parent[last] < 0) return [];
  const path = [end];
  for (let index = last; index !== first; index = parent[index]) path.push(position(index));
  path.push(start);
  return path.reverse();
}

function pathDistance(point, paths) {
  let nearest = Infinity;
  for (const path of paths) for (let index = 1; index < path.length; index++) {
    nearest = Math.min(nearest, distanceToSegment(point, path[index - 1], path[index]));
  }
  return nearest;
}

export function scatterGroundDetails({
  location, seed = 1, paths = [], exclusions = [], decalCount = 36, grassCount = 72,
  edgeMargin = .42, pathMargin = .72,
}) {
  const polygon = location?.walkablePoints;
  if (!polygon || polygon.length < 3) throw new TypeError('Scattering needs a walkable polygon');
  const random = seededRandom(seed), bounds = areaBounds(polygon);
  const decals = [], grass = [];
  const decalKinds = ['ground-v2-pit', 'ground-v2-grass-ring', 'ground-v2-dirt-patch', 'ground-v2-footprints',
    'ground-v2-footsteps', 'ground-v2-scuff', 'ground-v2-pebbles', 'ground-v2-cracks',
    'ground-v2-twig', 'ground-v2-hooves', 'ground-v2-stones', 'ground-v2-cracks-broad'];
  const accepts = (point, edge, path, placements, spacing) => pointInWalkableArea(point.x, point.z, polygon)
    && distanceToBoundary(point.x, point.z, polygon) >= edge
    && !hazardAtPoint(point.x, point.z, location.hazards, edge + .3)
    && pathDistance(point, paths) >= path
    && !exclusions.some(exclusion => distance(point, exclusion) < exclusion.radius)
    && placements.every(other => distance(point, other) >= spacing);
  const placeRandom = (count, target, options) => {
    for (let attempt = 0; attempt < count * 90 && target.length < count; attempt++) {
      const point = { x: bounds.minX + random() * (bounds.maxX - bounds.minX),
        z: bounds.minZ + random() * (bounds.maxZ - bounds.minZ) };
      if (!accepts(point, edgeMargin, pathMargin, target, options.spacing)) continue;
      const kind = options.grass ? `grass-tuft-v2-${1 + Math.floor(random() * 8)}`
        : decalKinds[Math.floor(random() * decalKinds.length)];
      target.push({ ...point, kind, width: options.width[0] + random() * (options.width[1] - options.width[0]),
        height: options.height[0] + random() * (options.height[1] - options.height[0]),
        rotation: random() * Math.PI * 2, opacity: options.grass ? .88 + random() * .12 : .72 + random() * .22 });
    }
  };
  placeRandom(decalCount, decals, { spacing: .72, width: [.38, .84], height: [.34, .78] });
  placeRandom(grassCount, grass, { spacing: .96, width: [.26, .48], height: [.38, .72], grass: true });

  const trail = [];
  for (const path of paths) {
    let carry = 0;
    for (let index = 1; index < path.length; index++) {
      const a = path[index - 1], b = path[index], length = distance(a, b);
      carry += length;
      if (carry < .9) continue;
      carry = 0;
      const tangent = Math.atan2(b.x - a.x, b.z - a.z);
      if (hazardAtPoint((a.x + b.x) / 2, (a.z + b.z) / 2, location.hazards, .5)) continue;
      if (random() < .58) trail.push({ x: (a.x + b.x) / 2 + (random() - .5) * .12,
        z: (a.z + b.z) / 2 + (random() - .5) * .12,
        kind: random() < .7 ? 'ground-v2-dirt-patch' : 'ground-v2-scuff',
        width: .65 + random() * .4, height: .45 + random() * .3,
        rotation: tangent + (random() - .5) * .28, opacity: .65 + random() * .18 });
      if (Math.floor(index * .46 / 1.55) !== Math.floor((index - 1) * .46 / 1.55) && random() < .72) {
        trail.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2,
          kind: random() < .5 ? 'ground-v2-footprints' : 'ground-v2-footsteps',
          width: .42 + random() * .13, height: .48 + random() * .18,
          rotation: tangent + (random() - .5) * .16, opacity: .75 + random() * .2 });
      }
    }
  }
  return { decals, grass, trail };
}
