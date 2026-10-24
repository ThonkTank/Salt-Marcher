import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {readFile,stat,readdir,rename} from 'node:fs/promises';
import {createGunzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {createNativeSession} from './native-session.mjs';

const root=process.cwd(),require=createRequire(root+'/package.json');
const Database=require('better-sqlite3');
const output=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/atlas-geometry-overview-native',`${Date.now()}-${process.pid}`);
const native=await createNativeSession({root,output,name:'atlas-geometry-overview'});
const fixtureGzip=path.join(root,'docs/reference/atlas-rebuild-m0-20261023/mixed-world.sqlite.gz');
const databasePath=path.join(native.profile,'workbench.sqlite');
const frozenFixture={sha256:'19d4edc88b50d8074578a5c40c870a50331fec1c78a7a8b4f4feee5d463fdb12',bytes:225546240,compressedBytes:40236558};
const files=[
 'src/app/atlas-scene-geometry.ts','src/app/atlas-geometry-overview.ts','src/app/atlas-geometry-tile.ts','src/app/atlas-geometry-mesh.ts',
 'src/app/atlas-deck-scene-model.ts','src/app/atlas-deck-surface.ts','src/app/storage/atlas-geometry-tiles.ts',
 'src/app/storage/atlas-tile-cache.ts','src/app/storage/atlas-projection-index.ts','src/app/storage/atlas-region.ts',
 'src/app/storage/atlas-shape-source.ts','src/app/storage/atlas-terrain-tiles.ts','src/app/storage/atlas-material-tiles.ts',
 'src/app/storage/terrain-grid.ts','src/app/storage/atlas-landscape-region.ts','src/app/terrain-projection-cache.ts',
 'desktop/atlas-region-worker.ts','desktop/atlas-region.ts','desktop/main.ts','desktop/preload.ts',
 'tools/test-desktop-atlas-geometry-overview.mjs','.build/desktop/main.cjs','.build/desktop/preload.cjs',
 '.build/desktop/atlas-region-worker.cjs','.build/desktop/ui/atlas-deck-runtime.js'
];
const hashFile=async file=>createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async file=>[file,await hashFile(file)])));
const hashStream=async file=>{
 const hash=createHash('sha256');
 for await(const chunk of createReadStream(file))hash.update(chunk);
 return hash.digest('hex');
};
const canonicalTables=['campaign_atlas','atlas_binding','atlas_landscape','room_group','room','drawing_element','scope','drawing_floor','city_document','location','location_map','world_record'];
// Playwright serializes this top-level function for each isolated evaluation.
async function captureTerrainMaterial(pageArgs){
 const {token,kind,tile}=pageArgs,unwrap=result=>{if(!result.ok)throw Error(JSON.stringify(result));return result.value;};
 const revision=unwrap(await window.campaign.atlasTerrainSource(token)).revision;
 const start=performance.now(),value=unwrap(await (kind==='terrain'?window.campaign.atlasTerrainTile(token,{tile,revision}):window.campaign.atlasMaterialTile(token,{tile,revision}))),ms=performance.now()-start;
 const digest=async typed=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(typed.buffer,typed.byteOffset,typed.byteLength)))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
 if(kind==='terrain'){
  const projection=value.projection,grid=projection.grid,buffers={heights:grid.heights,pixels:projection.pixels};
  if(grid.editing){buffers.editingGround=grid.editing.ground;buffers.editingWater=grid.editing.water;}
  if(projection.forest)buffers.forest=projection.forest;
  return {kind,tile:value.tile,revision:value.revision,fence:value.fence,cache:value.cache,ms,width:projection.width,height:projection.height,
   metadata:{generation:projection.generation,draft:projection.draft,seaLevelM:grid.seaLevelM,view:grid.view,
    landColor:projection.landColor,contourInk:projection.contourInk,rasterRouteKey:projection.rasterRouteKey,
    objects:projection.objects,routes:projection.routes,protectedLimit:projection.protectedLimit,heightM:projection.heightM},
   buffers:Object.fromEntries(await Promise.all(Object.entries(buffers).map(async([name,typed])=>[name,{type:typed.constructor.name,length:typed.length,byteLength:typed.byteLength,sha256:await digest(typed)}])))};
 }
 const channelNames=['baseColor','water','forest','rock','snow'];
 return {kind,tile:value.tile,revision:value.revision,fence:value.fence,cache:value.cache,ms,width:value.width,height:value.height,
  channels:Object.fromEntries(await Promise.all(channelNames.map(async name=>{const typed=value.channels[name];return[name,{type:typed.constructor.name,length:typed.length,byteLength:typed.byteLength,sha256:await digest(typed)}];})))};
}
function canonicalSnapshot(campaignId){
 const db=new Database(databasePath,{readonly:true}),hash=createHash('sha256');
 try{
  const revision=db.prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?').get(campaignId)?.revision;
  assert(Number.isSafeInteger(revision),'The frozen campaign must have an Atlas revision');
  for(const table of canonicalTables){
   const exists=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
   if(!exists)continue;
   const columns=db.pragma(`table_info("${table}")`),primaryKey=columns.filter(column=>column.pk>0).sort((a,b)=>a.pk-b.pk);
   const order=primaryKey.length?primaryKey.map(column=>`"${column.name.replaceAll('"','""')}"`).join(','):'rowid';
   const statement=db.prepare(`SELECT * FROM "${table}" WHERE campaign_id=? ORDER BY ${order}`);
   let count=0;
   for(const row of statement.iterate(campaignId)){hash.update(JSON.stringify(row));hash.update('\n');count++;}
   hash.update(`${table}:${count}\n`);
  }
  return {sha256:hash.digest('hex'),atlasRevision:revision};
 }finally{db.close();}
}

