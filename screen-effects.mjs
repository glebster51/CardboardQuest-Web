export const SCREEN_EFFECT_SETTINGS_KEY = 'cardboardquest-screen-effects';

export const DEFAULT_SCREEN_EFFECTS = Object.freeze({
  ssao: true,
  tiltShift: true,
  ssaoKernelRadius: 5,
  ssaoMinDistance: .008,
  ssaoMaxDistance: .12,
  tiltShiftFocus: .48,
  tiltShiftBlur: 7,
});

export function normalizeScreenEffects(value) {
  const number = (key, min, max) => {
    const candidate = Number(value?.[key]);
    return Number.isFinite(candidate) ? Math.max(min, Math.min(max, candidate)) : DEFAULT_SCREEN_EFFECTS[key];
  };
  return {
    ssao: value?.ssao !== false,
    tiltShift: value?.tiltShift !== false,
    ssaoKernelRadius: number('ssaoKernelRadius', 0, 16),
    ssaoMinDistance: number('ssaoMinDistance', .001, .05),
    ssaoMaxDistance: number('ssaoMaxDistance', .01, .5),
    tiltShiftFocus: number('tiltShiftFocus', 0, 1),
    tiltShiftBlur: number('tiltShiftBlur', 0, 24),
  };
}
