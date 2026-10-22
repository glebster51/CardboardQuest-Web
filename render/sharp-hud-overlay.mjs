export const SHARP_HUD_LAYER = 30;

export function assignSharpHudLayer(root) {
  root?.traverse(object => object.layers.set(SHARP_HUD_LAYER));
}

/** Draw HUD meshes after post-processing so their edges stay at native resolution. */
export function renderSharpHudOverlay(renderer, scene, camera) {
  const previousMask = camera.layers.mask;
  const previousAutoClear = renderer.autoClear;
  const previousBackground = scene.background;
  try {
    renderer.autoClear = false;
    // A Color background forces Three.js to clear the color buffer even when
    // autoClear is false. That erased the composer output before drawing HUD.
    scene.background = null;
    camera.layers.set(SHARP_HUD_LAYER);
    renderer.clearDepth();
    renderer.render(scene, camera);
  } finally {
    scene.background = previousBackground;
    camera.layers.mask = previousMask;
    renderer.autoClear = previousAutoClear;
  }
}
