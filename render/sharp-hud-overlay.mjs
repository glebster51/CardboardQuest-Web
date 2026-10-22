export const SHARP_HUD_LAYER = 30;

export function assignSharpHudLayer(root) {
  root?.traverse(object => object.layers.set(SHARP_HUD_LAYER));
}

/** Draw HUD meshes after post-processing so their edges stay at native resolution. */
export function renderSharpHudOverlay(renderer, scene, camera) {
  const previousMask = camera.layers.mask;
  const previousAutoClear = renderer.autoClear;
  try {
    renderer.autoClear = false;
    camera.layers.set(SHARP_HUD_LAYER);
    renderer.clearDepth();
    renderer.render(scene, camera);
  } finally {
    camera.layers.mask = previousMask;
    renderer.autoClear = previousAutoClear;
  }
}
