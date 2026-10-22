export const PLAYER_REVEAL_DEFAULTS = Object.freeze({ revealInnerRadius: 14, revealOuterRadius: 76 });

/** Adds the screen-space dither discard to one opaque scenery shader. */
export function applyPlayerOcclusionDitherShader(shader, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
      varying float vCQRevealDepth;`)
    .replace('#include <project_vertex>', `#include <project_vertex>
      vCQRevealDepth = -mvPosition.z;`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform float cqRevealEnabled;
      uniform vec2 cqRevealScreen;
      uniform float cqRevealPlayerDepth;
      uniform float cqRevealInnerRadius;
      uniform float cqRevealOuterRadius;
      varying float vCQRevealDepth;
      float cqRevealBayer4(vec2 p) {
        vec2 cell = mod(floor(p), 4.0);
        float low = mod(cell.x, 2.0) + 2.0 * mod(cell.y, 2.0);
        float high = mod(floor(cell.x * 0.5) + 2.0 * floor(cell.y * 0.5), 4.0);
        return (low * 4.0 + high + 0.5) / 16.0;
      }`)
    .replace('#include <opaque_fragment>', `
      float cqRevealDistance = length(gl_FragCoord.xy - cqRevealScreen);
      float cqRevealBeforePlayer = step(vCQRevealDepth + 0.025, cqRevealPlayerDepth);
      if (cqRevealEnabled > 0.5 && cqRevealBeforePlayer > 0.5 && cqRevealDistance < cqRevealOuterRadius) {
        if (cqRevealDistance <= cqRevealInnerRadius) discard;
        float cqRevealCoverage = 1.0 - smoothstep(cqRevealInnerRadius, cqRevealOuterRadius, cqRevealDistance);
        vec2 cqRevealPixel = floor(gl_FragCoord.xy / 3.0);
        float cqRevealChecker = mod(cqRevealPixel.x + cqRevealPixel.y, 2.0);
        float cqRevealThreshold = fract(cqRevealBayer4(cqRevealPixel) + cqRevealChecker * 0.0625);
        if (cqRevealThreshold < cqRevealCoverage) discard;
      }
      #include <opaque_fragment>`);
}

/** Shares a camera-space reveal mask across opaque scenery materials. */
export function createPlayerOcclusionDither(THREE, renderer) {
  const uniforms = {
    cqRevealEnabled: { value: 0 },
    cqRevealScreen: { value: new THREE.Vector2() },
    cqRevealPlayerDepth: { value: 0 },
    cqRevealInnerRadius: { value: PLAYER_REVEAL_DEFAULTS.revealInnerRadius },
    cqRevealOuterRadius: { value: PLAYER_REVEAL_DEFAULTS.revealOuterRadius },
  };
  const screen = new THREE.Vector3();
  const viewPosition = new THREE.Vector3();
  const viewport = new THREE.Vector2();
  let innerRadius = PLAYER_REVEAL_DEFAULTS.revealInnerRadius;
  let outerRadius = PLAYER_REVEAL_DEFAULTS.revealOuterRadius;

  function updateSettings(settings = {}) {
    innerRadius = settings.revealInnerRadius ?? innerRadius;
    outerRadius = settings.revealOuterRadius ?? outerRadius;
    uniforms.cqRevealInnerRadius.value = innerRadius * renderer.getPixelRatio();
    uniforms.cqRevealOuterRadius.value = outerRadius * renderer.getPixelRatio();
  }

  function update(camera, playerPosition, enabled = true) {
    camera.updateMatrixWorld();
    screen.copy(playerPosition).project(camera);
    viewPosition.copy(playerPosition).applyMatrix4(camera.matrixWorldInverse);
    renderer.getDrawingBufferSize(viewport);
    const visible = enabled && viewPosition.z < 0 && screen.z >= -1 && screen.z <= 1
      && Math.abs(screen.x) <= 1 && Math.abs(screen.y) <= 1;
    uniforms.cqRevealEnabled.value = visible ? 1 : 0;
    if (!visible) return;
    uniforms.cqRevealScreen.value.set((screen.x * .5 + .5) * viewport.x,
      (screen.y * .5 + .5) * viewport.y);
    uniforms.cqRevealPlayerDepth.value = -viewPosition.z;
  }

  return { uniforms, update, updateSettings };
}
