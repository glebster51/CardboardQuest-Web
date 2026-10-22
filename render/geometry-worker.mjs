import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { createTerrainRenderer } from './terrain-renderer.mjs?v=2';
import { createTerrainHeightMap, createTerrainHeightMapFromDepthMap, extractTerrainContours } from '../terrain-shapes.mjs?v=5';
import { silhouetteShapes, makeExtrudedSprite } from '../figure-model.mjs?v=10';
import { unionSpriteAlpha, clipSpriteToAlphaMask } from '../sprite-geometry.mjs?v=10';
import { makeScenerySprite } from '../scenery-model-v4.mjs?v=6';
import { packScene, terrainLayoutPayload } from './geometry-transfer.mjs?v=2';
import { createLocationWalkPaths, scatterGroundDetails } from '../ground-decoration.mjs';
import { createCampaignLocations } from '../game/story-world.mjs?v=16';
import { createLocationNetwork } from '../location-network.mjs';

globalThis.document = { createElement: () => new OffscreenCanvas(1, 1) };
const shared = Object.fromEntries(['paper', 'grain', 'corrugation', 'terrainCorrugation'].map(key => [key, new THREE.Texture()]));
async function image(url) {
  const response = await fetch(url); if (!response.ok) throw new Error(`Asset ${response.status}: ${url}`);
  return createImageBitmap(await response.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
}
self.onmessage = async ({ data: { id, kind, payload } }) => {
  try {
    let root, extra = {};
    if (kind === 'terrain') {
      if (!payload.layoutReady) {
        const catalog = createCampaignLocations(createLocationNetwork(), payload.scale, []);
        catalog[payload.id].art = payload.art;
        const authored = createCampaignLocations(catalog, payload.scale, [payload.id])[payload.id];
        extra.layout = terrainLayoutPayload(authored);
        Object.assign(payload, extra.layout);
      }
      const location = { ...payload, sceneGroup: new THREE.Group() };
      createTerrainRenderer({ THREE, locations: { [location.id]: location }, createTerrainHeightMap,
        createTerrainHeightMapFromDepthMap, extractTerrainContours, paper: shared.paper,
        playfieldCardboard: shared.grain, roughCardboard: shared.grain,
        terrainCorrugation: shared.terrainCorrugation, sceneStencil: { stencilWrite: true, stencilRef: 0,
          stencilFunc: THREE.AlwaysStencilFunc, stencilFail: THREE.KeepStencilOp,
          stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.ReplaceStencilOp } });
      const { sample, ...heightMap } = location.terrainHeightMap;
      extra.heightMap = heightMap;
      extra.rounded = Boolean(location.art.depthMap || Number.isFinite(location.art.terrain?.edgeHeight));
      root = location.sceneGroup;
    } else if (kind === 'ground') {
      const paths = createLocationWalkPaths(payload.location, payload.targets);
      extra = { paths, details: scatterGroundDetails({ location: payload.location, ...payload.specs, paths }) };
      root = new THREE.Group();
    } else if (kind === 'scenery') {
      const source = payload.bitmap ?? await image(payload.url);
      root = new THREE.Group();
      const count = payload.frameCount ?? 1;
      for (let index = 0; index < count; index++) {
        const canvas = new OffscreenCanvas(source.width / count, source.height);
        canvas.getContext('2d').drawImage(source, index * canvas.width, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
        root.add(makeScenerySprite(canvas, shared.corrugation).group);
      }
      source.close();
    } else if (kind === 'figure') {
      const source = await image(payload.url), { width, height } = source;
      const canvas = new OffscreenCanvas(width, height), context = canvas.getContext('2d', { willReadFrequently: true });
      if (payload.flip) { context.translate(width, 0); context.scale(-1, 1); }
      context.drawImage(source, 0, 0); source.close(); context.setTransform(1, 0, 0, 1, 0, 0);
      const pixels = context.getImageData(0, 0, width, height).data;
      const mask = unionSpriteAlpha(pixels, pixels, width, height);
      const geometry = silhouetteShapes(mask, width, height, 2.05 * width / height, 2.05);
      const alphaPixels = clipSpriteToAlphaMask(pixels, geometry.rasterMask);
      context.putImageData(new ImageData(alphaPixels, width, height), 0, 0);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const model = makeExtrudedSprite(alphaPixels, width, height, texture, texture, shared.corrugation,
        payload.player, geometry.shapes, alphaPixels);
      root = model.group;
      extra = { width, height, alphaPixels, flashUuid: root.children.find(child => child.material === model.flashMaterial).uuid,
        backFlashUuid: root.children.find(child => child.material === model.backFlashMaterial).uuid };
    } else throw new Error(`Unknown geometry job: ${kind}`);
    const { packet, transfers } = await packScene(root, shared);
    if (extra.alphaPixels) transfers.push(extra.alphaPixels.buffer);
    if (extra.heightMap) transfers.push(extra.heightMap.values.buffer);
    self.postMessage({ id, result: { packet, ...extra } }, transfers);
  } catch (error) { self.postMessage({ id, error: error.stack || error.message }); }
};
