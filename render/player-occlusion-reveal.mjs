export const PLAYER_REVEAL_DEFAULTS = Object.freeze({ revealInnerRadius: 14, revealOuterRadius: 76 });

/** One camera/player update feeds every eligible prop material through shared shader uniforms. */
export function createPlayerOcclusionReveal(THREE, renderer) {
  const uniforms = {
    cqRevealEnabled: { value: 0 },
    cqRevealScreen: { value: new THREE.Vector2() },
    cqRevealPlayerDepth: { value: 0 },
    cqRevealTime: { value: 0 },
    cqRevealInnerRadius: { value: PLAYER_REVEAL_DEFAULTS.revealInnerRadius },
    cqRevealOuterRadius: { value: PLAYER_REVEAL_DEFAULTS.revealOuterRadius },
  };
  const screen = new THREE.Vector3();
  const viewPosition = new THREE.Vector3();
  const viewport = new THREE.Vector2();

  function setSettings(settings) {
    uniforms.cqRevealInnerRadius.value = settings.revealInnerRadius;
    uniforms.cqRevealOuterRadius.value = settings.revealOuterRadius;
  }

  function update(camera, playerPosition, enabled = true) {
    uniforms.cqRevealTime.value = performance.now() * .001;
    camera.updateMatrixWorld();
    screen.copy(playerPosition).project(camera);
    viewPosition.copy(playerPosition).applyMatrix4(camera.matrixWorldInverse);
    renderer.getDrawingBufferSize(viewport);
    const visible = enabled && viewPosition.z < 0 && screen.z >= -1 && screen.z <= 1
      && Math.abs(screen.x) <= 1 && Math.abs(screen.y) <= 1;
    uniforms.cqRevealEnabled.value = visible ? 1 : 0;
    if (!visible) return;
    const pixelRatio = renderer.getPixelRatio();
    uniforms.cqRevealScreen.value.set((screen.x * .5 + .5) * viewport.x, (screen.y * .5 + .5) * viewport.y);
    uniforms.cqRevealPlayerDepth.value = -viewPosition.z;
    uniforms.cqRevealInnerRadius.value = settingsInner * pixelRatio;
    uniforms.cqRevealOuterRadius.value = settingsOuter * pixelRatio;
  }

  let settingsInner = PLAYER_REVEAL_DEFAULTS.revealInnerRadius;
  let settingsOuter = PLAYER_REVEAL_DEFAULTS.revealOuterRadius;
  function updateSettings(settings) {
    settingsInner = settings.revealInnerRadius;
    settingsOuter = settings.revealOuterRadius;
    setSettings(settings);
  }

  return { uniforms, update, updateSettings };
}
