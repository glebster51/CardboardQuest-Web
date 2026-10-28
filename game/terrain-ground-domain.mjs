// These are the actual smoothed cap contours, not the authored arena polygon.
// Nested contours use the same even/odd fill rule as the terrain triangulator.
const boundsCache=new WeakMap();
function contourBounds(contours) {
  let bounds=boundsCache.get(contours);
  if(!bounds){bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
    for(const points of contours)for(const p of points){bounds.minX=Math.min(bounds.minX,p.x);bounds.maxX=Math.max(bounds.maxX,p.x);
      bounds.minZ=Math.min(bounds.minZ,p.z);bounds.maxZ=Math.max(bounds.maxZ,p.z);}
    boundsCache.set(contours,bounds);
  }
  return bounds;
}
export function insideTerrainContours(x,z,contours) {
  const b=contourBounds(contours);if(x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ)return false;
  let inside=false;
  for(const points of contours)for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }
  return inside;
}

function contourDistance(x,z,contours) {
  let squared=Infinity,nearestX=x,nearestZ=z;
  for(const points of contours)for(let i=0;i<points.length;i++) {
    const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dz=b.z-a.z;
    const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
    const px=a.x+dx*t,pz=a.z+dz*t,distance=(x-px)**2+(z-pz)**2;
    if(distance<squared){squared=distance;nearestX=px;nearestZ=pz;}
  }
  return {distance:Math.sqrt(squared),x:nearestX,z:nearestZ};
}

export function terrainGroundContains(domain,x,z,margin=0) {
  if(!insideTerrainContours(x,z,domain.floor))return false;
  if(margin>0&&contourDistance(x,z,domain.floor).distance<margin)return false;
  return !domain.blockers.some(contours=>insideTerrainContours(x,z,contours)
    ||margin>0&&contourDistance(x,z,contours).distance<margin);
}

/** Signed clearance and inward normal for a unit-sized disc on the zero plane. */
const contactCache=new WeakMap();
export function terrainGroundContact(domain,body) {
  const last=contactCache.get(body),radius=body.radius??.8;
  if(last&&last.domain===domain&&last.x===body.x&&last.z===body.z&&last.radius===radius)return last.contact;
  const contact=findGroundContact(domain,body);
  contactCache.set(body,{domain,x:body.x,z:body.z,radius,contact});
  return contact;
}

function findGroundContact(domain,body) {
  let contact=null;
  const check=(contours,keepInside)=>{
    if(!contours.length)return;
    const b=contourBounds(contours),r=body.radius??.8;
    if(!keepInside&&(body.x<b.minX-r||body.x>b.maxX+r||body.z<b.minZ-r||body.z>b.maxZ+r))return;
    const near=contourDistance(body.x,body.z,contours);
    const allowed=insideTerrainContours(body.x,body.z,contours)===keepInside;
    const signed=allowed?near.distance:-near.distance,depth=(body.radius??.8)-signed;
    if(depth<=0||contact&&depth<=contact.depth)return;
    let nx=(allowed?1:-1)*(body.x-near.x),nz=(allowed?1:-1)*(body.z-near.z),length=Math.hypot(nx,nz);
    if(length<1e-8) {
      // At an exact vertex/edge, find the permitted side without relying on winding.
      for(const [x,z] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        if(insideTerrainContours(body.x+x*.001,body.z+z*.001,contours)===keepInside){nx=x;nz=z;length=1;break;}
      }
    }
    contact={x:nx/(length||1),z:nz/(length||1),depth,edge:near,boundary:keepInside};
  };
  check(domain.floor,true);
  for(const contours of domain.blockers)check(contours,false);
  return contact;
}
