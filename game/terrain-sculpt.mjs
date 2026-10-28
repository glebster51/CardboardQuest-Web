import { validateVolumeStrokes, TERRAIN_MAX_STROKES, TERRAIN_MAX_POINTS, TERRAIN_MAX_STROKE_POINTS } from './terrain-volume.mjs?v=7c14a71de3a9af87';
import { validateTerrainBake } from './terrain-bake.mjs?v=7c14a71de3a9af87';
import {isHeightStroke,terrainOperations,terrainHeightAfterDab,terrainBrushSpacing} from './terrain-brush.mjs?v=7c14a71de3a9af87';
export {terrainBrushSpacing};
const MODES = new Set(['level', 'raise', 'lower']);
export const TERRAIN_SCULPT_MAX_HEIGHT = 8;

export function validateTerrainEdits(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.strokes) || value.strokes.length > TERRAIN_MAX_STROKES)
    throw new TypeError(`Terrain edits need up to ${TERRAIN_MAX_STROKES} strokes`);
  if (value.zeroLevel !== undefined && (!Number.isFinite(value.zeroLevel) || value.zeroLevel < -8 || value.zeroLevel > 8))
    throw new RangeError('Terrain zero level must be between -8 and 8');
  if(value.base!==undefined&&value.base!=='simple')throw new RangeError('Invalid terrain base');
  const operations=terrainOperations(value);
  if(operations.some(stroke=>!stroke||!['level','raise','lower','add','subtract','push','pull','fill-layer','erase-layer'].includes(stroke.mode)))throw new RangeError('Invalid terrain sculpt stroke');
  if(operations.length>TERRAIN_MAX_STROKES)throw new TypeError(`Terrain edits need up to ${TERRAIN_MAX_STROKES} strokes`);
  validateVolumeStrokes(operations.filter(stroke=>!isHeightStroke(stroke)));
  validateTerrainBake(value.baked);
  let totalPoints = 0;
  for (const stroke of operations) {
    if(!isHeightStroke(stroke))continue;
    if (!stroke || !MODES.has(stroke.mode) || !Number.isFinite(stroke.radius) || stroke.radius < .5 || stroke.radius > 24
      || !Number.isFinite(stroke.strength) || stroke.strength < .01 || stroke.strength > 2
      || !Number.isFinite(stroke.targetHeight) || stroke.targetHeight < -8 || stroke.targetHeight > 8
      || !Array.isArray(stroke.points) || !stroke.points.length || stroke.points.length > TERRAIN_MAX_STROKE_POINTS)
      throw new RangeError('Invalid terrain sculpt stroke');
    totalPoints += stroke.points.length;
    if (totalPoints > TERRAIN_MAX_POINTS || stroke.points.some(point => !Array.isArray(point) || point.length !== 2
      || !point.every(Number.isFinite) || point.some(number => Math.abs(number) > 300)))
      throw new RangeError('Terrain sculpt strokes exceed the supported bounds');
    if(stroke.surfaceHeight!==undefined&&(!Number.isFinite(stroke.surfaceHeight)||Math.abs(stroke.surfaceHeight)>8))throw new RangeError('Invalid terrain surface height');
  }
  if(operations.reduce((sum,stroke)=>sum+stroke.points.length,0)>TERRAIN_MAX_POINTS)throw new RangeError('Terrain sculpt strokes exceed the supported bounds');
  return value;
}

/** Sample the actual editable height field, including beneath the original play area. */
export function terrainTargetHeightAt(map, x, z) { return map.sample(x, z); }

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
    const distanceSq = (worldX - x) ** 2 + (worldZ - z) ** 2;
    if (distanceSq >= radiusSq) continue;
    const index = row * columns + column, before = values[index];
    const after=terrainHeightAfterDab(before,{...stroke,targetHeight:target},Math.sqrt(distanceSq),Math.max(cellX,cellZ));
    values[index] = Math.max(minHeight, Math.min(maxHeight, after));
    changed ||= Math.abs(values[index] - before) > 1e-6;
  }
  return changed;
}

export function applyTerrainSculptStrokes(map, edits = { strokes: [] }, walkablePoints = []) {
  validateTerrainEdits(edits);
  for (const stroke of edits.strokes) {
    if(!isHeightStroke(stroke))break;
    for (const [x, z] of stroke.points)applyTerrainSculptDab(map, stroke, x, z, walkablePoints);
  }
  return map;
}
