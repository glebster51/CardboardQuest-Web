import * as THREE from './vendor/three/build/three.module.js?v=ab782efa5048549c';
import { createSpriteCapMask, traceSpriteContours } from './sprite-geometry.mjs?v=ab782efa5048549c';
import { CARDBOARD_EXTRUSION_DEPTH } from './scenery-layout.mjs?v=ab782efa5048549c';
import { markSsaoSpriteAlphaCutout } from './render/ssao-alpha-cutout.mjs?v=ab782efa5048549c';
import { smoothExtrusionSideNormals } from './extrusion-smoothing.mjs?v=ab782efa5048549c';
import { subdivideTriangleMesh } from './triangle-subdivision.mjs?v=ab782efa5048549c';

export function silhouetteShapes(alphaPixels, width, height, worldWidth, worldHeight) {
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = alphaPixels[i * 4 + 3];
  const contours = traceSpriteContours(alpha, width, height, worldWidth, worldHeight);
  // Face geometry follows a coarser, slightly expanded silhouette than the
  // recessed cardboard wall. The texture alpha still defines the printed edge.
  const faceContours = traceSpriteContours(alpha, width, height, worldWidth, worldHeight,
    { maxDimension: 112, insetPixels: 0 });
  const smoothingAnchors = contours.flatMap(contour => contour.concaveAnchors);
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
  const buildShapes = source => source.filter(contour => contour.depth % 2 === 0).map(contour => {
    const shape = new THREE.Shape(), path = pathFrom(contour, false);
    shape.moveTo(path.curves[0].v1.x, path.curves[0].v1.y);
    for (const curve of path.curves) shape.lineTo(curve.v2.x, curve.v2.y);
    shape.closePath();
    for (const hole of contours) if (hole.depth === contour.depth + 1 && contains(hole.points[0], contour.points)) shape.holes.push(pathFrom(hole, true));
    return shape;
  });
  const shapes = buildShapes(contours), faceShapes = buildShapes(faceContours);
  // The inset contour is only for the cardboard side profile. Keep the print
  // at its original alpha silhouette so it slightly overhangs and hides the
  // recessed cardboard edge instead of being clipped down with the mesh.
  const rasterMask = createSpriteCapMask(alpha, width, height);
  return { shapes, faceShapes, rasterMask, smoothingAnchors };
}

function subdivideFaceGeometry(geometry) {
  const position = geometry.attributes.position, uv = geometry.attributes.uv;
  const subdivided = subdivideTriangleMesh(position.array, uv.array, geometry.index?.array ?? null);
  const refined = new THREE.BufferGeometry();
  refined.setAttribute('position', new THREE.BufferAttribute(subdivided.positions, 3));
  refined.setAttribute('uv', new THREE.BufferAttribute(subdivided.uvs, 2));
  refined.computeVertexNormals(); refined.computeBoundingSphere(); geometry.dispose();
  return refined;
}

