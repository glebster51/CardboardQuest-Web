export function createTerrainPeaks(seed = 1937, count = 16, maxRadius = 6.5) {
  let state = seed >>> 0;
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    angle: random() * Math.PI * 2,
    radius: .9 + random() * (maxRadius - .9),
    angleWidth: .12 + random() * .36,
    radiusWidth: .22 + random() * .82,
    amplitude: random() * 2 - 1,
  }));
}

function pointInsidePolygon(x, z, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function latticeNoise(x, z, seed) {
  const hash = (ix, iz) => {
    let value = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + seed;
    value = Math.imul(value ^ value >>> 13, 1274126177);
    return ((value ^ value >>> 16) >>> 0) / 2147483647.5 - 1;
  };
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const fade = value => value * value * (3 - 2 * value);
  const tx = fade(fx), tz = fade(fz);
  const a = hash(ix, iz) * (1 - tx) + hash(ix + 1, iz) * tx;
  const b = hash(ix, iz + 1) * (1 - tx) + hash(ix + 1, iz + 1) * tx;
  return a * (1 - tz) + b * tz;
}

function smoothNoise(x, z, seed) {
  return latticeNoise(x / 19, z / 16, seed) * .52
    + latticeNoise(x / 9, z / 8, seed + 0x9e3779b9) * .31
    + latticeNoise(x / 4.2, z / 4.8, seed + 0x85ebca6b) * .17;
}

function smoothStep(min, max, value) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return t * t * (3 - 2 * t);
}

function contourKey(point) { return `${Math.round(point.x * 10000)},${Math.round(point.z * 10000)}`; }

export function extractTerrainContours(map, threshold) {
  const segments = [];
  const { columns, rows, values, minX, minZ, cellSize } = map;
  const sample = (x, z) => values[z * columns + x];
  const edgePoint = (a, b, va, vb) => {
    const amount = Math.max(0, Math.min(1, (threshold - va) / (vb - va)));
    return { x: a.x + (b.x - a.x) * amount, z: a.z + (b.z - a.z) * amount };
  };
  const pairs = (mask, centerHigh) => {
    switch (mask) {
      case 1: return [[0, 3]];
      case 2: return [[0, 1]];
      case 3: return [[1, 3]];
      case 4: return [[1, 2]];
      case 5: return centerHigh ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]];
      case 6: return [[0, 2]];
      case 7: return [[2, 3]];
      case 8: return [[2, 3]];
      case 9: return [[0, 2]];
      case 10: return centerHigh ? [[0, 3], [1, 2]] : [[0, 1], [2, 3]];
      case 11: return [[1, 2]];
      case 12: return [[1, 3]];
      case 13: return [[0, 1]];
      case 14: return [[0, 3]];
      default: return [];
    }
  };
  for (let z = 0; z < rows - 1; z++) for (let x = 0; x < columns - 1; x++) {
    const points = [
      { x: minX + x * cellSize, z: minZ + z * cellSize },
      { x: minX + (x + 1) * cellSize, z: minZ + z * cellSize },
      { x: minX + (x + 1) * cellSize, z: minZ + (z + 1) * cellSize },
      { x: minX + x * cellSize, z: minZ + (z + 1) * cellSize },
    ];
    const valuesAtCorners = [sample(x, z), sample(x + 1, z), sample(x + 1, z + 1), sample(x, z + 1)];
    const mask = valuesAtCorners.reduce((bits, value, index) => bits | (value >= threshold ? 1 << index : 0), 0);
    if (mask === 0 || mask === 15) continue;
    const edges = [
      edgePoint(points[0], points[1], valuesAtCorners[0], valuesAtCorners[1]),
      edgePoint(points[1], points[2], valuesAtCorners[1], valuesAtCorners[2]),
      edgePoint(points[2], points[3], valuesAtCorners[2], valuesAtCorners[3]),
      edgePoint(points[3], points[0], valuesAtCorners[3], valuesAtCorners[0]),
    ];
    const centerHigh = valuesAtCorners.reduce((sum, value) => sum + value, 0) / 4 >= threshold;
    for (const [start, end] of pairs(mask, centerHigh)) segments.push([edges[start], edges[end]]);
  }

  const adjacency = new Map(), pointsByKey = new Map();
  segments.forEach((segment, index) => segment.forEach(point => {
    const key = contourKey(point);
    pointsByKey.set(key, point);
    if (!adjacency.has(key)) adjacency.set(key, []);
    adjacency.get(key).push(index);
  }));
  const used = new Uint8Array(segments.length), contours = [];
  for (let startIndex = 0; startIndex < segments.length; startIndex++) {
    if (used[startIndex]) continue;
    const segment = segments[startIndex], startKey = contourKey(segment[0]);
    let key = contourKey(segment[1]), previousIndex = startIndex;
    const contour = [segment[0], segment[1]];
    used[startIndex] = 1;
    while (key !== startKey && contour.length <= segments.length + 1) {
      const nextIndex = adjacency.get(key)?.find(index => index !== previousIndex && !used[index]);
      if (nextIndex === undefined) break;
      used[nextIndex] = 1;
      const next = segments[nextIndex], nextKey = contourKey(next[0]) === key ? contourKey(next[1]) : contourKey(next[0]);
      contour.push(pointsByKey.get(nextKey));
      previousIndex = nextIndex; key = nextKey;
    }
    if (key === startKey && contour.length >= 4) contours.push(contour.slice(0, -1));
  }
  return contours;
}

