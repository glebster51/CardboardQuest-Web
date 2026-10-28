import { OGRE_SETTINGS as settings } from './settings.mjs?v=7c14a71de3a9af87';
export const BOSS_WAVE_LEAP_DURATION = .4;
export const BOSS_WAVE_LEAP_DISTANCE = 1.6;
export const BOSS_WAVE_LEAP_HEIGHT = 1.1;

export function rollBossSeriesLength(randomBetween) {
  const roll = randomBetween(0, settings.seriesOne + settings.seriesTwo + settings.seriesThree);
  return roll < settings.seriesOne ? 1 : roll < settings.seriesOne + settings.seriesTwo ? 2 : 3;
}

export function pickBossSeriesAttack(previous, randomBetween) {
  const candidates = [
    ['wave', (1 - settings.leapSlamChance) * settings.firstWaveChance],
    ['dash', (1 - settings.leapSlamChance) * (1 - settings.firstWaveChance)],
    ['leap-slam', settings.leapSlamChance],
  ].filter(([attack]) => attack !== previous);
  const total = candidates.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = randomBetween(0, total || candidates.length);
  for (const [attack, weight] of candidates) {
    roll -= total ? weight : 1;
    if (roll < 0) return attack;
  }
  return candidates.at(-1)[0];
}

/** Pick a different attack after each bounded run. */
export function takeBossSeriesAttack(body, randomBetween) {
  if (!['dash', 'wave', 'leap-slam'].includes(body.bossSeriesAttack)) {
    body.bossSeriesAttack = pickBossSeriesAttack(null, randomBetween);
    body.bossSeriesRemaining = rollBossSeriesLength(randomBetween);
  } else if (!(body.bossSeriesRemaining > 0)) {
    body.bossSeriesAttack = pickBossSeriesAttack(body.bossSeriesAttack, randomBetween);
    body.bossSeriesRemaining = rollBossSeriesLength(randomBetween);
  }
  body.bossSeriesRemaining--;
  return body.bossSeriesAttack;
}

export function bossDashAngle(towardPlayer, randomBetween) {
  return towardPlayer + randomBetween(-settings.dashScatter * Math.PI / 360, settings.dashScatter * Math.PI / 360);
}

export function bossCanShatterOwnRock(rock, actor) {
  return actor.boss && actor.health > 0 && rock.ownerId === actor.id
    && ['dash', 'earth-retreat'].includes(actor.aiPhase);
}

export function createBossWaveLeap(x, z, angle, attack = 'wave') {
  const slam = attack === 'leap-slam';
  const distance = slam ? settings.leapSlamDistance : settings.waveLeapDistance;
  return { startX: x, startZ: z,
    endX: x + Math.sin(angle) * distance,
    endZ: z + Math.cos(angle) * distance,
    duration: slam ? settings.leapSlamFlightDuration : settings.waveLeapDuration,
    height: slam ? settings.leapSlamHeight : settings.waveLeapHeight };
}

export function bossWaveLeapPose(leap, remaining) {
  const progress = Math.max(0, Math.min(1, 1 - remaining / leap.duration));
  return { x: leap.startX + (leap.endX - leap.startX) * progress,
    z: leap.startZ + (leap.endZ - leap.startZ) * progress,
    height: 4 * progress * (1 - progress) * leap.height };
}
