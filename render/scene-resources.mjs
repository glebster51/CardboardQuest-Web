export function sceneResources(roots) {
  const resources = new Set();
  for (const root of roots) root?.traverse(object => {
    if (object.geometry) resources.add(object.geometry);
    for (const material of [object.material].flat().filter(Boolean)) {
      resources.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
      for (const value of Object.values(material.userData ?? {})) if (value?.isTexture) resources.add(value);
    }
  });
  return resources;
}

export function disposeUnusedScenes(removed, retained, protectedResources = []) {
  const live = sceneResources(retained);
  for (const resource of protectedResources) live.add(resource);
  for (const resource of sceneResources(removed)) if (!live.has(resource)) {
    resource.dispose();
    if (resource.isTexture) resource.image?.close?.();
  }
}
