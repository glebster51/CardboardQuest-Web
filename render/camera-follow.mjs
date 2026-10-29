/** Find the equally weighted center of the player and active, living enemies. */
export function combatCenterOfMass(player, enemies) {
  let x = player.x, z = player.z, count = 1;
  for (const enemy of enemies) {
    if (enemy.health <= 0 || !enemy.combatAwake || enemy.fell || enemy.poolDormant || enemy.spawnReady === false) continue;
    x += enemy.x; z += enemy.z; count++;
  }
  return { x: x / count, z: z / count, count };
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
