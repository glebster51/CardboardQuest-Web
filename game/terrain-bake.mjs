const FORMAT = 'cardboardquest.terrain-bake.v1';
const MAX_BYTES = 40 * 1024 * 1024;

export function validateTerrainBake(bake) {
  if (bake === undefined) return;
  if (!bake || bake.format !== FORMAT || !Number.isInteger(bake.bytes) || bake.bytes < 1 || bake.bytes > MAX_BYTES
    || typeof bake.data !== 'string' || bake.data.length > 8 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(bake.data))
    throw new TypeError('Invalid baked terrain');
}

/** Lossless snapshot: Float32 height grid and optional R8 volume, gzip-compressed. */
export async function encodeTerrainBake(map) {
  const volume = map.volume?.edited ? map.volume : null;
  const header = new TextEncoder().encode(JSON.stringify({
    height: {columns:map.columns,rows:map.rows,minX:map.minX,minZ:map.minZ,
      cellSize:map.cellSize,cellSizeX:map.cellSizeX,cellSizeZ:map.cellSizeZ,step:map.step},
    volume: volume ? Object.fromEntries(Object.entries(volume).filter(([key])=>!['data','clearance'].includes(key))) : null,
  }));
  const raw = new Uint8Array(4 + header.length + map.values.byteLength + (volume?.data.byteLength ?? 0));
  new DataView(raw.buffer).setUint32(0,header.length,true);raw.set(header,4);
  raw.set(new Uint8Array(map.values.buffer,map.values.byteOffset,map.values.byteLength),4+header.length);
  if(volume)raw.set(volume.data,4+header.length+map.values.byteLength);
  const compressed = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let text='';for(let i=0;i<compressed.length;i+=16384)text+=String.fromCharCode(...compressed.subarray(i,i+16384));
  const bake={format:FORMAT,bytes:raw.length,data:btoa(text)};validateTerrainBake(bake);return bake;
}

export async function decodeTerrainBake(bake) {
  if(!bake)return null;validateTerrainBake(bake);
  const compressed=Uint8Array.from(atob(bake.data),c=>c.charCodeAt(0));
  const reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks=[];let size=0;
  try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;
    if(size>bake.bytes||size>MAX_BYTES)throw new RangeError('Baked terrain exceeds declared size');chunks.push(value);}
  } finally {await reader.cancel();}
  if(size!==bake.bytes||size<4)throw new RangeError('Incomplete baked terrain');
  const raw=new Uint8Array(size);let at=0;for(const chunk of chunks){raw.set(chunk,at);at+=chunk.length;}
  const length=new DataView(raw.buffer).getUint32(0,true);
  if(length>65536||length+4>size)throw new RangeError('Invalid baked terrain header');
  const {height,volume}=JSON.parse(new TextDecoder().decode(raw.subarray(4,4+length)));
  const count=height?.columns*height?.rows;
  if(!Number.isInteger(height?.columns)||!Number.isInteger(height?.rows)||height.columns<2||height.rows<2||count>1000000
    || ![height.minX,height.minZ,height.step,height.cellSizeX??height.cellSize,height.cellSizeZ??height.cellSize].every(Number.isFinite)
    || height.step<=0 || (height.cellSizeX??height.cellSize)<=0 || (height.cellSizeZ??height.cellSize)<=0)
    throw new RangeError('Invalid baked height grid');
  at=4+length;const end=at+count*4;
  if(end>size)throw new RangeError('Incomplete baked height grid');
  height.values=new Float32Array(raw.slice(at,end).buffer);
  if(!height.values.every(value=>Number.isFinite(value)&&value>=-8&&value<=8))throw new RangeError('Invalid baked heights');
  at=end;
  if(volume){const voxels=volume.width*volume.height*volume.depth;
    if(volume.footprint!==undefined&&(!Array.isArray(volume.footprint)||volume.footprint.length<3||volume.footprint.length>4096
      ||volume.footprint.some(p=>!p||![p.x,p.z].every(n=>Number.isFinite(n)&&Math.abs(n)<=1000))))throw new RangeError('Invalid baked terrain footprint');
    if(![volume.width,volume.height,volume.depth].every(n=>Number.isInteger(n)&&n>=2)||voxels>16000000
      || ![volume.minX,volume.minY,volume.minZ,volume.cellX,volume.cellY,volume.cellZ,volume.step].every(Number.isFinite)
      || Math.min(volume.cellX,volume.cellY,volume.cellZ,volume.step)<=0 || at+voxels!==size)throw new RangeError('Invalid baked density grid');
    volume.data=raw.slice(at);volume.edited=true;
  } else if(at!==size)throw new RangeError('Unexpected baked terrain data');
  return {height,volume};
}

export function restoreBakedHeights(map,baked) {
  if(!baked)return;
  if(map.columns===baked.columns&&map.rows===baked.rows&&map.minX===baked.minX&&map.minZ===baked.minZ
    && (map.cellSizeX??map.cellSize)===(baked.cellSizeX??baked.cellSize)
    && (map.cellSizeZ??map.cellSize)===(baked.cellSizeZ??baked.cellSize)) {
    map.values.set(baked.values);map.bakedHeightValues=map.values.slice();return;
  }
  const cellX=map.cellSizeX??map.cellSize,cellZ=map.cellSizeZ??map.cellSize;
  const bx=baked.cellSizeX??baked.cellSize,bz=baked.cellSizeZ??baked.cellSize;
  for(let z=0;z<map.rows;z++)for(let x=0;x<map.columns;x++) {
    const gx=(map.minX+x*cellX-baked.minX)/bx,gz=(map.minZ+z*cellZ-baked.minZ)/bz;
    if(gx<0||gz<0||gx>baked.columns-1||gz>baked.rows-1)continue;
    const ix=Math.min(baked.columns-2,Math.floor(gx)),iz=Math.min(baked.rows-2,Math.floor(gz)),tx=gx-ix,tz=gz-iz,i=iz*baked.columns+ix;
    map.values[z*map.columns+x]=(baked.values[i]*(1-tx)+baked.values[i+1]*tx)*(1-tz)
      +(baked.values[i+baked.columns]*(1-tx)+baked.values[i+baked.columns+1]*tx)*tz;
  }
  map.bakedHeightValues=map.values.slice();
}
