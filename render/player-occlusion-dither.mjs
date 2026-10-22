export const PLAYER_REVEAL_DEFAULTS = Object.freeze({ revealInnerRadius: 14, revealOuterRadius: 76,
  revealNoiseEnabled: true, revealNoiseSize: 8, revealNoiseShift: 0, revealNoiseMultiply: .35, revealCheckerSize: 3 });

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
      uniform float cqRevealCheckerSize;
      uniform float cqRevealNoiseEnabled;
      uniform float cqRevealNoiseSize;
      uniform float cqRevealNoiseShift;
      uniform float cqRevealNoiseMultiply;
      varying float vCQRevealDepth;
      float cqRevealHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float cqRevealVoronoi(vec2 p) {
        vec2 cell = floor(p);
        vec2 local = fract(p);
        float nearest = 1.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 seed = cell + neighbor;
            vec2 point = neighbor + vec2(cqRevealHash(seed), cqRevealHash(seed + 19.19));
            nearest = min(nearest, length(local - point));
          }
        }
        return nearest;
      }
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
        if (cqRevealNoiseEnabled > 0.5) {
          float cqRevealVoronoiValue = cqRevealVoronoi(gl_FragCoord.xy / cqRevealNoiseSize);
          float cqRevealRemappedNoise = clamp((cqRevealVoronoiValue - 0.35) * 4.0, -1.0, 1.0);
          float cqRevealNoise = (cqRevealRemappedNoise + cqRevealNoiseShift) * cqRevealNoiseMultiply;
          cqRevealCoverage = clamp((cqRevealCoverage + cqRevealNoise) * cqRevealCoverage, 0.0, 1.0);
        }
        vec2 cqRevealPixel = floor(gl_FragCoord.xy / cqRevealCheckerSize);
        float cqRevealChecker = mod(cqRevealPixel.x + cqRevealPixel.y, 2.0);
        float cqRevealThreshold = fract(cqRevealBayer4(cqRevealPixel) + cqRevealChecker * 0.0625);
        if (cqRevealThreshold < cqRevealCoverage) discard;
      }
      #include <opaque_fragment>`);
}

/** Shares a camera-space reveal mask across opaque scenery materials. */
export function createPlayerOcclusionDither(THREE, renderer,
  getRenderPixelRatio = () => renderer.getPixelRatio()) {
  const uniforms = {
    cqRevealEnabled: { value: 0 },
    cqRevealScreen: { value: new THREE.Vector2() },
    cqRevealPlayerDepth: { value: 0 },
    cqRevealInnerRadius: { value: PLAYER_REVEAL_DEFAULTS.revealInnerRadius },
    cqRevealOuterRadius: { value: PLAYER_REVEAL_DEFAULTS.revealOuterRadius },
    cqRevealCheckerSize: { value: PLAYER_REVEAL_DEFAULTS.revealCheckerSize },
    cqRevealNoiseEnabled: { value: Number(PLAYER_REVEAL_DEFAULTS.revealNoiseEnabled) },
    cqRevealNoiseSize: { value: PLAYER_REVEAL_DEFAULTS.revealNoiseSize },
    cqRevealNoiseShift: { value: PLAYER_REVEAL_DEFAULTS.revealNoiseShift },
    cqRevealNoiseMultiply: { value: PLAYER_REVEAL_DEFAULTS.revealNoiseMultiply },
  };
  const screen = new THREE.Vector3();
  const viewPosition = new THREE.Vector3();
  const viewport = new THREE.Vector2();
  let innerRadius = PLAYER_REVEAL_DEFAULTS.revealInnerRadius;
  let outerRadius = PLAYER_REVEAL_DEFAULTS.revealOuterRadius;
  let checkerSize = PLAYER_REVEAL_DEFAULTS.revealCheckerSize;
  let noiseEnabled = PLAYER_REVEAL_DEFAULTS.revealNoiseEnabled;
  let noiseSize = PLAYER_REVEAL_DEFAULTS.revealNoiseSize;
  let noiseShift = PLAYER_REVEAL_DEFAULTS.revealNoiseShift;
  let noiseMultiply = PLAYER_REVEAL_DEFAULTS.revealNoiseMultiply;
  let appliedPixelRatio = null;

  function syncPixelRatio() {
    const devicePixelRatio = renderer.getPixelRatio();
    const renderPixelRatio = getRenderPixelRatio();
    const pixelRatio = Number.isFinite(renderPixelRatio) && renderPixelRatio > 0
      ? renderPixelRatio : devicePixelRatio;
    if (pixelRatio === appliedPixelRatio) return pixelRatio;
    appliedPixelRatio = pixelRatio;
    uniforms.cqRevealInnerRadius.value = innerRadius * pixelRatio;
    uniforms.cqRevealOuterRadius.value = outerRadius * pixelRatio;
    uniforms.cqRevealCheckerSize.value = checkerSize * pixelRatio;
    uniforms.cqRevealNoiseSize.value = noiseSize * pixelRatio;
    return pixelRatio;
  }

  function updateSettings(settings = {}) {
    innerRadius = settings.revealInnerRadius ?? innerRadius;
    outerRadius = settings.revealOuterRadius ?? outerRadius;
    checkerSize = settings.revealCheckerSize ?? checkerSize;
    noiseEnabled = settings.revealNoiseEnabled ?? noiseEnabled;
    noiseSize = settings.revealNoiseSize ?? noiseSize;
    noiseShift = settings.revealNoiseShift ?? noiseShift;
    noiseMultiply = settings.revealNoiseMultiply ?? noiseMultiply;
    uniforms.cqRevealNoiseEnabled.value = noiseEnabled ? 1 : 0;
    uniforms.cqRevealNoiseShift.value = noiseShift;
    uniforms.cqRevealNoiseMultiply.value = noiseMultiply;
    appliedPixelRatio = null;
    syncPixelRatio();
  }

  function update(camera, playerPosition, enabled = true) {
    const renderPixelRatio = syncPixelRatio();
    camera.updateMatrixWorld();
    screen.copy(playerPosition).project(camera);
    viewPosition.copy(playerPosition).applyMatrix4(camera.matrixWorldInverse);
    renderer.getDrawingBufferSize(viewport);
    const renderScale = renderPixelRatio / renderer.getPixelRatio();
    viewport.set(viewport.x * renderScale, viewport.y * renderScale);
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
