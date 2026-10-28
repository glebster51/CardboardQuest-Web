// Signed density stored as an R8 3D texture: 128 is the solid/air boundary.
// Layout matches Data3DTexture: x + width * (y + height * z).
export const TERRAIN_DENSITY_SCALE = 24;
import {TERRAIN_MAX_STROKES,TERRAIN_MAX_POINTS,TERRAIN_MAX_STROKE_POINTS,isHeightStroke,terrainHeightAfterDab} from './terrain-brush.mjs?v=7c14a71de3a9af87';
import {isLayerRepair,applyTerrainLayerRepair} from './terrain-layer-tools.mjs?v=7c14a71de3a9af87';
export {TERRAIN_MAX_STROKES,TERRAIN_MAX_POINTS,TERRAIN_MAX_STROKE_POINTS};
const encode=value=>Math.max(0,Math.min(255,Math.round(128+value*TERRAIN_DENSITY_SCALE)));
const decode=value=>(value-128)/TERRAIN_DENSITY_SCALE;
const index=(v,x,y,z)=>x+v.width*(y+v.height*z);

export function validateVolumeStrokes(strokes=[]) {
  if(!Array.isArray(strokes)||strokes.length>TERRAIN_MAX_STROKES)throw new RangeError(`Volume terrain supports up to ${TERRAIN_MAX_STROKES} strokes`);
  let count=0;
  for(const stroke of strokes) {
    if(!stroke || !['add','subtract','push','pull','fill-layer','erase-layer'].includes(stroke.mode) || !Number.isFinite(stroke.radius)||stroke.radius<.5||stroke.radius>24
      || !Array.isArray(stroke.points)||!stroke.points.length||stroke.points.length>TERRAIN_MAX_STROKE_POINTS)throw new RangeError('Invalid volume terrain stroke');
    const normalMode=['push','pull'].includes(stroke.mode);
    const repair=isLayerRepair(stroke);
    if(repair&&(!Number.isInteger(stroke.layers)||stroke.layers<1||stroke.layers>24||!['layer','brush'].includes(stroke.scope)))throw new RangeError('Invalid layer repair settings');
    if(normalMode && (!Number.isInteger(stroke.layers)||stroke.layers<1||stroke.layers>8||!Number.isFinite(stroke.strength)||stroke.strength<.01||stroke.strength>2))throw new RangeError('Invalid layer brush settings');
    count+=stroke.points.length;
    if(count>TERRAIN_MAX_POINTS || stroke.points.some(point=>!Array.isArray(point)||point.length!==(normalMode?6:3)||!point.every(Number.isFinite)
      || Math.abs(point[0])>300||Math.abs(point[2])>300||Math.abs(point[1])>(repair?9:8)
      || normalMode && Math.abs(Math.hypot(...point.slice(3))-1)>.01))throw new RangeError('Invalid volume terrain coordinates');
  }
  return strokes;
}

function inside(x,z,polygon) {
  let result=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[j],b=polygon[i];
    if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)result=!result;
  }
  return result;
}

