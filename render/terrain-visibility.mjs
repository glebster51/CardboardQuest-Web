import {terrainVolumeSlice,TERRAIN_DENSITY_SCALE} from '../game/terrain-volume.mjs?v=ab782efa5048549c';

/** Only exterior-connected air needs a surface. Keep the editable volume intact:
 * a later tunnel can expose a cavity that currently has no rendered geometry.
 * Connectivity is evaluated on the same 0.72 m slices used by the mesher.
 */
export function createVisibleTerrainSlices(volume) {
  const firstLayer=Math.ceil(volume.minY/volume.step);
  const lastLayer=Math.floor((volume.minY+(volume.height-1)*volume.cellY)/volume.step);
  const width=volume.width,depth=volume.depth,plane=width*depth,count=lastLayer-firstLayer;
  const slices=Array.from({length:count},(_,i)=>terrainVolumeSlice(volume,(firstLayer+i+.5)*volume.step));
  const reached=new Uint8Array(plane*count),queue=new Uint32Array(plane*count);
  let head=0,tail=0;
  const enqueue=(layer,at)=>{
    const id=layer*plane+at;
    if(!reached[id]&&slices[layer].values[at]<0){reached[id]=1;queue[tail++]=id;}
  };
  if(!count)return {firstLayer,slices,stats:{sealedAirSamples:0,exteriorAirSamples:0,totalSamples:0}};
  // The top and the four sides lead outside. The artificial lower cutoff is
  // underground, so it must not make a buried pocket appear accessible.
  for(let at=0;at<plane;at++)enqueue(count-1,at);
  for(let layer=0;layer<count;layer++) {
    for(let x=0;x<width;x++){enqueue(layer,x);enqueue(layer,(depth-1)*width+x);}
    for(let z=1;z<depth-1;z++){enqueue(layer,z*width);enqueue(layer,z*width+width-1);}
  }
  const midpointAir=(values,at,dx,dz)=>{
    if(!dx&&!dz)return values[at]<0;
    if(!dx)return values[at]+values[at+dz*width]<0;
    if(!dz)return values[at]+values[at+dx]<0;
    // Match marching squares' saddle decision: diagonal air is joined only
    // when the cell centre is air, never through a solid corner.
    return values[at]+values[at+dx]+values[at+dz*width]+values[at+dx+dz*width]<0;
  };
  while(head<tail) {
    const id=queue[head++],layer=Math.floor(id/plane),at=id-layer*plane,x=at%width,z=Math.floor(at/width);
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++) {
      if(x+dx<0||x+dx>=width||z+dz<0||z+dz>=depth)continue;
      const to=at+dx+dz*width;
      if((dx||dz)&&(!dx||!dz||midpointAir(slices[layer].values,at,dx,dz)))enqueue(layer,to);
      // Adjacent layer openings may overlap between grid vertices. Preserve
      // these slanted connections too, if both cross-sections contain air.
      if(!midpointAir(slices[layer].values,at,dx,dz))continue;
      for(let next=layer-1;next<=layer+1;next+=2)if(next>=0&&next<count&&midpointAir(slices[next].values,at,dx,dz))enqueue(next,to);
    }
  }
  let sealedAirSamples=0;
  for(let layer=0;layer<count;layer++)for(let at=0;at<plane;at++) {
    if(slices[layer].values[at]<0&&!reached[layer*plane+at]) {
      slices[layer].values[at]=128/TERRAIN_DENSITY_SCALE;sealedAirSamples++;
    }
  }
  return {firstLayer,slices,stats:{sealedAirSamples,exteriorAirSamples:tail,totalSamples:plane*count}};
}
