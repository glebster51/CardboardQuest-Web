const MODES = new Set(['level', 'raise', 'lower']);
export const TERRAIN_SCULPT_MAX_HEIGHT = 8;
const smoothStep = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

function insidePolygon(x, z, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export function validateTerrainEdits(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.strokes) || value.strokes.length > 80)
    throw new TypeError('Terrain edits need up to 80 strokes');
  let totalPoints = 0;
  for (const stroke of value.strokes) {
    if (!stroke || !MODES.has(stroke.mode) || !Number.isFinite(stroke.radius) || stroke.radius < .5 || stroke.radius > 24
      || !Number.isFinite(stroke.strength) || stroke.strength < .01 || stroke.strength > 2
      || !Number.isFinite(stroke.targetHeight) || stroke.targetHeight < -8 || stroke.targetHeight > 8
      || !Array.isArray(stroke.points) || !stroke.points.length || stroke.points.length > 5000)
      throw new RangeError('Invalid terrain sculpt stroke');
    totalPoints += stroke.points.length;
    if (totalPoints > 20000 || stroke.points.some(point => !Array.isArray(point) || point.length !== 2
      || !point.every(Number.isFinite) || point.some(number => Math.abs(number) > 300)))
      throw new RangeError('Terrain sculpt strokes exceed the supported bounds');
  }
  return value;
}

/** The walkable tabletop is an explicit zero-height reference for level strokes. */
export function terrainTargetHeightAt(map, x, z, walkablePoints = []) {
  return walkablePoints.length >= 3 && insidePolygon(x, z, walkablePoints) ? 0 : map.sample(x, z);
}

/** Apply one smooth, world-space brush stamp to a sampled height field. */
export function applyTerrainSculptDab(map, stroke, x, z, walkablePoints = []) {
  const { columns, rows, values, minX, minZ } = map;
  const maxHeight = map.sculptMaxHeight ?? map.maxHeight;
  const minHeight = map.sculptMinHeight ?? 0;
  const cellX = map.cellSizeX ?? map.cellSize, cellZ = map.cellSizeZ ?? map.cellSize;
  const radius = stroke.radius, radiusSq = radius * radius;
  const minColumn = Math.max(0, Math.floor((x - radius - minX) / cellX));
  const maxColumn = Math.min(columns - 1, Math.ceil((x + radius - minX) / cellX));
  const minRow = Math.max(0, Math.floor((z - radius - minZ) / cellZ));
  const maxRow = Math.min(rows - 1, Math.ceil((z + radius - minZ) / cellZ));
  const target = Math.max(minHeight, Math.min(maxHeight, stroke.targetHeight));
  let changed = false;
  for (let row = minRow; row <= maxRow; row++) for (let column = minColumn; column <= maxColumn; column++) {
    const worldX = minX + column * cellX, worldZ = minZ + row * cellZ;
    if (walkablePoints.length >= 3 && insidePolygon(worldX, worldZ, walkablePoints)) continue;
    const distanceSq = (worldX - x) ** 2 + (worldZ - z) ** 2;
    if (distanceSq >= radiusSq) continue;
    const weight = (1 - smoothStep(Math.sqrt(distanceSq) / radius)) ** 2;
    const index = row * columns + column, before = values[index];
    let after = before;
    if (stroke.mode === 'level') after += (target - before) * Math.min(.95, stroke.strength * weight);
    else {
      // Treat raise/lower as a continuous brush rate: overlapping stamps must
      // not turn into a tall spike when the pointer moves slowly.
      const spacing = terrainBrushSpacing(radius, Math.max(cellX, cellZ));
      const delta = stroke.strength * spacing / radius;
      after += (stroke.mode === 'raise' ? 1 : -1) * delta * weight;
    }
    values[index] = Math.max(minHeight, Math.min(maxHeight, after));
    changed ||= Math.abs(values[index] - before) > 1e-6;
  }
  return changed;
}

export function applyTerrainSculptStrokes(map, edits = { strokes: [] }, walkablePoints = []) {
  validateTerrainEdits(edits);
  for (const stroke of edits.strokes) for (const [x, z] of stroke.points)
    applyTerrainSculptDab(map, stroke, x, z, walkablePoints);
  return map;
}

export function terrainBrushSpacing(radius, cellSize) {
  return Math.max(cellSize * .65, radius * .16);
}
