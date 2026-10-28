/** A new starting point, deliberately retaining none of the previous terrain data. */
export function resetTerrainToSimpleBase() { return {base:'simple',strokes:[]}; }

const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function noise(x,z) {
  const ix=Math.floor(x),iz=Math.floor(z),tx=smooth(x-ix),tz=smooth(z-iz);
  const hash=(a,b)=>{let n=Math.imul(a,374761393)^Math.imul(b,668265263)^9137;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
  return (hash(ix,iz)*(1-tx)+hash(ix+1,iz)*tx)*(1-tz)+(hash(ix,iz+1)*(1-tx)+hash(ix+1,iz+1)*tx)*tz;
}
const segmentDistance=(x,z,a,b)=>{
  const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(x-a.x-dx*t,z-a.z-dz*t);
};

/** Circle + spokes to every exit. Border ridges leave a clear passage between them. */
export function simpleTerrainLayout(location) {
  const center={x:0,z:0},radius=6;
  const routes=(location.exits??[]).map(p=>{
    const length=Math.hypot(p.x,p.z)||1,extension=4;
    return {end:{x:p.x+p.x/length*extension,z:p.z+p.z/length*extension},width:Math.max(2.8,(p.halfWidth??2.3)+.6)};
  });
  const bounds={minX:-radius,maxX:radius,minZ:-radius,maxZ:radius};
  for(const {end} of routes){bounds.minX=Math.min(bounds.minX,end.x);bounds.maxX=Math.max(bounds.maxX,end.x);
    bounds.minZ=Math.min(bounds.minZ,end.z);bounds.maxZ=Math.max(bounds.maxZ,end.z);}
  for(const key of ['minX','minZ'])bounds[key]-=18;
  for(const key of ['maxX','maxZ'])bounds[key]+=18;
  const distance=(x,z)=>Math.min(Math.hypot(x,z)-radius,...routes.map(route=>segmentDistance(x,z,center,route.end)-route.width));
  return {center,radius,routes,bounds,
    // Low frequency noise is evaluated once during mesh generation.
    footprintAt:(x,z)=>12-distance(x,z)+(noise(x/8,z/8)-.5)*2,
    heightAt(x,z){
      const d=distance(x,z)+(noise(x/3,z/3)-.5)*.45;
      if(d<=0)return 0;
      return .72+smooth(d/2.8)*(.25+noise(x/4.5,z/4.5)*2.1+noise((x+31)/9,(z-9)/9)*.5);
    }};
}
