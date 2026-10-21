import {readRouteTerrain} from './terrain-route';
import type {Point,Polygon} from '../contracts';
import {bounds,contains,type LandscapeBox,type LandscapeRecord} from '../atlas-landscape';
import {posed,roadPoints} from '../city-model';
import {generateVegetation,vegetationEnvironment,vegetationOwner,VEGETATION_SURFACE_MPP,type VegetationScene} from '../vegetation';
import {previewSpatialTerrain,spatialDraftBounds,spatialTerrainSurface,type SpatialTerrainDraft} from '../spatial-terrain';

const overlap=(a:LandscapeBox,b:LandscapeBox)=>a.x<=b.x+b.width&&a.x+a.width>=b.x&&a.y<=b.y+b.height&&a.y+a.height>=b.y;
/** World overview contains no automatic trees. Resolve only actual candidates;
 * protected world objects need their local terrain, never the whole continent. */
export function vegetationEnvironmentReader(db:any,cam:string,box:LandscapeBox,mpp:number){
  let cached:ReturnType<typeof readVegetationEnvironment>|undefined;
  return(point:Point,radius:number)=>{
    if(mpp<=VEGETATION_SURFACE_MPP)return(cached??=readVegetationEnvironment(db,cam,box)).env;
    const pad=Math.max(100,radius);
    return readVegetationEnvironment(db,cam,{x:point.x-pad,y:point.y-pad,width:pad*2,height:pad*2}).env;
  };
}
/** Bounded read on both Main and readonly region workers. Never builds an index
 * or changes the source fence during a projection. */
