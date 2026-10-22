import { FOG_DEFAULTS } from './fog-settings.mjs?v=6';
import { buildFogPathTopology, fogPathDistanceAt, isInsideFogLoop } from './render/location-edge-shade.mjs?v=27';

const cross2 = (ax, az, bx, bz) => ax * bz - az * bx;

export function terrainLevelCenter(points) {
  if (!Array.isArray(points) || points.length < 3) return { x: 0, z: 0 };
  let twiceArea = 0, x = 0, z = 0;
  for (let index = 0; index < points.length; index++) {
    const a = points[index], b = points[(index + 1) % points.length];
    const cross = cross2(a.x, a.z, b.x, b.z);
    twiceArea += cross; x += (a.x + b.x) * cross; z += (a.z + b.z) * cross;
  }
  if (Math.abs(twiceArea) < 1e-8) {
    return points.reduce((center, point) => ({ x: center.x + point.x / points.length,
      z: center.z + point.z / points.length }), { x: 0, z: 0 });
  }
  return { x: x / (3 * twiceArea), z: z / (3 * twiceArea) };
}

export function terrainFogCullDistance(fog = FOG_DEFAULTS) {
  const end = Number.isFinite(fog?.end) ? fog.end : FOG_DEFAULTS.end;
  // Keep the cardboard wall through the whole fog gradient. The shader reaches
  // full fog at `end`, so only geometry beyond that point can be discarded.
  return end;
}

export function shouldCullTerrainSideFace(faceCenter, faceNormal, levelCenter, fogTopology, fog = FOG_DEFAULTS) {
  if (fog.enabled === false) return false;
  if (!fogTopology?.paths?.length || isInsideFogLoop(faceCenter.x, faceCenter.z, fogTopology.clearRegions)) return false;
  if (fogPathDistanceAt(faceCenter.x, faceCenter.z, fogTopology.paths) < terrainFogCullDistance(fog)) return false;
  const towardCenterX = levelCenter.x - faceCenter.x, towardCenterZ = levelCenter.z - faceCenter.z;
  return faceNormal.x * towardCenterX + faceNormal.z * towardCenterZ < 0;
}

/** Returns one keep flag per triangle; only material-index 1 side walls are culled. */
export function terrainSideTriangleMask(positions, groups, levelCenter, fogTopology, fog = FOG_DEFAULTS) {
  const triangleCount = Math.floor(positions.length / 9), keep = new Uint8Array(triangleCount).fill(1);
  for (const group of groups ?? []) {
    if (group.materialIndex !== 1) continue;
    const first = Math.max(0, group.start), end = Math.min(positions.length / 3, first + group.count);
    for (let vertex = first; vertex + 2 < end; vertex += 3) {
      const offset = vertex * 3;
      const ax = positions[offset], ay = positions[offset + 1], az = positions[offset + 2];
      const bx = positions[offset + 3], by = positions[offset + 4], bz = positions[offset + 5];
      const cx = positions[offset + 6], cy = positions[offset + 7], cz = positions[offset + 8];
      const abx = bx - ax, aby = by - ay, abz = bz - az;
      const acx = cx - ax, acy = cy - ay, acz = cz - az;
      const normal = { x: aby * acz - abz * acy, z: abx * acy - aby * acx };
      const center = { x: (ax + bx + cx) / 3, z: (az + bz + cz) / 3 };
      if (shouldCullTerrainSideFace(center, normal, levelCenter, fogTopology, fog)) keep[vertex / 3] = 0;
    }
  }
  return keep;
}
