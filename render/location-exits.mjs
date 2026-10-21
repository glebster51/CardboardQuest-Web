function makePortalTexture(THREE) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  context.save(); context.translate(128, 128); context.scale(1, .68);
  const depth = context.createRadialGradient(0, 0, 8, 0, 0, 126);
  depth.addColorStop(0, 'rgba(2,3,9,.99)'); depth.addColorStop(.52, 'rgba(5,5,17,.98)');
  depth.addColorStop(.76, 'rgba(10,11,28,.86)'); depth.addColorStop(.92, 'rgba(25,24,43,.42)');
  depth.addColorStop(1, 'rgba(25,24,43,0)');
  context.fillStyle = depth; context.beginPath(); context.arc(0, 0, 126, 0, Math.PI * 2); context.fill();
  context.strokeStyle = 'rgba(97,88,135,.34)'; context.lineWidth = 3;
  for (let ring = 0; ring < 3; ring++) {
    context.beginPath(); context.ellipse(0, 0, 30 + ring * 25, 9 + ring * 10, 0, .12, Math.PI * .88); context.stroke();
  }
  context.restore();
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

function makeGateTexture(THREE) {
  const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 192;
  const context = canvas.getContext('2d');
  const x = 12, y = 10, width = 360, height = 172;
  context.beginPath(); context.roundRect(x, y, width, height, 12);
  context.fillStyle = '#30221d'; context.fill(); context.lineWidth = 8; context.strokeStyle = '#17151a'; context.stroke();
  const plankWidth = width / 7;
  for (let index = 0; index < 7; index++) {
    const px = x + 5 + index * plankWidth, pw = plankWidth - 3;
    const shade = index % 2 ? '#805735' : '#95653d';
    context.fillStyle = shade; context.fillRect(px, y + 5, pw, height - 10);
    context.fillStyle = 'rgba(30,19,18,.38)'; context.fillRect(px + pw - 3, y + 7, 3, height - 14);
    context.strokeStyle = 'rgba(223,174,107,.28)'; context.lineWidth = 2;
    for (let grain = 0; grain < 2; grain++) {
      const gx = px + 9 + grain * 13;
      context.beginPath(); context.moveTo(gx, y + 17); context.bezierCurveTo(gx - 5, 70, gx + 7, 120, gx, y + height - 16); context.stroke();
    }
  }
  context.lineCap = 'round'; context.lineJoin = 'round';
  context.strokeStyle = '#33241e'; context.lineWidth = 24;
  for (const yy of [y + 34, y + height - 34]) { context.beginPath(); context.moveTo(x + 8, yy); context.lineTo(x + width - 8, yy); context.stroke(); }
  context.strokeStyle = '#b18a56'; context.lineWidth = 7;
  context.beginPath(); context.moveTo(x + 20, y + height - 47); context.lineTo(x + width - 20, y + 47); context.stroke();
  context.beginPath(); context.moveTo(x + 20, y + 47); context.lineTo(x + width - 20, y + height - 47); context.stroke();
  context.fillStyle = '#d8bd82'; context.strokeStyle = '#48392b'; context.lineWidth = 4;
  for (const [px, py] of [[x + 19, y + 22], [x + width - 19, y + 22], [x + 19, y + height - 22], [x + width - 19, y + height - 22]]) {
    context.beginPath(); context.arc(px, py, 7, 0, Math.PI * 2); context.fill(); context.stroke();
  }
  context.fillStyle = '#cbb17a'; context.strokeStyle = '#372a22'; context.lineWidth = 6;
  context.beginPath(); context.roundRect(161, 70, 62, 54, 10); context.fill(); context.stroke();
  context.fillStyle = '#4b3329'; context.beginPath(); context.arc(192, 96, 7, 0, Math.PI * 2); context.fill();
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

function makeArrowShape(THREE) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -.78); shape.lineTo(-.52, -.12); shape.lineTo(-.2, -.12);
  shape.lineTo(-.2, .62); shape.lineTo(.2, .62); shape.lineTo(.2, -.12);
  shape.lineTo(.52, -.12); shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/** Add an unmistakable open/closed transition marker at every authored exit. */