export function createTerrainVolume(map,outline,strokes=[],baked=null) {
  validateVolumeStrokes(strokes.filter(stroke=>!isHeightStroke(stroke)));
  if(baked) {
    const v={...baked,footprint:baked.footprint??outline,data:baked.data.slice(),edited:true};delete v.clearance;
    const source={...v,data:v.data.slice()},cellX=map.cellSizeX??map.cellSize,cellZ=map.cellSizeZ??map.cellSize;
    if(map.bakedHeightValues)for(let z=0;z<v.depth;z++)for(let x=0;x<v.width;x++) {
      const wx=v.minX+x*v.cellX,wz=v.minZ+z*v.cellZ;
      const ix=Math.round((wx-map.minX)/cellX),iz=Math.round((wz-map.minZ)/cellZ);
      if(ix<0||iz<0||ix>=map.columns||iz>=map.rows)continue;
      const at=iz*map.columns+ix,delta=map.values[at]-map.bakedHeightValues[at];
      if(Math.abs(delta)<1e-6)continue;
      for(let y=0;y<v.height;y++)v.data[index(v,x,y,z)]=encode(sampleTerrainDensity(source,wx,v.minY+y*v.cellY-delta,wz));
    }
    for(const stroke of strokes)for(const point of stroke.points)applyTerrainVolumeDab(v,stroke,...point);
    return v;
  }
  const step=map.step,minY=-Math.ceil(8/step)*step,cellY=step/2;
  const v={format:'cardboardquest.terrain-density.v1',width:map.columns,height:Math.ceil((8-minY)/cellY)+2,depth:map.rows,
    minX:map.minX,minY,minZ:map.minZ,cellX:map.cellSizeX??map.cellSize,cellY,cellZ:map.cellSizeZ??map.cellSize,
    step,footprint:outline,edited:strokes.length>0,data:null};
  if(v.width*v.height*v.depth>16_000_000)throw new RangeError('Terrain density volume is too large');
  v.data=new Uint8Array(v.width*v.height*v.depth);
  for(let z=0;z<v.depth;z++)for(let x=0;x<v.width;x++) {
    const wx=v.minX+x*v.cellX,wz=v.minZ+z*v.cellZ;
    const solid=inside(wx,wz,outline),top=map.sample(wx,wz);
    for(let y=0;y<v.height;y++)v.data[index(v,x,y,z)]=solid?encode(top-(v.minY+y*v.cellY)):0;
  }
  for(const stroke of strokes)for(const point of stroke.points)applyTerrainVolumeDab(v,stroke,...point);
  return v;
}

export function applyTerrainVolumeDab(v,stroke,x,y,z,nx=0,ny=0,nz=1) {
  if(isLayerRepair(stroke))return applyTerrainLayerRepair(v,stroke,x,y,z);
  if(isHeightStroke(stroke))return sculptVolumeHeight(v,stroke,x,y);
  if(['push','pull'].includes(stroke.mode))return displaceTerrainVolumeLayer(v,stroke,x,y,z,nx,nz);
  const r=stroke.radius,margin=1/TERRAIN_DENSITY_SCALE;
  const lo=[Math.max(0,Math.floor((x-r-margin-v.minX)/v.cellX)),Math.max(0,Math.floor((y-r-margin-v.minY)/v.cellY)),Math.max(0,Math.floor((z-r-margin-v.minZ)/v.cellZ))];
  const hi=[Math.min(v.width-1,Math.ceil((x+r+margin-v.minX)/v.cellX)),Math.min(v.height-1,Math.ceil((y+r+margin-v.minY)/v.cellY)),Math.min(v.depth-1,Math.ceil((z+r+margin-v.minZ)/v.cellZ))];
  let changed=false;
  for(let iz=lo[2];iz<=hi[2];iz++)for(let iy=lo[1];iy<=hi[1];iy++)for(let ix=lo[0];ix<=hi[0];ix++) {
    const sphere=r-Math.hypot(v.minX+ix*v.cellX-x,v.minY+iy*v.cellY-y,v.minZ+iz*v.cellZ-z);
    if(sphere< -margin)continue;
    const at=index(v,ix,iy,iz),before=v.data[at],density=decode(before);
    const after=encode(stroke.mode==='add'?Math.max(density,sphere):Math.min(density,-sphere));
    v.data[at]=after;changed ||= before!==after;
  }
  return changed;
}

