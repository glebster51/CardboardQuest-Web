import { applyCombatDamage } from '../game/combat-damage.mjs?v=f484ba7b7b13e7f6';
import { cardboardPropDamageStageForHealth, applyCardboardPropHit, updateCardboardDamageTree } from '../cardboard-damage.mjs?v=f484ba7b7b13e7f6';
import { combatBonuses, playerDamageTaken } from '../game/equipment.mjs?v=f484ba7b7b13e7f6';
import { canReachMerchant } from '../game/merchants.mjs?v=f484ba7b7b13e7f6';
import { cardboardFallGroundOffset } from '../scenery-layout.mjs?v=f484ba7b7b13e7f6';
import { ricochetDamageQuarters } from '../heart-health.mjs?v=f484ba7b7b13e7f6';
import { canEnemyDamagePlayer, markDirectPlayerHit } from '../game/attack-protection.mjs?v=f484ba7b7b13e7f6';
import { recoverAfterFall } from '../game/fall-recovery.mjs?v=f484ba7b7b13e7f6';
import { rollEnemyLoot } from '../game/world-items.mjs?v=f484ba7b7b13e7f6';
import { applyStatusEffect } from '../game/status-effects.mjs?v=f484ba7b7b13e7f6';
import { recordCampDefeat } from '../location-network.mjs?v=f484ba7b7b13e7f6';

