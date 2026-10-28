export const isLayerRepair=stroke=>['fill-layer','erase-layer'].includes(stroke?.mode);

/** Top faces select the solid immediately below; side faces select their own band. */
export function terrainLayerAtSurface(y,normalY,step) {
  const layer=Math.floor((y+(normalY>.25?-1e-5:1e-5))/step);
  return (layer+.5)*step;
}

export function terrainLayerRange(center,layers,step) {
  const top=(Math.floor((center+1e-5)/step)+1)*step;
  return {bottom:top-layers*step,top};
}

function footprintDistance(x,z,polygon) {
  let inside=false,distance=Infinity;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[j],b=polygon[i],dx=b.x-a.x,dz=b.z-a.z;
    const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
    distance=Math.min(distance,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));
    if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }
  return inside?distance:-distance;
}

/** Exact slab CSG, independent of the current surface and of hidden cavities. */
export function applyTerrainLayerRepair(v,stroke,x,y,z) {
  const {bottom,top}=terrainLayerRange(y,stroke.layers,v.step),scale=24;
  const lo=Math.max(0,Math.ceil((bottom-v.minY-1e-5)/v.cellY)),hi=Math.min(v.height-1,Math.floor((top-v.minY+1e-5)/v.cellY));
  const whole=stroke.scope==='layer',r=stroke.radius;
  const x0=whole?0:Math.max(0,Math.floor((x-r-v.minX)/v.cellX)),x1=whole?v.width-1:Math.min(v.width-1,Math.ceil((x+r-v.minX)/v.cellX));
  const z0=whole?0:Math.max(0,Math.floor((z-r-v.minZ)/v.cellZ)),z1=whole?v.depth-1:Math.min(v.depth-1,Math.ceil((z+r-v.minZ)/v.cellZ));
  let changed=false;
  for(let iz=z0;iz<=z1;iz++)for(let ix=x0;ix<=x1;ix++) {
    const wx=v.minX+ix*v.cellX,wz=v.minZ+iz*v.cellZ;
    const mask=whole&&v.footprint?.length>=3?footprintDistance(wx,wz,v.footprint):whole?Infinity:r-Math.hypot(wx-x,wz-z);
    if(mask<=0)continue;
    for(let iy=lo;iy<=hi;iy++) {
      const wy=v.minY+iy*v.cellY,density=Math.min(wy-bottom,top-wy,mask);
      const at=ix+v.width*(iy+v.height*iz),before=v.data[at];
      const target=Math.max(0,Math.min(255,Math.round(128+(stroke.mode==='fill-layer'?density:-density)*scale)));
      const after=stroke.mode==='fill-layer'?Math.max(before,target):Math.min(before,target);
      v.data[at]=after;changed ||= after!==before;
    }
  }
  return changed;
}
