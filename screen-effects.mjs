export const SCREEN_EFFECT_SETTINGS_KEY = 'cardboardquest-screen-effects';

export const DEFAULT_SCREEN_EFFECTS = Object.freeze({
  ssao: true,
  tiltShift: true,
});

export function normalizeScreenEffects(value) {
  return {
    ssao: value?.ssao !== false,
    tiltShift: value?.tiltShift !== false,
  };
}
