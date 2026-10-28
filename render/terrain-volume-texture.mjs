/** One upload per terrain rebuild, never a per-frame density simulation. */
export function installTerrainVolumeTexture(THREE,renderer,location) {
  location.terrainVolumeTexture?.dispose();delete location.terrainVolumeTexture;
  const volume=location.terrainHeightMap?.volume;if(!volume)return;
  const texture=new THREE.Data3DTexture(volume.data,volume.width,volume.height,volume.depth);
  texture.name=`terrain-density:${location.id}`;texture.format=THREE.RedFormat;texture.type=THREE.UnsignedByteType;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.unpackAlignment=1;texture.generateMipmaps=false;texture.needsUpdate=true;
  renderer.initTexture(texture);location.terrainVolumeTexture=texture;
}
