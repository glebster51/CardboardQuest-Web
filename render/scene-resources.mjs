function materialResources(material, resources) {
  resources.add(material);
  const seen = new Set();
  const textures = value => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (value.isTexture) { resources.add(value); return; }
    for (const child of Object.values(value)) textures(child);
  };
  for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
  textures(material.uniforms); textures(material.userData);
}

export function sceneResources(roots) {
  const resources = new Set();
  for (const root of roots) root?.traverse(object => {
    if (object.geometry) resources.add(object.geometry);
    for (const material of [object.material].flat().filter(Boolean)) {
      materialResources(material, resources);
    }
  });
  return resources;
}

/** Named shared pools own their resources for the application's lifetime. Scene roots own the rest. */
export function createSceneResourceOwner() {
  const pools = new Map(), disposed = new WeakSet();
  return {
    share(name, resources) {
      if (pools.has(name)) throw new Error(`Duplicate resource owner: ${name}`);
      pools.set(name, typeof resources === 'function' ? resources : () => resources);
    },
    release(removed, retained = []) {
      const live = sceneResources(retained);
      for (const read of pools.values()) for (const resource of read()) {
        if (!resource) continue;
        live.add(resource);
        if (resource.isMaterial) materialResources(resource, live);
      }
      let count = 0;
      for (const resource of sceneResources(removed)) if (!live.has(resource) && !disposed.has(resource)) {
        resource.dispose(); disposed.add(resource); count++;
        if (resource.isTexture) resource.image?.close?.();
      }
      return count;
    },
  };
}

export function disposeUnusedScenes(removed, retained, protectedResources = []) {
  const live = sceneResources(retained);
  for (const resource of protectedResources) live.add(resource);
  for (const resource of sceneResources(removed)) if (!live.has(resource)) {
    resource.dispose();
    if (resource.isTexture) resource.image?.close?.();
  }
}