/** Reshape the selected solid span, preserving other floors/ceilings in a column. */
function sculptVolumeHeight(v,stroke,x,z) {
  const r=stroke.radius,reference=stroke.surfaceHeight??stroke.targetHeight;
  let changed=false;
  const minX=Math.max(0,Math.floor((x-r-v.minX)/v.cellX)),maxX=Math.min(v.width-1,Math.ceil((x+r-v.minX)/v.cellX));
  const minZ=Math.max(0,Math.floor((z-r-v.minZ)/v.cellZ)),maxZ=Math.min(v.depth-1,Math.ceil((z+r-v.minZ)/v.cellZ));
  for(let iz=minZ;iz<=maxZ;iz++)for(let ix=minX;ix<=maxX;ix++) {
    const distance=Math.hypot(v.minX+ix*v.cellX-x,v.minZ+iz*v.cellZ-z);if(distance>=r)continue;
    let start=-1,best=null;
    for(let iy=0;iy<v.height;iy++) {
      const solid=v.data[index(v,ix,iy,iz)]>=128;
      if(solid&&start<0)start=iy;
      if(start>=0&&(!solid||iy===v.height-1)) {
        const last=solid?iy:iy-1,a=decode(v.data[index(v,ix,last,iz)]),b=solid?-1:decode(v.data[index(v,ix,iy,iz)]);
        const top=v.minY+(last+(a/(a-b)||0))*v.cellY;
        if(!best||Math.abs(top-reference)<Math.abs(best.top-reference))best={start,last,top};
        start=-1;
      }
    }
    if(!best)continue;
    const after=Math.max(-8,Math.min(8,terrainHeightAfterDab(best.top,stroke,distance,Math.max(v.cellX,v.cellZ))));
    if(Math.abs(after-best.top)<1e-6)continue;
    const last=Math.min(v.height-1,Math.ceil((Math.max(after,best.top)-v.minY)/v.cellY));
    for(let iy=best.start;iy<=last;iy++) {
      const at=index(v,ix,iy,iz),before=v.data[at],height=v.minY+iy*v.cellY;
      const density=decode(before),value=encode(after<best.top?Math.min(density,after-height):Math.max(density,after-height));
      v.data[at]=value;changed ||= value!==before;
    }
  }
  return changed;
}

function displaceTerrainVolumeLayer(v,stroke,x,y,z,nx,nz) {
  const source={...v,data:v.data.slice()},r=stroke.radius,vertical=(stroke.layers-.5)*v.step;
  const minX=Math.max(0,Math.floor((x-r-v.minX)/v.cellX)),maxX=Math.min(v.width-1,Math.ceil((x+r-v.minX)/v.cellX));
  const minZ=Math.max(0,Math.floor((z-r-v.minZ)/v.cellZ)),maxZ=Math.min(v.depth-1,Math.ceil((z+r-v.minZ)/v.cellZ));
  const minY=Math.max(0,Math.floor((y-vertical-v.minY)/v.cellY)),maxY=Math.min(v.height-1,Math.ceil((y+vertical-v.minY)/v.cellY));
  let changed=false;
  for(let iz=minZ;iz<=maxZ;iz++)for(let iy=minY;iy<=maxY;iy++)for(let ix=minX;ix<=maxX;ix++) {
    const wx=v.minX+ix*v.cellX,wy=v.minY+iy*v.cellY,wz=v.minZ+iz*v.cellZ;
    const radial=Math.max(0,1-Math.hypot(wx-x,wz-z)/r),layerWeight=Math.max(0,1-Math.abs(wy-y)/vertical);
    const amount=(stroke.mode==='pull'?1:-1)*stroke.strength*.35*radial*radial*layerWeight;
    if(Math.abs(amount)<1e-6)continue;
    const at=index(v,ix,iy,iz),value=encode(sampleTerrainDensity(source,wx-nx*amount,wy,wz-nz*amount));
    changed ||= value!==v.data[at];v.data[at]=value;
  }
  return changed;
}

export function sampleTerrainDensity(v,x,y,z) {
  const gx=(x-v.minX)/v.cellX,gy=(y-v.minY)/v.cellY,gz=(z-v.minZ)/v.cellZ;
  if(gx<0||gy<0||gz<0||gx>v.width-1||gy>v.height-1||gz>v.depth-1)return -128/TERRAIN_DENSITY_SCALE;
  const ix=Math.min(v.width-2,Math.floor(gx)),iy=Math.min(v.height-2,Math.floor(gy)),iz=Math.min(v.depth-2,Math.floor(gz));
  const tx=gx-ix,ty=gy-iy,tz=gz-iz;let value=0;
  for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)
    value+=decode(v.data[index(v,ix+dx,iy+dy,iz+dz)])*(dx?tx:1-tx)*(dy?ty:1-ty)*(dz?tz:1-tz);
  return value;
}

