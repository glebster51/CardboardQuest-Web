import { extractTerrainContours } from '../terrain-shapes.mjs?v=7c14a71de3a9af87';

function signedDistance(x,z,polygon) {
  let inside=false,distance=Infinity;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[j],b=polygon[i],dx=b.x-a.x,dz=b.z-a.z;
    const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz || 1)));
    distance=Math.min(distance,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));
    if((a.z>z)!==(b.z>z) && x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }
  return inside?distance:-distance;
}

/** Boolean surface subtraction on the height grid, including intersecting holes. */
export function terrainSurfaceContours(map,footprints,holes=[]) {
  if(!footprints.length)return [];
  const values=new Float32Array(map.values.length),cellX=map.cellSizeX??map.cellSize,cellZ=map.cellSizeZ??map.cellSize;
  for(let row=0;row<map.rows;row++)for(let col=0;col<map.columns;col++) {
    const x=map.minX+col*cellX,z=map.minZ+row*cellZ,index=row*map.columns+col;
    let field=-Infinity;
    for(const polygon of footprints)field=Math.max(field,signedDistance(x,z,polygon));
    for(const polygon of holes)field=Math.min(field,-signedDistance(x,z,polygon));
    // Matches the first negative terrace threshold and the rounded sampler.
    values[index]=Math.min(field,map.values[index]+map.step*.5);
  }
  return extractTerrainContours({...map,values},0);
}
