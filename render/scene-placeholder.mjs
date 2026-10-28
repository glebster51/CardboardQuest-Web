/** Create an editor-only cardboard note for marking art that is still missing. */
export function createScenePlaceholder(THREE, { name = 'Новая идея', size = 2.2 } = {}) {
  const halfWidth = size * .62, halfHeight = size * .43, depth = size * .045;
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth * .82, -halfHeight);
  shape.bezierCurveTo(-halfWidth * 1.08, -halfHeight * .72, -halfWidth, -halfHeight * .25, -halfWidth * .88, halfHeight * .04);
  shape.bezierCurveTo(-halfWidth * .99, halfHeight * .4, -halfWidth * .67, halfHeight * .93, -halfWidth * .32, halfHeight * .84);
  shape.bezierCurveTo(-halfWidth * .02, halfHeight * 1.04, halfWidth * .22, halfHeight * .81, halfWidth * .47, halfHeight * .9);
  shape.bezierCurveTo(halfWidth * .78, halfHeight * .99, halfWidth * .96, halfHeight * .58, halfWidth * .84, halfHeight * .27);
  shape.bezierCurveTo(halfWidth * 1.1, -halfHeight * .08, halfWidth * .91, -halfHeight * .52, halfWidth * .61, -halfHeight * .57);
  shape.bezierCurveTo(halfWidth * .39, -halfHeight * 1.01, halfWidth * .02, -halfHeight * .83, -halfWidth * .22, -halfHeight * .91);
  shape.bezierCurveTo(-halfWidth * .47, -halfHeight * 1.02, -halfWidth * .65, -halfHeight * .75, -halfWidth * .82, -halfHeight);

  const group = new THREE.Group();
  const cardboard = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 5 }),
    new THREE.MeshStandardMaterial({ color: 0x81552f, roughness: 1, side: THREE.DoubleSide }));
  cardboard.castShadow = true; cardboard.receiveShadow = true;
  group.add(cardboard);

  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 440;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#e7ce98'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#35271e'; context.textAlign = 'center'; context.textBaseline = 'middle';
  const normalizedName = String(name).trim().slice(0, 48) || 'Новая идея';
  let fontSize = 54; context.font = `700 ${fontSize}px Georgia, serif`;
  while (context.measureText(normalizedName).width > canvas.width * .83 && fontSize > 22) {
    fontSize -= 2; context.font = `700 ${fontSize}px Georgia, serif`;
  }
  context.fillText(normalizedName, canvas.width / 2, canvas.height / 2, canvas.width * .86);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  const faceGeometry = new THREE.ShapeGeometry(shape, 8);
  faceGeometry.computeBoundingBox();
  const bounds = faceGeometry.boundingBox, position = faceGeometry.getAttribute('position'), uv = faceGeometry.getAttribute('uv');
  for (let index = 0; index < position.count; index++) {
    uv.setXY(index, (position.getX(index) - bounds.min.x) / (bounds.max.x - bounds.min.x),
      (position.getY(index) - bounds.min.y) / (bounds.max.y - bounds.min.y));
  }
  uv.needsUpdate = true;
  const face = new THREE.Mesh(faceGeometry, new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  face.position.z = depth + .003; face.castShadow = false; face.receiveShadow = true;
  group.add(face);
  group.userData.scenePlaceholder = { texture, canvas, context, face };
  return group;
}

export function updateScenePlaceholderName(group, name) {
  const note = group?.userData?.scenePlaceholder;
  if (!note) return;
  const { canvas, context, texture } = note;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#e7ce98'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#35271e'; context.textAlign = 'center'; context.textBaseline = 'middle';
  const label = String(name).trim().slice(0, 48) || 'Новая идея';
  let fontSize = 54; context.font = `700 ${fontSize}px Georgia, serif`;
  while (context.measureText(label).width > canvas.width * .83 && fontSize > 22) {
    fontSize -= 2; context.font = `700 ${fontSize}px Georgia, serif`;
  }
  context.fillText(label, canvas.width / 2, canvas.height / 2, canvas.width * .86);
  texture.needsUpdate = true;
}
