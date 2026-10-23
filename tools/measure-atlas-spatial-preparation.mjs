// Exploratory falsification probe for M2 landscape metadata preparation.
// Compares a global metadata copy with two disposable filters while keeping
// geometry projection global. This is not a product/native performance claim.
import assert from 'node:assert/strict';
import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {createGunzip} from 'node:zlib';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {buildSync} from 'esbuild';

const root=process.cwd(),output=resolve('.build/atlas-spatial-preparation',`${Date.now()}-${process.pid}`);
await mkdir(output,{recursive:true});
const fixture=resolve('docs/reference/atlas-rebuild-m0-20261023/mixed-world.sqlite.gz');
const filename=join(output,'workbench.sqlite');
await pipeline(createReadStream(fixture),createGunzip(),createWriteStream(filename,{flags:'wx'}));
const bundle=join(output,'probe.cjs');
buildSync({stdin:{contents:`export {CampaignStore} from './src/app/storage/store';
export {AtlasRegionReader} from './src/app/storage/atlas-region';
export {AtlasProjectionIndex} from './src/app/storage/atlas-projection-index';
export {AtlasGeometryTiles} from './src/app/storage/atlas-geometry-tiles';
export {atlasGeometryTileBox} from './src/app/atlas-geometry-tile';
export {heightRecord} from './src/app/terrain-height';`,resolveDir:root},outfile:bundle,bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const require=createRequire(import.meta.url),Database=require('better-sqlite3');
const {CampaignStore,AtlasRegionReader,AtlasProjectionIndex,AtlasGeometryTiles,atlasGeometryTileBox,heightRecord}=require(bundle);
const fixtureHash=createHash('sha256').update(await readFile(fixture)).digest('hex');
const tile={lod:4,x:0,y:0},fineTile={lod:0,x:0,y:0};
const box=atlasGeometryTileBox({tile,revision:0}),fineBox=atlasGeometryTileBox({tile:fineTile,revision:0});
const hashValue=value=>createHash('sha256').update(JSON.stringify(value,(key,v)=>ArrayBuffer.isView(v)?Array.from(v):v instanceof Map?[...v]:v)).digest('hex');
const heightPointsOutside=(points,b)=>points.filter(p=>p.x<b.x||p.x>b.x+b.width||p.y<b.y||p.y>b.y+b.height).length;

function wrapLandscapeCopy(index,mode,queryBox){
 const copy=index.copy.bind(index);
 let selectedRows=null;
 index.copy=(table,columns,select,args)=>{
  if(table!=='landscape_shape_bounds')return copy(table,columns,select,args);
  let sql=select,values=[...args];
  if(mode==='field-only'){
   sql+=` AND CASE WHEN json_valid(payload) THEN (json_extract(payload,'$.height') IS NOT NULL OR json_extract(payload,'$.route') IS NOT NULL OR json_extract(payload,'$.surface')='freshwater') ELSE 0 END`;
  }else if(mode==='spatial-0.75m'){
   const x=queryBox.x-.75,y=queryBox.y-.75,xx=queryBox.x+queryBox.width+.75,yy=queryBox.y+queryBox.height+.75;
   sql+=' AND max_x>=? AND min_x<=? AND max_y>=? AND min_y<=?';values.push(x,xx,y,yy);
  }
  const result=copy(table,columns,sql,values);
  selectedRows=index.prepare('SELECT count(*) n FROM temp.landscape_shape_bounds').get().n;
  return result;
 };
 return ()=>selectedRows;
}
async function runMode(store,source,mode,round,customBox=box,customTile=tile){
 const db=new Database(store.filename,{readonly:true});db.pragma('temp_store = FILE');
 const projection=AtlasProjectionIndex.temporary(db),reader=new AtlasRegionReader(db,undefined,projection),tiles=new AtlasGeometryTiles();
 const count=wrapLandscapeCopy(projection,mode,customBox);
 let syncMs=0,overviewMs=0,fineMs=0,overview, fine,anchorPoints=[];
 const originalHeight=reader.geometryHeight.bind(reader);reader.geometryHeight=(s,p)=>{anchorPoints.push({x:p.x,y:p.y});return originalHeight(s,p);};
 try{
  db.exec('BEGIN');
  let at=performance.now();await reader.sync(source,'core');syncMs=performance.now()-at;
  const metadataRows=count();
  at=performance.now();const overviewSteps=tiles.read(source,{tile:customTile,revision:source.revision},reader);let overviewResult;
  for(;;){const step=overviewSteps.next();if(step.done){overviewResult=step.value;break;}db.exec('COMMIT');db.exec('BEGIN');}
  overview=overviewResult.model;overviewMs=performance.now()-at;
  at=performance.now();
  const fineSteps=tiles.read(source,{tile:fineTile,revision:source.revision},reader);let fineResult;
  for(;;){const step=fineSteps.next();if(step.done){fineResult=step.value;break;}db.exec('COMMIT');db.exec('BEGIN');}
  fine=fineResult.model;
  fineMs=performance.now()-at;
  const result={mode,round,syncMs,overviewMs,fineMs,metadataRows,overviewHash:hashValue(overview),coverage:overview.coverage,overviewObjects:overview.overviews?.[0]?.modeledObjects??0,
   fineHash:hashValue(fine),fineObjects:fine.objects.length,fineTargetIds:fine.objects.map(o=>o.target?.id).filter(Boolean),geometryHeightCalls:anchorPoints.length,anchorsOutsideViewport:heightPointsOutside(anchorPoints,customBox)};
  db.exec('COMMIT');return result;
 }finally{if(db.inTransaction)db.exec('ROLLBACK');reader.rollback('core');tiles.close();await projection.close();db.close();}
}

// Three alternating rounds, each with new readonly connections, readers and
// temporary indices. The campaign/source itself remains the same pinned fixture.
const store=new CampaignStore(filename);let campaignId,token,cexStore;
try{
 const row=store.db.prepare('SELECT id FROM campaign').get();campaignId=row.id;token=store.activateShell(campaignId).token;
 const malformed=store.db.prepare('SELECT count(*) n FROM atlas_landscape WHERE campaign_id=? AND NOT json_valid(payload)').get(campaignId).n;
 assert.equal(malformed,0,'Global/field-only/spatial comparison requires the frozen source to contain no malformed landscape JSON; otherwise global failure behavior would be masked.');
 const pinnedSource=store.atlasRegionSource(token),ids=['global','field-only','spatial-0.75m'],results=[];
 for(let round=1;round<=3;round++)for(const mode of round%2?ids:[...ids].reverse())results.push(await runMode(store,pinnedSource,mode,round));
 const groups=Object.fromEntries(ids.map(mode=>[mode,results.filter(r=>r.mode===mode)]));
 const parity=Object.fromEntries(ids.slice(1).map(mode=>[mode,{overviewHashesMatch:groups[mode].every((r,i)=>r.overviewHash===groups.global[i].overviewHash),fineHashesMatch:groups[mode].every((r,i)=>r.fineHash===groups.global[i].fineHash),coverageMatches:groups[mode].every((r,i)=>JSON.stringify(r.coverage)===JSON.stringify(groups.global[i].coverage))}]));

 // Minimal deterministic counterexample: the world-visible room is displaced
 // into tile 0/0 while its scope workplane and required height tile remain at
 // an offscreen anchor. Global source selection sees the height; the spatial
 // metadata filter drops it. The resulting mismatch is evidence, not an assert.
 const cx=join(output,'counterexample.sqlite');cexStore=new CampaignStore(cx);const room={id:'displaced-visible-room',scopeId:'local',floorId:'ground',number:'1',name:'Displaced',revision:0,
  polygons:[{outer:[{x:20,y:20},{x:40,y:20},{x:40,y:40},{x:20,y:40}],holes:[]}],sections:[]};
 const c=cexStore.create('Spatial filter counterexample',[room]),ct=cexStore.activateShell(c.id).token;
 const far=1000000,dbw=cexStore.db,bind=dbw.prepare("SELECT id FROM atlas_binding WHERE campaign_id=? AND kind='dungeon' AND owner_id='local'").get(c.id);
 dbw.prepare('UPDATE atlas_binding SET x=?,y=? WHERE campaign_id=? AND id=?').run(far,far,c.id,bind.id);
 const roomRow=dbw.prepare('SELECT payload FROM room WHERE campaign_id=? AND id=?').get(c.id,room.id),payload=JSON.parse(roomRow.payload);
 payload.polygons=payload.polygons.map(p=>({...p,outer:p.outer.map(q=>({x:q.x-far,y:q.y-far}))}));
 const serialized=JSON.stringify(payload),checksum=createHash('sha256').update(serialized).digest('hex');
 dbw.prepare('UPDATE room SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(serialized,checksum,c.id,room.id);
 cexStore.executeAtlasCommit({commandId:randomUUID(),campaignId:c.id,token:ct,action:{kind:'landscape-put',expectedRevision:null,record:heightRecord(far,far,1,new Float32Array(4096).fill(80))}});
 const ceSource=cexStore.atlasRegionSource(ct),ceBox={x:0,y:0,width:4096,height:4096},ceTile={lod:4,x:0,y:0};
 const counterexample=[];
 for(const mode of ['global','field-only','spatial-0.75m'])counterexample.push(await runMode(cexStore,ceSource,mode,1,ceBox,ceTile));
 assert(counterexample[0].fineTargetIds.includes(room.id),'Counterexample must retain the displaced room as visible fine geometry.');
 assert.equal(counterexample[0].overviewHash,counterexample[1].overviewHash,'Field-only preparation must retain the offscreen height dependency.');
 assert.notEqual(counterexample[0].overviewHash,counterexample[2].overviewHash,'Spatial clipping must expose the offscreen height dependency counterexample.');
 const cexParity={overviewHashesMatch:counterexample[0].overviewHash===counterexample[1].overviewHash,
  fieldOnlyMatches:counterexample[0].overviewHash===counterexample[1].overviewHash,
  spatialMatches:counterexample[0].overviewHash===counterexample[2].overviewHash,
  objectCounts:[counterexample[0].overviewObjects,counterexample[1].overviewObjects],heightAnchorCounts:[counterexample[0].geometryHeightCalls,counterexample[1].geometryHeightCalls],
  anchorOutsideViewport:[counterexample[0].anchorsOutsideViewport,counterexample[1].anchorsOutsideViewport],samePinnedSource:true};
 const outputValue={scope:'Exploratory falsification only; frozen M0 readonly source in isolated copy, same source snapshot within each A/B round, global geometry projection, temporary projection tables, no publication/cache/native claim.',
  fixture,fixtureHash,malformedLandscapePayloads:malformed,tile,fineTile,box,fineBox,rounds:3,results,parity,counterexample:{fixture:'synthetic disposable campaign with a visible room displaced from its world binding anchor and height tile at the offscreen anchor',results:counterexample,comparison:cexParity},
  interpretation:'Spatial bounds clipping is not equivalent when visible geometry depends on a source anchor outside the viewport. Field-only metadata selection is measured separately because it retains all height, route and lake sources regardless of anchor location.'};
 await writeFile(join(output,'result.json'),JSON.stringify(outputValue,null,2));
 console.log(JSON.stringify({complete:true,output,result:outputValue},null,2));
}finally{cexStore?.close();store.close();}
