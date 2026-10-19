import {createHash} from 'node:crypto';
import type {Point} from '../contracts';
import type {CityUnit,CityHeader} from '../city-contracts';
import {bounds,type LandscapeRecord,type LandscapeBox} from '../atlas-landscape';
import {legacyLine,lineLength} from '../landscape-line';
import {putLandscape} from './atlas-landscape';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const parse=(r:any)=>{if(!r||r.checksum&&hash(r.payload)!==r.checksum)throw Error('Straßendaten fehlen oder sind beschädigt.');return JSON.parse(r.payload);};
export const overlaps=(a:LandscapeBox,b:LandscapeBox)=>a.x<=b.x+b.width&&a.x+a.width>=b.x&&a.y<=b.y+b.height&&a.y+a.height>=b.y;
export function cityRoadFrame(db:any,cam:string,cityId:string){const row=db.prepare("SELECT x,y,angle FROM atlas_binding WHERE campaign_id=? AND kind='city' AND owner_id=?").get(cam,cityId);return row??{x:0,y:0,angle:0};}
export function roadTransform(p:Point,f:{x:number;y:number;angle:number},inverse=false):Point{
 const c=Math.cos(f.angle),s=Math.sin(f.angle);if(inverse){const x=p.x-f.x,y=p.y-f.y;return{x:x*c+y*s,y:-x*s+y*c};}return{x:f.x+p.x*c-p.y*s,y:f.y+p.x*s+p.y*c};
}
/** Legacy cities are projected without rewriting user data or historical receipts.
 * The first explicit edit replaces the old geometry with a canonical reference,
 * inside the same captured Atlas transaction. Undo can restore either version. */
