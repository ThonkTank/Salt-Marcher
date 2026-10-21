import type {LandscapeBox,LandscapeRecord} from '../atlas-landscape';
export type RasterSamples=number|{width:number;height:number};
/** Reject patches without a supersample centre, including rectangular rasters. */
export function landscapeSampleFilter(box:LandscapeBox,pixels:RasterSamples,enabled:boolean){
 const samples=typeof pixels==='number'?{width:pixels,height:pixels}:pixels,args:number[]=[];
 if(!enabled||samples.width<=0||samples.height<=0)return {sql:'',args};
 const sql=' AND ceil((max(min_x,?)-?)/?*?-.5000001)<=floor((min(max_x,?)-?)/?*?-.4999999) AND ceil((max(min_y,?)-?)/?*?-.5000001)<=floor((min(max_y,?)-?)/?*?-.4999999)';
 for(const [origin,length,count]of [[box.x,box.width,samples.width],[box.y,box.height,samples.height]])args.push(origin!,origin!,length!,count!*2,origin!+length!,origin!,length!,count!*2);
 return {sql,args};
}
// All keys ascend. Negated resolutions preserve the canonical coarse-first
// order; version 1 precedes the ordered cumulative version-2 paint layers.
const colorKeys=["CASE WHEN paint_version=1 THEN 0 ELSE 1 END","CASE WHEN paint_version=1 THEN -coalesce(resolution,0) ELSE 0 END","coalesce(paint_order,1e999)","-coalesce(resolution,0)",'source_row'];
export const LANDSCAPE_COLOR_INDEX=`CREATE INDEX temp.landscape_color_order ON landscape_shape_bounds(${colorKeys.join(',')}) WHERE terrain_kind='color'`;
const coverKeys=['-coalesce(resolution,0)','coalesce(paint_order,0)','source_row'];
export const LANDSCAPE_COVER_INDEX=`CREATE INDEX temp.landscape_cover_order ON landscape_shape_bounds(${coverKeys.join(',')}) WHERE terrain_kind='cover'`;
// Include the predicate and raw paint_order as well as its sort expression:
// otherwise SQLite still probes the metadata table for every candidate.
export const LANDSCAPE_BASE_INDEX="CREATE INDEX IF NOT EXISTS temp.landscape_base_span ON landscape_shape_bounds(terrain_kind,max_x,min_x,max_y,min_y,resolution DESC,coalesce(paint_order,0),source_row,paint_order) WHERE terrain_kind='base'";
type Prepare=(sql:string)=>any;
/** A page owns only 128 numeric keys, then one payload at a time. Every SQL
 * statement has finished before yielding a record, so colour work may release
 * its WAL transaction between raster steps. No OFFSET scan or author array. */
export const landscapeColorRecords=(prepare:Prepare,campaignId:string,box:LandscapeBox,filter:ReturnType<typeof landscapeSampleFilter>)=>orderedRecords(prepare,campaignId,box,filter,'color',colorKeys);
export const landscapeCoverRecords=(prepare:Prepare,campaignId:string,box:LandscapeBox,filter:ReturnType<typeof landscapeSampleFilter>)=>orderedRecords(prepare,campaignId,box,filter,'cover',coverKeys);
function* orderedRecords(prepare:Prepare,campaignId:string,box:LandscapeBox,filter:ReturnType<typeof landscapeSampleFilter>,kind:'color'|'cover',keys:string[]):Generator<LandscapeRecord>{
 const values=keys.slice(0,-1),fields=values.map((k,i)=>`${k} k${i}`).join(',')+',CAST(source_row AS TEXT) id';
 const where=`terrain_kind='${kind}' AND max_x>=? AND min_x<=? AND max_y>=? AND min_y<=?`+filter.sql;
 const args=[box.x,box.x+box.width,box.y,box.y+box.height,...filter.args],order=keys.join(',');
 const first=prepare(`SELECT ${fields} FROM temp.landscape_shape_bounds WHERE ${where} ORDER BY ${order} LIMIT 128`);
 const next=prepare(`SELECT ${fields} FROM temp.landscape_shape_bounds WHERE ${where} AND (${order})>(${keys.map(()=>'?').join(',')}) ORDER BY ${order} LIMIT 128`);
 const payload=prepare("SELECT a.payload,l.trashed,json_extract(l.payload,'$.name') location_name FROM atlas_landscape a LEFT JOIN location l ON l.campaign_id=a.campaign_id AND l.id=json_extract(a.payload,'$.locationId') WHERE a.rowid=? AND a.campaign_id=?");
 let after:unknown[]|undefined;
 for(;;){
  const rows=after?next.all(...args,...after):first.all(...args);if(!rows.length)return;
  for(const row of rows){
   const value=payload.get(row.id,campaignId);if(!value||value.trashed)continue;
   const record=JSON.parse(value.payload) as LandscapeRecord;if(value.location_name!==null)record.name=value.location_name;
   yield record;
  }
  const last=rows.at(-1)!;after=[...values.map((_,i)=>last['k'+i]),last.id];
  if(rows.length<128)return;
 }
}
