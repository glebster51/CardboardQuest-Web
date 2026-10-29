import { createMarkerContours, markerFillTransform, UNIT_MARKER_RADIUS, MARKER_STROKE_WIDTH } from '../marker-shapes.mjs?v=ab782efa5048549c';

export function resizeRingGeometry(geometry, radius, width = MARKER_STROKE_WIDTH) {
  const segments=geometry.parameters.thetaSegments,position=geometry.attributes.position;
  for(let row=0;row<2;row++)for(let i=0;i<=segments;i++){
    const r=row?radius:Math.max(0,radius-width),angle=i/segments*Math.PI*2;
    position.setXYZ(row*(segments+1)+i,r*Math.cos(angle),r*Math.sin(angle),0);
  }
  position.needsUpdate=true;geometry.computeBoundingSphere();
}

function markerGeometry(THREE, radius, extension, filled = false) {
  const {outer,inner}=createMarkerContours(radius,extension,MARKER_STROKE_WIDTH,48);
  const path=(points,clockwise)=>{
    const ordered=THREE.ShapeUtils.isClockWise(points)===clockwise?points:[...points].reverse();
    const shape=new THREE.Shape();shape.moveTo(ordered[0].x,ordered[0].y);
    for(let i=1;i<ordered.length;i++)shape.lineTo(ordered[i].x,ordered[i].y);
    shape.closePath();return shape;
  };
  const shape=path(filled?inner:outer,false);
  if(!filled)shape.holes.push(path(inner,true));
  return new THREE.ShapeGeometry(shape);
}

/** Radius and length can change; the outline is always .26 world units wide. */
export function createVectorMarker(THREE, color, fillColor, showProgress, showOverlap = false, fullExtension = 5.4) {
  const group=new THREE.Group();group.name='combat-vector-marker';
  const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.96,side:THREE.DoubleSide,depthWrite:false,depthTest:true});
  const outline=new THREE.Mesh(markerGeometry(THREE,UNIT_MARKER_RADIUS,0),material);
  outline.rotation.x=Math.PI/2;outline.renderOrder=2;group.add(outline);
  let overlap=null,progress=null,currentExtension=0,sizeScale=1,amount=0;
  if(showOverlap){
    overlap=new THREE.Mesh(outline.geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.5,
      side:THREE.DoubleSide,depthWrite:false,depthTest:false,stencilWrite:true,stencilRef:1,stencilFunc:THREE.EqualStencilFunc}));
    overlap.rotation.x=Math.PI/2;overlap.renderOrder=20;group.add(overlap);
  }
  if(showProgress){
    progress=new THREE.Mesh(markerGeometry(THREE,UNIT_MARKER_RADIUS,fullExtension,true),
      new THREE.MeshBasicMaterial({color:fillColor,transparent:true,opacity:.94,side:THREE.DoubleSide,depthWrite:false,depthTest:true}));
    progress.rotation.x=Math.PI/2;progress.renderOrder=3;progress.visible=false;group.add(progress);
  }
  function radius(){return Math.max(MARKER_STROKE_WIDTH/Math.cos(Math.PI/48)+.001,UNIT_MARKER_RADIUS*sizeScale);}
  function updateProgress(){
    if(!progress)return;
    const backEdge=-radius()+MARKER_STROKE_WIDTH/Math.cos(Math.PI/48);
    const transform=markerFillTransform(amount,backEdge);
    progress.scale.y=Math.max(.001,transform.scaleY);progress.position.z=transform.offsetY;
    progress.visible=amount>.005 && outline.visible;
  }
  function rebuild(resizeFill=false){
    const previous=outline.geometry;
    outline.geometry=markerGeometry(THREE,radius(),currentExtension*sizeScale);
    if(overlap)overlap.geometry=outline.geometry;
    previous.dispose();
    outline.visible=UNIT_MARKER_RADIUS*sizeScale>MARKER_STROKE_WIDTH/Math.cos(Math.PI/48);
    if(overlap)overlap.visible=outline.visible;
    if(progress&&resizeFill){const old=progress.geometry;progress.geometry=markerGeometry(THREE,radius(),fullExtension*sizeScale,true);old.dispose();}
    updateProgress();
  }
  return {group,outline,material,progress,overlap,
    setExtension(extension){const next=Math.max(0,extension);if(Math.abs(next-currentExtension)<1e-4)return;currentExtension=next;rebuild();},
    setSizeScale(scale){const next=Math.max(.001,scale);if(Math.abs(next-sizeScale)<1e-4)return;sizeScale=next;rebuild(true);},
    setProgress(value){amount=value;updateProgress();},
  };
}