export function createTerrainHeightMap(seed = 9187, walkablePoints, options = {}) {
  if (!Array.isArray(walkablePoints) || walkablePoints.length < 3) throw new RangeError('Height map needs a walkable polygon');
  const minX = options.minX ?? -74, maxX = options.maxX ?? 74;
  const minZ = options.minZ ?? -60, maxZ = options.maxZ ?? 60;
  const cellSize = options.cellSize ?? .75, step = options.step ?? .28;
  const maxHeight = options.maxHeight ?? 3.92;
  const columns = Math.ceil((maxX - minX) / cellSize) + 1, rows = Math.ceil((maxZ - minZ) / cellSize) + 1;
  const values = new Float32Array(columns * rows);
  let state = seed >>> 0;
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
  const center = walkablePoints.reduce((sum, point) => ({ x: sum.x + point.x / walkablePoints.length,
    z: sum.z + point.z / walkablePoints.length }), { x: 0, z: 0 });
  const peaks = Array.from({ length: options.peakCount ?? 30 }, () => {
    const angle = random() * Math.PI * 2, radius = 3.8 + random() * 15.5;
    return {
      x: center.x + Math.cos(angle) * radius, z: center.z + Math.sin(angle) * radius,
      radialWidth: 2.8 + random() * 5.5,
      tangentWidth: 2.8 + random() * 6.5,
      angle, amplitude: .25 + random() * 2.4,
    };
  });
  const exits = options.exits ?? [];
  const dropZones = options.dropZones ?? [];
  const corridors = exits.map(exit => {
    const length = Math.hypot(exit.x - center.x, exit.z - center.z) || 1;
    return { x: (exit.x - center.x) / length, z: (exit.z - center.z) / length,
      start: length - 2.8, width: options.exitCorridorHalfWidth ?? 2.55 };
  });
  const distanceToBounds = (x, z) => Math.min(x - minX, maxX - x, z - minZ, maxZ - z);
  const rawHeight = (x, z) => {
    if (pointInsidePolygon(x, z, walkablePoints)) return 0;
    const edge = nearestPointOnPath(x, z, walkablePoints);
    const distance = Math.hypot(x - edge.x, z - edge.z);
    const warpX = latticeNoise(x / 14, z / 14, seed + 11) * 2.8;
    const warpZ = latticeNoise((x + 27) / 14, (z - 13) / 14, seed + 23) * 2.8;
    const noise = smoothNoise(x + warpX, z + warpZ, seed);
    let peakHeight = 0;
    for (const peak of peaks) {
      const dx = x - peak.x, dz = z - peak.z;
      const radial = dx * Math.cos(peak.angle) + dz * Math.sin(peak.angle);
      const tangent = -dx * Math.sin(peak.angle) + dz * Math.cos(peak.angle);
      const mound = peak.amplitude * Math.exp(-.5 * ((radial / peak.radialWidth) ** 2 + (tangent / peak.tangentWidth) ** 2));
      peakHeight = Math.max(peakHeight, mound);
    }
    const crestDistance = 3.6 + noise * 2.1;
    const ridge = Math.exp(-.5 * ((distance - crestDistance) / 4.6) ** 2);
    const outerFade = 1 - smoothStep(19, 28, distance);
    const edgeFade = smoothStep(0, 5.5, distanceToBounds(x, z));
    let height = (.38 + ridge * (1.35 + Math.max(0, noise) * .95) + peakHeight * .78) * outerFade * edgeFade;
    for (const corridor of corridors) {
      const along = (x - center.x) * corridor.x + (z - center.z) * corridor.z;
      if (along < corridor.start) continue;
      const across = Math.abs((x - center.x) * corridor.z - (z - center.z) * corridor.x);
      height *= smoothStep(corridor.width * .72, corridor.width, across);
    }
    for (const zone of dropZones) {
      const distanceToDrop = Math.hypot(x - zone.x, z - zone.z);
      height *= smoothStep(Math.max(.4, zone.radius * .72), zone.radius + .9, distanceToDrop);
    }
    return Math.max(0, Math.min(maxHeight, height));
  };
  for (let z = 0; z < rows; z++) for (let x = 0; x < columns; x++) {
    values[z * columns + x] = rawHeight(minX + x * cellSize, minZ + z * cellSize);
  }
  const map = {
    minX, minZ, columns, rows, cellSize, step, maxHeight, values,
    sample(x, z) {
      const gx = Math.max(0, Math.min(columns - 1.001, (x - minX) / cellSize));
      const gz = Math.max(0, Math.min(rows - 1.001, (z - minZ) / cellSize));
      const x0 = Math.floor(gx), z0 = Math.floor(gz), tx = gx - x0, tz = gz - z0;
      const a = values[z0 * columns + x0] * (1 - tx) + values[z0 * columns + x0 + 1] * tx;
      const b = values[(z0 + 1) * columns + x0] * (1 - tx) + values[(z0 + 1) * columns + x0 + 1] * tx;
      const height = a * (1 - tz) + b * tz;
      return height <= 1e-4 ? 0 : Math.min(maxHeight, step + Math.floor((height + 1e-6) / step) * step);
    },
  };
  const layerCount = Math.max(0, Math.floor(maxHeight / step + 1e-8) - 1);
  map.layers = Array.from({ length: layerCount }, (_, index) => {
    const threshold = (index + 1) * step;
    return { threshold, height: threshold + step, contours: extractTerrainContours(map, threshold) };
  });
  return map;
}

