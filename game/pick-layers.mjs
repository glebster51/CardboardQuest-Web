export const PLAYER_PICK_LAYER = 1;
export const ENEMY_PICK_LAYER = 2;

/** Add a selection-only Three.js layer without removing the render layer. */
export function enableFigurePickLayer(group, team) {
  const layer = team === 'player' ? PLAYER_PICK_LAYER : ENEMY_PICK_LAYER;
  group.traverse(object => object.layers.enable(layer));
  return layer;
}
