// Reserve stencil bit 1 (value 2) for visible cardboard pixels. Existing scene
// materials still write their previous 0/1 values across the full stencil mask.
export const ENEMY_OCCLUSION_STENCIL_BIT = 2;

/** The nearest opaque surface decides whether this pixel may reveal enemies. */
export function applyCardboardOcclusionStencil(material, THREE, revealEnemies = true) {
  const occlusionValue = revealEnemies ? ENEMY_OCCLUSION_STENCIL_BIT : 0;
  const damageMask = material.userData?.cardboardDamageStencilMask;
  if (material.userData?.cardboardDamageKind === 'environment' && damageMask) {
    Object.assign(material, {
      stencilWrite: true,
      stencilRef: (material.userData.cardboardDamageStencilValue ?? 0) | occlusionValue,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilFuncMask: 0xff,
      stencilWriteMask: damageMask | ENEMY_OCCLUSION_STENCIL_BIT,
      stencilFail: THREE.KeepStencilOp,
      stencilZFail: THREE.KeepStencilOp,
      stencilZPass: THREE.ReplaceStencilOp,
    });
    return material;
  }
  Object.assign(material, {
    stencilWrite: true,
    stencilRef: occlusionValue,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilFuncMask: ENEMY_OCCLUSION_STENCIL_BIT,
    stencilWriteMask: ENEMY_OCCLUSION_STENCIL_BIT,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.ReplaceStencilOp,
  });
  return material;
}

/** Let the red enemy copy draw only where a cardboard occluder marked this pixel. */
export function applyEnemySilhouetteStencil(material, THREE) {
  Object.assign(material, {
    // Three.js uses stencilWrite to enable STENCIL_TEST as well. Keep the
    // test enabled; a zero write mask makes this a read-only stencil pass.
    stencilWrite: true,
    stencilRef: ENEMY_OCCLUSION_STENCIL_BIT,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFuncMask: ENEMY_OCCLUSION_STENCIL_BIT,
    stencilWriteMask: 0,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp,
  });
  return material;
}
