export const SCREEN_EFFECT_SETTINGS_KEY = 'cardboardquest-screen-effects';

export const DEFAULT_SCREEN_EFFECTS = Object.freeze({
  tiltShift: true,
  tiltShiftFocus: .48,
  tiltShiftBlur: 12,
  tiltShiftUpperGradientShift: 0,
  tiltShiftLowerGradientShift: 0,
  tiltShiftGradientMultiplier: 1,
  tiltShiftShowGradient: false,
});

export function normalizeScreenEffects(value) {
  const number = (key, min, max) => {
    const candidate = Number(value?.[key]);
    return Number.isFinite(candidate) ? Math.max(min, Math.min(max, candidate)) : DEFAULT_SCREEN_EFFECTS[key];
  };
  return {
    tiltShift: value?.tiltShift !== false,
    tiltShiftFocus: number('tiltShiftFocus', 0, 1),
    tiltShiftBlur: number('tiltShiftBlur', 0, 24),
    tiltShiftUpperGradientShift: number('tiltShiftUpperGradientShift', -.25, .25),
    tiltShiftLowerGradientShift: number('tiltShiftLowerGradientShift', -.25, .25),
    tiltShiftGradientMultiplier: number('tiltShiftGradientMultiplier', 0, 4),
    tiltShiftShowGradient: value?.tiltShiftShowGradient === true,
  };
}
