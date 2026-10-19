import { facingAngle, launch } from '../physics.mjs';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Advance one enemy's decision state. Visual effects stay with the renderer. */
export function advanceEnemyAI(enemy, player, figure, dt, randomBetween = (min, max) => min + Math.random() * (max - min)) {
  if (enemy.team !== 'enemy' || enemy.health <= 0 || enemy.victorySequenceActive) return { launched: false };

  const dx = player.x - enemy.x, dz = player.z - enemy.z;
  const distanceToPlayer = Math.hypot(dx, dz);
  const speed = Math.hypot(enemy.vx, enemy.vz);

  if (!enemy.combatAwake) {
    if (figure && speed < .05) figure.facing = facingAngle(dx, dz, figure.facing);
    return { launched: false };
  }
  if (enemy.aiStunRemaining > 0) {
    enemy.aiStunRemaining = Math.max(0, enemy.aiStunRemaining - dt);
    return { launched: false };
  }

  if (enemy.aiPhase !== 'dash') enemy.aiTimer -= dt;
  if (player.health > 0 && distanceToPlayer > .001 && speed < .05 && figure) {
    figure.facing = facingAngle(dx, dz, figure.facing);
  }

  if (enemy.aiPhase === 'dash' && speed < .2) {
    enemy.aiPhase = 'pause';
    enemy.aiTimer = randomBetween(1, 4);
    return { launched: false };
  }

  if (enemy.aiPhase === 'pause' && enemy.aiTimer <= 0) {
    enemy.aiPhase = 'aim';
    enemy.aiTargetX = player.x;
    enemy.aiTargetZ = player.z;
    enemy.aiAimAngle = facingAngle(enemy.aiTargetX - enemy.x, enemy.aiTargetZ - enemy.z, figure?.facing ?? 0);
    enemy.aiAimDuration = randomBetween(1.7, 2.7);
    enemy.aiTimer = enemy.aiAimDuration;
    if (figure) figure.facing = enemy.aiAimAngle;
    return { launched: false, beganAiming: true };
  }

  if (enemy.aiPhase !== 'aim' || enemy.aiTimer > 0 || enemy.charges <= 0
      || player.health <= 0 || enemy.health <= 0) return { launched: false };

  const aimX = enemy.aiTargetX - enemy.x, aimZ = enemy.aiTargetZ - enemy.z;
  const aimDistance = Math.hypot(aimX, aimZ);
  const power = clamp(aimDistance * .12, .55, .95);
  enemy.charges--;
  enemy.aiPhase = 'dash';
  enemy.attackRicochets = 0;
  launch(enemy, { x: -aimX / Math.max(.001, aimDistance) * power,
    z: -aimZ / Math.max(.001, aimDistance) * power });
  return { launched: true };
}
