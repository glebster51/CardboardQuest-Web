import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { traceSpriteContours } from './sprite-geometry.mjs?v=4';
import { CARDBOARD_EXTRUSION_DEPTH } from './scenery-layout.mjs?v=1';

export function silhouetteShapes(alphaPixels, width, height, worldWidth, worldHeight) {
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = alphaPixels[i * 4 + 3];
  const contours = traceSpriteContours(alpha, width, height, worldWidth, worldHeight);
  const contains = (point, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  };
  const pathFrom = (contour, clockwise) => {
    const points = THREE.ShapeUtils.isClockWise(contour.points) === clockwise ? contour.points : [...contour.points].reverse();
    const path = new THREE.Path(); path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) path.lineTo(points[i].x, points[i].y);
    path.closePath(); return path;
  };
  const shapes = contours.filter(contour => contour.depth % 2 === 0).map(contour => {
    const shape = new THREE.Shape(), path = pathFrom(contour, false);
    shape.moveTo(path.curves[0].v1.x, path.curves[0].v1.y);
    for (const curve of path.curves) shape.lineTo(curve.v2.x, curve.v2.y);
    shape.closePath();
    for (const hole of contours) if (hole.depth === contour.depth + 1 && contains(hole.points[0], contour.points)) shape.holes.push(pathFrom(hole, true));
    return shape;
  });
  const maskCanvas = document.createElement('canvas'); maskCanvas.width = width; maskCanvas.height = height;
  const context = maskCanvas.getContext('2d'); context.fillStyle = '#fff'; context.beginPath();
  for (const contour of contours) {
    const first = contour.points[0]; context.moveTo((first.x / worldWidth + .5) * width, (.5 - first.y / worldHeight) * height);
    for (let i = 1; i < contour.points.length; i++) { const point = contour.points[i]; context.lineTo((point.x / worldWidth + .5) * width, (.5 - point.y / worldHeight) * height); }
    context.closePath();
  }
  context.fill('evenodd');
  return { shapes, rasterMask: context.getImageData(0, 0, width, height).data };
}

