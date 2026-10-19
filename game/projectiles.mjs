function segmentHit(ax, az, bx, bz, target, radius) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((target.x - ax) * dx + (target.z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(ax + dx * t - target.x, az + dz * t - target.z) <= radius ? t : null;
}

export function advanceStoneProjectile(shot, dt, player, obstacles = []) {
  const x = shot.x, z = shot.z;
  shot.x += shot.vx * dt; shot.z += shot.vz * dt; shot.age += Math.max(0, dt);
  let hit = null;
  if (player.health > 0) {
    const t = segmentHit(x, z, shot.x, shot.z, player, .98);
    if (t !== null) hit = { t, player: true };
  }
  for (const obstacle of obstacles) {
    const t = segmentHit(x, z, shot.x, shot.z, obstacle, (obstacle.radius ?? .5) + .16);
    if (t !== null && (!hit || t < hit.t)) hit = { t, player: false };
  }
  return { hitPlayer: Boolean(hit?.player), expired: Boolean(hit) || shot.age >= shot.lifetime };
}