try{
 const compressed=await stat(fixtureGzip);
 assert.equal(compressed.size,frozenFixture.compressedBytes,'Use the retained exact M0 fixture');
 await pipeline(createReadStream(fixtureGzip),createGunzip(),createWriteStream(databasePath,{flags:'wx'}));
 const sourceHash=await hashStream(databasePath),sourceBytes=(await stat(databasePath)).size;
 assert.equal(sourceHash,frozenFixture.sha256,'The decompressed M0 source must match its pinned digest');
 assert.equal(sourceBytes,frozenFixture.bytes);
 const sourceDb=new Database(databasePath,{readonly:true}),campaign=sourceDb.prepare('SELECT id,name FROM campaign ORDER BY rowid LIMIT 1').get();
 assert(campaign,'The retained M0 fixture must contain a campaign');
 const inventory={
  roomGroups:sourceDb.prepare('SELECT count(*) n FROM room_group WHERE campaign_id=?').get(campaign.id).n,
  rooms:sourceDb.prepare('SELECT count(*) n FROM room WHERE campaign_id=?').get(campaign.id).n,
  dungeonRooms:sourceDb.prepare("SELECT count(*) n FROM room WHERE campaign_id=? AND scope_id='mixed-dungeon'").get(campaign.id).n,
  bindings:sourceDb.prepare('SELECT count(*) n FROM atlas_binding WHERE campaign_id=?').get(campaign.id).n
 };
 sourceDb.close();
 assert(inventory.roomGroups>=5000&&inventory.dungeonRooms>=4000,'The frozen mixed-world inventory is incomplete');
 const before=await hashes(),canonicalBefore=canonicalSnapshot(campaign.id),errors=[];
 const page=await native.launch();page.on('pageerror',error=>errors.push(error.stack??String(error)));
 await page.evaluate(()=>{
  const windowRef=globalThis.window,container=document.createElement('div');container.id='atlas-geometry-overview-probe';
  Object.assign(container.style,{position:'fixed',inset:'0',background:'#dce2df',zIndex:'99999'});document.body.append(container);
  const header=document.createElement('div');header.textContent='Atlas · grobe Geometrieübersicht · technische Messprobe';
  Object.assign(header.style,{position:'absolute',inset:'0 0 auto',height:'46px',boxSizing:'border-box',padding:'12px 18px',
   background:'#f4f1e8',color:'#26313a',font:'600 16px sans-serif',borderBottom:'1px solid #859097',zIndex:'2'});
  const sceneHost=document.createElement('div');sceneHost.id='atlas-geometry-overview-canvas';
  Object.assign(sceneHost.style,{position:'absolute',inset:'47px 0 0'});container.append(header,sceneHost);
  windowRef.__atlasGeometryOverviewErrors=[];
 });

 const cold=await page.evaluate(async({campaignId})=>{
  const unwrap=result=>{if(!result.ok)throw Error(JSON.stringify(result));return result.value;};
  const active=unwrap(await window.campaign.activate(campaignId));
  const runtime=await import('campaign://app/atlas-deck-runtime.js');
  const revision=unwrap(await window.campaign.atlasTerrainSource(active.token)).revision,tile={lod:4,x:0,y:0};
  const start=performance.now(),value=unwrap(await window.campaign.atlasGeometryTile(active.token,{tile,revision})),readMs=performance.now()-start;
  const model=runtime.atlasGeometryTileModel(value),overview=model.overviews??[];
  const meshes=overview.flatMap(entry=>entry.meshes),bytes=meshes.reduce((sum,mesh)=>sum+mesh.positions.byteLength+mesh.indices.byteLength,0);
  const digest=async typed=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(typed.buffer,typed.byteOffset,typed.byteLength)))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const meshDigests=[];for(const mesh of meshes)meshDigests.push({id:mesh.id,kind:mesh.kind,origin:mesh.origin,
   positions:await digest(mesh.positions),indices:await digest(mesh.indices)});
  const detailModel=runtime.atlasGeometryTileModel(value,{scopeId:'overview-detail-probe',roofs:true});
  const container=document.getElementById('atlas-geometry-overview-canvas');
  const camera={focus:{x:2048,y:2048},focusHeightM:0,metersPerPixel:8,rotation:0,tilt:45,exaggeration:1};
  const errors=window.__atlasGeometryOverviewErrors;
  const renderStart=performance.now();
  const surface=await runtime.AtlasDeckSurface.create({container,camera,model,onError:error=>errors.push(error.message)});
  const firstUsableFrameMs=performance.now()-renderStart;
  await surface.waitForFrame();
  const layerIds=surface.deckValue.props.layers.filter(layer=>layer.id.startsWith('atlas-overview:')).map(layer=>({id:layer.id,pickable:layer.props.pickable}));
  window.__atlasGeometryOverview={surface,runtime,fixture:{campaignId,tile},token:active.token,errors};
  return {revision,tile,cache:value.cache,readMs,firstUsableFrameMs,frameUsable:surface.frameUsable,
   semanticObjects:model.objects.length,targetCount:model.targets.size,overviewCount:overview.length,
   modeledObjects:overview.map(entry=>entry.modeledObjects),resolutions:overview.map(entry=>entry.resolution),meshDigests,
   coverage:{complete:model.coverage.complete,unsupported:model.coverage.unsupported,unsupportedCount:model.coverage.unsupported.length,
    unsupportedByCode:model.coverage.unsupported.reduce((counts,item)=>({...counts,[item.code]:(counts[item.code]??0)+1}),{})},
   detailCheck:{overviews:detailModel.overviews?.length??0,complete:detailModel.coverage.complete,
    unsupported:detailModel.coverage.unsupported.map(item=>item.code)},
   meshCount:meshes.length,meshBytes:bytes,typed:meshes.every(mesh=>mesh.positions instanceof Float32Array&&mesh.indices instanceof Uint32Array),
   layerIds,errors};
 },{campaignId:campaign.id});
 assert.equal(cold.cache,'built','The new isolated profile must start with a cold geometry tile');
 assert.deepEqual(cold.tile,{lod:4,x:0,y:0});assert(cold.readMs>=0&&cold.firstUsableFrameMs>=0&&cold.frameUsable);
 assert.equal(cold.semanticObjects,0,'Coarse overview must not create semantic scene objects');
 assert.equal(cold.targetCount,0,'Coarse overview must not invent selection targets');
 assert.equal(cold.overviewCount,1);assert(cold.meshCount>0&&cold.meshCount<=2);assert(cold.meshBytes<=6*1024*1024);
 assert(cold.modeledObjects[0]>=5000);assert(cold.typed);assert(cold.layerIds.length===cold.meshCount&&cold.layerIds.every(layer=>layer.pickable===false));
 assert.equal(cold.detailCheck.overviews,0);assert.equal(cold.detailCheck.complete,false);assert(cold.detailCheck.unsupported.includes('geometry-detail-required'));
 assert.deepEqual(cold.errors,[]);
 await native.capture(page,'overview-tilt45.png');

 const flat=await page.evaluate(async()=>{
  const {surface}=window.__atlasGeometryOverview;surface.setCamera({...surface.camera,rotation:0,tilt:0});
  await surface.waitForFrame();
  const source=surface.canvas,copy=document.createElement('canvas');copy.width=source.width;copy.height=source.height;
  const context=copy.getContext('2d');if(!context)throw Error('2D canvas unavailable for overview pixel oracle');
  context.drawImage(source,0,0);const pixels=context.getImageData(0,0,copy.width,copy.height).data;
  let count=0,minX=copy.width,minY=copy.height,maxX=-1,maxY=-1;
  for(let y=0;y<copy.height;y++)for(let x=0;x<copy.width;x++)if(pixels[(y*copy.width+x)*4+3]>0){
   count++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
  }
  const bboxArea=maxX<minX?0:(maxX-minX+1)*(maxY-minY+1);
  return {frameUsable:surface.frameUsable,tilt:surface.camera.tilt,revision:surface.model.overviews?.[0]?.tile,
   pixelStats:{canvasWidth:copy.width,canvasHeight:copy.height,nontransparentPixels:count,
    geometryBounds:bboxArea?{minX,minY,maxX,maxY}:null,bboxArea,bboxOccupiedRatio:bboxArea?count/bboxArea:0},
   errors:window.__atlasGeometryOverviewErrors};
 });
 assert.equal(flat.frameUsable,true);assert.equal(flat.tilt,0);assert.deepEqual(flat.errors,[]);
 assert(flat.pixelStats.nontransparentPixels>0,'Flat overview canvas must contain rendered geometry pixels');
 assert(flat.pixelStats.bboxOccupiedRatio<.9,'Flat overview geometry must leave visible gaps inside its screen-space bounds');
 await native.capture(page,'overview-flat.png');

 const proxyPick=await page.evaluate(()=>{
  const {surface}=window.__atlasGeometryOverview,frame=surface.frame;
  const overviewLayers=surface.deckValue.props.layers.filter(layer=>layer.id.startsWith('atlas-overview:'));
  let tested=0;
  for(const layer of overviewLayers){
   const object=layer.props.data[0];let vertex=0;
   while(vertex<object.positions.length/3&&tested<512){
    const x0=object.positions[vertex*3],y0=object.positions[vertex*3+1],z=object.positions[vertex*3+2];
    const x1=object.positions[(vertex+1)*3],y1=object.positions[(vertex+1)*3+1];
    const x2=object.positions[(vertex+2)*3],y2=object.positions[(vertex+2)*3+1];
    const x3=object.positions[(vertex+3)*3],y3=object.positions[(vertex+3)*3+1];
    const point={x:object.origin.x+(x0+x1+x2+x3)/4,y:object.origin.y+(y0+y1+y2+y3)/4,heightM:object.origin.heightM+z};
    const screen=frame.project(point),raised=object.positions[(vertex+4)*3]===x0&&object.positions[(vertex+4)*3+1]===y0;
    vertex+=raised?20:4;
    if(screen.x<0||screen.y<0||screen.x>=frame.viewport.width||screen.y>=frame.viewport.height)continue;
    tested++;
    const hit=surface.pick(screen.x,screen.y);
    if(hit===null)return {tested,point,screen,hit:null,layerId:layer.id};
   }
  }
  return {tested,hit:'no-empty-proxy-sample'};
 });
 assert.equal(proxyPick.hit,null,'A visible overview-only proxy surface must not produce a pick');
 await native.close();

 const reopened=await native.launch();reopened.on('pageerror',error=>errors.push(error.stack??String(error)));
 const warm=await reopened.evaluate(async({campaignId,tile})=>{
  const unwrap=result=>{if(!result.ok)throw Error(JSON.stringify(result));return result.value;};
  const digest=async typed=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(typed.buffer,typed.byteOffset,typed.byteLength)))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const active=unwrap(await window.campaign.activate(campaignId)),revision=unwrap(await window.campaign.atlasTerrainSource(active.token)).revision;
  const start=performance.now(),value=unwrap(await window.campaign.atlasGeometryTile(active.token,{tile,revision})),readMs=performance.now()-start;
  const overviews=value.model.overviews??[],meshes=overviews.flatMap(entry=>entry.meshes),digests=[];
  for(const mesh of meshes)digests.push({id:mesh.id,kind:mesh.kind,origin:mesh.origin,positions:await digest(mesh.positions),indices:await digest(mesh.indices)});
  const runtime=await import('campaign://app/atlas-deck-runtime.js'),container=document.createElement('div');
  container.id='atlas-warm-overview';Object.assign(container.style,{position:'fixed',inset:'0',background:'#dce2df',zIndex:'99999'});document.body.append(container);
  const renderStart=performance.now(),surface=await runtime.AtlasDeckSurface.create({container,
   camera:{focus:{x:2048,y:2048},focusHeightM:0,metersPerPixel:8,rotation:0,tilt:45,exaggeration:1},
   model:runtime.atlasGeometryTileModel(value),onError:error=>{throw error;}});
  const firstUsableFrameMs=performance.now()-renderStart;await surface.waitForFrame();
  window.__atlasWarmOverview=surface;
  return {revision,tile:value.tile,cache:value.cache,readMs,firstUsableFrameMs,frameUsable:surface.frameUsable,overviewCount:overviews.length,
   modeledObjects:overviews.map(entry=>entry.modeledObjects),resolutions:overviews.map(entry=>entry.resolution),
   meshCount:meshes.length,meshBytes:meshes.reduce((sum,mesh)=>sum+mesh.positions.byteLength+mesh.indices.byteLength,0),
   typed:meshes.every(mesh=>mesh.positions instanceof Float32Array&&mesh.indices instanceof Uint32Array),digests};
 },{campaignId:campaign.id,tile:cold.tile});
 assert.equal(warm.cache,'hit');assert.equal(warm.revision,cold.revision);assert.deepEqual(warm.tile,cold.tile);
 assert.equal(warm.overviewCount,cold.overviewCount);assert.equal(warm.meshCount,cold.meshCount);assert.equal(warm.meshBytes,cold.meshBytes);assert(warm.typed);
 assert.deepEqual(warm.modeledObjects,cold.modeledObjects);assert.deepEqual(warm.resolutions,cold.resolutions);
 assert.deepEqual(warm.digests,cold.meshDigests,'Fresh-process overview typed buffers must retain identical content');
 const warmProjectionWork=(await readdir(path.join(native.profile,'atlas-region-cache'))).filter(name=>name.includes('.work-'));
 assert.deepEqual(warmProjectionWork,[],'An exact warm product must not open a private projection index');
 assert(warm.frameUsable);await native.capture(reopened,'warm-overview.png');
 await reopened.evaluate(()=>{window.__atlasWarmOverview.dispose();document.getElementById('atlas-warm-overview').remove();});

 const fine=await reopened.evaluate(async({campaignId})=>{
  const unwrap=result=>{if(!result.ok)throw Error(JSON.stringify(result));return result.value;};
  const runtime=await import('campaign://app/atlas-deck-runtime.js'),active=unwrap(await window.campaign.activate(campaignId));
  const revision=unwrap(await window.campaign.atlasTerrainSource(active.token)).revision,tile={lod:0,x:0,y:0};
  const start=performance.now(),value=unwrap(await window.campaign.atlasGeometryTile(active.token,{tile,revision})),readMs=performance.now()-start;
  const model=runtime.atlasGeometryTileModel(value),rooms=model.objects.filter(object=>object.target.kind==='room');
  if(!rooms.length)throw Error('Fine tile has no canonical room meshes');
  const container=document.createElement('div');container.id='atlas-geometry-overview-probe';
  Object.assign(container.style,{position:'fixed',inset:'0',background:'#dce2df',zIndex:'99999'});document.body.append(container);
  const header=document.createElement('div');header.textContent='Atlas · exakte Feinkachel · technische Messprobe';
  Object.assign(header.style,{position:'absolute',inset:'0 0 auto',height:'46px',boxSizing:'border-box',padding:'12px 18px',
   background:'#f4f1e8',color:'#26313a',font:'600 16px sans-serif',borderBottom:'1px solid #859097',zIndex:'2'});
  const sceneHost=document.createElement('div');sceneHost.id='atlas-geometry-overview-canvas';
  Object.assign(sceneHost.style,{position:'absolute',inset:'47px 0 0'});container.append(header,sceneHost);
  const errors=[];
  const candidates=rooms.map(object=>({object,maxHeight:Math.max(...Array.from({length:object.positions.length/3},(_,index)=>object.origin.heightM+object.positions[index*3+2]))}))
   .sort((a,b)=>b.maxHeight-a.maxHeight);
  const top=candidates[0].object,anchor={x:0,y:0,heightM:0};
  for(const index of top.indices.slice(0,3)){
   anchor.x+=(top.origin.x+top.positions[index*3])/3;anchor.y+=(top.origin.y+top.positions[index*3+1])/3;
   anchor.heightM+=(top.origin.heightM+top.positions[index*3+2])/3;
  }
  const renderStart=performance.now();
  const surface=await runtime.AtlasDeckSurface.create({container:sceneHost,camera:{focus:{x:anchor.x,y:anchor.y},focusHeightM:anchor.heightM,metersPerPixel:.15,rotation:0,tilt:0,exaggeration:1},
   model,onError:error=>errors.push(error.message)});
  const firstUsableFrameMs=performance.now()-renderStart;
  let selected=null,tested=0;
  for(const {object} of candidates){
   const samples=[];
   for(let offset=0;offset<object.indices.length;offset+=3){
    const ids=[object.indices[offset],object.indices[offset+1],object.indices[offset+2]];
    const point={x:0,y:0,heightM:0};
    for(const index of ids){point.x+=(object.origin.x+object.positions[index*3])/3;point.y+=(object.origin.y+object.positions[index*3+1])/3;point.heightM+=(object.origin.heightM+object.positions[index*3+2])/3;}
    samples.push(point);
   }
   samples.sort((a,b)=>b.heightM-a.heightM);
   for(const point of samples){
    const screen=surface.frame.project(point);if(!screen.visible)continue;
    tested++;const hit=surface.pick(screen.x,screen.y);
    if(hit?.target.kind==='room'&&hit.target.id===object.target.id){selected={expectedId:object.target.id,hitId:hit.target.id,point:hit.point,screen,maxHeight:candidates.find(candidate=>candidate.object===object).maxHeight};break;}
   }
   if(selected)break;
  }
  if(!selected)throw Error(`No visible topmost room triangle produced its own canonical pick after ${tested} samples`);
  window.__atlasGeometryOverview={surface,runtime,fixture:{campaignId,tile},token:active.token,errors};
  return {revision,tile,cache:value.cache,readMs,firstUsableFrameMs,frameUsable:surface.frameUsable,
   objectCount:model.objects.length,targetCount:model.targets.size,roomCount:rooms.length,selected,tested,errors};
 },{campaignId:campaign.id});
 assert.equal(fine.cache,'built');assert(fine.objectCount>0&&fine.targetCount>0&&fine.roomCount>0);
 assert(fine.frameUsable&&fine.firstUsableFrameMs>=0);assert.equal(fine.selected.hitId,fine.selected.expectedId);assert.deepEqual(fine.errors,[]);
 const fineScreenshot=await reopened.evaluate(async()=>{
  const {surface}=window.__atlasGeometryOverview;
  return {camera:surface.camera,frameUsable:surface.frameUsable,modelObjects:surface.model.objects.length};
 });
 assert(fineScreenshot.frameUsable&&fineScreenshot.modelObjects===fine.objectCount);
 await native.capture(reopened,'fine-room.png');

 const tileAddress={lod:0,x:0,y:0},fieldToken=await reopened.evaluate(()=>window.__atlasGeometryOverview.token);
 const fieldTerrain=await reopened.evaluate(captureTerrainMaterial,{token:fieldToken,kind:'terrain',tile:tileAddress});
 const fieldMaterial=await reopened.evaluate(captureTerrainMaterial,{token:fieldToken,kind:'material',tile:tileAddress});
 const fieldOnly={terrain:fieldTerrain,material:fieldMaterial};
 assert.equal(fieldOnly.terrain.cache,'built','The first terrain miss after the warm geometry and fine miss must promote the worker to full readiness');
 assert.deepEqual(Object.keys(fieldOnly.material.cache).sort(),['baseColor','forest','rock','snow','water']);
 assert(Object.values(fieldOnly.material.cache).every(state=>state==='built'),'Every first material channel miss must be built after full promotion');
 assert.equal(fieldOnly.terrain.revision,cold.revision);assert.equal(fieldOnly.material.revision,cold.revision);
 assert.deepEqual(fieldOnly.terrain.tile,tileAddress);assert.deepEqual(fieldOnly.material.tile,tileAddress);
 assert.equal(fieldOnly.terrain.width,256);assert.equal(fieldOnly.terrain.height,256);
 assert.equal(fieldOnly.material.width,256);assert.equal(fieldOnly.material.height,256);
 assert.deepEqual(Object.keys(fieldOnly.material.channels).sort(),['baseColor','forest','rock','snow','water']);
 assert(fieldOnly.terrain.buffers.heights&&fieldOnly.terrain.buffers.pixels);
 assert(fieldOnly.terrain.ms>=0&&fieldOnly.material.ms>=0);
 await native.close();

 const geometryCache=path.join(native.profile,'atlas-region-cache'),evidenceCache=path.join(native.profile,'atlas-region-cache-field-only-evidence');
 await rename(geometryCache,evidenceCache);
 const oraclePage=await native.launch();oraclePage.on('pageerror',error=>errors.push(error.stack??String(error)));
 const oracleToken=await oraclePage.evaluate(async campaignId=>{
  const result=await window.campaign.activate(campaignId);if(!result.ok)throw Error(JSON.stringify(result));
  window.__atlasFieldProbeToken=result.value.token;return window.__atlasFieldProbeToken;
 },campaign.id);
 const oracleTerrain=await oraclePage.evaluate(captureTerrainMaterial,{token:oracleToken,kind:'terrain',tile:tileAddress});
 const oracleMaterial=await oraclePage.evaluate(captureTerrainMaterial,{token:oracleToken,kind:'material',tile:tileAddress});
 const fullFirst={terrain:oracleTerrain,material:oracleMaterial};
 assert.equal(fullFirst.terrain.cache,'built','The cache-free oracle must build terrain');
 assert(Object.values(fullFirst.material.cache).every(state=>state==='built'),'The cache-free oracle must build all material channels');
 assert.equal(fullFirst.terrain.revision,cold.revision);assert.equal(fullFirst.material.revision,cold.revision);
 const parityView=({fence,ms,...stable})=>stable;
 assert.deepEqual(parityView(fieldOnly.terrain),parityView(fullFirst.terrain),'Field-only prepared-index terrain must match a fresh full-first projection');
 assert.deepEqual(parityView(fieldOnly.material),parityView(fullFirst.material),'Field-only prepared-index materials must match fresh full-first channel bytes');
 const canonicalAfter=canonicalSnapshot(campaign.id),after=await hashes();
 assert.deepEqual(canonicalAfter,canonicalBefore,'Canonical world, room, drawing and Atlas revision data must remain unchanged');
 assert.deepEqual(after,before,'Source and built code hashes must remain fixed throughout the run');
 assert.deepEqual(errors,[],'Renderer page errors prevent this probe from qualifying');
 await native.close();
 await native.finish({complete:true,scope:'Frozen M0 mixed-world coarse geometry overview through real preload/Main/worker IPC, visual nonsemantic Deck layers, warm fresh-process buffers, exact fine-room picking, and field-only readiness promotion compared with a cache-free full-first terrain/material oracle; no full M2 or product acceptance.',fixture:{path:'docs/reference/atlas-rebuild-m0-20261023/mixed-world.sqlite.gz',sha256:sourceHash,bytes:sourceBytes,campaign,inventory},cold,flat,proxyPick,warm,warmProjectionWork,fine,fieldOnly,fullFirst,evidenceCache,canonical:{before:canonicalBefore,after:canonicalAfter},errors,hashes:{before,after}});
 console.log(JSON.stringify({complete:true,output}));
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}
