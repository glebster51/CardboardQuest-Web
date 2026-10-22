const NORMAL_EPSILON = 1e-12;

function pointKey(x, y, epsilon) {
  return `${Math.round(x / epsilon)},${Math.round(y / epsilon)}`;
}

/**
 * Smooths the lighting normals of a non-indexed cardboard side wall at shared
 * outline vertices while preserving an explicit hard split at concave anchors.
 * The position/UV buffers are never changed, so the silhouette stays exact.
 */
export function smoothExtrusionSideNormals(positions, creaseAnchors = [], epsilon = 1e-6) {
  if (positions.length % 9 !== 0) throw new RangeError('Side-wall positions must contain complete triangles');
  if (!(epsilon > 0)) throw new RangeError('Smoothing epsilon must be positive');

  const normals = new Float32Array(positions.length);
  const sums = new Map();
  const creaseKeys = new Set(creaseAnchors.map(point => pointKey(point.x, point.y, epsilon)));

  for (let offset = 0; offset < positions.length; offset += 9) {
    const ax = positions[offset], ay = positions[offset + 1], az = positions[offset + 2];
    const abx = positions[offset + 3] - ax, aby = positions[offset + 4] - ay, abz = positions[offset + 5] - az;
    const acx = positions[offset + 6] - ax, acy = positions[offset + 7] - ay, acz = positions[offset + 8] - az;
    const nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
    const area = Math.hypot(nx, ny, nz);
    if (area <= NORMAL_EPSILON) continue;
    const normal = [nx / area, ny / area, nz / area];

    for (let vertex = 0; vertex < 3; vertex++) {
      const index = offset + vertex * 3;
      normals[index] = normal[0]; normals[index + 1] = normal[1]; normals[index + 2] = normal[2];
      const key = pointKey(positions[index], positions[index + 1], epsilon);
      if (creaseKeys.has(key)) continue;
      let sum = sums.get(key);
      if (!sum) sums.set(key, sum = [0, 0, 0]);
      sum[0] += nx; sum[1] += ny; sum[2] += nz;
    }
  }

  for (let offset = 0; offset < positions.length; offset += 3) {
    const key = pointKey(positions[offset], positions[offset + 1], epsilon);
    if (creaseKeys.has(key)) continue;
    const sum = sums.get(key);
    if (!sum) continue;
    const length = Math.hypot(sum[0], sum[1], sum[2]);
    if (length <= NORMAL_EPSILON) continue;
    normals[offset] = sum[0] / length;
    normals[offset + 1] = sum[1] / length;
    normals[offset + 2] = sum[2] / length;
  }
  return normals;
}