export function makeExtrudedSprite(alphaPixels, width, height, front, back, corrugation, stencilPlayer = false, shapes, backAlphaPixels = alphaPixels) {
  const worldWidth = 2.05 * width / height, worldHeight = 2.05, depth = CARDBOARD_EXTRUSION_DEPTH;
  const uv = (vertices, index) => new THREE.Vector2(vertices[index * 3] / worldWidth + .5, vertices[index * 3 + 1] / worldHeight + .5);
  const uvGenerator = {
    generateTopUV(_geometry, vertices, a, b, c) { return [uv(vertices, a), uv(vertices, b), uv(vertices, c)]; },
    generateSideWallUV(_geometry, vertices, a, b, c, d) {
      const horizontal = Math.abs(vertices[b * 3] - vertices[a * 3]) >= Math.abs(vertices[b * 3 + 1] - vertices[a * 3 + 1]);
      return [a, b, c, d].map(index => new THREE.Vector2(horizontal ? vertices[index * 3] / worldWidth + .5 : vertices[index * 3 + 1] / worldHeight + .5, vertices[index * 3 + 2] / depth));
    },
  };
  const extruded = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, steps: 1, UVGenerator: uvGenerator }); extruded.translate(0, 0, -depth / 2);
  const sideGroup = extruded.groups.find(group => group.materialIndex === 1), sideGeometry = new THREE.BufferGeometry(), sourceIndex = extruded.index;
  for (const [name, attribute] of Object.entries(extruded.attributes)) {
    const values = new Float32Array(sideGroup.count * attribute.itemSize);
    for (let i = 0; i < sideGroup.count; i++) {
      const vertex = sourceIndex ? sourceIndex.getX(sideGroup.start + i) : sideGroup.start + i;
      for (let component = 0; component < attribute.itemSize; component++) values[i * attribute.itemSize + component] = attribute.array[vertex * attribute.itemSize + component];
    }
    sideGeometry.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize));
  }
  sideGeometry.computeBoundingSphere(); extruded.dispose();
  const stencil = { stencilWrite: true, stencilRef: stencilPlayer ? 1 : 0, stencilFunc: THREE.AlwaysStencilFunc, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.ReplaceStencilOp };
  // Artwork caps only render from outside. DoubleSide on both caps exposes
  // the inward print through cutouts and at oblique angles.
  const frontMaterial = new THREE.MeshStandardMaterial({ map: front, alphaTest: .5, roughness: 1, side: THREE.FrontSide, shadowSide: THREE.DoubleSide, ...stencil });
  const sideMaterial = new THREE.MeshStandardMaterial({ map: corrugation, color: 0xc39658, roughness: 1, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide, ...stencil });
  const body = new THREE.Mesh(sideGeometry, sideMaterial); body.castShadow = true; body.userData.sideWall = true;
  const capGeometry = new THREE.PlaneGeometry(worldWidth, worldHeight), frontCap = new THREE.Mesh(capGeometry, frontMaterial);
  frontCap.position.z = depth / 2 + .001; frontCap.castShadow = true; frontCap.userData.print = true;
  const backMaterial = new THREE.MeshStandardMaterial({ map: back, alphaTest: .5, roughness: 1, side: THREE.BackSide, shadowSide: THREE.DoubleSide, ...stencil });
  const backPlane = new THREE.Mesh(new THREE.PlaneGeometry(worldWidth, worldHeight), backMaterial);
  backPlane.position.z = -depth / 2 - .001; backPlane.userData.print = true;
  const flashGeometry = new THREE.PlaneGeometry(worldWidth, worldHeight), whiteMask = document.createElement('canvas'); whiteMask.width = width; whiteMask.height = height;
  const whiteContext = whiteMask.getContext('2d'); whiteContext.fillStyle = '#fff'; whiteContext.fillRect(0, 0, width, height);
  const alphaCanvas = document.createElement('canvas'); alphaCanvas.width = width; alphaCanvas.height = height;
  const imageData = alphaCanvas.getContext('2d').createImageData(width, height);
  for (let i = 0; i < width * height; i++) imageData.data[i * 4 + 3] = alphaPixels[i * 4 + 3];
  alphaCanvas.getContext('2d').putImageData(imageData, 0, 0); whiteContext.globalCompositeOperation = 'destination-in'; whiteContext.drawImage(alphaCanvas, 0, 0);
  const flashTexture = new THREE.CanvasTexture(whiteMask), flashMaterial = new THREE.MeshBasicMaterial({ map: flashTexture, transparent: true, opacity: 0, alphaTest: .1, side: THREE.DoubleSide, depthWrite: false, ...stencil });
  const frontFlash = new THREE.Mesh(flashGeometry, flashMaterial), backAlphaCanvas = document.createElement('canvas'); backAlphaCanvas.width = width; backAlphaCanvas.height = height;
  const backAlphaImage = backAlphaCanvas.getContext('2d').createImageData(width, height);
  for (let i = 0; i < width * height; i++) backAlphaImage.data[i * 4 + 3] = backAlphaPixels[i * 4 + 3];
  backAlphaCanvas.getContext('2d').putImageData(backAlphaImage, 0, 0);
  const backWhiteMask = document.createElement('canvas'); backWhiteMask.width = width; backWhiteMask.height = height;
  const backWhiteContext = backWhiteMask.getContext('2d'); backWhiteContext.fillStyle = '#fff'; backWhiteContext.fillRect(0, 0, width, height);
  backWhiteContext.globalCompositeOperation = 'destination-in'; backWhiteContext.drawImage(backAlphaCanvas, 0, 0);
  const backFlashTexture = new THREE.CanvasTexture(backWhiteMask), backFlashMaterial = new THREE.MeshBasicMaterial({ map: backFlashTexture, transparent: true, opacity: 0, alphaTest: .1, side: THREE.DoubleSide, depthWrite: false, ...stencil });
  const backFlash = new THREE.Mesh(flashGeometry, backFlashMaterial);
  frontFlash.position.z = depth / 2 + .002; backFlash.position.z = -depth / 2 - .002; frontFlash.userData.print = backFlash.userData.print = true;
  const group = new THREE.Group(); group.add(body, frontCap, backPlane, frontFlash, backFlash);
  return { group, body, geometry: sideGeometry, frontMaterial, sideMaterial, frontCap, backPlane, flashMaterial, flashTexture, backFlashMaterial, backFlashTexture, alphaPixels, width, height };
}
