import { createEditModel, FOG_DEFAULTS, LIGHTING_DEFAULTS, TERRAIN_STYLE_DEFAULTS, UNIT_PUCK_COLOR_DEFAULTS, readTransform, validateSceneValue, writeTransform } from './edit-model.mjs?v=150';
import { ASSET_CATALOG, catalogAsset, catalogPrefab } from './asset-catalog.mjs?v=7';
import { createExitBarrierBodies } from '../location-network.mjs';
import { createDefaultFogPaths } from '../fog-paths.mjs?v=2';
import { validateTerrainEdits } from '../game/terrain-sculpt.mjs?v=2';

/** Stable scene ids, editable meshes, and their actual gameplay data. */
export function createSceneRegistry({ THREE, overrides, setFog, setLighting = () => {}, setTerrainStyle = () => {}, setUnitPuckColors = () => {} }) {
  const model = createEditModel(), resident = new Map(), sources = new Map(), placedTemplates = new Map();
  const fog = { ...FOG_DEFAULTS, ...overrides.fog }; model.register(null, 'fog', fog);
  const lighting = { ...LIGHTING_DEFAULTS, ...overrides.lighting,
    direction: [...(overrides.lighting?.direction ?? LIGHTING_DEFAULTS.direction)] };
  model.register(null, 'lighting', lighting);
  const terrainStyle = { ...TERRAIN_STYLE_DEFAULTS, ...overrides.terrainStyle };
  validateSceneValue(terrainStyle, false, false, false, false, false, true);
  model.register(null, 'terrain-style', terrainStyle);
  const unitPuckColors = { ...UNIT_PUCK_COLOR_DEFAULTS, ...overrides.unitPuckColors };
  validateSceneValue(unitPuckColors, false, false, false, false, false, false, true);
  model.register(null, 'unit-puck-colors', unitPuckColors);
  const prefabs = new Map();
  for (const item of ASSET_CATALOG.filter(entry => entry.asset && entry.kind !== 'reference')) {
    const settings = { size: overrides.prefabs?.[item.id]?.size ?? item.size };
    validateSceneValue(settings, false, false, false, false, false, false, false, item.id);
    prefabs.set(item.id, settings); model.register(null, `prefab:${item.id}`, settings);
  }
  const snapshot = binding => ({ ...readTransform(binding.object), ...(binding.asset
    ? { scale: readTransform(binding.object).scale.map(value => value / binding.prefabScale), asset: binding.asset, prefabId: binding.prefabId } : {}) });
  function fogPathsMatchLocation(paths, location) {
    try {
      const expected = createDefaultFogPaths(location).paths;
      const actual = new Map(paths.paths.map(path => [path.id, path]));
      return expected.length === actual.size && expected.every(path => {
        const saved = actual.get(path.id), start = saved?.points?.[0];
        return start && Math.hypot(start[0] - path.points[0][0], start[1] - path.points[0][1]) < .001;
      });
    } catch { return false; }
  }
  function apply(binding, value) {
    const deleted = value === null;
    binding.object.userData.sceneEditDeleted = deleted;
    binding.object.visible = !deleted && binding.visible;
    if (binding.body) binding.body.active = !deleted && binding.bodyActive;
    binding.onDelete?.(deleted);
    if (!deleted) {
      const transform = binding.prefabId ? { ...value, scale: value.scale.map(scale => scale * binding.prefabScale) } : value;
      writeTransform(binding.object, transform); binding.sync?.();
    }
  }
  function bind(location, bindings, id, label, object, options = {}, born = false) {
    const binding = { id, label, object, location: location.id, visible: object.visible,
      bodyActive: options.body?.active !== false, ...options };
    if (binding.asset) {
      const prefab = catalogAsset(binding.asset);
      binding.prefabId = object.userData.sceneEditPrefabId ?? prefab?.id;
      const definition = catalogPrefab(binding.prefabId);
      const settings = prefabs.get(binding.prefabId);
      binding.prefabScale = definition && settings ? settings.size / definition.size : 1;
    } else binding.prefabScale = 1;
    let original = snapshot(binding);
    const saved = overrides.locations[location.id];
    if (saved && Object.hasOwn(saved, id)) {
      if (saved[id] === null) original = null;
      else {
        const value = { ...saved[id] };
        if (value.asset) { value.prefabId = value.prefabId ?? catalogAsset(value.asset)?.id; delete value.size; }
        validateSceneValue(value); original = value;
      }
    }
    const current = model.register(location.id, id, born ? null : original);
    bindings.push(binding); apply(binding, current); return binding;
  }
  function propBinding(location, bindings, object, born = false) {
    const body = object.userData.sceneEditBody, radius = body?.radius;
    const inferredAsset = object.userData.sceneEditAsset ?? object.userData.sceneEditId?.match(/^scenery:(.+):\d+$/)?.[1];
    const category = object.userData.sceneEditCategory ?? catalogAsset(inferredAsset)?.category ?? 'ordinary';
    return bind(location, bindings, object.userData.sceneEditId, object.userData.sceneEditLabel, object, {
      body, asset: object.userData.sceneEditAsset, size: object.userData.sceneEditSize,
      prefabId: object.userData.sceneEditPrefabId ?? catalogAsset(object.userData.sceneEditAsset)?.id,
      category,
      sync() {
        if (body) { body.x = object.position.x; body.z = object.position.z; body.radius = radius * Math.max(object.scale.x, object.scale.z); }
        object.userData.sceneEditSync?.();
      },
      onDelete(deleted) { object.userData.sceneEditDelete?.(deleted); },
    }, born);
  }
  function bindGroundDetails(location, bindings) {
    const meshes = [];
    location.sceneGroup.traverse(mesh => {
      const entries = mesh.userData?.sceneEditGroundEntries;
      if (!mesh.isInstancedMesh || !entries?.length) return;
      meshes.push(mesh);
      for (const entry of entries) {
        const proxy = new THREE.Object3D();
        proxy.userData.sceneEditGroundProxy = true;
        proxy.position.set(entry.position?.[0] ?? 0, entry.position?.[1] ?? 0, entry.position?.[2] ?? 0);
        proxy.rotation.set(...(entry.rotation ?? [0, 0, 0]));
        proxy.scale.set(...(entry.scale ?? [entry.width, entry.height, 1]));
        location.sceneGroup.add(proxy);
        const instanceMatrix = new THREE.Matrix4();
        const binding = bind(location, bindings, entry.id, entry.label, proxy, {
          groundInstance: true, mesh,
          onDelete(deleted) {
            if (deleted) for (const instanceId of entry.instanceIds) mesh.setMatrixAt(instanceId, instanceMatrix.makeScale(0, 0, 0));
            else this.sync();
            mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
          },
          sync() {
            proxy.updateWorldMatrix(true, false); mesh.parent.updateWorldMatrix(true, false);
            const inverseParent = new THREE.Matrix4().copy(mesh.parent.matrixWorld).invert();
            const base = new THREE.Matrix4().multiplyMatrices(inverseParent, proxy.matrixWorld);
            const position = new THREE.Vector3(), baseRotation = new THREE.Quaternion(), scale = new THREE.Vector3();
            base.decompose(position, baseRotation, scale);
            for (const [variant, instanceId] of entry.instanceIds.entries()) {
              const rotation = baseRotation.clone();
              if (entry.upright && variant % 2) rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));
              instanceMatrix.compose(position, rotation, scale);
              mesh.setMatrixAt(instanceId, instanceMatrix);
            }
            mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
          },
        });
        for (const instanceId of entry.instanceIds) mesh.userData.sceneEditInstanceBindings.set(instanceId, binding);
      }
    });
    return meshes;
  }
  return {
    model, fog, lighting, terrainStyle, unitPuckColors,
    terrainEdits(id) {
      if (model.has(id, 'terrain')) return model.get(id, 'terrain');
      const value = overrides.locations[id]?.terrain ?? { strokes: [] };
      validateTerrainEdits(value);
      return model.register(id, 'terrain', value);
    },
    prepare(location) {
      sources.set(location.id, { location, data: JSON.parse(JSON.stringify({
        entry: location.entry, arrivals: location.arrivals, exits: location.exits, fogPaths: location.fogPaths,
      })) });
      const savedPaths = overrides.locations[location.id]?.['fog-paths'];
      const fogPaths = savedPaths && fogPathsMatchLocation(savedPaths, location) ? savedPaths : location.fogPaths;
      validateSceneValue(fogPaths, false, true);
      location.fogPaths = model.register(location.id, 'fog-paths', fogPaths);
      location.edgeShade?.updatePaths(location.fogPaths);
      const bindings = [];
      for (const [outputIndex, { exit, marker, shadow, blocked }] of (location.exitVisuals?.markers ?? []).entries()) {
        const proxy = new THREE.Object3D(); proxy.position.set(exit.x, .3, exit.z);
        proxy.rotation.y = marker.rotation.y; proxy.scale.set((exit.halfWidth ?? 2.3) * 2, .6, (exit.halfDepth ?? 1.05) * 2);
        const barrier = location.exitBarriers?.[location.exits.indexOf(exit)];
        bind(location, bindings, `exit:${exit.to}:trigger`, `Выход → ${exit.to} · коллайдер`, proxy, {
          helper: 'trigger', category: 'technical', body: barrier, outputIndex,
          onDelete(deleted) { exit.disabled = deleted; blocked.visible = !deleted && blocked.material.opacity > 0; },
          sync() {
            exit.x = proxy.position.x; exit.z = proxy.position.z;
            exit.dirX = Math.sin(proxy.rotation.y); exit.dirZ = Math.cos(proxy.rotation.y);
            exit.halfWidth = Math.max(.05, proxy.scale.x / 2); exit.halfDepth = Math.max(.05, proxy.scale.z / 2);
            marker.position.set(exit.x, 0, exit.z); marker.rotation.y = proxy.rotation.y;
            blocked.scale.x = Math.max(5, exit.halfWidth * 2 + 1.5);
            if (barrier) Object.assign(barrier, createExitBarrierBodies(location)[location.exits.indexOf(exit)]);
          },
        });
        bind(location, bindings, `exit:${exit.to}:shadow`, `Выход → ${exit.to} · листва`, shadow, { category: 'technical', outputIndex });
      }
      const spawn = (id, label, point, exit) => {
        const object = new THREE.Object3D(); object.position.set(point.x, .2, point.z);
        object.rotation.y = point.rotationY ?? (exit ? Math.atan2(-exit.dirX, -exit.dirZ) : 0);
        const from = id.startsWith('arrival:') ? id.slice(8) : null;
        bind(location, bindings, id, label, object, {
          helper: 'spawn', category: 'technical',
          onDelete(deleted) {
            if (from) { if (deleted) delete location.arrivals[from]; else location.arrivals[from] = point; }
            else location.entry = deleted ? null : point;
          },
          sync() {
            point.x = object.position.x; point.z = object.position.z; point.rotationY = object.rotation.y;
          },
        });
      };
      if (location.entry) spawn('entry', 'Стартовая точка', location.entry);
      for (const [from, point] of Object.entries(location.arrivals ?? {}))
        spawn(`arrival:${from}`, `Вход из ${from}`, point, location.exits.find(exit => exit.to === from));
      location.sceneGroup.traverse(object => { if (object.userData.sceneEditId) propBinding(location, bindings, object); });
      const groundMeshes = bindGroundDetails(location, bindings);
      bindings.groundMeshes = groundMeshes;
      resident.set(location.id, bindings); return bindings;
    },
    async restorePlaced(location, createAsset) {
      const placed = { ...overrides.locations[location.id] };
      for (const change of model.diff().changes) if (change.location === location.id && change.object.startsWith('placed:')) placed[change.object] = change.after;
      for (const { location: id, object, value } of placedTemplates.values()) if (id === location.id && !placed[object]) placed[object] = value;
      for (const [id, saved] of Object.entries(placed)) if (id.startsWith('placed:') && saved) {
        const value = { ...saved };
        const prefabId = value.prefabId ?? catalogAsset(value.asset)?.id;
        value.prefabId = prefabId; delete value.size;
        value.size = catalogPrefab(prefabId)?.size;
        await createAsset(location, id, value);
      }
    },
    add(location, object) {
      const prefabId = object.userData.sceneEditPrefabId ?? catalogAsset(object.userData.sceneEditAsset)?.id;
      const binding = propBinding(location, resident.get(location.id), object, true);
      const value = { ...snapshot(binding), asset: object.userData.sceneEditAsset, prefabId };
      placedTemplates.set(JSON.stringify([location.id, object.userData.sceneEditId]), { location: location.id, object: object.userData.sceneEditId, value });
      model.set(location.id, binding.id, value); apply(binding, value); return binding;
    },
    bindEntity(location, id, label, object, options = {}) {
      const bindings = resident.get(location.id);
      if (!bindings) return null;
      const existing = bindings.find(binding => binding.id === id);
      if (existing) return existing;
      object.userData.sceneEditId = id; object.userData.sceneEditLabel = label;
      object.userData.sceneEditCategory = options.category;
      return bind(location, bindings, id, label, object, options);
    },
    remove(binding) { model.set(binding.location, binding.id, null); apply(binding, null); },
    release(id) {
      const source = sources.get(id);
      if (source) Object.assign(source.location, source.data);
      for (const binding of resident.get(id) ?? []) if (binding.groundInstance) binding.object.removeFromParent();
      sources.delete(id); resident.delete(id);
    },
    graphChanged(location) {
      const source = sources.get(location.id);
      if (source) source.data = JSON.parse(JSON.stringify({
        entry: location.entry, arrivals: location.arrivals, exits: location.exits, fogPaths: location.fogPaths,
      }));
      for (const binding of resident.get(location.id) ?? []) if (Number.isInteger(binding.outputIndex)) {
        const target = location.exits[binding.outputIndex]?.to ?? 'не подключён';
        binding.label = `Выход → ${target} · ${binding.helper === 'trigger' ? 'коллайдер' : 'листва'}`;
      }
      if (model.has(location.id, 'fog-paths')) model.set(location.id, 'fog-paths', location.fogPaths);
    },
    bindings(id) { return resident.get(id) ?? []; },
    instanceMeshes(id) { return resident.get(id)?.groundMeshes ?? []; },
    instanceBindingForHit(hit) { return hit?.object?.userData?.sceneEditInstanceBindings?.get(hit.instanceId) ?? null; },
    hasEdit(location, object) {
      return Object.hasOwn(overrides.locations[location] ?? {}, object)
        || model.diff().changes.some(change => change.location === location && change.object === object);
    },
    change(binding) {
      for (const axis of ['x', 'y', 'z']) binding.object.scale[axis] = Math.max(.001, binding.object.scale[axis]);
      binding.sync?.(); return model.set(binding.location, binding.id, snapshot(binding));
    },
    changeFog(settings) {
      const next = { ...fog, ...settings }; validateSceneValue(next, true);
      Object.assign(fog, next); setFog(fog); return model.set(null, 'fog', { ...fog });
    },
    changeLighting(settings) {
      const next = { ...lighting, ...settings, direction: [...(settings.direction ?? lighting.direction)] };
      validateSceneValue(next, false, false, false, true);
      Object.assign(lighting, next); setLighting(lighting); return model.set(null, 'lighting', { ...lighting, direction: [...lighting.direction] });
    },
    changeTerrainStyle(settings) {
      const next = { ...terrainStyle, ...settings };
      validateSceneValue(next, false, false, false, false, false, true);
      Object.assign(terrainStyle, next); setTerrainStyle(terrainStyle);
      return model.set(null, 'terrain-style', { ...terrainStyle });
    },
    changeUnitPuckColors(settings) {
      const next = { ...unitPuckColors, ...settings };
      validateSceneValue(next, false, false, false, false, false, false, true);
      Object.assign(unitPuckColors, next); setUnitPuckColors(unitPuckColors);
      return model.set(null, 'unit-puck-colors', { ...unitPuckColors });
    },
    prefab(id) { return model.get(null, `prefab:${id}`) ?? null; },
    prefabInstanceCount(id) {
      const keys = new Set();
      for (const [location, bindings] of resident) for (const binding of bindings)
        if (binding.prefabId === id) keys.add(JSON.stringify([location, binding.id]));
      for (const [location, entries] of Object.entries(overrides.locations ?? {})) for (const [object, value] of Object.entries(entries))
        if (object.startsWith('placed:') && (value.prefabId ?? catalogAsset(value.asset)?.id) === id)
          keys.add(JSON.stringify([location, object]));
      for (const { location, object, value } of placedTemplates.values())
        if ((value.prefabId ?? catalogAsset(value.asset)?.id) === id) keys.add(JSON.stringify([location, object]));
      for (const change of model.diff().changes) if (change.object.startsWith('placed:')) {
        if (change.after === null) keys.delete(JSON.stringify([change.location, change.object]));
        else if ((change.after.prefabId ?? catalogAsset(change.after.asset)?.id) === id)
          keys.add(JSON.stringify([change.location, change.object]));
      }
      return keys.size;
    },
    changePrefab(id, settings) {
      const current = model.get(null, `prefab:${id}`);
      if (!current) throw new Error(`Unknown prefab: ${id}`);
      const next = { ...current, ...settings };
      validateSceneValue(next, false, false, false, false, false, false, false, id);
      const changed = model.set(null, `prefab:${id}`, next);
      if (!changed) return false;
      prefabs.set(id, next);
      const definition = catalogPrefab(id), factor = next.size / definition.size;
      for (const bindings of resident.values()) for (const binding of bindings) if (binding.prefabId === id) {
        binding.prefabScale = factor;
        const value = model.get(binding.location, binding.id);
        if (value) apply(binding, value);
      }
      return true;
    },
    changeTerrain(location, edits) {
      validateTerrainEdits(edits);
      const changed = model.set(location.id, 'terrain', edits);
      if (changed) location.terrainEdits = model.get(location.id, 'terrain');
      return changed;
    },
    fogPaths(location) { return model.get(location, 'fog-paths'); },
    changeFogPaths(location, paths) {
      validateSceneValue(paths, false, true);
      const changed = model.set(location.id, 'fog-paths', paths);
      if (changed) {
        location.fogPaths = model.get(location.id, 'fog-paths');
        location.edgeShade?.updatePaths(location.fogPaths);
      }
      return changed;
    },
    sync() {
      Object.assign(fog, model.get(null, 'fog')); setFog(fog);
      Object.assign(lighting, model.get(null, 'lighting')); setLighting(lighting);
      Object.assign(terrainStyle, model.get(null, 'terrain-style')); setTerrainStyle(terrainStyle);
      Object.assign(unitPuckColors, model.get(null, 'unit-puck-colors')); setUnitPuckColors(unitPuckColors);
      for (const item of ASSET_CATALOG) if (item.asset && item.kind !== 'reference') {
        const settings = model.get(null, `prefab:${item.id}`);
        if (settings) prefabs.set(item.id, settings);
      }
      for (const [id, source] of sources) {
        source.location.fogPaths = model.get(id, 'fog-paths');
        source.location.edgeShade?.updatePaths(source.location.fogPaths);
        if (model.has(id, 'terrain')) source.location.terrainEdits = model.get(id, 'terrain');
      }
      for (const bindings of resident.values()) for (const binding of bindings) {
        if (binding.prefabId) {
          const prefab = prefabs.get(binding.prefabId), definition = catalogPrefab(binding.prefabId);
          if (prefab && definition) binding.prefabScale = prefab.size / definition.size;
        }
        apply(binding, model.get(binding.location, binding.id));
      }
    },
  };
}
