import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { silhouetteShapes, makeExtrudedSprite } from './figure-model.mjs?v=4';

export function extractMainScenerySprite(image) {
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  const width = image.width, height = image.height;
  const visited = new Uint8Array(width * height), stack = new Int32Array(width * height);
  let largest = null;
  for (let start = 0; start < width * height; start++) {
    if (visited[start] || pixels[start * 4 + 3] <= 80) continue;
    let top = 0, count = 0, x0 = width, y0 = height, x1 = -1, y1 = -1;
    stack[top++] = start; visited[start] = 1;
    while (top) {
      const index = stack[--top], x = index % width, y = (index / width) | 0;
      count++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
          const next = ny * width + nx;
          if (!visited[next] && pixels[next * 4 + 3] > 80) { visited[next] = 1; stack[top++] = next; }
        }
      }
    }
    if (!largest || count > largest.count) largest = { count, x0, y0, x1, y1 };
  }
  if (!largest) throw new Error('Scenery sprite has no opaque artwork');
  const padding = 2;
  const cropX = Math.max(0, largest.x0 - padding), cropY = Math.max(0, largest.y0 - padding);
  const cropRight = Math.min(width - 1, largest.x1 + padding), cropBottom = Math.min(height - 1, largest.y1 + padding);
  const cropWidth = cropRight - cropX + 1, cropHeight = cropBottom - cropY + 1;
  const cut = document.createElement('canvas'); cut.width = cropWidth; cut.height = cropHeight;
  const cutContext = cut.getContext('2d', { willReadFrequently: true });
  cutContext.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  const cutData = cutContext.getImageData(0, 0, cropWidth, cropHeight);
  for (let y = 0; y < cropHeight; y++) for (let x = 0; x < cropWidth; x++) {
    const sourceX = cropX + x, sourceY = cropY + y, sourceIndex = sourceY * width + sourceX;
    let connected = visited[sourceIndex] === 1;
    if (!connected) {
      for (let ny = Math.max(0, sourceY - padding); ny <= Math.min(height - 1, sourceY + padding) && !connected; ny++)
        for (let nx = Math.max(0, sourceX - padding); nx <= Math.min(width - 1, sourceX + padding); nx++)
          if (visited[ny * width + nx]) { connected = true; break; }
    }
    if (!connected) cutData.data[(y * cropWidth + x) * 4 + 3] = 0;
  }
  cutContext.putImageData(cutData, 0, 0);
  return { cut, alphaPixels: cutData.data, width: cropWidth, height: cropHeight };
}

function flipRgbaX(pixels, width, height) {
  const flipped = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const source = (y * width + x) * 4, target = (y * width + width - 1 - x) * 4;
    flipped.set(pixels.subarray(source, source + 4), target);
  }
  return flipped;
}

function flipCanvasX(source) {
  const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
  const context = canvas.getContext('2d'); context.translate(canvas.width, 0); context.scale(-1, 1); context.drawImage(source, 0, 0);
  return canvas;
}

export function makeScenerySprite(image, corrugation, maxAnisotropy = 4) {
  const sprite = extractMainScenerySprite(image);
  const frontTexture = new THREE.CanvasTexture(sprite.cut); frontTexture.colorSpace = THREE.SRGBColorSpace;
  // Each side gets its own accurate silhouette. Only one group is visible at
  // a time, so both sides share the same single cardboard thickness.
  const backCut = flipCanvasX(sprite.cut);
  const backTexture = new THREE.CanvasTexture(backCut); backTexture.colorSpace = THREE.SRGBColorSpace;
  const anisotropy = Math.min(4, maxAnisotropy);
  frontTexture.anisotropy = backTexture.anisotropy = anisotropy;
  const shapes = silhouetteShapes(sprite.alphaPixels, sprite.width, sprite.height,
    2.05 * sprite.width / sprite.height, 2.05).shapes;
  const backAlphaPixels = flipRgbaX(sprite.alphaPixels, sprite.width, sprite.height);
  const backShapes = silhouetteShapes(backAlphaPixels, sprite.width, sprite.height,
    2.05 * sprite.width / sprite.height, 2.05).shapes;
  const frontArt = makeExtrudedSprite(sprite.alphaPixels, sprite.width, sprite.height,
    frontTexture, backTexture, corrugation, false, shapes, sprite.alphaPixels);
  const backArt = makeExtrudedSprite(backAlphaPixels, sprite.width, sprite.height,
    backTexture, frontTexture, corrugation, false, backShapes, backAlphaPixels);
  // The selected artwork face depends on the camera, while the sun stays fixed.
  // Render and cast shadows from either side so the inactive rear face is not needed for lighting.
  for (const face of [frontArt, backArt]) {
    for (const material of [face.frontMaterial, face.sideMaterial, face.backPlane.material]) {
      material.side = THREE.DoubleSide;
      material.shadowSide = THREE.DoubleSide;
      material.needsUpdate = true;
    }
  }
  const group = new THREE.Group();
  frontArt.group.name = 'scenery-front';
  backArt.group.name = 'scenery-back';
  backArt.group.rotation.y = Math.PI;
  backArt.group.visible = false;
  group.add(frontArt.group, backArt.group);
  return { ...frontArt, group, frontGroup: frontArt.group, backGroup: backArt.group,
    setViewBack(back) { frontArt.group.visible = !back; backArt.group.visible = back; },
    frontTexture, backTexture, width: sprite.width, height: sprite.height,
    backFlipMatches: true, backTextureShared: false, singleExtrusion: true };
}
