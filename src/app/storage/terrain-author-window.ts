import {terrainAuthorWindow,type TerrainAuthorQuery,type TerrainAuthorCheckpoint,type TerrainAuthorPage} from '../terrain-author-checkpoint';
import {decodeHeights,DEFAULT_HEIGHT_M,type HeightTile} from '../terrain-height';
import {accumulateHeightSources,type TerrainHeightSource} from '../terrain-height-lattice';
import {landscapeSampleFilter} from './landscape-record-stream';
import type {AtlasRegionSource} from '../atlas-region-contracts';
const fields="revision,json_extract(payload,'$.height.version') version,json_extract(payload,'$.height.x') x,json_extract(payload,'$.height.y') y,json_extract(payload,'$.height.pixel') pixel,json_extract(payload,'$.height.data') data";
type Row=HeightTile&{revision:number};
/** Readonly, called inside the worker's pinned canonical transaction. SQL never
 * materializes names, polygons or other author metadata. Ground streams one row. */
export function readTerrainAuthorCheckpoint(db:any,source:AtlasRegionSource,q:TerrainAuthorQuery):TerrainAuthorCheckpoint{
 const w=terrainAuthorWindow(q);
 if(source.token!==q.token||source.fence!==q.fence||source.revision!==q.revision)throw Error('Autorenquelle inzwischen geändert.');
 if(q.receipt){const r=db.prepare('SELECT campaign_id,fingerprint FROM atlas_receipt WHERE command_id=?').get(q.receipt.commandId);if(!r||r.campaign_id!==source.campaignId||r.fingerprint!==q.receipt.fingerprint)throw Error('Autorenpräfix nicht bestätigt.');}
 const rows=db.prepare(`SELECT ${fields} FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.height.version')=2 AND json_extract(payload,'$.height.pixel')=? AND json_extract(payload,'$.height.x')>=? AND json_extract(payload,'$.height.x')<=? AND json_extract(payload,'$.height.y')>=? AND json_extract(payload,'$.height.y')<=?`).all(source.campaignId,q.pixel,w.left*w.edge,w.right*w.edge,w.top*w.edge,w.bottom*w.edge) as Row[];
 if(rows.length>w.pages)throw Error('Doppelte Autorenbandseiten.');const by=new Map(rows.map(r=>[r.x+','+r.y,r]));if(by.size!==rows.length)throw Error('Doppelte Autorenbandseiten.');const pages:TerrainAuthorPage[]=[];
 for(let y=w.top;y<=w.bottom;y++)for(let x=w.left;x<=w.right;x++){const row=by.get(x*w.edge+','+y*w.edge);pages.push({x:x*w.edge,y:y*w.edge,pixel:q.pixel,revision:row?.revision??0,values:row?decodeHeights(row).slice():new Float32Array(4096).fill(NaN)});}
 const ground=q.lattices.map(l=>{
  const b={x:l.x-l.dx/2,y:l.y-l.dy/2,width:65*l.dx,height:65*l.dy},filter=landscapeSampleFilter(b,{width:32.5,height:32.5},true);
  const records=db.prepare(`SELECT ${fields} FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.height') IS NOT NULL AND max_x>=? AND min_x<=? AND max_y>=? AND min_y<=? ${filter.sql} ORDER BY CAST(json_extract(payload,'$.height.pixel') AS REAL) DESC,rowid`).iterate(source.campaignId,b.x,b.x+b.width,b.y,b.y+b.height,...filter.args);
  function* sources():Generator<TerrainHeightSource>{for(const row of records as Iterable<Row>)yield{version:row.version,x:row.x,y:row.y,pixel:row.pixel,read:()=>decodeHeights(row)};}
  const values=new Float64Array(4225).fill(DEFAULT_HEIGHT_M),additions=new Float64Array(4225);
  accumulateHeightSources(Float64Array.from({length:65},(_,i)=>l.x+i*l.dx),Float64Array.from({length:65},(_,i)=>l.y+i*l.dy),sources(),values,additions);
  for(let i=0;i<values.length;i++)values[i]=values[i]!+additions[i]!;
  return{lattice:{...l},values};
 });
 return{query:structuredClone(q),pages,ground,coverage:{left:w.left,right:w.right,top:w.top,bottom:w.bottom,complete:true}};
}
