import {validateTerrainView,type TerrainView,type TerrainGrid} from './terrain-spatial-model';
import type {PlayerFrame} from './player-contracts';
import {atlasHexAt} from './campaign-atlas-model';
import {terrainGridLayout} from './terrain-grid-layout';
/** Only the allowlisted player snapshot enters this field. Never fill forgotten heights from GM terrain. */
export function publicTerrainGrid(frame:PlayerFrame,view:TerrainView):TerrainGrid{
  validateTerrainView(view);const heights=new Float32Array(view.columns*view.rows),l=terrainGridLayout(view),cells=new Map(frame.map?.cells.map(c=>[c.q+':'+c.r,c]));
  if(frame.mode==='map'&&frame.map)for(let y=0;y<view.rows;y++)for(let x=0;x<view.columns;x++){
    const p={x:l.x.values[x]!,y:l.y.values[y]!},h=atlasHexAt(p,frame.map.hexMeters),cell=cells.get(h.q+':'+h.r);
    heights[y*view.columns+x]=cell?.elevationM??0;
  }
  const centre=frame.map?atlasHexAt({x:view.frame.x+view.frame.width/2,y:view.frame.y+view.frame.height/2},frame.map.hexMeters):null;
  return{view:{...view,focusM:centre?cells.get(centre.q+':'+centre.r)?.elevationM??0:0},heights,seaLevelM:0};
}