function createArtworkCap(shapes, worldWidth, worldHeight, material, name, z, flash = false) {
  let geometry = new THREE.ShapeGeometry(shapes);
  geometry = subdivideFaceGeometry(geometry);
  const positions = geometry.attributes.position, uv = new Float32Array(positions.count * 2);
  for (let i = 0; i < positions.count; i++) {
    uv[i * 2] = positions.getX(i) / worldWidth + .5;
    uv[i * 2 + 1] = positions.getY(i) / worldHeight + .5;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name; mesh.userData.cardboardSurface = !flash; mesh.userData.print = true;
  mesh.userData.cardboardDamageWorldWidth = worldWidth; mesh.userData.cardboardDamageWorldHeight = worldHeight;
  mesh.position.z = z;
  if (!flash) mesh.castShadow = true;
  return mesh;
}

export function makeExtrudedSprite(alphaPixels, width, height, front, back, corrugation, stencilPlayer = false, shapes, backAlphaPixels = alphaPixels, smoothingAnchors = [], faceShapes = shapes) {
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
  sideGeometry.setAttribute('normal', new THREE.BufferAttribute(
    smoothExtrusionSideNormals(sideGeometry.attributes.position.array, smoothingAnchors), 3));
  sideGeometry.computeBoundingSphere(); extruded.dispose();
  const stencil = { stencilWrite: true, stencilRef: stencilPlayer ? 1 : 0, stencilFunc: THREE.AlwaysStencilFunc, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.ReplaceStencilOp };
  // Artwork caps only render from outside. DoubleSide on both caps exposes
  // the inward print through cutouts and at oblique angles.
  const frontMaterial = new THREE.MeshStandardMaterial({ map: front, alphaTest: .5, roughness: 1, side: THREE.FrontSide, shadowSide: THREE.DoubleSide, vertexColors: true, ...stencil });
  const sideMaterial = new THREE.MeshStandardMaterial({ map: corrugation, color: 0xc39658, roughness: 1, vertexColors: true, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide, ...stencil });
  const body = new THREE.Mesh(sideGeometry, sideMaterial); body.name = 'cardboard-side'; body.castShadow = true; body.userData.sideWall = true; body.userData.cardboardSurface = true;
  body.userData.cardboardDamageWorldWidth = worldWidth; body.userData.cardboardDamageWorldHeight = worldHeight;
  const capShapes = faceShapes?.length ? faceShapes : shapes;
  const frontCap = createArtworkCap(capShapes, worldWidth, worldHeight, frontMaterial, 'cardboard-front', depth / 2 + .001);
  markSsaoSpriteAlphaCutout(frontCap, front, frontMaterial.alphaTest);
  const backMaterial = new THREE.MeshStandardMaterial({ map: back, alphaTest: .5, roughness: 1, side: THREE.BackSide, shadowSide: THREE.DoubleSide, vertexColors: true, ...stencil });
  const backPlane = createArtworkCap(capShapes, worldWidth, worldHeight, backMaterial, 'cardboard-back', -depth / 2 - .001);
  markSsaoSpriteAlphaCutout(backPlane, back, backMaterial.alphaTest);
  const whiteMask = document.createElement('canvas'); whiteMask.width = width; whiteMask.height = height;
  const whiteContext = whiteMask.getContext('2d'); whiteContext.fillStyle = '#fff'; whiteContext.fillRect(0, 0, width, height);
  const alphaCanvas = document.createElement('canvas'); alphaCanvas.width = width; alphaCanvas.height = height;
  const imageData = alphaCanvas.getContext('2d').createImageData(width, height);
  for (let i = 0; i < width * height; i++) imageData.data[i * 4 + 3] = alphaPixels[i * 4 + 3];
  alphaCanvas.getContext('2d').putImageData(imageData, 0, 0); whiteContext.globalCompositeOperation = 'destination-in'; whiteContext.drawImage(alphaCanvas, 0, 0);
  const flashTexture = new THREE.CanvasTexture(whiteMask), flashMaterial = new THREE.MeshBasicMaterial({ map: flashTexture, transparent: true, opacity: 0, alphaTest: .1, side: THREE.DoubleSide, depthWrite: false, ...stencil });
  const frontFlash = createArtworkCap(capShapes, worldWidth, worldHeight, flashMaterial, 'cardboard-front-flash', depth / 2 + .002, true), backAlphaCanvas = document.createElement('canvas'); backAlphaCanvas.width = width; backAlphaCanvas.height = height;
  const backAlphaImage = backAlphaCanvas.getContext('2d').createImageData(width, height);
  for (let i = 0; i < width * height; i++) backAlphaImage.data[i * 4 + 3] = backAlphaPixels[i * 4 + 3];
  backAlphaCanvas.getContext('2d').putImageData(backAlphaImage, 0, 0);
  const backWhiteMask = document.createElement('canvas'); backWhiteMask.width = width; backWhiteMask.height = height;
  const backWhiteContext = backWhiteMask.getContext('2d'); backWhiteContext.fillStyle = '#fff'; backWhiteContext.fillRect(0, 0, width, height);
  backWhiteContext.globalCompositeOperation = 'destination-in'; backWhiteContext.drawImage(backAlphaCanvas, 0, 0);
  const backFlashTexture = new THREE.CanvasTexture(backWhiteMask), backFlashMaterial = new THREE.MeshBasicMaterial({ map: backFlashTexture, transparent: true, opacity: 0, alphaTest: .1, side: THREE.DoubleSide, depthWrite: false, ...stencil });
  const backFlash = createArtworkCap(capShapes, worldWidth, worldHeight, backFlashMaterial, 'cardboard-back-flash', -depth / 2 - .002, true);
  markSsaoSpriteAlphaCutout(frontFlash, flashTexture, flashMaterial.alphaTest);
  markSsaoSpriteAlphaCutout(backFlash, backFlashTexture, backFlashMaterial.alphaTest);
  const group = new THREE.Group(); group.add(body, frontCap, backPlane, frontFlash, backFlash);
  return { group, body, geometry: sideGeometry, frontMaterial, sideMaterial, frontCap, backPlane, flashMaterial, flashTexture, backFlashMaterial, backFlashTexture, alphaPixels, width, height };
}
