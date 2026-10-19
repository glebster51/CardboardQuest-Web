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

