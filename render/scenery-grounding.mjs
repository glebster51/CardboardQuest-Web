// Editor transforms remain in the original terrain coordinate system. Sculpting
// adds only a derived Y displacement, so undo/save/reload never accumulates it.
export function terrainDisplacementAt(terrain,x,z) {
  if(!terrain?.sample || !terrain.sampleBase)return 0;
  return terrain.sample(x,z)-terrain.sampleBase(x,z);
}
export function attachSceneryToTerrain(object,terrain) {
  object.userData.terrainPlacement={authoredY:object.position.y-terrainDisplacementAt(terrain,object.position.x,object.position.z)};
}
export function sceneryAuthoredY(object,terrain) {
  const y=object.position.y-terrainDisplacementAt(terrain,object.position.x,object.position.z)-(object.userData.cardboardGroundLift??0);
  if(object.userData.terrainPlacement)object.userData.terrainPlacement.authoredY=y;
  return y;
}
export function applySceneryGrounding(object,terrain,authoredY=object.userData.terrainPlacement?.authoredY) {
  if(!object.userData.terrainPlacement || !Number.isFinite(authoredY))return;
  object.userData.terrainPlacement.authoredY=authoredY;
  object.position.y=authoredY+terrainDisplacementAt(terrain,object.position.x,object.position.z)+(object.userData.cardboardGroundLift??0);
  object.updateMatrixWorld?.(true);
}
export function regroundLocationScenery(location) {
  let count=0;
  location.sceneGroup?.traverse(object=>{
    if(!object.userData.terrainPlacement)return;
    applySceneryGrounding(object,location.terrainHeightMap);count++;
  });
  return count;
}
