export const CACHE_OPEN_FRAME_DELAY = .12;
export const CACHE_SQUASH_DURATION = .62;

export function cacheSquashScale(age) {
  const impact = .34 * Math.exp(-age * 8) * Math.sin(age * 26);
  return { x: 1 + impact * .72, y: 1 - impact, z: 1 };
}
