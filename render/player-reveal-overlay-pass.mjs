/** Redraws reveal proxies over the opaque scene without making the base materials transparent. */
export function createPlayerRevealOverlayPass({ scene, camera, uniforms, layer = 31 }) {
  const syncProxies = () => scene.traverse(object => {
    const source = object._cqRevealOverlaySource;
    if (!source) return;
    object.position.copy(source.position);
    object.quaternion.copy(source.quaternion);
    object.scale.copy(source.scale);
    object.visible = source.visible;
    object.renderOrder = source.renderOrder;
  });

  const draw = (renderer, target = null) => {
    if (!(uniforms.cqRevealEnabled.value > 0.5)) return;
    syncProxies();
    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    const previousLayerMask = camera.layers.mask;
    const previousOverlayValue = uniforms.cqRevealOverlayPass.value;
    try {
      renderer.setRenderTarget(target);
      renderer.autoClear = false;
      camera.layers.set(layer);
      uniforms.cqRevealOverlayPass.value = 1;
      renderer.render(scene, camera);
    } finally {
      uniforms.cqRevealOverlayPass.value = previousOverlayValue;
      camera.layers.mask = previousLayerMask;
      renderer.autoClear = previousAutoClear;
      renderer.setRenderTarget(previousTarget);
    }
  };

  return {
    renderDirect(renderer) { draw(renderer); },
    composerPass: {
      enabled: true,
      needsSwap: false,
      clear: false,
      renderToScreen: false,
      setSize() {},
      render(renderer, writeBuffer, readBuffer) { draw(renderer, readBuffer); },
    },
  };
}