/** Application orchestration with explicit live state and service ports.
 * The composition root owns these bindings; this subsystem owns the operations below. */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createCombatController(context) {
  function damage(target, damageQuarters, speed, statusTick = false) {
    const applied = applyCombatDamage(target, damageQuarters, { statusTick,
      mitigate: raw => playerDamageTaken(context.campaignState, raw) });
    if (!applied) return false;
    const { previousHealth } = applied;
    if (target.team === 'enemy' && target.health <= 0) {
      context.clearAbilityTelegraph(target.id);
      if (target.boss) context.clearEarthShatterForBoss(target.id);
    }
    context.audio.play(target.team === 'player' ? 'hurt' : target.health <= 0 ? 'enemyDeath' : 'hit',
      { pan: (target.x - context.heroBody.x) / 15 });
    const figure = context.figures.find(item => item.body === target);
    if (figure) {
      context.clearLostHealthRestoration(figure, previousHealth, target.health);
      context.syncFigureDamageStage(figure);
      figure.hitAge = 0;
      figure.hitStrength = clamp(speed / 22, .15, .38);
      figure.hurtAge = 0;
      figure.flashMaterial.opacity = 1;
      figure.backFlashMaterial.opacity = 1;
    }
    if (target.team === 'enemy' && target.locationId === 'camp' && !target.boss && target.health === 0 && !target.defeatRecorded) {
      target.defeatRecorded = true;
      const bossUnlocked = recordCampDefeat(context.locations.camp, context.elapsed);
      context.refreshLocationInfo();
      if (bossUnlocked) context.spawnCampBoss();
    }
    if (target.team === 'enemy' && target.health === 0 && !target.lootDropped) {
      target.lootDropped = true;
      const dropPosition = target.lootPosition ?? { x: target.x, z: target.z };
      context.spawnWorldLoot(context.locations[target.locationId], target.id, dropPosition.x, dropPosition.z, rollEnemyLoot(Math.random, target));
    }
    context.persistCampaign();
    return true;
  }

  function damageCardboardProp(target, damageQuarters, attacker) {
    if (target.kind !== 'cardboard-prop' || !target.prop || target.health <= 0 || target.hitCooldown > 0) return false;
    if (!applyCardboardPropHit(target)) return false;
    target.hitCooldown = .45;
    const stage = cardboardPropDamageStageForHealth(target.health, target.maxHealth);
    updateCardboardDamageTree(target.prop, { settings: context.cardboardDamageSettings, stage,
      texture: context.cardboardDamageTexture, noiseTexture: context.cardboardVoronoiTexture, displacementNoiseTexture: context.cardboardPerlinTexture,
      tearNoiseTexture: context.cardboardTearNoiseTexture });
    context.audio.play(target.health <= 0 ? 'impact' : 'hit', { pan: (target.x - context.heroBody.x) / 15, strength: .7 });
    if (target.health <= 0) {
      target.active = false;
      target.fell = true; target.radius = 0;
      context.activeLocation.obstacles = context.activeLocation.obstacles.filter(body => body !== target);
      const prop = target.prop, sign = Math.sign(target.z - (attacker?.z ?? target.z - 1)) || 1;
      // Freeze the face that will point upward once the cardboard lies flat.
      prop.userData.cardboardFallenFace = sign < 0 ? 'front' : 'back';
      context.cardboardFalls.push({ prop, elapsed: 0, duration: context.cardboardDamageSettings.fallDuration, from: prop.rotation.x,
        to: sign * Math.PI / 2, baseY: prop.position.y });
    }
    return true;
  }

  function updateCardboardFalls(dt) {
    for (let index = context.cardboardFalls.length - 1; index >= 0; index--) {
      const fall = context.cardboardFalls[index]; fall.elapsed += dt;
      const t = Math.min(1, fall.elapsed / fall.duration), eased = 1 - (1 - t) ** 3;
      fall.prop.rotation.x = fall.from + (fall.to - fall.from) * eased;
      fall.prop.userData.cardboardGroundLift = cardboardFallGroundOffset(eased);
      fall.prop.position.y = fall.baseY + fall.prop.userData.cardboardGroundLift;
      if (t >= 1) context.cardboardFalls.splice(index, 1);
    }
  }

  function recoverPlayerFromFall(body) {
    if (body.team === 'enemy') {
      if (body.health > 0) {
        body.lootPosition = body.lastSafePosition ?? context.activeLocation.entry;
        body.hitCooldown = 0;
        damage(body, body.health, 18);
      }
      const figure = context.figures.find(item => item.body === body);
      if (figure) { figure.fallAge = 0; context.setVisualState(figure, 'dead'); }
      context.burst(body.x, body.z, .8);
      return;
    }
    if (body !== context.heroBody) return;
    context.audio.play('fall');
    const safe = body.lastSafePosition ?? context.activeLocation.entry;
    const previousHealth = body.health;
    recoverAfterFall(body, safe);
    const figure = context.figures.find(item => item.body === body);
    if (figure) {
      context.clearLostHealthRestoration(figure, previousHealth, body.health);
      context.syncFigureDamageStage(figure);
      figure.hurtAge = 0; figure.hitAge = 0; figure.hitStrength = .2;
    }
    context.vibrate([55, 24, 55]);
    context.burst(body.x, body.z, .9);
    context.persistCampaign();
  }

  function onImpact(a, b, speed, attackingA = false, attackingB = false) {
    if (a === context.heroBody || b === context.heroBody) context.audio.play('impact', { strength: Math.min(1, speed / 10) });
    for (const body of b ? [a, b] : [a]) {
      const figure = context.figureByBody.get(body);
      if (figure) {
        figure.hitAge = 0;
        figure.hitStrength = clamp(speed / 28, .08, .3);
      }
    }
    if (b) {
      const rockBody = a.kind === 'earth-shatter-rock' ? a : b.kind === 'earth-shatter-rock' ? b : null;
      if (rockBody) {
        const rock = context.earthShatterRocks.find(item => item.body === rockBody);
        const actor = rockBody === a ? b : a;
        if (context.breakEarthShatterRockOnActor(rock, actor)) {
          context.rebuildBodies();
        }
        return;
      }
      // Evaluate rebound protection before either direction of this collision can mutate it.
      const directHitProtectionA = a.directHitProtection ?? false;
      const directHitProtectionB = b.directHitProtection ?? false;
      let playerDealtDamage = false, playerTookDamage = false;
      const attackHit = (attacker, target, directHitProtection) => {
        if (attacker.fixed) return;
        if (target.kind === 'cache-chest' || target.kind === 'editor-chest') {
          if (attacker.team === 'player' && attacker.health > 0) context.openCache(target);
          return;
        }
        if (target.kind === 'merchant') {
          if (attacker === context.heroBody && attacker.team === 'player' && attacker.health > 0
            && !context.dialogue.isOpen() && !context.shop.isOpen()) {
            const actor = context.merchantActors.find(candidate => candidate.body === target && candidate.locationId === context.activeLocation.id);
            if (actor && canReachMerchant(context.campaignState, context.merchantContext(actor))) context.shop.open(actor);
          }
          return;
        }
        if (target.kind === 'cardboard-prop') {
          if (attacker.health > 0 && !attacker.nonDamagingDash)
            damageCardboardProp(target, (attacker.damageQuarters ?? ricochetDamageQuarters(attacker.attackRicochets || 0))
              + (attacker.team === 'player' ? combatBonuses(context.campaignState).damage : 0), attacker);
          return;
        }
        if (target.fixed) return;
        if (!canEnemyDamagePlayer(attacker, target, directHitProtection)) return;
        if (attacker.health <= 0 || (attacker.team === target.team && attacker.team !== 'enemy') || (attacker.attackRicochets || 0) >= 3) return;
        const bonus = attacker.team === 'player' ? combatBonuses(context.campaignState).damage : 0;
        if (attacker.nonDamagingDash) return;
        let hitDamage = attacker.archetype === 'boar'
          ? Math.max(1, Math.floor((attacker.damageQuarters ?? 6) / 2 ** (attacker.attackRicochets || 0)))
          : ['acid-spitter', 'shellguard', 'burrower', 'flanker', 'ember-moth', 'hexer'].includes(attacker.archetype)
            ? Math.max(1, Math.floor((attacker.damageQuarters ?? 4) / 2 ** (attacker.attackRicochets || 0)))
            : ricochetDamageQuarters(attacker.attackRicochets || 0);
        if (target.team === 'enemy' && target.archetype === 'shellguard' && target.aiPhase === 'guard') {
          const incomingX = attacker.x - target.x, incomingZ = attacker.z - target.z;
          const incomingLength = Math.hypot(incomingX, incomingZ) || 1;
          const shieldDot = Math.sin(target.aiAimAngle ?? 0) * incomingX / incomingLength
            + Math.cos(target.aiAimAngle ?? 0) * incomingZ / incomingLength;
          if (shieldDot > .25) hitDamage = Math.max(1, Math.ceil(hitDamage * .3));
        }
        if (!damage(target, hitDamage + bonus, speed)) return;
        if (attacker === context.heroBody && context.campaignState.equipment?.orbs?.includes('emberOrb'))
          applyStatusEffect(target, 'burn');
        markDirectPlayerHit(attacker, target);
        attacker.attackRicochets = (attacker.attackRicochets || 0) + 1;
        const attackerFigure = context.figures.find(item => item.body === attacker);
        if (attackerFigure) attackerFigure.dealDamageAge = 0;
        if (attacker.team === 'player') playerDealtDamage = true;
        if (target.team === 'player') playerTookDamage = true;
      };
      if (attackingA) attackHit(a, b, directHitProtectionA);
      if (attackingB) attackHit(b, a, directHitProtectionB);
      if (playerDealtDamage && playerTookDamage) context.vibrate([32, 18, 48]);
      else if (playerTookDamage) context.vibrate([48, 24, 70]);
      else if (playerDealtDamage) context.vibrate(28);
    }
    context.burst(b ? (a.x + b.x) / 2 : a.x, b ? (a.z + b.z) / 2 : a.z, Math.min(1.5, speed / 7));
  }
  return { damage, onImpact, recoverPlayerFromFall, damageCardboardProp, updateCardboardFalls };
}
