// label, default, minimum, maximum, step; shared by validation and editor controls.
export const OGRE_FIELDS = {
  health: ['Здоровье при появлении, четверти сердца', 48, 1, 400, 1],
  seriesOne: ['Вес серии из 1 атаки', 70, 0, 100, 1],
  seriesTwo: ['Вес серии из 2 атак', 25, 0, 100, 1],
  seriesThree: ['Вес серии из 3 атак', 5, 0, 100, 1],
  firstWaveChance: ['Доля волны среди рывка и волны', .5, 0, 1, .01],
  leapSlamChance: ['Доля дальнего АОЕ в ротации', .33, 0, 1, .01],
  dashScatter: ['Сектор рывка, градусы', 90, 0, 180, 1],
  dashAimMin: ['Прицеливание рывка: минимум, с', 1.5, .1, 10, .05],
  dashAimMax: ['Прицеливание рывка: максимум, с', 2.3, .1, 10, .05],
  dashPauseMin: ['Пауза после рывка: минимум, с', 1, .1, 10, .05],
  dashPauseMax: ['Пауза после рывка: максимум, с', 3.2, .1, 10, .05],
  dashPowerMin: ['Сила рывка: минимум', .55, .1, 1.8, .01],
  dashPowerMax: ['Сила рывка: максимум', .95, .1, 1.8, .01],
  dashDistanceGain: ['Сила рывка на метр', .12, .01, 1, .01],
  waveDuration: ['Заполнение маркера волны, с', .78, .2, 5, .01],
  waveLeapDuration: ['Полёт перед волной, с', .4, .1, 5, .01],
  waveLeapDistance: ['Прыжок перед волной, м', 1.6, .1, 6, .1],
  waveLeapHeight: ['Высота прыжка волны, м', 1.1, .1, 4, .1],
  waveRockCount: ['Глыб в волне', 7, 1, 24, 1],
  waveRockInterval: ['Интервал глыб, с', .12, .01, 1, .01],
  waveRockSpacing: ['Шаг глыб, м', 1.18, .3, 4, .01],
  waveFirstOffset: ['Первая глыба от посадки, м', 1.7, .3, 5, .1],
  leapSlamDuration: ['Заполнение маркера дальнего АОЕ, с', .9, .2, 5, .01],
  leapSlamFlightDuration: ['Полёт дальнего АОЕ, с', .5, .1, 5, .01],
  leapSlamDistance: ['Прыжок дальнего АОЕ, м', 2.4, .1, 8, .1],
  leapSlamHeight: ['Высота прыжка дальнего АОЕ, м', 1.5, .1, 4, .1],
  closeDistance: ['Дистанция приоритета АОЕ, м', 2.6, .5, 8, .1],
  circleRadius: ['Радиус АОЕ, м', 3.4, 1, 10, .1],
  circleDuration: ['Заполнение круга АОЕ, с', 1.2, .3, 5, .05],
  circleJumpStart: ['Взлёт АОЕ: доля заполнения', .75, .1, .95, .01],
  circleJumpHeight: ['Высота прыжка АОЕ, м', 1.1, .1, 4, .1],
  circleRockCount: ['Глыб вокруг босса', 12, 3, 32, 1],
  circleRockRadius: ['Радиус кольца глыб, м', 2.5, .5, 9, .1],
  retreatPower: ['Сила отскока после АОЕ', .55, .1, 1.8, .01],
  recoveryDuration: ['Восстановление после умения, с', 1.2, .1, 8, .05],
  skillPauseMin: ['Пауза после умения: минимум, с', 1.4, .1, 10, .05],
  skillPauseMax: ['Пауза после умения: максимум, с', 2.2, .1, 10, .05],
  rockDangerDuration: ['Глыба наносит урон, с', 1, .1, 5, .1],
  rockIdleDuration: ['Глыба остаётся после урона, с', 5, .1, 20, .1],
  rockDamage: ['Урон земли, четверти сердца', 4, 1, 40, 1],
  knockbackDuration: ['Отбрасывание цели, с', .58, .1, 2, .01],
  knockbackDistance: ['Отбрасывание цели, м', 3, .1, 8, .1],
  knockbackHeight: ['Высота отбрасывания цели, м', .58, .1, 3, .01],
  attackPoseDuration: ['Длительность позы удара, с', .2, .05, 1, .01],
};
export const OGRE_DEFAULTS = Object.freeze(Object.fromEntries(Object.entries(OGRE_FIELDS).map(([key, field]) => [key, field[1]])));
export function normalizeOgreSettings(value) {
  const result = {};
  for (const [key, [, fallback, min, max, step]] of Object.entries(OGRE_FIELDS)) {
    const input = Number.isFinite(value?.[key]) ? value[key] : fallback;
    result[key] = Math.max(min, Math.min(max, step === 1 ? Math.round(input) : input));
  }
  for (const prefix of ['dashAim', 'dashPause', 'dashPower', 'skillPause'])
    result[`${prefix}Max`] = Math.max(result[`${prefix}Min`], result[`${prefix}Max`]);
  result.waveLeapDuration = Math.min(result.waveLeapDuration, result.waveDuration);
  result.leapSlamFlightDuration = Math.min(result.leapSlamFlightDuration, result.leapSlamDuration);
  result.circleRockRadius = Math.min(result.circleRockRadius, result.circleRadius - .5);
  if (result.seriesOne + result.seriesTwo + result.seriesThree === 0) result.seriesOne = 1;
  return result;
}
export function validateOgreSettings(value) {
  const normalized = normalizeOgreSettings(value);
  if (!value || Object.keys(value).some(key => !Object.hasOwn(OGRE_FIELDS, key))
      || Object.keys(OGRE_FIELDS).some(key => normalized[key] !== value[key])) throw new Error('Invalid ogre settings');
  return value;
}
export const OGRE_SETTINGS = { ...OGRE_DEFAULTS };
const ADDED_FIELDS = ['leapSlamChance', 'leapSlamDuration', 'leapSlamFlightDuration', 'leapSlamDistance', 'leapSlamHeight'];
export function upgradeOgreSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const result = {};
  for (const key of Object.keys(OGRE_FIELDS)) {
    if (Object.hasOwn(value, key)) result[key] = value[key];
    else if (ADDED_FIELDS.includes(key)) result[key] = OGRE_DEFAULTS[key];
  }
  for (const key of Object.keys(value)) if (!Object.hasOwn(OGRE_FIELDS, key)) result[key] = value[key];
  return result;
}
export function upgradeOgreSceneDiff(diff) {
  if (!Array.isArray(diff?.changes)) return diff;
  return { ...diff, changes: diff.changes.map(change => change?.object === 'ogre-boss'
    ? { ...change, before: upgradeOgreSettings(change.before), after: upgradeOgreSettings(change.after) } : change) };
}
export function setOgreSettings(value) { Object.assign(OGRE_SETTINGS, normalizeOgreSettings(value)); }
export async function loadOgreSettings() {
  const response = await fetch(new URL('./config.json', import.meta.url));
  if (!response.ok) throw new Error(`Не удалось загрузить настройки босса: HTTP ${response.status}`);
  const settings = upgradeOgreSettings(await response.json()); validateOgreSettings(settings); setOgreSettings(settings);
  return { ...OGRE_SETTINGS };
}
