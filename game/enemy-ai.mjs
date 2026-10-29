import { OGRE_SETTINGS as bossSettings } from '../bosses/ogre/settings.mjs?v=ab782efa5048549c';
import { facingAngle, launch, GOBLIN_DASH_MAX_POWER } from '../physics.mjs?v=ab782efa5048549c';
import { earthShatterPositions } from './earth-shatter.mjs?v=ab782efa5048549c';
import { groundSlamPositions } from '../bosses/ogre/ground-slam.mjs?v=ab782efa5048549c';
import { takeBossSeriesAttack, bossDashAngle, createBossWaveLeap, bossWaveLeapPose } from '../bosses/ogre/attacks.mjs?v=ab782efa5048549c';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function beginAim(enemy, player, figure, duration) {
  enemy.aiPhase = 'aim';
  enemy.aiTargetX = player.x;
  enemy.aiTargetZ = player.z;
  enemy.aiAimAngle = facingAngle(player.x - enemy.x, player.z - enemy.z, figure?.facing ?? 0);
  enemy.aiAimDuration = duration;
  enemy.aiTimer = duration;
  if (figure) figure.facing = enemy.aiAimAngle;
  return { launched: false, beganAiming: true };
}

function launchAtTarget(enemy, player, power) {
  const dx = enemy.aiTargetX - enemy.x, dz = enemy.aiTargetZ - enemy.z;
  const length = Math.hypot(dx, dz);
  const directionX = length > 0 ? dx / length : Math.sin(enemy.aiAimAngle ?? 0);
  const directionZ = length > 0 ? dz / length : Math.cos(enemy.aiAimAngle ?? 0);
  enemy.charges--;
  enemy.aiPhase = 'dash';
  enemy.attackRicochets = 0;
  launch(enemy, { x: -directionX * power, z: -directionZ * power });
  if (enemy.archetype === 'ember-moth') enemy.comboRemaining = Math.max(0, (enemy.comboRemaining ?? 3) - 1);
  return { launched: true };
}

