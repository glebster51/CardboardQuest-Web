export function pointInPolygon(x, z, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export function distanceToPolygon(x, z, points) {
  let nearest = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    nearest = Math.min(nearest, Math.hypot(x - a.x - t * dx, z - a.z - t * dz));
  }
  return nearest;
}

export function hazardAtPoint(x, z, hazards = [], margin = 0) {
  return hazards.find(hazard => pointInPolygon(x, z, hazard.points)
    || margin > 0 && distanceToPolygon(x, z, hazard.points) < margin) ?? null;
}

export function isPlayableFloor(location, x, z, margin = 0) {
  return pointInPolygon(x, z, location.walkablePoints)
    && !hazardAtPoint(x, z, location.hazards, margin);
}
