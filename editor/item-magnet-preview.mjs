import { createItemIconFlight, itemIconFlightPosition, itemMagnetWorldPosition, normalizeItemMagnetSettings } from '../game/item-magnet.mjs?v=1';

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ state >>> 15, state | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
/** Stable random samples inside the pickup disk, including its rim. */
export function createItemMagnetPreviewSamples(count = 12, seed = 1937) {
  const random = seededRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    const angle = (index + random() * .6) / count * Math.PI * 2;
    const radius = index % 3 === 0 ? 1 : Math.sqrt(.08 + random() * .92);
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, seed: Math.floor(random() * 0xffffffff) };
  });
}
export function itemMagnetPreviewWorldFlight(sample, settings) {
  const normalized = normalizeItemMagnetSettings(settings);
  return { from: { x: sample.x * normalized.radius, y: 0, z: sample.z * normalized.radius },
    arc: normalized.worldArc, duration: normalized.worldDuration };
}
/** The normal paused-editor frame loop drives both the world and screen passes. */
export function createItemMagnetPreview({ THREE, scene, camera, canvas, getPlayerPosition, getSettings }) {
  const root = new THREE.Group(); root.name = 'item-magnet-preview'; root.visible = false;
  root.userData.cqRenderDebugExclude = true; scene.add(root);
  const overlay = document.createElement('canvas'); overlay.id = 'se-item-magnet-preview';
  overlay.setAttribute('aria-hidden', 'true'); overlay.hidden = true; document.body.append(overlay);
  const context = overlay.getContext('2d');
  const bagMirror = document.createElement('div'); bagMirror.id = 'se-item-magnet-backpack';
  bagMirror.setAttribute('aria-hidden', 'true'); bagMirror.hidden = true;
  const bagArt = document.querySelector('#inventory-toggle svg, #inventory-toggle img')?.cloneNode(true);
  if (bagArt) { bagArt.removeAttribute('id'); bagArt.querySelectorAll('[id]').forEach(node => node.removeAttribute('id')); bagMirror.append(bagArt); }
  document.body.append(bagMirror);
  const samples = createItemMagnetPreviewSamples(12, Math.floor(Math.random() * 0xffffffff));
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x74f5e4, transparent: true, opacity: .72, depthTest: false, depthWrite: false });
  const ringMaterial = new THREE.LineBasicMaterial({ color: 0xffcb75, transparent: true, opacity: .95, depthTest: false, depthWrite: false });
  const dotMaterial = new THREE.MeshBasicMaterial({ color: 0x94ed97, depthTest: false, depthWrite: false });
  const movingMaterial = new THREE.MeshBasicMaterial({ color: 0xffd275, depthTest: false, depthWrite: false });
  const pointGeometry = new THREE.SphereGeometry(.085, 8, 6);
  const ringPositions = new Float32Array(96 * 3), ringGeometry = new THREE.BufferGeometry();
  ringGeometry.setAttribute('position', new THREE.BufferAttribute(ringPositions, 3));
  const ring = new THREE.LineLoop(ringGeometry, ringMaterial); ring.renderOrder = 10001; root.add(ring);
  const target = { x: 0, y: .92, z: 0 };
  const records = samples.map(sample => {
    const positions = new Float32Array(49 * 3), geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const line = new THREE.Line(geometry, lineMaterial); line.renderOrder = 10002;
    const start = new THREE.Mesh(pointGeometry, dotMaterial), moving = new THREE.Mesh(pointGeometry, movingMaterial);
    start.renderOrder = moving.renderOrder = 10003; moving.scale.setScalar(1.35);
    root.add(line, start, moving);
    return { sample, line, start, moving, positions, flight: null, icon: null };
  });
  let control = null, clock = 0, signature = '', settings, screenFrom = null, screenTo = null;
  const project = (x, y, z) => {
    const point = new THREE.Vector3(x, y, z).project(camera), rect = canvas.getBoundingClientRect();
    return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2, depth: point.z };
  };
  function setControl(next) {
    if (!control && next) clock = 0;
    control = next; root.visible = Boolean(next); overlay.hidden = bagMirror.hidden = !next; overlay.dataset.control = next ?? '';
    document.body.classList.toggle('se-item-magnet-previewing', Boolean(next));
  }
  function rebuildWorld() {
    ring.visible = settings.radius > 0;
    for (let index = 0; index < 96; index++) {
      const angle = index / 96 * Math.PI * 2;
      ringPositions[index * 3] = Math.cos(angle) * settings.radius;
      ringPositions[index * 3 + 1] = .055;
      ringPositions[index * 3 + 2] = Math.sin(angle) * settings.radius;
    }
    ringGeometry.attributes.position.needsUpdate = true; ringGeometry.computeBoundingSphere();
    for (const record of records) {
      record.flight = itemMagnetPreviewWorldFlight(record.sample, settings);
      record.line.visible = record.start.visible = settings.radius > 0;
      record.start.position.set(record.flight.from.x, .055, record.flight.from.z);
      for (let index = 0; index <= 48; index++) {
        const point = itemMagnetWorldPosition(record.flight, index / 48, target);
        record.positions.set([point.x, point.y, point.z], index * 3);
      }
      record.line.geometry.attributes.position.needsUpdate = true; record.line.geometry.computeBoundingSphere();
    }
  }
  function diamond(x, y, size, color) {
    context.fillStyle = color; context.beginPath(); context.moveTo(x, y - size); context.lineTo(x + size, y);
    context.lineTo(x, y + size); context.lineTo(x - size, y); context.closePath(); context.fill();
    context.strokeStyle = '#fff4cf'; context.lineWidth = 1; context.stroke();
  }
  function update(dt) {
    if (!control) return;
    settings = normalizeItemMagnetSettings(getSettings());
    const nextSignature = JSON.stringify(settings);
    if (nextSignature !== signature) { signature = nextSignature; rebuildWorld(); }
    const player = getPlayerPosition(); root.position.set(player.x, player.y ?? 0, player.z);
    clock += dt;
    const age = clock % (settings.worldDuration + settings.iconDuration + .6);
    const worldT = Math.min(1, age / settings.worldDuration);
    for (const record of records) {
      const point = itemMagnetWorldPosition(record.flight, worldT, target);
      record.moving.position.set(point.x, point.y, point.z);
      record.moving.visible = age < settings.worldDuration && settings.radius > 0;
      record.moving.scale.setScalar(1.35 * Math.max(.001, point.scale));
    }
    const width = innerWidth, height = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (overlay.width !== Math.round(width * dpr) || overlay.height !== Math.round(height * dpr)) {
      overlay.width = Math.round(width * dpr); overlay.height = Math.round(height * dpr);
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0); context.clearRect(0, 0, width, height);
    camera.updateMatrixWorld(); screenFrom = project(player.x, (player.y ?? 0) + .2, player.z);
    const bag = document.querySelector('#inventory-toggle'), bagRect = bag?.getBoundingClientRect();
    if (!bagRect || screenFrom.depth < -1 || screenFrom.depth > 1) { bagMirror.hidden = true; return; }
    bagMirror.hidden = false;
    Object.assign(bagMirror.style, { left: `${bagRect.left}px`, top: `${bagRect.top}px`, width: `${bagRect.width}px`, height: `${bagRect.height}px` });
    screenTo = { x: bagRect.left + bagRect.width / 2, y: bagRect.top + bagRect.height / 2 };
    const screenHighlighted = control.startsWith('icon'); lineMaterial.opacity = screenHighlighted ? .45 : .78;
    context.lineWidth = screenHighlighted ? 1.6 : 1.2;
    for (const record of records) {
      record.icon = createItemIconFlight(screenFrom, screenTo, { duration: settings.iconDuration, arc: settings.iconArc,
        random: seededRandom(record.sample.seed) });
      context.strokeStyle = screenHighlighted ? '#ffcb7599' : '#ffcb7555';
      context.lineWidth = screenHighlighted ? 1.6 : 1.2;
      context.beginPath(); context.moveTo(screenFrom.x, screenFrom.y);
      context.quadraticCurveTo(record.icon.control.x, record.icon.control.y, screenTo.x, screenTo.y); context.stroke();
      const iconAge = age - settings.worldDuration;
      if (iconAge >= 0 && iconAge < settings.iconDuration) {
        const point = itemIconFlightPosition(record.icon, iconAge / settings.iconDuration);
        context.globalAlpha = point.alpha; diamond(point.x, point.y, 6 * point.scale, '#edbb66'); context.globalAlpha = 1;
      }
    }
    context.strokeStyle = '#76f5e7'; context.lineWidth = 2; context.beginPath(); context.arc(screenFrom.x, screenFrom.y, 6, 0, Math.PI * 2); context.stroke();
    context.fillStyle = '#20232bdf'; context.beginPath(); context.arc(screenTo.x, screenTo.y, bagRect.width * .55, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#ffcb75'; context.beginPath(); context.arc(screenTo.x, screenTo.y, bagRect.width * .55, 0, Math.PI * 2); context.stroke();
    context.font = 'bold 12px system-ui'; context.textAlign = 'center'; context.lineWidth = 4; context.strokeStyle = '#20232b'; context.fillStyle = '#fff0ce';
    const label = `${settings.radius.toFixed(1)} м  ·  ${settings.worldDuration.toFixed(2)} с → игрок → ${settings.iconDuration.toFixed(2)} с → рюкзак`;
    context.strokeText(label, screenFrom.x, screenFrom.y + 28); context.fillText(label, screenFrom.x, screenFrom.y + 28);
  }
  return { setControl, update,
    inspect() { return { active: Boolean(control), control, radius: settings?.radius, worldDuration: settings?.worldDuration,
      worldArc: settings?.worldArc, iconArc: settings?.iconArc,
      iconDuration: settings?.iconDuration, player: root.position.toArray(), screenFrom, screenTo, clock,
      ringRadius: Math.hypot(ringPositions[0], ringPositions[2]),
      worldPeak: Math.max(0, ...records.flatMap(record => Array.from(record.positions).filter((_, index) => index % 3 === 1))),
      worldStarts: records.filter(record => record.flight).map(record => ({ ...record.flight.from })),
      iconControls: records.filter(record => record.icon).map(record => ({ ...record.icon.control })) }; },
  };
}
