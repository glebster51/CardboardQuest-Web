/** Temporary editor-only render overrides for inspecting scene geometry. */
export function createRenderDebugModes({ THREE, scene, renderer }) {
  const originals = new WeakMap();
  const materials = {
    overdraw: new THREE.MeshBasicMaterial({
      color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: .16,
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false, toneMapped: false,
    }),
    wireframe: new THREE.MeshBasicMaterial({
      color: 0x8df3d4, side: THREE.DoubleSide, wireframe: true,
      blending: THREE.NormalBlending, depthTest: true, depthWrite: true, fog: false, toneMapped: false,
    }),
  };
  let mode = 'normal';
  const originalRender = renderer.render;

  function excluded(object) {
    for (let parent = object; parent; parent = parent.parent)
      if (parent.userData?.cqRenderDebugExclude) return true;
    return false;
  }
  function apply() {
    scene.traverse(object => {
      if (!object.isMesh || excluded(object)) return;
      if (!originals.has(object)) originals.set(object, object.material);
      const base = originals.get(object);
      const debug = materials[mode];
      object.material = Array.isArray(base) ? base.map(material => material ? debug : null) : debug;
    });
  }
  function restore() {
    scene.traverse(object => {
      if (!object.isMesh || !originals.has(object)) return;
      object.material = originals.get(object);
      originals.delete(object);
    });
  }

  renderer.render = function renderWithDebugMode(targetScene, camera, ...args) {
    if (mode !== 'normal' && targetScene === scene) apply();
    return originalRender.call(this, targetScene, camera, ...args);
  };

  return {
    get mode() { return mode; },
    setMode(next) {
      if (!['normal', 'overdraw', 'wireframe'].includes(next)) throw new RangeError(`Unknown render mode: ${next}`);
      mode = next;
      if (mode === 'normal') restore();
      else apply();
      return mode;
    },
    dispose() {
      mode = 'normal'; restore();
      if (renderer.render !== originalRender) renderer.render = originalRender;
      for (const material of Object.values(materials)) material.dispose();
    },
  };
}
