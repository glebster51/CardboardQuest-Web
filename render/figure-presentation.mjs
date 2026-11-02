import { earthShatterAttackPoseActive } from '../game/earth-shatter.mjs?v=f484ba7b7b13e7f6';
import { groundSlamProgress, groundSlamJumpHeight } from '../bosses/ogre/ground-slam.mjs?v=f484ba7b7b13e7f6';
import { updateFigureHitFlash } from './figure-hit-flash.mjs?v=f484ba7b7b13e7f6';
import { facingAngle, turnToward, isAttacking } from '../physics.mjs?v=f484ba7b7b13e7f6';
import { chargeRechargeProgress, playerChargeRechargeInterval } from '../charge-recharge.mjs?v=f484ba7b7b13e7f6';
import { heartHealthLevels, healthHeartRenderOrder, healthRestoreVisual, shouldShowHealthHud } from '../heart-health.mjs?v=f484ba7b7b13e7f6';
import { advanceVictoryLoop } from '../victory-animation.mjs?v=f484ba7b7b13e7f6';

/** Update figure sprites, hit feedback, hearts and charge markers from the current frame. */
export function updateFigurePresentation({ figures, heroBody, activeLocation, aimingBody, camera, elapsed, campaignState, playerRestoredHearts, heartMaterialVariants, victorySequenceActive, GROUND_UI_Y, MAX_AIM_MARKER_EXTENSION, attackColor, enemyColor, setVisualState }, dt) {
  for (const figure of figures) {
    if (figure.poolDormant) continue;
    const body = figure.body;
    if (body !== heroBody && figure.locationId !== activeLocation.id) continue;
    if (body.fell) {
      figure.healthHUD.visible = false;
      if (figure.enemyMarker) figure.enemyMarker.group.visible = false;
      if (typeof figure.fallAge !== 'number') { figure.group.visible = false; continue; }
      figure.fallAge += dt;
      const t = Math.min(1, figure.fallAge / .65);
      figure.group.position.set(body.x, -3 * t, body.z);
      figure.group.scale.setScalar(Math.max(.05, 1 - t * .85));
      figure.group.visible = t < 1;
      continue;
    }
    if (figure.spawnAnimation) continue;
    figure.healthHUD.visible = shouldShowHealthHud(body.team, body.health, body.maxHealth);
    figure.group.position.set(body.x, 0, body.z);
    const speed = Math.hypot(body.vx, body.vz);
    const victoryPose = body.health > 0 && figure.victoryAnimation
      ? advanceVictoryLoop(figure.victoryAnimation, dt) : null;
    if (victoryPose) figure.group.rotation.y = figure.victoryBaseYaw + victoryPose.spinY;
    else if (body.health > 0 && body !== aimingBody && !(body.team === 'enemy' && ['aim', 'guard'].includes(body.aiPhase))) {
      figure.facing = facingAngle(body.vx, body.vz, figure.facing);
    }
    if (body.health > 0 && !victoryPose) figure.group.rotation.y = turnToward(figure.group.rotation.y, figure.facing, dt);
    const cameraDx = camera.position.x - figure.group.position.x, cameraDz = camera.position.z - figure.group.position.z;
    const cameraDistance = Math.max(.001, Math.hypot(cameraDx, cameraDz));
    const facingDot = (cameraDx * Math.sin(figure.group.rotation.y) + cameraDz * Math.cos(figure.group.rotation.y)) / cameraDistance;
    if (body.health <= 0) figure.viewBack = false;
    else if (figure.viewBack ? facingDot > .025 : facingDot < -.025) figure.viewBack = !figure.viewBack;
    for (const art of Object.values(figure.artStates)) {
      art.frontArt.group.visible = !figure.viewBack;
      art.backArt.group.visible = figure.viewBack;
    }
    figure.hitAge += dt;
    figure.hurtAge += dt;
    figure.dealDamageAge += dt;
    if (Number.isFinite(figure.earthShatterAttackAge)) figure.earthShatterAttackAge += dt;
    const visualState = body.health <= 0 ? 'dead'
      : victoryPose ? victoryPose.sprite
        : earthShatterAttackPoseActive(figure.earthShatterAttackAge) ? 'attack'
          : figure.hurtAge < .55 ? 'on-hit'
        : figure.dealDamageAge < .32 ? 'deal-damage'
          : body === aimingBody || (body.team === 'enemy' && ['aim', 'guard', 'earth-windup', 'earth-slam-windup'].includes(body.aiPhase)) ? 'aiming'
            : isAttacking(body) ? 'attack' : 'idle';
    setVisualState(figure, visualState);
    updateFigureHitFlash(figure);
    const spring = Math.exp(-figure.hitAge * 9) * Math.sin(figure.hitAge * 28);
    const squash = figure.hitStrength * spring;
    const artScale = figure.bossScale ?? 1;
    for (const state of Object.values(figure.enemyOcclusionGhost?.states ?? {})) state.group.scale.setScalar(artScale);
    const bossLeap = !body.boss ? 0 : body.aiPhase === 'earth-slam-windup'
      ? groundSlamJumpHeight(groundSlamProgress(body.aiTimer))
      : body.aiPhase === 'earth-windup' ? body.bossLeapHeight ?? 0 : 0;
    const earthShatterHeight = body.earthShatterHeight ?? 0;
    if (visualState === 'dead') {
      figure.artGroup.scale.set(artScale, artScale, artScale);
      figure.artGroup.position.y = figure.deadGroundedY + earthShatterHeight;
      figure.artGroup.rotation.set(0, 0, 0);
    } else if (victoryPose) {
      figure.artGroup.scale.set(artScale * victoryPose.scaleX, artScale * victoryPose.scaleY, artScale);
      figure.artGroup.position.y = 1.25 + bossLeap + victoryPose.lift + earthShatterHeight;
      figure.artGroup.rotation.set(0, 0, 0);
    } else {
      figure.artGroup.scale.set(artScale * (1 + squash * .7), artScale * (1 - squash), artScale);
      figure.artGroup.position.y = 1.25 + bossLeap + Math.max(0, squash) * .2 + earthShatterHeight;
      figure.artGroup.rotation.set(0, 0, squash * .15 + Math.sin(elapsed * 19) * Math.min(speed / 20, 1) * .012);
    }
    figure.attacking = isAttacking(body);
    const heartLevels = heartHealthLevels(body.health, body.maxHealth);
    const currentLastHeart = heartLevels.reduce((last, level, index) => level > 0 ? index : last, -1);
    const effects = body === heroBody ? campaignState.statusEffects : body.statusEffects;
    const poisoned = effects?.some(effect => effect.id === 'poison') ?? false;
    const burning = effects?.some(effect => effect.id === 'burn') ?? false;
    const variant = poisoned ? (burning ? 'poisonBurn' : 'poison') : (burning ? 'burn' : 'normal');
    figure.heartIcons.forEach((icon, index) => {
      const level = heartLevels[index];
      const isCurrentLast = index === currentLastHeart;
      let restore = figure.healthRestoreHearts?.get(index);
      let restoreVisual = restore ? healthRestoreVisual((performance.now() - restore.startedAt) / 1000) : null;
      if (restore && !restoreVisual.active) {
        figure.healthRestoreHearts.delete(index);
        if (figure.body === heroBody) playerRestoredHearts.delete(index);
        restore = null; restoreVisual = null;
      }
      const materialVariant = restoreVisual?.green && level > 0 ? 'restored' : variant;
      const material = heartMaterialVariants[materialVariant][level];
      if (icon.level !== level || icon.currentLast !== isCurrentLast) {
        icon.mesh.renderOrder = healthHeartRenderOrder(level, index, currentLastHeart);
        icon.currentLast = isCurrentLast;
      }
      const baseScale = isCurrentLast ? 1.2 : 1;
      const squash = restoreVisual?.squash ?? 0;
      icon.mesh.scale.set(baseScale * (1 + squash * .85), baseScale * (1 - squash), 1);
      if (icon.level !== level || icon.materialVariant !== materialVariant) {
        icon.mesh.material = material;
        icon.level = level; icon.materialVariant = materialVariant;
      }
    });
    figure.statusIndicators.update(effects);
    const rechargeProgress = chargeRechargeProgress(body,
      body === heroBody ? playerChargeRechargeInterval(activeLocation.enemies) : undefined);
    figure.chargePips.forEach(({ group, base, fill }, index) => {
      const amount = index < body.charges ? 1 : index === body.charges ? rechargeProgress : 0;
      group.visible = body.team === 'player';
      const popRemaining = body.chargePop?.[index] ?? 0;
      body.chargePop[index] = Math.max(0, popRemaining - dt);
      if (popRemaining > 0 && index < body.charges) {
        const t = 1 - popRemaining / .48;
        const bounce = t >= 1 ? 1 : 1 + Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * 2 * Math.PI / 3);
        fill.scale.setScalar(1.05 * Math.max(.001, bounce));
        fill.material.opacity = 1 - .1 * t;
      } else {
        fill.scale.setScalar(amount * (index < body.charges ? 1.05 : 1));
        fill.material.opacity = .9;
      }
      base.material.opacity = .4;
    });
    if (figure.enemyMarker) {
      const aiming = !victorySequenceActive && body.health > 0 && ['aim', 'guard', 'earth-windup'].includes(body.aiPhase);
      figure.enemyMarker.setSizeScale(figure.bossScale ?? (body.boss ? 1.5 : 1));
      figure.enemyMarker.group.position.set(body.x, GROUND_UI_Y, body.z);
      figure.enemyMarker.group.rotation.y = aiming ? body.aiAimAngle : figure.facing;
      figure.enemyMarker.group.visible = !victorySequenceActive && body.health > 0;
      figure.enemyMarker.setExtension(aiming ? MAX_AIM_MARKER_EXTENSION : 0);
      figure.enemyMarker.setProgress(aiming ? 1 - body.aiTimer / (body.aiAimDuration || 1) : 0);
      figure.enemyMarker.material.color.lerp(body.health > 0 && isAttacking(body) ? attackColor : enemyColor, 1 - Math.exp(-18 * dt));
      figure.enemyMarker.material.opacity = body.health > 0 ? .96 : .35;
    }
  }
}
