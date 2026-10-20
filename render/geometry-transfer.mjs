/** Transfer typed buffers and bitmap textures, preserving shared resource identity. */
export async function packScene(root, shared = {}) {
  const geometries = [], materials = [], textures = [], nodes = [];
  const geometryIds = new Map(), materialIds = new Map(), textureIds = new Map(), transfers = new Set();
  async function textureId(texture) {
    if (textureIds.has(texture)) return textureIds.get(texture);
    const id = textures.length; textureIds.set(texture, id); textures.push(null);
    const sharedName = Object.keys(shared).find(key => shared[key] === texture);
    const image = sharedName ? null : await createImageBitmap(texture.image,
      { imageOrientation: texture.flipY ? 'flipY' : 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    if (image) transfers.add(image);
    textures[id] = { sharedName, image, colorSpace: texture.colorSpace, flipY: false };
    return id;
  }
  async function materialId(material) {
    if (materialIds.has(material)) return materialIds.get(material);
    const id = materials.length; materialIds.set(material, id); materials.push(null);
    const props = {};
    for (const [key, value] of Object.entries(material)) {
      if (['id', 'uuid', 'version', 'type', 'userData'].includes(key)) continue;
      if (value?.isTexture) props[key] = { texture: await textureId(value) };
      else if (value?.isColor) props[key] = { color: value.toArray() };
      else if (value === null || ['boolean', 'number', 'string'].includes(typeof value)) props[key] = value;
    }
    materials[id] = { type: material.type, props }; return id;
  }
  function geometryId(geometry) {
    if (geometryIds.has(geometry)) return geometryIds.get(geometry);
    const id = geometries.length; geometryIds.set(geometry, id);
    const attributes = Object.fromEntries(Object.entries(geometry.attributes).map(([key, attribute]) => {
      transfers.add(attribute.array.buffer);
      return [key, { array: attribute.array, itemSize: attribute.itemSize, normalized: attribute.normalized }];
    }));
    if (geometry.index) transfers.add(geometry.index.array.buffer);
    geometries.push({ attributes, index: geometry.index?.array, groups: geometry.groups }); return id;
  }
  async function visit(object, parent = null) {
    const index = nodes.length;
    nodes.push({ parent, uuid: object.uuid, name: object.name, visible: object.visible,
      position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray(),
      castShadow: object.castShadow, receiveShadow: object.receiveShadow, renderOrder: object.renderOrder,
      geometry: object.geometry ? geometryId(object.geometry) : null,
      materials: object.material ? await Promise.all([object.material].flat().map(materialId)) : null,
      arrayMaterial: Array.isArray(object.material) });
    for (const child of object.children) await visit(child, index);
  }
  await visit(root);
  return { packet: { nodes, geometries, materials, textures }, transfers: [...transfers] };
}

export async function unpackScene(THREE, packet, shared = {}, yieldWork = async () => {}) {
  const textures = packet.textures.map(record => {
    if (record.sharedName) return shared[record.sharedName];
    const texture = new THREE.Texture(record.image); texture.needsUpdate = true;
    texture.colorSpace = record.colorSpace; texture.flipY = record.flipY; texture.anisotropy = 4;
    return texture;
  });
  const materials = packet.materials.map(record => {
    const material = new THREE[record.type]();
    for (const [key, value] of Object.entries(record.props)) {
      if (value?.texture !== undefined) material[key] = textures[value.texture];
      else if (value?.color) material[key].fromArray(value.color);
      else material[key] = value;
    }
    return material;
  });
  const geometries = [];
  for (const record of packet.geometries) {
    const geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(record.attributes))
      geometry.setAttribute(name, new THREE.BufferAttribute(attribute.array, attribute.itemSize, attribute.normalized));
    if (record.index) geometry.setIndex(new THREE.BufferAttribute(record.index, 1));
    for (const group of record.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
    geometries.push(geometry);
    await yieldWork();
  }
  const nodes = [], byUuid = new Map();
  for (const record of packet.nodes) {
    const mats = record.materials?.map(id => materials[id]);
    const object = record.geometry === null ? new THREE.Group()
      : new THREE.Mesh(geometries[record.geometry], record.arrayMaterial ? mats : mats[0]);
    object.name = record.name; object.visible = record.visible;
    object.position.fromArray(record.position); object.quaternion.fromArray(record.quaternion); object.scale.fromArray(record.scale);
    object.castShadow = record.castShadow; object.receiveShadow = record.receiveShadow; object.renderOrder = record.renderOrder;
    if (record.parent !== null) nodes[record.parent].add(object);
    nodes.push(object); byUuid.set(record.uuid, object);
  }
  return { group: nodes[0], byUuid };
}
