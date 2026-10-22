const UNIFORMS_KEY = 'cqSsaoSpriteAlphaUniforms';
const BOUND_KEY = Symbol('cqSsaoSpriteAlphaBound');

/** Make Three.js's SSAO normal prepass discard the transparent part of sprite cards. */
export function installSsaoSpriteAlphaCutout(normalMaterial) {
  if (!normalMaterial?.isMeshNormalMaterial) return null;

  const uniforms = {
    map: { value: null },
    mapTransform: { value: null },
    cutoff: { value: 0 },
    enabled: { value: 0 },
  };
  normalMaterial.userData ??= {};
  normalMaterial.userData[UNIFORMS_KEY] = uniforms;

  const previousCompile = normalMaterial.onBeforeCompile;
  normalMaterial.onBeforeCompile = function (shader, renderer) {
    previousCompile?.call(this, shader, renderer);
    shader.uniforms.cqSsaoSpriteAlphaMap = uniforms.map;
    shader.uniforms.cqSsaoSpriteAlphaMapTransform = uniforms.mapTransform;
    shader.uniforms.cqSsaoSpriteAlphaCutoff = uniforms.cutoff;
    shader.uniforms.cqSsaoSpriteAlphaEnabled = uniforms.enabled;

    const vertexCommon = '#include <common>';
    const vertexBegin = '#include <begin_vertex>';
    const fragmentCommon = '#include <common>';
    const fragmentMain = 'void main() {';
    if (!shader.vertexShader.includes(vertexCommon) || !shader.vertexShader.includes(vertexBegin)
      || !shader.fragmentShader.includes(fragmentCommon) || !shader.fragmentShader.includes(fragmentMain)) {
      throw new Error('Could not install the SSAO sprite alpha cutoff shader');
    }

    shader.vertexShader = shader.vertexShader
      .replace(vertexCommon, `${vertexCommon}\nattribute vec2 uv;\nvarying vec2 vCqSsaoSpriteUv;`)
      .replace(vertexBegin, `${vertexBegin}\nvCqSsaoSpriteUv = uv;`);
    shader.fragmentShader = shader.fragmentShader
      .replace(fragmentCommon, `${fragmentCommon}\nuniform sampler2D cqSsaoSpriteAlphaMap;\nuniform mat3 cqSsaoSpriteAlphaMapTransform;\nuniform float cqSsaoSpriteAlphaCutoff;\nuniform float cqSsaoSpriteAlphaEnabled;\nvarying vec2 vCqSsaoSpriteUv;`)
      .replace(fragmentMain, `${fragmentMain}\nif (cqSsaoSpriteAlphaEnabled > 0.5) {\n  vec2 alphaUv = (cqSsaoSpriteAlphaMapTransform * vec3(vCqSsaoSpriteUv, 1.0)).xy;\n  if (texture2D(cqSsaoSpriteAlphaMap, alphaUv).a < cqSsaoSpriteAlphaCutoff) discard;\n}`);
  };
  const previousCacheKey = normalMaterial.customProgramCacheKey;
  normalMaterial.customProgramCacheKey = function () {
    return `${previousCacheKey?.call(this) ?? ''}|cq-ssao-sprite-alpha-v1`;
  };
  normalMaterial.needsUpdate = true;
  return uniforms;
}

/** Attach per-object alpha state; it is active only while SSAOPass overrides the material. */
export function markSsaoSpriteAlphaCutout(mesh, texture, cutoff = 0.5) {
  if (!mesh || !texture || !(cutoff > 0)) return false;
  mesh.userData ??= {};
  mesh.userData.cqSsaoSpriteAlphaCutoff = cutoff;
  if (mesh[BOUND_KEY]) return true;
  let activeUniforms = null;
  const previousBefore = mesh.onBeforeRender;
  const previousAfter = mesh.onAfterRender;
  mesh.onBeforeRender = function (renderer, scene, camera, geometry, material, group) {
    previousBefore?.call(this, renderer, scene, camera, geometry, material, group);
    const override = scene?.overrideMaterial;
    const uniforms = override?.isMeshNormalMaterial && override.userData?.[UNIFORMS_KEY];
    if (!uniforms) return;
    texture.updateMatrix?.();
    uniforms.map.value = texture;
    uniforms.mapTransform.value = texture.matrix;
    uniforms.cutoff.value = cutoff;
    uniforms.enabled.value = 1;
    activeUniforms = uniforms;
  };
  mesh.onAfterRender = function (renderer, scene, camera, geometry, material, group) {
    previousAfter?.call(this, renderer, scene, camera, geometry, material, group);
    if (!activeUniforms) return;
    activeUniforms.enabled.value = 0;
    activeUniforms = null;
  };
  mesh[BOUND_KEY] = true;
  return true;
}

/** Reattach render hooks after Object3D.clone(), which copies userData but not callbacks. */
export function bindSsaoSpriteAlphaCutouts(root) {
  root?.traverse?.(mesh => {
    const cutoff = mesh.userData?.cqSsaoSpriteAlphaCutoff;
    if (mesh.isMesh && cutoff > 0 && mesh.material?.map)
      markSsaoSpriteAlphaCutout(mesh, mesh.material.map, cutoff);
  });
}
