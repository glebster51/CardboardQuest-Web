import { pointInPolygon } from '../game/world-hazards.mjs';

/** Restore the worker's sampling function without regenerating its height grid. */
export function restoreTerrainSampler(map, { rounded = true, walkablePoints = [], depthMap = false } = {}) {
  const { columns, rows, values, minX, minZ, step, maxHeight } = map;
  const sculptMaxHeight = map.sculptMaxHeight ?? maxHeight;
  const cellX = map.cellSizeX ?? map.cellSize, cellZ = map.cellSizeZ ?? map.cellSize;
  map.sample = (x, z) => {
    if (depthMap && pointInPolygon(x, z, walkablePoints)) return 0;
    const gx = Math.max(0, Math.min(columns - 1.001, (x - minX) / cellX));
    const gz = Math.max(0, Math.min(rows - 1.001, (z - minZ) / cellZ));
    const x0 = Math.floor(gx), z0 = Math.floor(gz), tx = gx - x0, tz = gz - z0;
    const a = values[z0 * columns + x0] * (1 - tx) + values[z0 * columns + x0 + 1] * tx;
    const b = values[(z0 + 1) * columns + x0] * (1 - tx) + values[(z0 + 1) * columns + x0 + 1] * tx;
    const height = a * (1 - tz) + b * tz;
    return rounded ? Math.min(sculptMaxHeight, Math.round(height / step) * step)
      : height <= 1e-4 ? 0 : Math.min(sculptMaxHeight, step + Math.floor((height + 1e-6) / step) * step);
  };
  return map;
}
