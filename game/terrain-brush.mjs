export const TERRAIN_MAX_STROKES=1024;
export const TERRAIN_MAX_POINTS=200000;
export const TERRAIN_MAX_STROKE_POINTS=5000;
export const isHeightStroke=stroke=>['level','raise','lower'].includes(stroke?.mode);
// Compatibility only: old files stored volume operations after the height list.
// Every new edit and every bake uses a single chronological operation list.
export const terrainOperations=edits=>[...(edits?.strokes??[]),...(edits?.volumeStrokes??[])];
export const terrainBrushSpacing=(radius,cellSize)=>Math.max(cellSize*.65,radius*.16);
export function terrainHeightAfterDab(before,stroke,distance,cellSize) {
  const t=Math.max(0,Math.min(1,distance/stroke.radius)),smooth=t*t*(3-2*t),weight=(1-smooth)**2;
  if(stroke.mode==='level')return before+(stroke.targetHeight-before)*Math.min(.95,stroke.strength*weight);
  return before+(stroke.mode==='raise'?1:-1)*stroke.strength*terrainBrushSpacing(stroke.radius,cellSize)/stroke.radius*weight;
}
export function terrainEditBudget(edits) {
  const operations=terrainOperations(edits),points=operations.reduce((sum,s)=>sum+s.points.length,0);
  const full=operations.length>=TERRAIN_MAX_STROKES||points>=TERRAIN_MAX_POINTS;
  return {strokes:operations.length,points,full,warning:full||operations.length>=TERRAIN_MAX_STROKES*.8||points>=TERRAIN_MAX_POINTS*.8};
}
