import { readTransform } from './edit-model.mjs?v=136';
import { ASSET_CATALOG } from './asset-catalog.mjs?v=4';
import { createRenderDebugModes } from './render-debug-modes.mjs?v=1';
import { applyTerrainSculptDab, terrainBrushSpacing, terrainTargetHeightAt } from '../game/terrain-sculpt.mjs?v=2';

const editable = target => target instanceof HTMLElement && (target.matches('input,textarea') || target.isContentEditable);

/** Desktop editor. Loaded controls stay dormant until the physical ~ / Ё key is pressed. */
export function installSceneEditor({ THREE, scene, camera, renderer, registry, getLocation, canOpen, onActiveChange, createAsset, rebuildTerrain,
  getCampaignGraphData, onCampaignGraphChange, getScreenEffects = () => ({ ssao: true, tiltShift: true }), onScreenEffectsChange = () => {} }) {
  const canvas = renderer.domElement, model = registry.model;
  let active = false, opening = false, controls, panel, bindings = [], selected = null, helperRoot, box, pathRoot, renderDebug;
  let pathMode = false, pathHandles = [], pathLines = [], hoveredPath = null, activePath = null;
  let terrainOpen = false, terrainBrush, terrainMode = 'level', terrainRadius = 5, terrainStrength = .45;
  let terrainStroke = null, terrainMap = null, terrainEdits = null, terrainLast = null, terrainStrokeChanged = false, terrainTimer = 0;
  let terrainRebuildPending = false, terrainRebuildTask = null;
  let campaignGraphEditor = null, graphOpen = false;
  let originalCamera, pointerStart = null, right = false, middle = false, lastPointer = null;
  let yaw = 0, pitch = 0, copyPending = null, copying = false, speed = 12;
  const keys = new Set(), focusPoint = new THREE.Vector3(), direction = new THREE.Vector3();
  const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
  const ui = {};
  const addJobs = new Set();
  const objectLabels = new Map(), locationLabels = new Map();
  const sceneKey = (location, object) => JSON.stringify([location, object]);
  function rememberBindings(location) {
    locationLabels.set(location.id, location.title);
    for (const binding of registry.bindings(location.id)) objectLabels.set(sceneKey(binding.location, binding.id), binding.label);
  }
  function describeChange(change) {
    const { location, object } = change;
    const place = location ? locationLabels.get(location) ?? location : '';
    let label = objectLabels.get(sceneKey(location, object))
      ?? bindings.find(binding => binding.location === location && binding.id === object)?.label;
    if (!label) {
      if (object === 'fog') label = 'Настройки тумана';
      else if (object === 'lighting') label = 'Освещение';
      else if (object === 'fog-paths') label = 'Линии тумана';
      else if (object === 'terrain') label = 'Рельеф локации';
      else if (object === 'terrain-style') label = 'Цвета кромок террас';
      else if (object === 'campaign-graph') label = 'Граф карты мира';
      else label = object.replace(/^exit:/, 'Выход · ').replace(/^arrival:/, 'Вход из ')
        .replace(/^placed:/, 'Добавленный объект · ').replace(/:/g, ' · ');
    }
    return place ? `${place} · ${label}` : label;
  }
  function refreshChangeList() {
    if (!ui.changes) return;
    const changes = model.diff().changes;
    ui.changes.replaceChildren();
    ui['change-count'].textContent = String(changes.length);
    ui.changes.dataset.empty = String(changes.length === 0);
    if (!changes.length) {
      const empty = document.createElement('span'); empty.className = 'se-change-empty';
      empty.textContent = 'Пока нет изменений'; ui.changes.append(empty); return;
    }
    for (const change of changes) {
      const kind = change.before === null ? 'added' : change.after === null ? 'removed' : 'modified';
      const tag = document.createElement('div'); tag.className = 'se-change-tag'; tag.dataset.kind = kind; tag.setAttribute('role', 'listitem');
      const label = document.createElement('span'); label.className = 'se-change-name'; label.textContent = describeChange(change);
      label.title = label.textContent;
      const revert = document.createElement('button'); revert.type = 'button'; revert.className = 'se-change-revert';
      revert.dataset.revert = sceneKey(change.location, change.object); revert.textContent = '×';
      revert.title = `Откатить: ${label.textContent}`; revert.setAttribute('aria-label', revert.title);
      tag.append(label, revert); ui.changes.append(tag);
    }
  }
  function refreshObjects() {
    ui.objects.replaceChildren(new Option('Выбери объект…', ''));
    for (const binding of bindings) if (model.get(binding.location, binding.id) !== null)
      ui.objects.add(new Option(binding.label, binding.id));
    if (selected && model.get(selected.location, selected.id) === null) select(null);
    ui.objects.value = selected?.id ?? '';
  }
  function deleteSelection() {
    if (!selected || selected.deletable === false) return;
    model.commit(); registry.remove(selected); select(null); refreshObjects(); changed();
  }
  function dropPoint(x, y) {
    const rect = canvas.getBoundingClientRect();
    mouse.set((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2);
    raycaster.setFromCamera(mouse, camera);
    const surfaces = [];
    getLocation().sceneGroup.traverse(object => { if (object.isMesh && /^(terrain|playfield)-top-/.test(object.name)) surfaces.push(object); });
    const hit = raycaster.intersectObjects(surfaces, false)[0];
    return hit?.point ?? raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  }
  async function addAsset(item, x = canvas.clientWidth * .45, y = canvas.clientHeight * .55) {
    const point = dropPoint(x, y); if (!point) return;
    const location = getLocation(), id = `placed:${item.id}:${crypto.randomUUID()}`;
    ui.status.textContent = `Добавляю: ${item.label}…`;
    const task = createAsset(location, id, { asset: item.asset, size: item.size,
      position: [point.x, point.y, point.z], rotation: [0, 0, 0], scale: [1, 1, 1] });
    addJobs.add(task);
    try {
      const object = await task, binding = registry.add(location, object);
      bindings = registry.bindings(location.id); refreshObjects(); select(binding); changed();
    } catch (error) { ui.status.textContent = `Ассет не добавлен: ${error.message}`; }
    finally { addJobs.delete(task); }
  }
  function cameraAngles() {
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    yaw = euler.y; pitch = euler.x;
  }
  function copyFallback(text) {
    const previous = document.activeElement, field = document.createElement('textarea');
    field.value = text; field.style.cssText = 'position:fixed;left:-10000px;top:0';
    document.body.append(field); field.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { /* The visible diff remains available. */ }
    field.remove(); previous?.focus({ preventScroll: true }); return copied;
  }
  async function copyDiff(text) {
    copyPending = text;
    ui.status.dataset.copied = 'pending';
    if (copying) return;
    copying = true;
    try {
      while (copyPending !== null) {
        const next = copyPending; copyPending = null;
        let copied = false;
        try {
          if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(next); copied = true; }
        } catch { /* A browser can require a fresh click; try the legacy user-gesture path. */ }
        if (!copied) copied = copyFallback(next);
        if (copyPending !== null) continue;
        ui.status.textContent = copied ? `Дифф в буфере · ${model.diff().changes.length} правок`
          : 'Буфер недоступен · нажми «Копировать» или выдели дифф';
        ui.status.dataset.copied = String(copied);
      }
    } finally { copying = false; }
  }
  function changed() {
    ui.diff.value = model.text(); ui.count.textContent = String(model.diff().changes.length);
    refreshChangeList();
    try { localStorage.setItem('cardboardquest-editor-last-diff', ui.diff.value); } catch { /* Clipboard and download still work. */ }
    void copyDiff(ui.diff.value);
  }
  function refreshInspector() {
    ui.selected.textContent = selected?.label ?? 'Выбери объект в сцене или списке';
    ui.fields.disabled = !selected;
    panel.querySelector('#se-delete').disabled = !selected || selected.deletable === false;
    if (!selected) return;
    const transform = readTransform(selected.object);
    for (const input of ui.fields.querySelectorAll('input')) {
      const value = transform[input.dataset.property][Number(input.dataset.axis)];
      input.value = Number((input.dataset.property === 'rotation' ? value * 180 / Math.PI : value).toFixed(3));
    }
  }
  function select(binding) {
    model.commit(); selected = binding ?? null;
    if (selected) { controls.attach(selected.object); box.setFromObject(selected.object); box.visible = true; }
    else { controls.detach(); box.visible = false; }
    ui.objects.value = selected?.id ?? ''; refreshInspector();
  }
  function setMode(mode) {
    controls.setMode(mode);
    for (const button of panel.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  }
  function setRenderMode(mode) {
    renderDebug.setMode(mode);
    for (const button of panel.querySelectorAll('[data-render-mode]'))
      button.setAttribute('aria-pressed', String(button.dataset.renderMode === mode));
  }
  function setPathMode(enabled) {
    pathMode = enabled; pathRoot.visible = enabled;
    panel.querySelector('#se-fog-paths').setAttribute('aria-pressed', String(enabled));
    canvas.style.cursor = enabled ? 'crosshair' : '';
    if (enabled) { controls.detach(); box.visible = false; }
    else if (selected) { controls.attach(selected.object); box.setFromObject(selected.object); box.visible = true; }
    ui.pathHint.textContent = enabled ? 'Тропы: наведи на точку и перетащи · жёлтая — Hover · оранжевая — Active'
      : 'Туман строится вдоль линий троп от входов к центру карты.';
  }
  function setPathState(handle, state) {
    if (!handle) return;
    handle.userData.pathState = state;
    handle.material.color.set(state === 'active' ? 0xff805d : state === 'hover' ? 0xffdf70 : 0xd5c5a6);
    handle.scale.setScalar(state === 'active' ? 1.32 : state === 'hover' ? 1.18 : 1);
  }
  function syncFogPathVisuals(paths = registry.fogPaths(getLocation().id)) {
    const center = paths.paths[0]?.points.at(-1) ?? [0, 0];
    for (const handle of pathHandles) {
      const { pathIndex, pointIndex, sharedCenter } = handle.userData.fogPath;
      const point = sharedCenter ? center : paths.paths[pathIndex]?.points[pointIndex];
      if (point) handle.position.set(point[0], .24, point[1]);
    }
    for (const line of pathLines) {
      const points = paths.paths[line.userData.pathIndex]?.points ?? [];
      const positions = line.geometry.attributes.position.array;
      points.forEach(([x, z], index) => { positions[index * 3] = x; positions[index * 3 + 1] = .22; positions[index * 3 + 2] = z; });
      line.geometry.attributes.position.needsUpdate = true; line.geometry.computeBoundingSphere();
    }
  }
  function makeFogPathVisuals(location) {
    for (const child of [...pathRoot.children]) {
      child.traverse(object => { object.geometry?.dispose(); for (const material of [object.material].flat()) material?.dispose(); });
      child.removeFromParent();
    }
    pathHandles = []; pathLines = []; hoveredPath = activePath = null;
    const paths = registry.fogPaths(location.id);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xd7c7ff, transparent: true, opacity: .92, depthTest: false });
    paths.paths.forEach((path, pathIndex) => {
      const positions = new Float32Array(path.points.length * 3);
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const line = new THREE.Line(geometry, lineMaterial); line.renderOrder = 10004; line.userData.pathIndex = pathIndex;
      pathRoot.add(line); pathLines.push(line);
      path.points.slice(0, -1).forEach((_, pointIndex) => {
        const handle = new THREE.Mesh(new THREE.SphereGeometry(.29, 14, 10), new THREE.MeshBasicMaterial({ color: 0xd5c5a6, depthTest: false, depthWrite: false }));
        handle.renderOrder = 10005; handle.userData.fogPath = { pathIndex, pointIndex, sharedCenter: false };
        pathRoot.add(handle); pathHandles.push(handle);
      });
    });
    if (paths.paths.length) {
      const handle = new THREE.Mesh(new THREE.SphereGeometry(.34, 16, 12), new THREE.MeshBasicMaterial({ color: 0xd5c5a6, depthTest: false, depthWrite: false }));
      handle.renderOrder = 10006; handle.userData.fogPath = { pathIndex: 0, pointIndex: paths.paths[0].points.length - 1, sharedCenter: true };
      pathRoot.add(handle); pathHandles.push(handle);
    }
    syncFogPathVisuals(paths);
  }
  function pathHandleAt(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    raycaster.setFromCamera(mouse, camera); scene.updateMatrixWorld(true);
    return raycaster.intersectObjects(pathHandles, false)[0]?.object ?? null;
  }
  function dragFogPath(event) {
    const point = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -.24), new THREE.Vector3());
    if (!point || !activePath) return;
    const location = getLocation(), paths = registry.fogPaths(location.id);
    const { pathIndex, pointIndex, sharedCenter } = activePath.userData.fogPath;
    const next = JSON.parse(JSON.stringify(paths));
    if (sharedCenter) for (const path of next.paths) path.points[path.points.length - 1] = [point.x, point.z];
    else next.paths[pathIndex].points[pointIndex] = [point.x, point.z];
    registry.changeFogPaths(location, next); syncFogPathVisuals(next); changed();
  }
  function terrainPointAt(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    raycaster.setFromCamera(mouse, camera); scene.updateMatrixWorld(true);
    const surfaces = [];
    getLocation().sceneGroup.traverse(object => {
      if (object.isMesh && /^(terrain|playfield)-top-/.test(object.name)) surfaces.push(object);
    });
    const hit = raycaster.intersectObjects(surfaces, false)[0];
    if (hit) return hit.point;
    return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  }
  function walkableAt(x, z, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside;
  }
  function updateTerrainBrush(point) {
    if (!terrainBrush || !point) { if (terrainBrush) terrainBrush.visible = false; return; }
    if (terrainBrush.userData.radius !== terrainRadius) {
      terrainBrush.geometry.dispose();
      terrainBrush.geometry = new THREE.RingGeometry(terrainRadius * .94, terrainRadius, 64);
      terrainBrush.userData.radius = terrainRadius;
    }
    const surfaceHeight = getLocation().terrainHeightMap?.sample(point.x, point.z) ?? point.y;
    terrainBrush.position.set(point.x, surfaceHeight + .045, point.z);
    terrainBrush.userData.world = { x: point.x, y: point.y, z: point.z };
    terrainBrush.material.color.set(terrainMode === 'level' ? 0x9deaa9 : terrainMode === 'raise' ? 0xffc56a : 0x82c9f5);
    terrainBrush.visible = true;
  }
  function requestTerrainRebuild() {
    if (!rebuildTerrain) return;
    terrainRebuildPending = true;
    if (terrainRebuildTask) return;
    terrainRebuildTask = (async () => {
      while (terrainRebuildPending) {
        terrainRebuildPending = false;
        const location = getLocation();
        await rebuildTerrain(location, registry.terrainEdits(location.id));
      }
    })().catch(error => { if (ui.status) ui.status.textContent = `Рельеф не обновлён: ${error.message}`; })
      .finally(() => { terrainRebuildTask = null; if (terrainRebuildPending) requestTerrainRebuild(); });
  }
  function scheduleTerrainPreview() {
    if (terrainTimer || !terrainStroke) return;
    terrainTimer = setTimeout(() => {
      terrainTimer = 0;
      const location = getLocation();
      try { registry.changeTerrain(location, terrainEdits); requestTerrainRebuild(); }
      catch (error) { ui.status.textContent = `Слишком длинная кисть: ${error.message}`; }
    }, 180);
  }
  function beginTerrainStroke(event, point) {
    const location = getLocation(), map = location.terrainHeightMap;
    if (!map || !point) return;
    const onWalkableFloor = walkableAt(point.x, point.z, location.walkablePoints);
    if (onWalkableFloor && terrainMode !== 'level') {
      ui.status.textContent = 'Игровой пол остаётся плоским. Рисуй по рельефу за его границей.'; return;
    }
    if (point.x < map.minX || point.z < map.minZ
      || point.x > map.minX + (map.columns - 1) * (map.cellSizeX ?? map.cellSize)
      || point.z > map.minZ + (map.rows - 1) * (map.cellSizeZ ?? map.cellSize)) return;
    terrainEdits = JSON.parse(JSON.stringify(registry.terrainEdits(location.id)));
    if (terrainEdits.strokes.length >= 80) { ui.status.textContent = 'Лимит рельефных мазков достигнут.'; return; }
    terrainMap = { ...map, values: new Float32Array(map.values) };
    const targetHeight = terrainTargetHeightAt(map, point.x, point.z, location.walkablePoints);
    terrainStroke = { mode: terrainMode, radius: terrainRadius, strength: terrainStrength,
      targetHeight, points: [[point.x, point.z]] };
    terrainLast = [point.x, point.z];
    terrainEdits.strokes.push(terrainStroke);
    model.begin();
    terrainStrokeChanged = applyTerrainSculptDab(terrainMap, terrainStroke, point.x, point.z, location.walkablePoints);
    updateTerrainBrush(point); canvas.style.cursor = 'crosshair';
    ui.terrainLevel.textContent = `${targetHeight.toFixed(2)} м`;
    ui.status.textContent = terrainMode === 'level' ? `Выбран уровень ${targetHeight.toFixed(2)} м · веди кисть` : 'Веди кисть по рельефу';
    canvas.setPointerCapture(event.pointerId);
    if (terrainStrokeChanged) scheduleTerrainPreview();
  }
  function continueTerrainStroke(point) {
    if (!terrainStroke || !point) return;
    const location = getLocation(), [lastX, lastZ] = terrainLast;
    const distance = Math.hypot(point.x - lastX, point.z - lastZ);
    const spacing = terrainBrushSpacing(terrainStroke.radius, terrainMap.cellSizeX ?? terrainMap.cellSize);
    const steps = Math.min(256, Math.floor(distance / spacing));
    for (let index = 1; index <= steps; index++) {
      if (terrainStroke.points.length >= 5000) { ui.status.textContent = 'Лимит длины мазка достигнут.'; break; }
      const t = index / steps;
      const x = lastX + (point.x - lastX) * t, z = lastZ + (point.z - lastZ) * t;
      terrainStroke.points.push([x, z]);
      terrainStrokeChanged = applyTerrainSculptDab(terrainMap, terrainStroke, x, z, location.walkablePoints) || terrainStrokeChanged;
    }
    if (steps > 0) terrainLast = [point.x, point.z];
    updateTerrainBrush(point); if (terrainStrokeChanged) scheduleTerrainPreview();
  }
  function finishTerrainStroke() {
    if (!terrainStroke) return;
    clearTimeout(terrainTimer); terrainTimer = 0;
    const location = getLocation();
    if (terrainStrokeChanged) {
      try { registry.changeTerrain(location, terrainEdits); }
      catch (error) { ui.status.textContent = `Мазок не сохранён: ${error.message}`; }
      model.commit(); changed(); requestTerrainRebuild();
    } else model.commit();
    terrainStroke = terrainMap = terrainEdits = terrainLast = null;
    terrainStrokeChanged = false;
    canvas.style.cursor = 'crosshair';
  }
  function setTerrainModeOpen(open) {
    terrainOpen = open; panel.classList.toggle('terrain-open', open);
    panel.querySelector('#se-terrain').setAttribute('aria-pressed', String(open));
    panel.querySelector('#se-terrain-window').hidden = !open;
    if (open) {
      if (pathMode) setPathMode(false);
      controls.detach(); box.visible = false; controls.enabled = false;
      terrainBrush.visible = false; panel.querySelector('#se-inspector')?.classList.add('se-terrain-inspector-hidden');
      panel.querySelector('.se-library')?.classList.add('se-terrain-library-hidden');
      ui.status.textContent = 'Игровой пол защищён; кисть меняет только окружающие картонные слои.';
    } else {
      finishTerrainStroke(); terrainBrush.visible = false; controls.enabled = true;
      panel.querySelector('#se-inspector')?.classList.remove('se-terrain-inspector-hidden');
      panel.querySelector('.se-library')?.classList.remove('se-terrain-library-hidden');
      canvas.style.cursor = '';
    }
  }
  function restoreHistory(action) {
    if (!model[action]()) return;
    registry.sync(); campaignGraphEditor?.sync(); refreshObjects(); refreshInspector(); refreshFog(); refreshLighting(); refreshTerrainStyle(); changed();
    requestTerrainRebuild();
  }
  async function openCampaignGraph() {
    if (graphOpen || !getCampaignGraphData) return;
    if (terrainOpen) setTerrainModeOpen(false);
    if (!campaignGraphEditor) {
      const { createCampaignGraphEditor } = await import('./campaign-graph-editor.mjs?v=2');
      campaignGraphEditor = createCampaignGraphEditor({ model, getData: getCampaignGraphData, changed,
        onGraphChange: onCampaignGraphChange ?? (() => {}), onClose(play) {
          graphOpen = false;
          if (play) { void toggle(); return; }
          if (!active) return;
          const location = getLocation(); clearHelpers();
          bindings = registry.bindings(location.id); rememberBindings(location);
          for (const binding of bindings) if (binding.helper) makeHelper(binding);
          select(null); refreshObjects(); refreshFog(); refreshLighting(); makeFogPathVisuals(location); changed();
        } });
    }
    graphOpen = true; campaignGraphEditor.open(getCampaignGraphData());
  }
  function refreshFog() {
    for (const input of panel.querySelectorAll('[data-fog]')) {
      input.value = registry.fog[input.dataset.fog];
      const output = input.closest('label').querySelector('output');
      if (output) output.value = input.dataset.fog.startsWith('reveal')
        ? `${Number(input.value).toFixed(input.dataset.fog === 'revealNoiseSize' ? 1 : 0)} px`
        : Number(input.value).toFixed(2);
    }
  }
  function refreshLighting() {
    for (const input of panel.querySelectorAll('[data-lighting]')) {
      const key = input.dataset.lighting, directionIndex = key.startsWith('direction.') ? Number(key.split('.')[1]) : -1;
      input.value = directionIndex >= 0 ? registry.lighting.direction[directionIndex] : registry.lighting[key];
      const output = input.closest('label').querySelector('output');
      if (output) output.value = Number(input.value).toFixed(1);
    }
  }
  function refreshTerrainStyle() {
    for (const input of panel.querySelectorAll('[data-terrain-style]')) {
      input.value = registry.terrainStyle[input.dataset.terrainStyle];
      const output = input.closest('label').querySelector('output');
      if (output) output.value = Number(input.value).toFixed(2);
    }
  }
  function focusSelection(all = false) {
    const bounds = all || !selected
      ? new THREE.Box3().setFromPoints(getLocation().walkablePoints.map(point => new THREE.Vector3(point.x, 0, point.z)))
      : new THREE.Box3().setFromObject(selected.object);
    bounds.getCenter(focusPoint);
    const size = bounds.getSize(new THREE.Vector3()), distance = Math.max(4, size.length() * 1.3);
    direction.set(0, 0, 1).applyQuaternion(camera.quaternion);
    camera.position.copy(focusPoint).addScaledVector(direction, distance);
    camera.lookAt(focusPoint); cameraAngles(); camera.updateMatrixWorld();
  }
  function makeHelper(binding) {
    const object = binding.object, trigger = binding.helper === 'trigger', color = trigger ? 0xffb65c : 0x63edcf;
    const geometry = trigger ? new THREE.BoxGeometry(1, 1, 1) : new THREE.ConeGeometry(.36, .8, 12);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: trigger ? .12 : .8, depthTest: false, depthWrite: false });
    const fill = new THREE.Mesh(geometry, material); fill.renderOrder = 10000;
    if (!trigger) { fill.rotation.x = Math.PI / 2; fill.position.z = .35; }
    object.add(fill);
    const line = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color, depthTest: false, depthWrite: false }));
    line.renderOrder = 10001; if (!trigger) { line.rotation.copy(fill.rotation); line.position.copy(fill.position); }
    object.add(line); helperRoot.add(object);
  }
  function clearHelpers() {
    for (const object of [...helperRoot.children]) {
      object.traverse(child => { child.geometry?.dispose(); for (const material of [child.material].flat()) material?.dispose(); });
      object.clear(); object.removeFromParent();
    }
  }
  function makePanel() {
    panel = document.createElement('section'); panel.id = 'scene-editor'; panel.hidden = true;
    panel.setAttribute('aria-label', 'Редактор сцены');
    const screenEffects = getScreenEffects();
    panel.innerHTML = `<div class="se-toolbar">
      <header><div><small>РЕДАКТОР СЦЕНЫ · ИГРА НА ПАУЗЕ</small><strong id="se-location"></strong></div>
        <div class="se-modes" role="group" aria-label="Гизмо">
          <button data-mode="translate" aria-pressed="true" title="W — перемещение"><kbd>W</kbd> Двигать</button>
          <button data-mode="rotate" aria-pressed="false" title="E — вращение"><kbd>E</kbd> Вращать</button>
          <button data-mode="scale" aria-pressed="false" title="R — масштаб"><kbd>R</kbd> Масштаб</button></div>
        <button id="se-undo" title="Ctrl+Z">↶</button><button id="se-redo" title="Ctrl+Y">↷</button>
        <button id="se-overview">Вся локация</button><button id="se-fog-paths" aria-pressed="false" title="Показать и перетаскивать точки троп тумана">Линии тумана</button><button id="se-terrain" aria-pressed="false" title="Открыть мастерскую рельефа">Терраформинг</button><button id="se-level-graph" title="Открыть карту уровней и редактировать связи">Граф карты мира</button><button id="se-reset-all" title="Вернуть все объекты и туман к опубликованной версии">Сброс к релизу</button>
        <button id="se-close" title="~ / Ё">Вернуться в игру ×</button>
      </header></div><aside class="se-controls" aria-label="Параметры сцены">
      <details class="se-module" open><summary>Туман</summary><div class="se-module-content se-fog">
        <label>Начало тумана <output></output><input data-fog="start" aria-label="Начало тумана" type="range" min="-12" max="20" step=".1"></label>
        <label>Конец тумана <output></output><input data-fog="end" aria-label="Конец тумана" type="range" min=".1" max="50" step=".1"></label>
        <label>Тонирование <output></output><input data-fog="tint" aria-label="Тонирование тумана" type="range" min="0" max="1" step=".01"></label>
        <label>Плавность <output></output><input data-fog="curve" aria-label="Плавность тумана" type="range" min=".2" max="4" step=".05"></label>
        <label class="se-color">Цвет тумана<input data-fog="color" aria-label="Цвет тумана" type="color"></label>
        <label>Внутренний радиус просвета <output></output><input data-fog="revealInnerRadius" aria-label="Внутренний радиус просвета игрока" type="range" min="0" max="480" step="1"></label>
        <label>Внешний радиус просвета <output></output><input data-fog="revealOuterRadius" aria-label="Внешний радиус просвета игрока" type="range" min="1" max="640" step="1"></label>
        <label>Размер шума просвета <output></output><input data-fog="revealNoiseSize" aria-label="Размер экранного шума просвета" type="range" min="2" max="32" step=".5"></label>
        <small id="se-path-hint">Туман строится вдоль линий троп от входов к центру карты.</small>
      </div></details><details class="se-module" open><summary>Эффекты изображения</summary><div class="se-module-content se-screen-effects" role="group" aria-label="Скринспейс эффекты">
        <label><input type="checkbox" data-screen-effect="ssao" ${screenEffects.ssao ? 'checked' : ''}> Ambient Occlusion · SSAO</label>
        <label><input type="checkbox" data-screen-effect="tiltShift" ${screenEffects.tiltShift ? 'checked' : ''}> Tilt-shift</label>
        <label>Радиус SSAO <output>${screenEffects.ssaoKernelRadius}</output><input data-effect-setting="ssaoKernelRadius" aria-label="Радиус SSAO" type="range" min="0" max="16" step=".25" value="${screenEffects.ssaoKernelRadius}"></label>
        <label>Порог SSAO <output>${screenEffects.ssaoMinDistance.toFixed(3)}</output><input data-effect-setting="ssaoMinDistance" aria-label="Минимальная дистанция SSAO" type="range" min=".001" max=".05" step=".001" value="${screenEffects.ssaoMinDistance}"></label>
        <label>Дальность SSAO <output>${screenEffects.ssaoMaxDistance.toFixed(2)}</output><input data-effect-setting="ssaoMaxDistance" aria-label="Максимальная дистанция SSAO" type="range" min=".01" max=".5" step=".01" value="${screenEffects.ssaoMaxDistance}"></label>
        <label>Фокус Tilt-shift <output>${screenEffects.tiltShiftFocus.toFixed(2)}</output><input data-effect-setting="tiltShiftFocus" aria-label="Положение полосы фокуса Tilt-shift" type="range" min="0" max="1" step=".01" value="${screenEffects.tiltShiftFocus}"></label>
        <label>Размытие Tilt-shift, px <output>${screenEffects.tiltShiftBlur.toFixed(1)}</output><input data-effect-setting="tiltShiftBlur" aria-label="Сила размытия Tilt-shift" type="range" min="0" max="24" step=".5" value="${screenEffects.tiltShiftBlur}"></label>
        <small>Настройки сохраняются в этом браузере.</small>
      </div></details><details class="se-module"><summary>Освещение</summary><div class="se-module-content se-lighting" role="group" aria-label="Настройки освещения">
        <label>Направление X <output></output><input data-lighting="direction.0" aria-label="Направление света по X" type="range" min="-20" max="20" step=".1"></label>
        <label>Направление Y <output></output><input data-lighting="direction.1" aria-label="Направление света по Y" type="range" min="-20" max="20" step=".1"></label>
        <label>Направление Z <output></output><input data-lighting="direction.2" aria-label="Направление света по Z" type="range" min="-20" max="20" step=".1"></label>
        <label>Сила <output></output><input data-lighting="intensity" aria-label="Сила направленного света" type="range" min="0" max="8" step=".05"></label>
        <label class="se-color">Цвет света<input data-lighting="color" aria-label="Цвет направленного света" type="color"></label>
      </div></details><details class="se-module"><summary>Кромки террас · глобально</summary><div class="se-module-content se-terrain-appearance" role="group" aria-label="Глобальные настройки цвета кромок террас">
        <label>Подсветка верхнего края<input data-terrain-style="edgeColor" aria-label="Цвет подсветки верхней кромки рельефа" type="color"></label>
        <label>Сила <output></output><input data-terrain-style="edgeStrength" aria-label="Сила подсветки кромки" type="range" min="0" max="1" step=".01"></label>
        <label>Ширина <output></output><input data-terrain-style="edgeWidth" aria-label="Ширина полосы подсветки" type="range" min=".03" max=".5" step=".01"></label>
        <label>Тёмное основание<input data-terrain-style="baseColor" aria-label="Цвет затенения основания рельефа" type="color"></label>
        <label>AO-сила <output></output><input data-terrain-style="baseStrength" aria-label="Сила затемнения основания слоя" type="range" min="0" max="1" step=".01"></label>
        <label>AO-ширина <output></output><input data-terrain-style="baseWidth" aria-label="Ширина затемнённой полосы у основания" type="range" min=".03" max=".5" step=".01"></label>
      </div></details><details class="se-module"><summary>Диагностика рендера</summary><div class="se-module-content se-render-mode" role="group" aria-label="Диагностический режим рендера">
        <span>РЕНДЕР</span>
        <button data-render-mode="normal" aria-pressed="true">Обычный</button>
        <button data-render-mode="overdraw" aria-pressed="false" title="Подсвечивает области, где поверх друг друга рисуется геометрия">OVERDRAW</button>
        <button data-render-mode="wireframe" aria-pressed="false" title="Показывает только рёбра треугольников геометрии">Только сетка</button>
        <small id="se-render-hint">Режимы работают только пока открыт редактор.</small>
      </div></details></aside><section id="se-terrain-window" class="se-terrain-window" aria-label="Мастерская рельефа" hidden>
        <header><div><small>МАСТЕРСКАЯ РЕЛЬЕФА · ИГРА НА ПАУЗЕ</small><strong>Терраформинг</strong></div><button id="se-terrain-close" title="Закрыть терраформинг">Готово ×</button></header>
        <nav class="se-terrain-modes" role="group" aria-label="Режим кисти">
          <button data-terrain-mode="level" aria-pressed="true">Выровнять по уровню</button>
          <button data-terrain-mode="raise" aria-pressed="false">Наращивать гору</button>
          <button data-terrain-mode="lower" aria-pressed="false">Углублять</button>
        </nav>
        <div class="se-terrain-controls">
          <label>Размер кисти <output id="se-terrain-radius-value">5.0 м</output><input id="se-terrain-radius" type="range" min="1" max="16" step=".25" value="5" aria-label="Размер кисти"></label>
          <label>Сила <output id="se-terrain-strength-value">0.45</output><input id="se-terrain-strength" type="range" min=".1" max="1.5" step=".05" value=".45" aria-label="Сила кисти"></label>
          <span>Уровень выбора: <b id="se-terrain-level">не выбран</b></span>
          <button id="se-terrain-reset">Сбросить рельеф локации</button>
        </div>
        <small class="se-terrain-help">Щёлкни по рельефу и веди мышь. Для выравнивания по игровой земле начни мазок на ней — это уровень 0 м. «Углублять» может уйти до −8 м, «Наращивать гору» — до 8 м; новые ярусы строятся автоматически. Края кисти мягкие. ПКМ + WASD — летать камерой. Игровая площадка и физика остаются ровными.</small>
      </section>
      <aside class="se-inspector"><div class="se-caption">ОБЪЕКТЫ СЦЕНЫ</div>
        <select id="se-objects" aria-label="Объект сцены"></select><strong id="se-selected"></strong>
        <fieldset id="se-fields"><legend>Трансформация</legend></fieldset>
        <div class="se-row"><button id="se-focus">Приблизить · F</button><button id="se-reset">Сбросить объект</button></div>
        <button id="se-delete" class="se-delete">Удалить сущность · Delete</button>
        <label class="se-speed">Скорость камеры<input id="se-speed" aria-label="Скорость камеры" type="range" min="1" max="40" value="12"></label>
        <p class="se-help">ПКМ + WASD — полёт · Q/E — высота<br>Shift — быстрее · СКМ — сдвиг · колесо — зум<br><i class="se-exit-dot"></i> Выходы <i class="se-spawn-dot"></i> Точки входа</p>
        <div class="se-export"><span>Суммарный дифф <b id="se-count">0</b></span><button id="se-copy">Копировать</button></div>
        <section class="se-change-panel" aria-label="Изменённые объекты">
          <header><span>ОБЪЕКТЫ В ДИФФЕ</span><b id="se-change-count">0</b></header>
          <div id="se-changes" role="list" aria-live="polite"></div>
          <small>Жёлтый — изменён · зелёный — добавлен · красный — удалён</small>
        </section>
        <output id="se-status" aria-live="polite">Изменения автоматически попадут в буфер</output>
        <details><summary>Показать текст диффа</summary><textarea id="se-diff" aria-label="Суммарный дифф сцены" readonly spellcheck="false"></textarea>
        <button id="se-download">Скачать дифф</button></details>
      </aside><section class="se-library" aria-label="Библиотека игровых ассетов"><header><strong>Библиотека игровых ассетов</strong><small>Общий каталог игры · карточки с изображением можно перетащить на сцену</small>
      <input id="se-search" type="search" placeholder="Найти…" aria-label="Поиск в библиотеке"></header>
      <nav id="se-library-tabs" role="tablist" aria-label="Категории библиотеки">
        <button role="tab" data-library-category="ordinary" aria-selected="true">Обычные</button>
        <button role="tab" data-library-category="unique" aria-selected="false">Уникальные</button>
        <button role="tab" data-library-category="technical" aria-selected="false">Технические</button>
        <button role="tab" data-library-category="interactive" aria-selected="false">Интерактивные</button>
        <button role="tab" data-library-category="enemies" aria-selected="false">Враги</button>
        <button role="tab" data-library-category="characters" aria-selected="false">Персонажи</button>
      </nav><div id="se-assets" role="tabpanel"></div></section>`;
    document.body.append(panel);
    new ResizeObserver(entries => panel.style.setProperty('--se-top', `${entries[0].target.getBoundingClientRect().height + 14}px`))
      .observe(panel.querySelector('.se-toolbar'));
    for (const name of ['location', 'objects', 'selected', 'fields', 'status', 'diff', 'count', 'path-hint', 'changes', 'change-count']) ui[name] = panel.querySelector(`#se-${name}`);
    ui.terrainLevel = panel.querySelector('#se-terrain-level');
    for (const [property, label] of [['position', 'Позиция'], ['rotation', 'Поворот °'], ['scale', 'Масштаб']]) {
      const row = document.createElement('div'); row.className = 'se-vector';
      const title = document.createElement('span'); title.textContent = label; row.append(title);
      for (const [axis, name] of ['X', 'Y', 'Z'].entries()) {
        const wrapper = document.createElement('label'); wrapper.dataset.axis = name; wrapper.textContent = name;
        const input = document.createElement('input'); input.type = 'number'; input.step = property === 'rotation' ? '1' : '.1';
        input.dataset.property = property; input.dataset.axis = axis; input.setAttribute('aria-label', `${label} ${name}`);
        input.addEventListener('change', () => {
          if (!selected || !Number.isFinite(input.valueAsNumber)) return;
          selected.object[property][name.toLowerCase()] = input.valueAsNumber * (property === 'rotation' ? Math.PI / 180 : 1);
          registry.change(selected); refreshInspector(); changed();
        });
        wrapper.append(input); row.append(wrapper);
      }
      ui.fields.append(row);
    }
    for (const button of panel.querySelectorAll('[data-mode]')) button.addEventListener('click', () => setMode(button.dataset.mode));
    for (const button of panel.querySelectorAll('[data-render-mode]'))
      button.addEventListener('click', () => setRenderMode(button.dataset.renderMode));
    const emitScreenEffects = () => onScreenEffectsChange({
      ...Object.fromEntries([...panel.querySelectorAll('[data-screen-effect]')].map(control => [control.dataset.screenEffect, control.checked])),
      ...Object.fromEntries([...panel.querySelectorAll('[data-effect-setting]')].map(control => [control.dataset.effectSetting, Number(control.value)])),
    });
    for (const input of panel.querySelectorAll('[data-screen-effect]')) input.addEventListener('change', emitScreenEffects);
    for (const input of panel.querySelectorAll('[data-effect-setting]')) input.addEventListener('input', () => {
      input.previousElementSibling.value = Number(input.value).toFixed(input.step === '.001' ? 3 : 2);
      emitScreenEffects();
    });
    ui.objects.addEventListener('change', () => select(bindings.find(binding => binding.id === ui.objects.value)));
    panel.querySelector('#se-close').addEventListener('click', () => void toggle());
    panel.querySelector('#se-focus').addEventListener('click', () => focusSelection());
    panel.querySelector('#se-overview').addEventListener('click', () => focusSelection(true));
    panel.querySelector('#se-level-graph').addEventListener('click', () => void openCampaignGraph());
    panel.querySelector('#se-fog-paths').addEventListener('click', () => setPathMode(!pathMode));
    panel.querySelector('#se-terrain').addEventListener('click', () => setTerrainModeOpen(!terrainOpen));
    panel.querySelector('#se-terrain-close').addEventListener('click', () => setTerrainModeOpen(false));
    for (const button of panel.querySelectorAll('[data-terrain-mode]')) button.addEventListener('click', () => {
      terrainMode = button.dataset.terrainMode;
      for (const other of panel.querySelectorAll('[data-terrain-mode]'))
        other.setAttribute('aria-pressed', String(other === button));
      updateTerrainBrush(terrainBrush.visible ? terrainBrush.userData.world : null);
    });
    panel.querySelector('#se-terrain-radius').addEventListener('input', event => {
      terrainRadius = Number(event.target.value);
      panel.querySelector('#se-terrain-radius-value').value = `${terrainRadius.toFixed(2)} м`;
      updateTerrainBrush(terrainBrush.visible ? terrainBrush.userData.world : null);
    });
    panel.querySelector('#se-terrain-strength').addEventListener('input', event => {
      terrainStrength = Number(event.target.value);
      panel.querySelector('#se-terrain-strength-value').value = terrainStrength.toFixed(2);
    });
    panel.querySelector('#se-terrain-reset').addEventListener('click', () => {
      const location = getLocation(); model.commit();
      if (model.reset(location.id, 'terrain')) {
        registry.sync(); changed(); requestTerrainRebuild();
        ui.status.textContent = 'Рельеф возвращён к опубликованной версии.';
      }
    });
    panel.querySelector('#se-undo').addEventListener('click', () => restoreHistory('undo'));
    panel.querySelector('#se-redo').addEventListener('click', () => restoreHistory('redo'));
    panel.querySelector('#se-reset-all').addEventListener('click', async () => {
      if (addJobs.size) await Promise.allSettled([...addJobs]);
      model.resetAll(); registry.sync(); campaignGraphEditor?.sync(); refreshObjects(); refreshInspector(); refreshFog(); refreshLighting(); refreshTerrainStyle(); changed();
      requestTerrainRebuild();
    });
    panel.querySelector('#se-reset').addEventListener('click', () => {
      if (selected && model.reset(selected.location, selected.id)) { registry.sync(); refreshObjects(); refreshInspector(); changed(); }
    });
    ui.changes.addEventListener('click', event => {
      const button = event.target.closest('button[data-revert]');
      if (!button) return;
      const [location, object] = JSON.parse(button.dataset.revert);
      model.commit();
      if (!model.reset(location, object)) return;
      registry.sync(); campaignGraphEditor?.sync(); bindings = registry.bindings(getLocation().id);
      refreshObjects(); refreshInspector(); refreshFog(); refreshLighting(); refreshTerrainStyle(); syncFogPathVisuals(); changed();
      if (object === 'terrain') requestTerrainRebuild();
    });
    panel.querySelector('#se-delete').addEventListener('click', deleteSelection);
    let activeLibraryCategory = 'ordinary';
    const renderAssets = () => {
      const list = panel.querySelector('#se-assets'), query = panel.querySelector('#se-search').value.toLocaleLowerCase();
      list.replaceChildren();
      const assets = ASSET_CATALOG.filter(item => item.category === activeLibraryCategory
        && `${item.label} ${item.group ?? ''} ${item.id} ${item.hint ?? ''}`.toLocaleLowerCase().includes(query));
      for (const item of assets) {
        const placeable = Boolean(item.asset) && item.kind !== 'reference';
        const button = document.createElement('button'); button.type = 'button'; button.draggable = placeable;
        button.className = placeable ? '' : 'se-library-reference';
        button.dataset.asset = item.id; button.title = `${item.label}${item.group ? ` · ${item.group}` : ''}`;
        const imagePath = item.asset ?? item.preview;
        if (imagePath) {
          const image = new Image(); image.src = new URL(`../${imagePath}`, import.meta.url).href; image.loading = 'lazy'; image.alt = ''; image.draggable = false;
          button.append(image);
        } else {
          const glyph = document.createElement('b'); glyph.textContent = item.icon ?? '✦'; button.append(glyph);
        }
        const label = document.createElement('span'); label.textContent = item.label; button.append(label);
        if (item.hint) { const hint = document.createElement('small'); hint.textContent = item.hint; button.append(hint); }
        if (placeable) {
          button.addEventListener('click', () => void addAsset(item));
          button.addEventListener('dragstart', event => {
            event.dataTransfer.setData('application/x-cardboardquest-asset', item.id); event.dataTransfer.effectAllowed = 'copy';
          });
        } else button.addEventListener('click', () => {
          if (item.id === 'fog-paths') setPathMode(true);
          else if (item.id === 'level-graph') void openCampaignGraph();
          else ui.status.textContent = item.hint ?? item.label;
        });
        list.append(button);
      }
      if (!list.children.length) {
        const empty = document.createElement('small'); empty.className = 'se-library-empty';
        empty.textContent = 'В каталоге нет совпадений по этому запросу.';
        list.append(empty);
      }
    };
    for (const tab of panel.querySelectorAll('[data-library-category]')) tab.addEventListener('click', () => {
      activeLibraryCategory = tab.dataset.libraryCategory;
      for (const other of panel.querySelectorAll('[data-library-category]')) other.setAttribute('aria-selected', String(other === tab));
      renderAssets();
    });
    panel.querySelector('#se-search').addEventListener('input', renderAssets); ui.renderAssets = renderAssets;
    panel.querySelector('#se-copy').addEventListener('click', () => void copyDiff(model.text()));
    panel.querySelector('#se-speed').addEventListener('input', event => { speed = Number(event.target.value); });
    panel.querySelector('#se-download').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([model.text()], { type: 'application/json' })), link = document.createElement('a');
      link.href = url; link.download = 'cardboardquest-scene-diff.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    for (const input of panel.querySelectorAll('[data-fog]')) {
      input.addEventListener('pointerdown', () => model.begin());
      input.addEventListener('change', () => model.commit());
      input.addEventListener('input', () => {
        const settings = { ...registry.fog, [input.dataset.fog]: input.type === 'color' ? input.value : Number(input.value) };
        if (settings.end - settings.start < .1) {
          if (input.dataset.fog === 'start') settings.end = settings.start + .1;
          else settings.start = settings.end - .1;
        }
        if (settings.revealOuterRadius <= settings.revealInnerRadius) {
          if (input.dataset.fog === 'revealInnerRadius') settings.revealOuterRadius = settings.revealInnerRadius + 1;
          else settings.revealInnerRadius = Math.max(0, settings.revealOuterRadius - 1);
        }
        registry.changeFog(settings); refreshFog(); changed();
      });
    }
    for (const input of panel.querySelectorAll('[data-lighting]')) {
      input.addEventListener('pointerdown', () => model.begin());
      input.addEventListener('change', () => model.commit());
      input.addEventListener('input', () => {
        const key = input.dataset.lighting, settings = { ...registry.lighting, direction: [...registry.lighting.direction] };
        if (key.startsWith('direction.')) settings.direction[Number(key.split('.')[1])] = Number(input.value);
        else settings[key] = input.type === 'color' ? input.value : Number(input.value);
        if (Math.hypot(...settings.direction) < .1) settings.direction[1] = .1;
        registry.changeLighting(settings); refreshLighting(); changed();
      });
    }
    for (const input of panel.querySelectorAll('[data-terrain-style]')) {
      input.addEventListener('pointerdown', () => model.begin());
      input.addEventListener('change', () => model.commit());
      input.addEventListener('input', () => {
        const settings = { ...registry.terrainStyle,
          [input.dataset.terrainStyle]: input.type === 'color' ? input.value : Number(input.value) };
        registry.changeTerrainStyle(settings); refreshTerrainStyle(); changed();
      });
    }
  }
  async function initialize() {
    const { TransformControls } = await import('./vendor/TransformControls.mjs');
    makePanel(); helperRoot = new THREE.Group(); helperRoot.userData.cqRenderDebugExclude = true; scene.add(helperRoot);
    pathRoot = new THREE.Group(); pathRoot.userData.cqRenderDebugExclude = true; pathRoot.visible = false; scene.add(pathRoot);
    terrainBrush = new THREE.Mesh(new THREE.RingGeometry(terrainRadius * .94, terrainRadius, 64),
      new THREE.MeshBasicMaterial({ color: 0x9deaa9, transparent: true, opacity: .9, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
    terrainBrush.rotation.x = -Math.PI / 2; terrainBrush.renderOrder = 10007; terrainBrush.visible = false;
    terrainBrush.userData.cqRenderDebugExclude = true; scene.add(terrainBrush);
    renderDebug = createRenderDebugModes({ THREE, scene, renderer });
    controls = new TransformControls(camera, canvas); controls.enabled = false; controls.setSize(.9);
    scene.add(controls.getHelper());
    controls.getHelper().userData.cqRenderDebugExclude = true;
    box = new THREE.BoxHelper(new THREE.Object3D(), 0xffe09b); box.userData.cqRenderDebugExclude = true;
    box.material.depthTest = false; box.renderOrder = 10003; box.visible = false; scene.add(box);
    controls.addEventListener('mouseDown', () => model.begin());
    controls.addEventListener('objectChange', () => {
      if (!selected) return;
      registry.change(selected); refreshInspector(); changed();
    });
    controls.addEventListener('mouseUp', () => model.commit());
  }
  async function toggle() {
    if (opening || (!active && !canOpen())) return;
    if (active) {
      if (addJobs.size) await Promise.allSettled([...addJobs]);
      active = false; pathMode = false; activePath = hoveredPath = null; pathRoot.visible = false;
      if (terrainOpen) setTerrainModeOpen(false);
      setRenderMode('normal');
      panel.querySelector('#se-fog-paths').setAttribute('aria-pressed', 'false'); canvas.style.cursor = '';
      model.commit(); controls.detach(); controls.enabled = false; box.visible = false;
      controls.dragging = false; pointerStart = null; lastPointer = null;
      clearHelpers(); panel.hidden = true; keys.clear(); right = middle = false;
      bindings = []; selected = null; box.setFromObject(new THREE.Object3D());
      panel.querySelector('#se-assets').replaceChildren();
      document.body.classList.remove('scene-editing');
      camera.position.copy(originalCamera.position); camera.quaternion.copy(originalCamera.quaternion);
      camera.updateMatrixWorld(); onActiveChange(false);
      if (model.diff().changes.length) void copyDiff(model.text());
      return;
    }
    active = true; opening = true; onActiveChange(true);
    originalCamera = { position: camera.position.clone(), quaternion: camera.quaternion.clone() };
    try {
      if (!controls) await initialize();
      setRenderMode('normal');
      const location = getLocation(); bindings = registry.bindings(location.id);
      rememberBindings(location);
      document.body.classList.add('scene-editing'); panel.hidden = false; helperRoot.visible = true;
      ui.renderAssets();
      ui.location.textContent = location.title;
      for (const binding of bindings) {
        if (binding.helper) makeHelper(binding);
      }
      makeFogPathVisuals(location);
      controls.enabled = true; select(null); refreshObjects(); refreshFog(); refreshLighting(); refreshTerrainStyle(); ui.diff.value = model.text(); refreshChangeList(); cameraAngles();
      focusPoint.copy(camera.position).add(direction.set(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(15));
      if (model.diff().changes.length) void copyDiff(model.text());
    } catch (error) {
      active = false; onActiveChange(false); document.body.classList.remove('scene-editing');
      if (panel) panel.hidden = true;
      console.error('Не удалось открыть редактор сцены', error);
      const errorBox = document.querySelector('#error');
      if (errorBox) { errorBox.hidden = false; errorBox.textContent = `Редактор не открылся: ${error.message}. Нажми ~ для повторной попытки.`; }
    } finally { opening = false; }
  }
  addEventListener('keydown', event => {
    if (graphOpen) {
      if (event.code === 'Backquote' && !event.repeat) { event.preventDefault(); event.stopImmediatePropagation(); campaignGraphEditor?.close(); }
      return;
    }
    if (event.code === 'Backquote' && !event.repeat && !editable(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); void toggle(); return; }
    if (!active || editable(event.target)) return;
    keys.add(event.code);
    if (right) { event.preventDefault(); return; }
    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') { event.preventDefault(); restoreHistory(event.shiftKey ? 'redo' : 'undo'); return; }
    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyY') { event.preventDefault(); restoreHistory('redo'); return; }
    const mode = { KeyW: 'translate', KeyE: 'rotate', KeyR: 'scale' }[event.code];
    if (controls && mode) { event.preventDefault(); setMode(mode); }
    if (event.code === 'KeyF' && controls) { event.preventDefault(); focusSelection(); }
    if (event.code === 'Escape' && controls) select(null);
    if (event.code === 'Delete' && controls) { event.preventDefault(); deleteSelection(); }
  }, true);
  addEventListener('keyup', event => keys.delete(event.code));
  addEventListener('blur', () => { keys.clear(); right = middle = false; model.commit(); });
  canvas.addEventListener('pointercancel', () => {
    right = middle = false; pointerStart = lastPointer = null;
    if (terrainStroke) finishTerrainStroke();
    if (activePath) { setPathState(activePath, hoveredPath === activePath ? 'hover' : 'idle'); activePath = null; model.commit(); changed(); }
  });
  canvas.addEventListener('contextmenu', event => { if (active) event.preventDefault(); });
  canvas.addEventListener('pointerdown', event => {
    if (!active || !controls) return;
    if (editable(document.activeElement)) document.activeElement.blur();
    if (terrainOpen && event.button === 0) {
      event.preventDefault(); event.stopImmediatePropagation(); pointerStart = null; lastPointer = null;
      beginTerrainStroke(event, terrainPointAt(event)); return;
    }
    if (pathMode && event.button === 0) {
      const handle = pathHandleAt(event);
      event.preventDefault(); event.stopImmediatePropagation();
      if (handle) {
        activePath = handle; hoveredPath = handle; setPathState(handle, 'active'); model.begin();
        canvas.setPointerCapture(event.pointerId); lastPointer = [event.clientX, event.clientY];
        return;
      }
      pointerStart = null; lastPointer = [event.clientX, event.clientY]; return;
    }
    lastPointer = [event.clientX, event.clientY];
    if (event.button === 2 || event.button === 1) {
      event.preventDefault(); right = event.button === 2; middle = event.button === 1;
      canvas.setPointerCapture(event.pointerId); return;
    }
    if (event.button === 0) pointerStart = { x: event.clientX, y: event.clientY, gizmo: controls.axis !== null };
  }, true);
  canvas.addEventListener('pointermove', event => {
    if (!active) return;
    if (terrainOpen && terrainStroke && (event.buttons & 1)) {
      const point = terrainPointAt(event); continueTerrainStroke(point); return;
    }
    if (terrainOpen && event.buttons === 0) { updateTerrainBrush(terrainPointAt(event)); return; }
    if (pathMode && (activePath || event.buttons === 0)) {
      if (activePath) {
        const rect = canvas.getBoundingClientRect();
        mouse.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
        raycaster.setFromCamera(mouse, camera); dragFogPath(event); return;
      }
      const next = pathHandleAt(event);
      if (next !== hoveredPath) { setPathState(hoveredPath, 'idle'); hoveredPath = next; setPathState(hoveredPath, 'hover'); }
      canvas.style.cursor = hoveredPath ? 'grab' : 'crosshair'; return;
    }
    if (!lastPointer) return;
    const dx = event.clientX - lastPointer[0], dy = event.clientY - lastPointer[1]; lastPointer = [event.clientX, event.clientY];
    if (right) {
      yaw -= dx * .004; pitch = Math.max(-1.55, Math.min(1.55, pitch - dy * .004));
      camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    } else if (middle) {
      const factor = Math.max(2, camera.position.distanceTo(focusPoint)) * 2 * Math.tan(camera.fov * Math.PI / 360) / canvas.clientHeight;
      camera.position.addScaledVector(direction.set(1, 0, 0).applyQuaternion(camera.quaternion), -dx * factor);
      camera.position.addScaledVector(direction.set(0, 1, 0).applyQuaternion(camera.quaternion), dy * factor);
    }
  }, true);
  addEventListener('pointerup', event => {
    if (!active || !controls) return;
    if (terrainOpen && event.button === 0) { finishTerrainStroke(); return; }
    if (event.button === 0 && activePath) {
      setPathState(activePath, hoveredPath === activePath ? 'hover' : 'idle'); activePath = null;
      model.commit(); changed(); canvas.style.cursor = hoveredPath ? 'grab' : 'crosshair'; return;
    }
    if (event.button !== 0) { right = middle = false; lastPointer = null; return; }
    const start = pointerStart; pointerStart = null;
    if (!start || start.gizmo || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5 || event.target !== canvas) return;
    const rect = canvas.getBoundingClientRect();
    mouse.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    raycaster.setFromCamera(mouse, camera); scene.updateMatrixWorld(true);
    const available = bindings.filter(binding => binding.object.visible && model.get(binding.location, binding.id) !== null);
    const helpers = available.filter(binding => binding.helper);
    const hit = raycaster.intersectObjects(helpers.map(binding => binding.object), true)[0]
      ?? raycaster.intersectObjects(available.filter(binding => !binding.helper && !binding.groundInstance).map(binding => binding.object), true)[0]
      ?? raycaster.intersectObjects(registry.instanceMeshes(getLocation().id), false)[0];
    let binding = registry.instanceBindingForHit(hit);
    if (!binding && hit) for (let object = hit.object; object; object = object.parent) {
      binding = bindings.find(item => item.object === object); if (binding) break;
    }
    select(binding);
  });
  canvas.addEventListener('wheel', event => {
    if (!active || !controls) return;
    event.preventDefault(); event.stopImmediatePropagation();
    camera.position.addScaledVector(direction.set(0, 0, -1).applyQuaternion(camera.quaternion), -event.deltaY * speed * .003);
  }, { capture: true, passive: false });
  canvas.addEventListener('dragover', event => {
    if (active && event.dataTransfer.types.includes('application/x-cardboardquest-asset')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }
  });
  canvas.addEventListener('drop', event => {
    if (!active) return;
    const item = ASSET_CATALOG.find(item => item.id === event.dataTransfer.getData('application/x-cardboardquest-asset'));
    if (item) { event.preventDefault(); void addAsset(item, event.clientX, event.clientY); }
  });
  return {
    get active() { return active; },
    get graphOpen() { return graphOpen; },
    inspect() {
      const handles = [];
      const group = controls?.getHelper().children.find(object => object.gizmo)?.gizmo[controls.mode];
      for (const object of group?.children ?? []) if (object.visible && ['X', 'Y', 'Z'].includes(object.name) && object.isMesh) {
        const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).project(camera);
        handles.push({ axis: object.name, x: (center.x + 1) * canvas.clientWidth / 2, y: (1 - center.y) * canvas.clientHeight / 2 });
      }
      return { selected: selected?.id ?? null, mode: controls?.mode ?? 'translate', renderMode: renderDebug?.mode ?? 'normal',
        dragging: controls?.dragging ?? false, handles };
    },
    update(dt) {
      if (!active || !controls) return;
      if (right) {
        const movement = new THREE.Vector3(Number(keys.has('KeyD')) - Number(keys.has('KeyA')), 0,
          Number(keys.has('KeyS')) - Number(keys.has('KeyW'))).applyQuaternion(camera.quaternion);
        movement.y += Number(keys.has('KeyE')) - Number(keys.has('KeyQ'));
        if (movement.lengthSq()) camera.position.addScaledVector(movement.normalize(), speed * dt
          * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3 : 1));
      }
      camera.updateMatrixWorld(); if (selected) box.setFromObject(selected.object);
    },
  };
}
