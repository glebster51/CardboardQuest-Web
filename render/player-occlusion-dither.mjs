export const PLAYER_REVEAL_DEFAULTS = Object.freeze({ revealInnerRadius: 14, revealOuterRadius: 76, revealNoiseSize: 8 });

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
      uniform float cqRevealTime;
      uniform float cqRevealInnerRadius;
      uniform float cqRevealOuterRadius;
      uniform float cqRevealNoiseSize;
      varying float vCQRevealDepth;
      float cqRevealHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float cqRevealVoronoi(vec2 p) {
        vec2 cell = floor(p), local = fract(p);
        float nearest = 1.0;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
          vec2 neighbor = vec2(float(x), float(y));
          vec2 feature = vec2(cqRevealHash(cell + neighbor),
            cqRevealHash(cell + neighbor + vec2(37.0, 17.0)));
          feature = 0.18 + feature * 0.64;
          nearest = min(nearest, length(neighbor + feature - local));
        }
        return clamp(nearest * 1.35, 0.0, 1.0);
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
        float cqRevealFade = 1.0 - smoothstep(cqRevealInnerRadius, cqRevealOuterRadius, cqRevealDistance);
        vec2 cqRevealDrift = vec2(cqRevealTime * 0.035, -cqRevealTime * 0.022);
        float cqRevealFine = cqRevealVoronoi(gl_FragCoord.xy / cqRevealNoiseSize + cqRevealDrift);
        float cqRevealBroad = cqRevealVoronoi(gl_FragCoord.xy / (cqRevealNoiseSize * 3.0) - cqRevealDrift * 0.7);
        float cqRevealNoise = cqRevealFine * 0.72 + cqRevealBroad * 0.28;
        float cqRevealShape = clamp(cqRevealFade + (cqRevealNoise - 0.5) * 1.2
          * cqRevealFade * (1.0 - cqRevealFade), 0.0, 1.0);
        float cqRevealCoverage = cqRevealShape * 0.60;
        vec2 cqRevealPixel = floor(gl_FragCoord.xy / 3.0);
        float cqRevealChecker = mod(cqRevealPixel.x + cqRevealPixel.y, 2.0);
        float cqRevealThreshold = mix(cqRevealBayer4(cqRevealPixel), cqRevealNoise, 0.28);
        cqRevealThreshold = fract(cqRevealThreshold + cqRevealChecker * 0.0625);
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
    cqRevealTime: { value: 0 },
    cqRevealInnerRadius: { value: PLAYER_REVEAL_DEFAULTS.revealInnerRadius },
    cqRevealOuterRadius: { value: PLAYER_REVEAL_DEFAULTS.revealOuterRadius },
    cqRevealNoiseSize: { value: PLAYER_REVEAL_DEFAULTS.revealNoiseSize },
  };
  const screen = new THREE.Vector3();
  const viewPosition = new THREE.Vector3();
  const viewport = new THREE.Vector2();
  let innerRadius = PLAYER_REVEAL_DEFAULTS.revealInnerRadius;
  let outerRadius = PLAYER_REVEAL_DEFAULTS.revealOuterRadius;
  let noiseSize = PLAYER_REVEAL_DEFAULTS.revealNoiseSize;

  function updateSettings(settings = {}) {
    innerRadius = settings.revealInnerRadius ?? innerRadius;
    outerRadius = settings.revealOuterRadius ?? outerRadius;
    noiseSize = settings.revealNoiseSize ?? noiseSize;
    uniforms.cqRevealInnerRadius.value = innerRadius * renderer.getPixelRatio();
    uniforms.cqRevealOuterRadius.value = outerRadius * renderer.getPixelRatio();
    uniforms.cqRevealNoiseSize.value = noiseSize * renderer.getPixelRatio();
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
    uniforms.cqRevealScreen.value.set((screen.x * .5 + .5) * viewport.x,
      (screen.y * .5 + .5) * viewport.y);
    uniforms.cqRevealPlayerDepth.value = -viewPosition.z;
  }

  return { uniforms, update, updateSettings };
}
