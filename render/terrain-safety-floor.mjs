import {pointInPolygon} from '../game/world-hazards.mjs?v=7c14a71de3a9af87';
import {smoothClosedContour} from '../terrain-shapes.mjs?v=7c14a71de3a9af87';

/** Close a through hole one terrace below the lowest exposed floor, rather than
 * at the density texture's artificial lower cutoff. Keep real deep caves above it.
 */
export function createTerrainSafetyFloor(volume,visible,referenceHeight=0) {
  const bottom=visible.slices[0];if(!bottom)return null;
  const footprint=volume.footprint;
  let open=false;
  for(let z=1;z<volume.depth-1&&!open;z++)for(let x=1;x<volume.width-1;x++) {
    const wx=volume.minX+x*volume.cellX,wz=volume.minZ+z*volume.cellZ;
    if(bottom.values[z*volume.width+x]<0&&(!footprint?.length||pointInPolygon(wx,wz,footprint))){open=true;break;}
  }
  if(!open)return null;
  let sourceTop=null;
  findFloor:for(let layer=0;layer<visible.slices.length;layer++) {
    const top=(visible.firstLayer+layer+1)*volume.step;
    const below=visible.slices[layer].values,above=visible.slices[layer+1]?.values;
    for(let z=1;z<volume.depth-1;z++)for(let x=1;x<volume.width-1;x++) {
      const at=z*volume.width+x;
      if(below[at]<0||above&&above[at]>=0)continue;
      const wx=volume.minX+x*volume.cellX,wz=volume.minZ+z*volume.cellZ;
      if(!footprint?.length||pointInPolygon(wx,wz,footprint)){sourceTop=top;break findFloor;}
    }
  }
  // Use the height field only if deletion removed every exposed floor.
  // It may contain obsolete deep pits that have since been filled in 3D.
  sourceTop??=Math.round(referenceHeight/volume.step)*volume.step;
  const bounds={minX:volume.minX,minZ:volume.minZ,
    maxX:volume.minX+(volume.width-1)*volume.cellX,maxZ:volume.minZ+(volume.depth-1)*volume.cellZ};
  // Padding keeps every map corner covered after the standard four smoothing
  // passes. Sampling long edges avoids rounding a four-point rectangle away.
  const spacing=Math.max(volume.cellX,volume.cellZ),padding=2*Math.max(spacing,volume.step);
  const corners=[{x:bounds.minX-padding,z:bounds.minZ-padding},{x:bounds.maxX+padding,z:bounds.minZ-padding},
    {x:bounds.maxX+padding,z:bounds.maxZ+padding},{x:bounds.minX-padding,z:bounds.maxZ+padding}];
  const contour=[];
  for(let i=0;i<4;i++) {
    const a=corners[i],b=corners[(i+1)%4],steps=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/spacing);
    for(let n=0;n<steps;n++)contour.push({x:a.x+(b.x-a.x)*n/steps,z:a.z+(b.z-a.z)*n/steps});
  }
  return {top:sourceTop-volume.step,sourceTop,depth:volume.step,bounds,contour:smoothClosedContour(contour,4)};
}

export function terrainSafetyFloorAt(floor,x,z) {
  if(!floor)return null;
  const b=floor.bounds;
  return x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ?floor.top:null;
}