function angleDistance(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

export function gaussianHeightNoise(radius, angle, peaks) {
  let weighted = 0, weights = 0;
  for (const peak of peaks) {
    const da = angleDistance(angle, peak.angle) / peak.angleWidth;
    const dr = (radius - peak.radius) / peak.radiusWidth;
    const weight = Math.exp(-.5 * (da * da + dr * dr));
    weighted += peak.amplitude * weight;
    weights += weight;
  }
  return weights > 1e-8 ? weighted / weights : 0;
}

export function gaussianGrowthField(radius, angle, peaks) {
  let growth = 0;
  for (const peak of peaks) {
    const da = angleDistance(angle, peak.angle) / peak.angleWidth;
    const dr = (radius - peak.radius) / peak.radiusWidth;
    growth = Math.max(growth, Math.exp(-.5 * (da * da + dr * dr)));
  }
  return growth;
}

export function makeNoisyBoundary(points, scale, peaks, subdivisions = 5) {
  if (points.length < 3 || subdivisions < 1) throw new RangeError('Terrain boundary needs a polygon and subdivisions');
  const dense = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    for (let step = 0; step < subdivisions; step++) {
      const t = step / subdivisions;
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      const angle = Math.atan2(z / 8.2, x / 10.8);
      const radius = Math.hypot(x / 10.8, z / 8.2);
      const jitter = gaussianHeightNoise(radius, angle, peaks) * Math.max(0, scale - 1) * .05;
      const factor = scale + jitter;
      dense.push({ x: x * factor, z: z * factor });
    }
  }
  return dense;
}

export function nearestPointOnPath(x, z, points) {
  let nearest = null, nearestDistanceSq = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    const point = { x: a.x + dx * t, z: a.z + dz * t };
    const distanceSq = (x - point.x) ** 2 + (z - point.z) ** 2;
    if (distanceSq < nearestDistanceSq) { nearest = point; nearestDistanceSq = distanceSq; }
  }
  return nearest;
}

export function containingTerrainLayer(x, z, boundaries) {
  for (let layerIndex = 0; layerIndex < boundaries.length; layerIndex++) {
    const boundary = boundaries[layerIndex];
    let inside = false;
    for (let a = 0, b = boundary.length - 1; a < boundary.length; b = a++) {
      const p = boundary[a], q = boundary[b];
      if ((p.z > z) !== (q.z > z) && x < (q.x - p.x) * (z - p.z) / (q.z - p.z) + p.x) inside = !inside;
    }
    if (inside) return layerIndex;
  }
  return -1;
}