export function readVegetationEnvironment(db:any,cam:string,box:LandscapeBox) {
  const halo=100,search={x:box.x-halo,y:box.y-halo,width:box.width+halo*2,height:box.height+halo*2};
  const rows=db.prepare("SELECT payload FROM atlas_landscape WHERE campaign_id=? AND (json_extract(payload,'$.terrainSettings') IS NOT NULL OR (max_x>=? AND min_x<=? AND max_y>=? AND min_y<=?)) ORDER BY rowid").iterate(cam,search.x,search.x+search.width,search.y,search.y+search.height);
  const records:LandscapeRecord[]=[];let bytes=0;
  for(const row of rows){bytes+=Buffer.byteLength(row.payload);if(bytes>16*1024*1024)throw Error('Bewuchsbereich zu groß. Kleineren Ausschnitt wählen.');records.push(JSON.parse(row.payload));}
  const buildings:Polygon[]=[];
  let units=0;
  for(const binding of db.prepare("SELECT * FROM atlas_binding WHERE campaign_id=? AND kind='city' AND parent='world'").iterate(cam)){
    const at=(p:Point)=>({x:binding.x+p.x*Math.cos(binding.angle)-p.y*Math.sin(binding.angle),y:binding.y+p.x*Math.sin(binding.angle)+p.y*Math.cos(binding.angle)});
    const row=db.prepare('SELECT payload FROM city_document WHERE campaign_id=? AND id=?').get(cam,binding.owner_id);if(!row)continue;
    const h=JSON.parse(row.payload),corners=[{x:0,y:0},{x:h.width,y:0},{x:h.width,y:h.height},{x:0,y:h.height}].map(at);
    if(!overlap(bounds({points:corners,polygons:[]} as unknown as LandscapeRecord),search))continue;
    const data=new Map<string,any>();
    for(const u of db.prepare("SELECT id,payload FROM city_unit WHERE campaign_id=? AND city_id=?").iterate(cam,binding.owner_id)){if(++units>30000)throw Error('Zu viele Stadtobjekte im Bewuchsbereich.');data.set(u.id,JSON.parse(u.payload));}
    for(const u of data.values()){
      if(u.kind==='building'){const polygon={outer:posed(u).map(at),holes:[]};if(overlap(bounds({points:[],polygons:[polygon]} as unknown as LandscapeRecord),search))buildings.push(polygon);}
      else if(u.kind==='road'){
        const points=roadPoints(u,(u.nodeIds??[]).map((id:string)=>data.get(id)).filter(Boolean)).map(at);
        if(points.length>1)records.push({id:'city-road:'+u.id,revision:0,kind:'road',name:'',points,polygons:[],resolution:1,width:u.width??6,values:{}});
      }
    }
  }
  return {records,env:vegetationEnvironment(records,buildings)};
}
export function vegetationScene(db:any,cam:string,box:LandscapeBox,mpp:number,revision:number,spatial?:{draft?:SpatialTerrainDraft}):VegetationScene {
  if(!box||![box.x,box.y,box.width,box.height,box.x+box.width,box.y+box.height].every(Number.isFinite)||
    box.width<=0||box.height<=0||Math.max(Math.abs(box.x),Math.abs(box.y),box.width,box.height)>1e12||!Number.isFinite(mpp)||mpp<=0)throw Error('Landschaftsausschnitt prüfen.');
  let search={...box};
  if(spatial?.draft){const b=spatialDraftBounds(spatial.draft),x=Math.min(b.x,box.x),y=Math.min(b.y,box.y);search={x,y,width:Math.max(b.x+b.width,box.x+box.width)-x,height:Math.max(b.y+b.height,box.y+box.height)-y};}
  const source=readVegetationEnvironment(db,cam,search);
  if(spatial?.draft?.kind==='landscape-color-stroke'&&spatial.draft.record.paint?.fill){
    const all:LandscapeRecord[]=[];let bytes=0;
    for(const row of db.prepare("SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.kind')='patch' ORDER BY rowid").iterate(cam)){
      bytes+=Buffer.byteLength(row.payload);if(all.length>=10000||bytes>16*1024*1024)throw Error('Zu viele Flächen zum Füllen. Mit dem Farbpinsel abschnittsweise malen.');
      all.push(JSON.parse(row.payload));
    }
    source.records=[...source.records.filter(r=>r.kind!=='patch'),...all];
  }
  const terrain=readRouteTerrain(db,cam,search,true),terrainIds=new Set(terrain.map(r=>r.id));
  source.records=[...source.records.filter(r=>!terrainIds.has(r.id)),...terrain];
  const records=previewSpatialTerrain(source.records,spatial?.draft),
    env=vegetationEnvironment(records,source.env.buildings),instances:VegetationScene['instances']=[];
  const covers=env.covers.map(r=>{
    const vegetationView=generateVegetation(r,env,box,mpp);
    instances.push(...vegetationView.instances.map(i=>({...i,areaId:r.id})));
    return {...r,vegetationView};
  });
  if(instances.length>20000)throw Error('Zu viele Bewuchsdetails. Weiter herauszoomen.');
  const columns=65,rows=65,heights:number[]=[],colors:string[]=[],lakes=records.filter(r=>r.surface==='freshwater');
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
    const p={x:box.x+x/(columns-1)*box.width,y:box.y+y/(rows-1)*box.height},h=env.terrain.sample(p).heightM,water=env.terrain.water(p,h),owner=vegetationOwner(env,p);
    const lakeLevel=lakes.reduce((level,r)=>contains(p,r.polygons)?Math.max(level,r.waterLevelM??env.terrain.seaLevelM+1):level,env.terrain.seaLevelM);
    heights.push(water?Math.max(env.terrain.waterLevel(p)??lakeLevel,h):h);
    colors.push(water?'#88acb9':owner?.vegetation?.preset.ground??'#e1d8b9');
  }
  const result:VegetationScene={revision,box,records:[...covers,...records.filter(r=>r.kind==='road'||r.kind==='river'||r.surface==='freshwater')],grid:{columns,rows,heights,colors},instances,buildings:env.buildings,...(spatial?spatialTerrainSurface(records,box,mpp):{})};
  if(Buffer.byteLength(JSON.stringify({...result,texture:undefined}))+(result.texture?.pixels.byteLength??0)>4*1024*1024)throw Error('Landschaftsansicht überschreitet das Ladebudget.');
  return result;
}
