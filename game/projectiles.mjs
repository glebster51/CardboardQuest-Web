function segmentHit(ax, az, bx, bz, target, radius) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((target.x - ax) * dx + (target.z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(ax + dx * t - target.x, az + dz * t - target.z) <= radius ? t : null;
}

export function projectileStatusEffect(shot, target) {
  if (shot.sourceArchetype === 'slinger') return 'poison';
  if (shot.sourceArchetype === 'acid-spitter' && target?.team === 'player') return 'poison';
  return null;
}

export function advanceStoneProjectile(shot, dt, player, obstacles = [], enemies = []) {
  const x = shot.x, z = shot.z;
  shot.x += shot.vx * dt; shot.z += shot.vz * dt; shot.age += Math.max(0, dt);
  let hit = null;
  if (player.health > 0) {
    const t = segmentHit(x, z, shot.x, shot.z, player, .98);
    if (t !== null) hit = { t, player: true };
  }
  for (const enemy of enemies) {
    if (enemy.id === shot.sourceId || enemy.health <= 0 || enemy.active === false
        || enemy.spawnReady === false || enemy.burrowed || enemy.fell) continue;
    const t = segmentHit(x, z, shot.x, shot.z, enemy, (enemy.radius ?? .62) + .16);
    if (t !== null && (!hit || t < hit.t)) hit = { t, enemy };
  }
  for (const obstacle of obstacles) {
    const t = segmentHit(x, z, shot.x, shot.z, obstacle, (obstacle.radius ?? .5) + .16);
    if (t !== null && (!hit || t < hit.t)) hit = { t, obstacle };
  }
  const result = { hitPlayer: Boolean(hit?.player), expired: Boolean(hit) || shot.age >= shot.lifetime };
  if (hit?.enemy) result.hitEnemy = hit.enemy;
  if (hit?.obstacle?.kind === 'cardboard-prop') result.hitObstacle = hit.obstacle;
  return result;
}
