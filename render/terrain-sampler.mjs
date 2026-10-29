import { pointInPolygon } from '../game/world-hazards.mjs?v=ab782efa5048549c';
import { terrainVolumeFloor } from '../game/terrain-volume.mjs?v=ab782efa5048549c';
import {terrainSafetyFloorAt} from './terrain-safety-floor.mjs?v=ab782efa5048549c';

/** Restore the worker's sampling function without regenerating its height grid. */
export function restoreTerrainSampler(map, { rounded = true, walkablePoints = [], depthMap = false, sculpted = false } = {}) {
  sculpted ||= Boolean(map.bakedHeightValues);
  const { columns, rows, values, minX, minZ, step, maxHeight } = map;
  const sculptMaxHeight = map.sculptMaxHeight ?? maxHeight;
  const sculptMinHeight = map.sculptMinHeight ?? 0;
  const cellX = map.cellSizeX ?? map.cellSize, cellZ = map.cellSizeZ ?? map.cellSize;
  map.baseValues ??= values.slice();
  const sampler = (grid, edited) => (x, z) => {
    if (depthMap && !edited && pointInPolygon(x, z, walkablePoints)) return 0;
    const gx = Math.max(0, Math.min(columns - 1.001, (x - minX) / cellX));
    const gz = Math.max(0, Math.min(rows - 1.001, (z - minZ) / cellZ));
    const x0 = Math.floor(gx), z0 = Math.floor(gz), tx = gx - x0, tz = gz - z0;
    const a = grid[z0 * columns + x0] * (1 - tx) + grid[z0 * columns + x0 + 1] * tx;
    const b = grid[(z0 + 1) * columns + x0] * (1 - tx) + grid[(z0 + 1) * columns + x0 + 1] * tx;
    const height = a * (1 - tz) + b * tz;
    if (height < -1e-4) return Math.max(sculptMinHeight, Math.round(height / step) * step);
    return rounded ? Math.min(edited ? map.renderMaxHeight??sculptMaxHeight : maxHeight, Math.round(height / step) * step)
      : height <= 1e-4 ? 0 : Math.min(sculptMaxHeight, step + Math.floor((height + 1e-6) / step) * step);
  };
  const sampleHeight=sampler(values,sculpted);
  map.sample = map.volume?.renderUnified||map.volume?.edited ? (x,z)=>{
    const floor=terrainVolumeFloor(map.volume,x,z,sampleHeight(x,z)),guard=terrainSafetyFloorAt(map.safetyFloor,x,z);
    return guard===null?floor??sampleHeight(x,z):Math.max(floor??-Infinity,guard);
  } : sampleHeight;
  map.sampleBase = sampler(map.baseValues,false);
  return map;
}
