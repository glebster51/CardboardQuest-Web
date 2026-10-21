/** Pick the closest living enemy whose encounter has been triggered. */
export function nearestAwakeThreat(player, enemies) {
  let nearest = null, nearestDistance = Infinity;
  for (const enemy of enemies) {
    if (enemy.health <= 0 || !enemy.combatAwake || enemy.fell || enemy.poolDormant || enemy.spawnReady === false) continue;
    const dx = enemy.x - player.x, dz = enemy.z - player.z;
    const distance = dx * dx + dz * dz;
    if (distance < nearestDistance) { nearest = enemy; nearestDistance = distance; }
  }
  return nearest;
}

/** Smoothly yaw the camera toward a horizontal direction, looking from behind it. */
export function followDirection(theta, dx, dz, dt, response = 2.4) {
  if (dt <= 0 || Math.hypot(dx, dz) < .001) return theta;
  const target = Math.atan2(dx, dz) + Math.PI;
  const delta = Math.atan2(Math.sin(target - theta), Math.cos(target - theta));
  return theta + delta * (1 - Math.exp(-response * dt));
}

/** Smoothly rotate the camera to trail the current XZ motion direction. */
export function followMotion(theta, vx, vz, dt, response = 2.4, minSpeed = .25) {
  return Math.hypot(vx, vz) < minSpeed ? theta : followDirection(theta, vx, vz, dt, response);
}