export function createLocationExitVisuals({ THREE, location, locked }) {
  const root = new THREE.Group(); root.name = `location-exits-${location.id}`;
  const portalMaterial = new THREE.MeshBasicMaterial({ map: makePortalTexture(THREE), transparent: true,
    opacity: locked ? .58 : .96, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const gateMaterial = new THREE.MeshBasicMaterial({ map: makeGateTexture(THREE), transparent: true,
    opacity: locked ? 1 : 0, alphaTest: .04, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const arrowOutlineMaterial = new THREE.MeshBasicMaterial({ color: 0x201a21, transparent: true,
    opacity: locked ? .32 : .78, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xf2dba2, transparent: true,
    opacity: locked ? .2 : .98, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const floor = new THREE.PlaneGeometry(1, 1), gateGeometry = new THREE.PlaneGeometry(1, 1);
  const arrowGeometry = makeArrowShape(THREE), markers = [];
  for (const exit of location.exits ?? []) {
    const radius = Math.hypot(exit.x, exit.z) || 1;
    const dx = exit.dirX ?? exit.x / radius, dz = exit.dirZ ?? exit.z / radius;
    const width = (exit.halfWidth ?? 2.3) * 2;
    const marker = new THREE.Group(); marker.position.set(exit.x, 0, exit.z); marker.rotation.y = Math.atan2(dx, dz);
    const portal = new THREE.Mesh(floor, portalMaterial);
    portal.rotation.x = -Math.PI / 2; portal.scale.set(width + .6, 5.3, 1);
    portal.position.set(0, .027, 1.7); portal.renderOrder = 1; marker.add(portal);
    const arrowOutline = new THREE.Mesh(arrowGeometry, arrowOutlineMaterial);
    arrowOutline.rotation.x = -Math.PI / 2; arrowOutline.scale.set(1.52, 1.52, 1);
    arrowOutline.position.set(0, .036, -.55); arrowOutline.renderOrder = 2; marker.add(arrowOutline);
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.rotation.x = -Math.PI / 2; arrow.scale.set(1.2, 1.2, 1);
    arrow.position.set(0, .043, -.55); arrow.renderOrder = 3; marker.add(arrow);
    const gate = new THREE.Mesh(gateGeometry, gateMaterial);
    gate.scale.set(width + .35, 1.9, 1); gate.position.set(0, .95, -.28);
    gate.renderOrder = 5; gate.visible = Boolean(locked); marker.add(gate);
    marker.name = `exit-${exit.to}`; root.add(marker); markers.push({ gate });
  }
  location.sceneGroup.add(root);
  return { root, markers, portalMaterial, gateMaterial, arrowOutlineMaterial, arrowMaterial,
    locked: Boolean(locked), gateOpacity: locked ? 1 : 0 };
}

/** Fade the barriers open or shut while keeping the ground exit cue readable. */
export function updateLocationExitLock(system, locked, dt = 0) {
  if (!system) return false;
  const changed = system.locked !== Boolean(locked);
  system.locked = Boolean(locked);
  const targetOpacity = system.locked ? 1 : 0;
  const step = Math.max(0, dt) * (system.locked ? 4 : 2.5);
  system.gateOpacity += Math.sign(targetOpacity - system.gateOpacity) * Math.min(Math.abs(targetOpacity - system.gateOpacity), step);
  system.gateMaterial.opacity = system.gateOpacity;
  system.portalMaterial.opacity = system.locked ? .62 : .96;
  system.arrowOutlineMaterial.opacity = system.locked ? .4 : .78;
  system.arrowMaterial.opacity = system.locked ? .26 : .98;
  for (const marker of system.markers) marker.gate.visible = system.gateOpacity > .015;
  return changed;
}