// A layer can contain several disconnected solids and air pockets in one XZ
// column. This keeps the cardboard style without reducing the volume to height.
export function terrainVolumeSlice(v,y) {
  const values=new Float32Array(v.width*v.depth);
  for(let z=0;z<v.depth;z++)for(let x=0;x<v.width;x++)values[z*v.width+x]=sampleTerrainDensity(v,v.minX+x*v.cellX,y,v.minZ+z*v.cellZ);
  return {columns:v.width,rows:v.depth,minX:v.minX,minZ:v.minZ,cellSizeX:v.cellX,cellSizeZ:v.cellZ,values};
}

export function terrainVolumeFloor(v,x,z,reference=0) {
  let best=null,distance=Infinity;
  const bottom=Math.ceil(v.minY/v.step),top=Math.floor((v.minY+(v.height-1)*v.cellY)/v.step);
  for(let layer=bottom;layer<top;layer++) {
    const y=layer*v.step;
    if(sampleTerrainDensity(v,x,y-v.step/2,z)>=0 && sampleTerrainDensity(v,x,y+v.step/2,z)<0 && Math.abs(y-reference)<distance) {
      best=y;distance=Math.abs(y-reference);
    }
  }
  return best;
}

/** Broad-phase clearance for planar unit movement, derived from the 3D solid. */
export function createVolumeCollisionField(v,bodyHeight=2.25) {
  const count=v.width*v.depth,field=new Float32Array(count),solid=new Uint8Array(count);
  for(let z=0;z<v.depth;z++)for(let x=0;x<v.width;x++) {
    const wx=v.minX+x*v.cellX,wz=v.minZ+z*v.cellZ;
    const blocked=[.12,bodyHeight*.5,bodyHeight].some(y=>sampleTerrainDensity(v,wx,y,wz)>0);
    solid[z*v.width+x]=blocked?1:0;field[z*v.width+x]=blocked?0:10000;
  }
  const diagonal=Math.hypot(v.cellX,v.cellZ);
  for(let pass=0;pass<2;pass++)for(let n=0;n<count;n++) {
    const at=pass?count-1-n:n,x=at%v.width,z=Math.floor(at/v.width),dir=pass?1:-1;
    if(x+dir>=0&&x+dir<v.width)field[at]=Math.min(field[at],field[at+dir]+v.cellX);
    if(z+dir>=0&&z+dir<v.depth) {
      field[at]=Math.min(field[at],field[at+dir*v.width]+v.cellZ);
      for(const dx of [-1,1])if(x+dx>=0&&x+dx<v.width)field[at]=Math.min(field[at],field[at+dir*v.width+dx]+diagonal);
    }
  }
  for(let i=0;i<count;i++)if(solid[i])field[i]=-Math.min(v.cellX,v.cellZ)*.5;
  return field;
}

export function volumeBodyContact(v,body) {
  const field=v.clearance;if(!v.edited||!field)return null;
  const sample=(x,z)=>{
    const gx=Math.max(0,Math.min(v.width-1.001,(x-v.minX)/v.cellX)),gz=Math.max(0,Math.min(v.depth-1.001,(z-v.minZ)/v.cellZ));
    const ix=Math.floor(gx),iz=Math.floor(gz),tx=gx-ix,tz=gz-iz,at=iz*v.width+ix;
    return (field[at]*(1-tx)+field[at+1]*tx)*(1-tz)+(field[at+v.width]*(1-tx)+field[at+v.width+1]*tx)*tz;
  };
  const radius=body.radius??.8,distance=sample(body.x,body.z);
  if(distance>=radius)return null;
  const nx=sample(body.x+.15,body.z)-sample(body.x-.15,body.z),nz=sample(body.x,body.z+.15)-sample(body.x,body.z-.15),length=Math.hypot(nx,nz);
  return {x:length>1e-6?nx/length:0,z:length>1e-6?nz/length:0,depth:radius-distance};
}
