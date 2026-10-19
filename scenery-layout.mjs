export const SPRITE_REFERENCE_HEIGHT = 2.05;
export const CARDBOARD_EXTRUSION_DEPTH = .144;
export const PUCK_HEIGHT = .2;
export const PUCK_CENTER_Y = .11;

export function sceneryTokenLayout(spriteHeight, baseRadius = 0) {
  if (!Number.isFinite(spriteHeight) || spriteHeight <= 0) throw new RangeError('Sprite height must be positive');
  if (!Number.isFinite(baseRadius) || baseRadius < 0) throw new RangeError('Base radius cannot be negative');
  const scale = spriteHeight / SPRITE_REFERENCE_HEIGHT;
  const baseTop = baseRadius > 0 ? PUCK_CENTER_Y + PUCK_HEIGHT / 2 : 0;
  const artY = spriteHeight / 2 + baseTop;
  return { scale, artY, baseTop, extrusionDepth: CARDBOARD_EXTRUSION_DEPTH * scale };
}