export function legacyCityRoad(db:any,cam:string,row:any):LandscapeRecord|null{
 const u=parse(row) as CityUnit;if(u.kind!=='road'||u.roadRef)return null;
 const h=parse(db.prepare('SELECT payload,checksum FROM city_document WHERE campaign_id=? AND id=?').get(cam,row.city_id)) as CityHeader;
 const f=cityRoadFrame(db,cam,row.city_id),nodes=(u.nodeIds??[]).map(id=>parse(db.prepare("SELECT payload,checksum FROM city_unit WHERE campaign_id=? AND city_id=? AND id=? AND kind='node'").get(cam,row.city_id,id)));
 const local=nodes.length===2?[nodes[0].point,...u.via??[],nodes[1].point]:u.outline??[];
 const line=u.line??{...legacyLine('road'),color:'#c1ae8b'};
 return {id:u.id,revision:h.revision,kind:'road',name:u.name,points:local.map(p=>roadTransform(p,f)),polygons:[],resolution:1,width:u.width??6,values:{},line,routeId:u.id,
  junctions:(u.nodeIds??[]).map((id,i)=>({id,index:i?local.length-1:0})),cityAnchors:local.map((_,index)=>({index,cityId:row.city_id}))};
}
export function* legacyCityRoads(db:any,cam:string,box?:LandscapeBox):Generator<LandscapeRecord>{
 for(const row of db.prepare("SELECT u.* FROM city_unit u WHERE u.campaign_id=? AND u.kind='road' AND json_extract(u.payload,'$.roadRef') IS NULL AND NOT EXISTS(SELECT 1 FROM atlas_landscape l WHERE l.campaign_id=u.campaign_id AND l.id=u.id)").iterate(cam)){
  const r=legacyCityRoad(db,cam,row);if(r&&(!box||overlaps(bounds(r),box)))yield r;
 }
}
export function readSharedRoad(db:any,cam:string,id:string):LandscapeRecord|null{
 const row=db.prepare("SELECT payload FROM atlas_landscape WHERE campaign_id=? AND id=? AND (CASE WHEN json_valid(payload) THEN json_extract(payload,'$.kind') END)='road'").get(cam,id);if(row)return parse(row);
 const old=db.prepare("SELECT * FROM city_unit WHERE campaign_id=? AND id=? AND kind='road'").get(cam,id);return old?legacyCityRoad(db,cam,old):null;
}
export function roadReference(db:any,cam:string,r:LandscapeRecord){
 const row=db.prepare("SELECT * FROM city_unit WHERE campaign_id=? AND id=? AND kind='road'").get(cam,r.id);if(!row)return;
 const old=parse(row),u={id:r.id,kind:'road',name:r.name,protected:old.protected,roadRef:r.id},p=JSON.stringify(u);
 db.prepare('UPDATE city_unit SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(p,hash(p),cam,r.id);
}
export function roadAsCityUnit(r:LandscapeRecord,f:{x:number;y:number;angle:number},protectedValue=true):CityUnit{
 const local=structuredClone(r);local.points=local.points.map(p=>roadTransform(p,f,true));
 const continuity=local.line?.continuity;if(continuity)for(const key of ['before','after'] as const)if(continuity[key])continuity[key]=roadTransform(continuity[key]!,f,true);
 return {id:r.id,kind:'road',name:r.name,protected:protectedValue,roadRef:r.id,roadRevision:r.revision,outline:local.points,width:r.width,line:local.line,routeId:r.routeId,routeLength:r.routeLength};
}
export function projectCityRoads(db:any,cam:string,h:CityHeader,units:CityUnit[]):CityUnit[]{
 const f=cityRoadFrame(db,cam,h.id),corners=[{x:0,y:0},{x:h.width,y:0},{x:h.width,y:h.height},{x:0,y:h.height}].map(p=>roadTransform(p,f));
 const box={x:Math.min(...corners.map(p=>p.x)),y:Math.min(...corners.map(p=>p.y)),width:Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x)),height:Math.max(...corners.map(p=>p.y))-Math.min(...corners.map(p=>p.y))};
 const out=units.filter(u=>u.kind!=='road'),original=new Map(units.filter(u=>u.kind==='road').map(u=>[u.id,u]));
 for(const row of db.prepare("SELECT payload FROM atlas_landscape WHERE campaign_id=? AND (CASE WHEN json_valid(payload) THEN json_extract(payload,'$.kind') END)='road' AND max_x>=? AND min_x<=? AND max_y>=? AND min_y<=?").iterate(cam,box.x,box.x+box.width,box.y,box.y+box.height)){
  const r=parse(row);out.push(roadAsCityUnit(r,f,original.get(r.id)?.protected??true));original.delete(r.id);
 }
 for(const u of original.values()){const r=readSharedRoad(db,cam,u.id);if(r)out.push(roadAsCityUnit(r,f,u.protected));}
 return out;
}
export function putCityRoad(db:any,cam:string,cityId:string,u:CityUnit){
 const existing=readSharedRoad(db,cam,u.roadRef??u.id),f=cityRoadFrame(db,cam,cityId);
 if(u.roadRevision!==undefined&&existing?.revision!==u.roadRevision)throw Error('Straße inzwischen geändert. Neu laden.');
 const local=u.nodeIds?.length===2?[parse(db.prepare('SELECT payload,checksum FROM city_unit WHERE campaign_id=? AND id=?').get(cam,u.nodeIds[0])).point,...u.via??[],parse(db.prepare('SELECT payload,checksum FROM city_unit WHERE campaign_id=? AND id=?').get(cam,u.nodeIds[1])).point]:u.outline??[];
 const line=structuredClone(u.line??existing?.line??{...legacyLine('road'),color:'#c1ae8b'});
 if(line.continuity)for(const key of ['before','after'] as const)if(line.continuity[key])line.continuity[key]=roadTransform(line.continuity[key]!,f);
 const r:LandscapeRecord={...(existing??{id:u.id,kind:'road',revision:0,polygons:[],resolution:1,values:{}}),name:u.name,width:u.width??existing?.width??6,points:local.map(p=>roadTransform(p,f)),line};
 if(!existing){r.cityAnchors=local.map((_,index)=>({index,cityId}));r.junctions=(u.nodeIds??[]).map((id,i)=>({id,index:i?local.length-1:0}));}
 else if(r.points.length!==existing.points.length){r.cityAnchors=local.map((_,index)=>({index,cityId:existing.cityAnchors?.find(a=>a.index===index)?.cityId??cityId}));r.junctions=existing.junctions?.filter(j=>j.index===0||j.index===existing.points.length-1).map(j=>({...j,index:j.index?local.length-1:0}));}
 if(!existing){
  const candidates=roadSnapshot(db,cam),changed=new Map<string,LandscapeRecord>();
  for(const index of [0,r.points.length-1])for(const candidate of candidates.values()){
   if(candidate.kind!=='road'||candidate.id===r.id)continue;const at=candidate.points.findIndex(p=>Math.hypot(p.x-r.points[index]!.x,p.y-r.points[index]!.y)<1e-7);if(at<0)continue;
   const other=changed.get(candidate.id)??structuredClone(candidate),id=other.junctions?.find(j=>j.index===at)?.id??r.junctions?.find(j=>j.index===index)?.id??r.id+':'+index;
   other.junctions=[...(other.junctions??[]).filter(j=>j.index!==at),{index:at,id}];r.junctions=[...(r.junctions??[]).filter(j=>j.index!==index),{index,id}];changed.set(other.id,other);break;
  }
  for(const other of changed.values())putLandscape(db,cam,other,other.revision);
 }
 const stored=db.prepare('SELECT revision FROM atlas_landscape WHERE campaign_id=? AND id=?').get(cam,r.id);putLandscape(db,cam,r,stored?.revision??existing?.revision??null);
 const row=db.prepare('SELECT city_id FROM city_unit WHERE campaign_id=? AND id=?').get(cam,u.id);
 if(!row){const p=JSON.stringify({id:u.id,kind:'road',name:u.name,protected:u.protected,roadRef:r.id});db.prepare('INSERT INTO city_unit VALUES(?,?,?,?,?,?)').run(cam,cityId,u.id,'road',p,hash(p));}
 roadReference(db,cam,r);
}
export function removeSharedRoad(db:any,cam:string,id:string){db.prepare("DELETE FROM city_unit WHERE campaign_id=? AND id=? AND kind='road'").run(cam,id);db.prepare("DELETE FROM atlas_landscape WHERE campaign_id=? AND id=? AND (CASE WHEN json_valid(payload) THEN json_extract(payload,'$.kind') END)='road'").run(cam,id);}
type RoadSnapshot=Map<string,LandscapeRecord>&{nodes?:Map<string,Point>};
export function roadSnapshot(db:any,cam:string):RoadSnapshot{const result:RoadSnapshot=new Map([...db.prepare("SELECT payload FROM atlas_landscape WHERE campaign_id=? AND (CASE WHEN json_valid(payload) THEN json_extract(payload,'$.kind') END) IN('road','river')").all(cam).map(parse),...legacyCityRoads(db,cam)].map(r=>[r.id,r]));result.nodes=new Map(db.prepare("SELECT * FROM city_unit WHERE campaign_id=? AND kind='node'").all(cam).map((row:any)=>[row.id,roadTransform(parse(row).point,cityRoadFrame(db,cam,row.city_id))]));return result;}
/** Reconcile explicit junctions and cached whole-route lengths, never crossings. */
export function reconcileRoads(db:any,cam:string,before:RoadSnapshot){
 const after=roadSnapshot(db,cam),moved=new Map<string,Point>();
 for(const r of after.values())for(const j of r.junctions??[]){const p=r.points[j.index]!,old=before.get(r.id),oldJ=old?.junctions?.find(n=>n.id===j.id),prior=oldJ?old!.points[oldJ.index]:null;
  if(prior&&(p.x!==prior.x||p.y!==prior.y)){const other=moved.get(j.id);if(other&&Math.hypot(other.x-p.x,other.y-p.y)>1e-7)throw Error('Verbundene Straßenenden widersprüchlich verschoben.');moved.set(j.id,p);}
 }
 for(const [id,p] of after.nodes??[]){const old=before.nodes?.get(id);if(old&&Math.hypot(old.x-p.x,old.y-p.y)>1e-7){const other=moved.get(id);if(other&&Math.hypot(other.x-p.x,other.y-p.y)>1e-7)throw Error('Straßenknoten widersprüchlich verschoben.');moved.set(id,p);}}
 const junctions=new Map<string,Point>();for(const r of after.values())for(const j of r.junctions??[]){const p=moved.get(j.id)??r.points[j.index]!,known=junctions.get(j.id);if(known&&Math.hypot(known.x-p.x,known.y-p.y)>1e-7&&!moved.has(j.id))throw Error('Straßenanschluss hat unterschiedliche Positionen.');junctions.set(j.id,p);}
 for(const [id,p] of moved){const row=db.prepare("SELECT * FROM city_unit WHERE campaign_id=? AND id=? AND kind='node'").get(cam,id);if(row){const u=parse(row);u.point=roadTransform(p,cityRoadFrame(db,cam,row.city_id),true);const payload=JSON.stringify(u);db.prepare('UPDATE city_unit SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(payload,hash(payload),cam,id);}}
 const parent=new Map<string,string>(),find=(id:string):string=>{const p=parent.get(id);if(!p)return id;const root=find(p);parent.set(id,root);return root;},join=(a:string,b:string)=>{a=find(a);b=find(b);if(a!==b)parent.set(a<b?b:a,a<b?a:b);},nodes=new Map<string,string>();
 for(const r of after.values()){const route=r.routeId??r.id;for(const j of r.junctions??[]){const key=r.kind+':'+j.id,other=nodes.get(key);if(other)join(route,other);else nodes.set(key,route);}for(const j of r.junctions??[])r.points[j.index]={...junctions.get(j.id)!};}
 const cityIds=new Set<string>(db.prepare('SELECT id FROM city_document WHERE campaign_id=?').all(cam).map((r:any)=>r.id));for(const r of after.values())if(r.cityAnchors)r.cityAnchors=r.cityAnchors.filter(a=>cityIds.has(a.cityId));
 const lengths=new Map<string,number>();for(const r of after.values()){r.routeId=find(r.routeId??r.id);lengths.set(r.routeId,(lengths.get(r.routeId)??0)+lineLength(r));}
 for(const r of after.values()){
  const current=readSharedRoad(db,cam,r.id)??parse(db.prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? AND id=?').get(cam,r.id));
  const changed=JSON.stringify(current.cityAnchors)!==JSON.stringify(r.cityAnchors)||JSON.stringify(current.points)!==JSON.stringify(r.points)||current.routeId!==r.routeId||current.routeLength!==lengths.get(r.routeId!);
  // Untouched legacy roads remain in their original storage until explicitly edited.
  const stored=db.prepare('SELECT revision FROM atlas_landscape WHERE campaign_id=? AND id=?').get(cam,r.id);
  if(changed&&(stored||JSON.stringify(current.points)!==JSON.stringify(r.points))){r.routeLength=lengths.get(r.routeId!);putLandscape(db,cam,r,stored?.revision??current.revision??null);roadReference(db,cam,r);}
 }
}
export function moveCityRoads(db:any,cam:string,cityId:string,previous:{x:number;y:number;angle:number},next:{x:number;y:number;angle:number}){
 for(const row of db.prepare("SELECT payload,revision FROM atlas_landscape WHERE campaign_id=? AND (CASE WHEN json_valid(payload) THEN json_extract(payload,'$.kind') END)='road' AND EXISTS(SELECT 1 FROM json_each(payload,'$.cityAnchors') a WHERE json_extract(a.value,'$.cityId')=?)").all(cam,cityId)){
  const r=parse(row) as LandscapeRecord;for(const a of r.cityAnchors??[])if(a.cityId===cityId)r.points[a.index]=roadTransform(roadTransform(r.points[a.index]!,previous,true),next);
  if(r.cityAnchors?.length===r.points.length&&r.cityAnchors.every(a=>a.cityId===cityId)&&r.line?.continuity)for(const key of ['before','after'] as const)if(r.line.continuity[key])r.line.continuity[key]=roadTransform(roadTransform(r.line.continuity[key]!,previous,true),next);
  putLandscape(db,cam,r,row.revision);
 }
}