/** Advance an enemy's authored behavior. Rendering and status application remain in app.js. */
export function advanceEnemyAI(enemy, player, figure, dt, randomBetween = (min, max) => min + Math.random() * (max - min)) {
  if (enemy.team !== 'enemy' || enemy.health <= 0 || enemy.victorySequenceActive || enemy.active === false) return { launched: false };

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
  if (!['aim', 'guard', 'burrow', 'surface', 'zone', 'earth-windup', 'earth-slam-windup', 'earth-recover', 'earth-retreat'].includes(enemy.aiPhase)
      && player.health > 0 && distanceToPlayer > .001 && speed < .05 && figure) {
    figure.facing = facingAngle(dx, dz, figure.facing);
  }

  if (enemy.boss) {
    enemy.bossGroundCooldown = Math.max(0, (enemy.bossGroundCooldown ?? 0) - dt);
    if (enemy.aiPhase === 'earth-retreat') {
      if (speed < .2) {
        enemy.aiPhase = 'earth-recover'; enemy.aiTimer = bossSettings.recoveryDuration; enemy.nonDamagingDash = false;
      }
      return { launched: false };
    }
    if (enemy.aiPhase === 'earth-slam-windup') {
      const zone = enemy.pendingGroundSlam;
      if (!zone) { enemy.aiPhase = 'pause'; enemy.aiTimer = bossSettings.recoveryDuration; return { launched: false }; }
      zone.x = enemy.x; zone.z = enemy.z;
      enemy.vx = enemy.vz = 0;
      if (enemy.aiTimer > 1e-8) return { launched: false };
      enemy.aiPhase = 'earth-retreat'; enemy.aiTimer = bossSettings.recoveryDuration;
      enemy.bossGroundCooldown = bossSettings.recoveryDuration + randomBetween(bossSettings.skillPauseMin, bossSettings.skillPauseMax);
      enemy.pendingGroundSlam = null;
      const awayAngle = facingAngle(dx, dz, figure?.facing ?? 0);
      launch(enemy, { x: Math.sin(awayAngle) * bossSettings.retreatPower, z: Math.cos(awayAngle) * bossSettings.retreatPower });
      enemy.nonDamagingDash = true;
      return { launched: false, retreated: true, earthShatterSlam: groundSlamPositions(zone), groundSlamImpact: zone };
    }
    if (enemy.aiPhase === 'pause' && enemy.aiTimer <= 0 && player.health > 0 && distanceToPlayer < bossSettings.closeDistance) {
      enemy.vx = enemy.vz = 0;
      enemy.bossSeriesAttack = null; enemy.bossSeriesRemaining = 0;
      enemy.pendingEarthShatterPositions = null; enemy.bossWaveLeap = null; enemy.bossLeapHeight = 0; enemy.bossLeapAttack = null;
      if (enemy.bossGroundCooldown > 1e-8) {
        enemy.aiPhase = 'pause'; enemy.aiTimer = enemy.bossGroundCooldown;
        return { launched: false, earthShatterCancelled: true };
      }
      enemy.pendingGroundSlam = { x: enemy.x, z: enemy.z, radius: bossSettings.circleRadius };
      enemy.aiPhase = 'earth-slam-windup'; enemy.aiTimer = bossSettings.circleDuration;
      return { launched: false, groundSlamWarning: enemy.pendingGroundSlam, duration: bossSettings.circleDuration };
    }
    if (enemy.aiPhase === 'earth-windup' && enemy.bossWaveLeap) {
      const pose = bossWaveLeapPose(enemy.bossWaveLeap, enemy.aiTimer);
      enemy.x = pose.x; enemy.z = pose.z; enemy.bossLeapHeight = pose.height;
      enemy.vx = enemy.vz = 0;
    }
    if (enemy.aiPhase === 'earth-windup' && enemy.aiTimer <= 0) {
      enemy.aiPhase = 'earth-recover'; enemy.aiTimer = bossSettings.recoveryDuration;
      const zone = enemy.bossLeapAttack === 'leap-slam'
        ? { x: enemy.x, z: enemy.z, radius: bossSettings.circleRadius } : null;
      const positions = zone ? groundSlamPositions(zone) : earthShatterPositions(enemy.x, enemy.z, enemy.aiAimAngle);
      enemy.pendingEarthShatterPositions = null; enemy.bossWaveLeap = null; enemy.bossLeapHeight = 0;
      enemy.bossLeapAttack = null;
      return { launched: false, earthShatterSlam: positions, ...(zone ? { groundSlamImpact: zone } : {}) };
    }
    if (enemy.aiPhase === 'earth-windup') return { launched: false };
    if (enemy.aiPhase === 'earth-recover') {
      if (enemy.aiTimer <= 0) { enemy.aiPhase = 'pause'; enemy.aiTimer = randomBetween(bossSettings.skillPauseMin, bossSettings.skillPauseMax); }
      return { launched: false };
    }
    if (enemy.aiPhase === 'pause' && enemy.aiTimer <= 0 && player.health > 0) {
      const angle = facingAngle(dx, dz, figure?.facing ?? 0);
      const attack = takeBossSeriesAttack(enemy, randomBetween);
      if (attack === 'dash') {
        const decision = beginAim(enemy, player, figure, randomBetween(bossSettings.dashAimMin, bossSettings.dashAimMax));
        enemy.aiAimAngle = bossDashAngle(angle, randomBetween);
        enemy.aiTargetX = enemy.x + Math.sin(enemy.aiAimAngle) * distanceToPlayer;
        enemy.aiTargetZ = enemy.z + Math.cos(enemy.aiAimAngle) * distanceToPlayer;
        if (figure) figure.facing = enemy.aiAimAngle;
        return decision;
      }
      enemy.aiAimAngle = angle;
      const duration = attack === 'leap-slam' ? bossSettings.leapSlamDuration : bossSettings.waveDuration;
      enemy.aiAimDuration = duration;
      if (figure) figure.facing = angle;
      enemy.bossLeapAttack = attack;
      enemy.bossWaveLeap = createBossWaveLeap(enemy.x, enemy.z, angle, attack);
      enemy.pendingEarthShatterPositions = attack === 'leap-slam' ? []
        : earthShatterPositions(enemy.bossWaveLeap.endX, enemy.bossWaveLeap.endZ, angle);
      enemy.vx = enemy.vz = 0; enemy.bossLeapHeight = 0;
      enemy.aiPhase = 'earth-windup'; enemy.aiTimer = duration;
      return { launched: false, earthShatterWarning: enemy.pendingEarthShatterPositions,
        duration };
    }
  }

  if (enemy.aiPhase === 'dash' && speed < .2) {
    enemy.nonDamagingDash = false;
    enemy.aiPhase = 'pause';
    enemy.aiTimer = enemy.boss ? randomBetween(bossSettings.dashPauseMin, bossSettings.dashPauseMax) : enemy.archetype === 'boar' ? randomBetween(.9, 1.8)
      : enemy.archetype === 'ember-moth' && enemy.comboRemaining > 0 && enemy.charges > 0 ? .18
        : enemy.archetype === 'ember-moth' ? randomBetween(2.4, 3.2) : randomBetween(1, 3.2);
    return { launched: false };
  }

  if (enemy.aiPhase === 'burrow' && enemy.aiTimer <= 0) {
    const side = (enemy.burrowSide ?? 1) * (randomBetween(3.4, 4.5));
    enemy.x = player.x + dz / Math.max(.001, distanceToPlayer) * side;
    enemy.z = player.z - dx / Math.max(.001, distanceToPlayer) * side;
    enemy.vx = enemy.vz = 0;
    enemy.aiPhase = 'surface';
    enemy.aiTimer = .52;
    enemy.burrowed = false;
    return { launched: false, surfaced: true, x: enemy.x, z: enemy.z };
  }
  if (enemy.aiPhase === 'surface' && enemy.aiTimer <= 0) return beginAim(enemy, player, figure, .62);
  if (enemy.aiPhase === 'guard' && enemy.aiTimer <= 0) return beginAim(enemy, player, figure, .72);
  if (enemy.aiPhase === 'zone' && enemy.aiTimer <= 0) {
    const zone = enemy.pendingZone;
    enemy.pendingZone = null;
    enemy.aiPhase = 'pause'; enemy.aiTimer = randomBetween(2, 2.8);
    return zone ? { launched: false, zoneDetonated: zone } : { launched: false };
  }

  if (enemy.aiPhase === 'pause' && enemy.aiTimer <= 0) {
    if (enemy.archetype === 'acid-spitter' && enemy.charges > 0 && player.health > 0) {
      if (distanceToPlayer < 5.2 || distanceToPlayer > 10.5) {
        const sign = distanceToPlayer < 5.2 ? 1 : -1;
        enemy.charges--; enemy.aiPhase = 'dash'; enemy.attackRicochets = 0;
        launch(enemy, { x: dx / Math.max(.001, distanceToPlayer) * .48 * sign,
          z: dz / Math.max(.001, distanceToPlayer) * .48 * sign });
        enemy.nonDamagingDash = true;
        return { launched: true, repositioned: true };
      }
    }
    if (enemy.archetype === 'shellguard' && distanceToPlayer < 5.4) {
      enemy.aiPhase = 'guard'; enemy.aiTimer = randomBetween(.8, 1.2);
      enemy.aiAimAngle = facingAngle(dx, dz, figure?.facing ?? 0);
      if (figure) figure.facing = enemy.aiAimAngle;
      return { launched: false, guarding: true };
    }
    if (enemy.archetype === 'burrower' && distanceToPlayer > 1.8 && player.health > 0) {
      enemy.aiPhase = 'burrow'; enemy.aiTimer = randomBetween(.72, .96);
      enemy.burrowSide = randomBetween(0, 1) > .5 ? 1 : -1;
      enemy.burrowed = true;
      return { launched: false, burrowed: true };
    }
    if (enemy.archetype === 'flanker' && !enemy.flankPending && distanceToPlayer < 7 && distanceToPlayer > 2 && player.health > 0) {
      const sign = enemy.flankSign = -(enemy.flankSign ?? 1);
      const length = Math.max(.001, distanceToPlayer);
      enemy.charges = Math.max(1, enemy.charges);
      enemy.flankPending = true;
      enemy.aiPhase = 'dash'; enemy.attackRicochets = 0; enemy.nonDamagingDash = true;
      launch(enemy, { x: dz / length * .48 * sign, z: -dx / length * .48 * sign });
      return { launched: true, repositioned: true, flanking: true };
    }
    if (enemy.archetype === 'flanker' && enemy.flankPending) enemy.flankPending = false;
    if (enemy.archetype === 'hexer' && player.health > 0) {
      const zone = { x: player.x + (player.vx ?? 0) * .35, z: player.z + (player.vz ?? 0) * .35,
        radius: 1.75, damageQuarters: 2, effect: 'poison' };
      enemy.pendingZone = zone; enemy.aiPhase = 'zone'; enemy.aiTimer = 1.05;
      return { launched: false, zoneTelegraph: zone, duration: 1.05 };
    }
    if (enemy.archetype === 'ember-moth' && (enemy.comboRemaining ?? 0) <= 0) enemy.comboRemaining = 3;
    const aimDuration = enemy.archetype === 'boar' ? randomBetween(1.05, 1.45)
      : enemy.archetype === 'slinger' ? randomBetween(2, 2.8)
        : enemy.archetype === 'ember-moth' ? randomBetween(.38, .52)
          : enemy.archetype === 'shellguard' ? randomBetween(.65, .9)
            : enemy.archetype === 'acid-spitter' ? randomBetween(1.35, 1.75)
              : enemy.archetype === 'flanker' ? randomBetween(.85, 1.15) : randomBetween(1.5, 2.3);
    return beginAim(enemy, player, figure, aimDuration);
  }

  if (enemy.aiPhase !== 'aim' || enemy.aiTimer > 0 || enemy.charges <= 0
      || player.health <= 0 || enemy.health <= 0) return { launched: false };

  const aimX = enemy.aiTargetX - enemy.x, aimZ = enemy.aiTargetZ - enemy.z;
  const aimDistance = Math.hypot(aimX, aimZ);
  if (enemy.archetype === 'slinger' || enemy.archetype === 'acid-spitter') {
    enemy.charges--; enemy.aiPhase = 'pause'; enemy.aiTimer = randomBetween(1.4, 2.2);
    return { launched: false, shot: { x: enemy.x, z: enemy.z,
      vx: aimX / Math.max(.001, aimDistance) * (enemy.archetype === 'acid-spitter' ? 7.8 : 10.5),
      vz: aimZ / Math.max(.001, aimDistance) * (enemy.archetype === 'acid-spitter' ? 7.8 : 10.5),
      damageQuarters: enemy.archetype === 'acid-spitter' ? 1 : 2, age: 0,
      lifetime: enemy.archetype === 'acid-spitter' ? 2.8 : 2.2 } };
  }
  const power = enemy.boss ? clamp(aimDistance * bossSettings.dashDistanceGain, bossSettings.dashPowerMin, bossSettings.dashPowerMax) : !enemy.archetype || enemy.archetype === 'goblin' ? GOBLIN_DASH_MAX_POWER
    : enemy.archetype === 'boar' ? clamp(aimDistance * .22, .95, 1.6)
    : enemy.archetype === 'ember-moth' ? clamp(aimDistance * .18, .85, 1.35)
      : enemy.archetype === 'shellguard' ? clamp(aimDistance * .15, .72, 1.05)
        : enemy.archetype === 'burrower' ? clamp(aimDistance * .19, .82, 1.35)
          : enemy.archetype === 'flanker' ? clamp(aimDistance * .17, .72, 1.25)
            : clamp(aimDistance * .12, .55, GOBLIN_DASH_MAX_POWER);
  return launchAtTarget(enemy, player, power);
}
