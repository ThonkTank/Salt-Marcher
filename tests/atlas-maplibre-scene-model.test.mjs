import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';

buildSync({entryPoints:['src/app/atlas-maplibre-scene-model.ts'],outfile:'.build/atlas-maplibre-scene-model-test.cjs',bundle:true,platform:'node',format:'cjs'});
buildSync({entryPoints:['src/app/terrain-grid-layout.ts'],outfile:'.build/atlas-maplibre-layout-test.cjs',bundle:true,platform:'node',format:'cjs'});
buildSync({entryPoints:['src/app/atlas-metric-space.ts'],outfile:'.build/atlas-maplibre-metric-test.cjs',bundle:true,platform:'node',format:'cjs'});
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/atlas-maplibre-store-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
buildSync({entryPoints:['src/app/storage/atlas-region.ts'],outfile:'.build/atlas-maplibre-region-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const require=createRequire(import.meta.url),{buildAtlasMapLibreSceneModel}=require('../.build/atlas-maplibre-scene-model-test.cjs'),
  {terrainGridLayout}=require('../.build/atlas-maplibre-layout-test.cjs'),{metricLngLat,metricProjectionParameters}=require('../.build/atlas-maplibre-metric-test.cjs'),
  {CampaignStore}=require('../.build/atlas-maplibre-store-test.cjs'),{AtlasRegionReader}=require('../.build/atlas-maplibre-region-test.cjs');

function terrain({x=0,y=0,width=128,height=128,columns=3,rows=3,heights=Array(columns*rows).fill(10),focusM=8,exaggeration=2,refinement}={}){
  return {view:{box:{x,y,width,height},frame:{x,y,width,height},columns,rows,focusM,tilt:0,rotation:0,exaggeration,...(refinement?{refinement}:{})},heights:Float32Array.from(heights),seaLevelM:0};
}
function regionView({rooms=[],cities=[],scopeId=null,coverage='detail',frames={},interiors={},bindings=[]}={}){
  return {region:{scopeId,coverage:{mode:coverage,complete:coverage==='detail',unreadable:0},frames,interiors},bindings,cities,
    geometry:{floors:[],drawing:{elements:[]}},workspace:{rooms,floors:[]}};
}
function area2(mesh,scale,atZ){
  const p=mesh.positions,ix=mesh.indices;let total=0;
  for(let i=0;i<ix.length;i+=3){
    const a=ix[i]*3,b=ix[i+1]*3,c=ix[i+2]*3;
    if(Math.abs(p[a+2]-atZ)>1e-7||Math.abs(p[b+2]-atZ)>1e-7||Math.abs(p[c+2]-atZ)>1e-7)continue;
    total+=Math.abs((p[b]-p[a])*(p[c+1]-p[a+1])-(p[b+1]-p[a+1])*(p[c]-p[a]))*.5*scale*scale;
  }
  return total;
}
const close=(actual,expected,tolerance=1e-5)=>assert(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);

test('terrain mesh retains terrainGridLayout topology, height datum and root-local metric coordinates',()=>{
  const grid=terrain({x:-20,y:-30,width:40,height:60,columns:3,rows:2,heights:[8,9,10,11,12,13]}),root={x:-128,y:-128,size:256},origin={x:0,y:0};
  const model=buildAtlasMapLibreSceneModel({view:regionView(),terrain:grid,root,sceneOrigin:origin}),mesh=model.objects.find(o=>o.target.kind==='terrain');
  assert(mesh);assert.equal(mesh.positions.length,3*3*2);assert.deepEqual([...mesh.indices],[0,3,1,1,3,4,1,4,2,2,4,5]);
  const first=mesh.positions;close(first[0],-20/256);close(first[1],-30/256);close(first[2],8*2/256);
  const last=(3*2-1)*3;close(first[last],20/256);close(first[last+1],30/256);close(first[last+2],13*2/256);
  assert.equal(model.verticalOriginM,0);assert.equal(model.verticalExaggeration,2);
  assert.deepEqual(model.root,root);assert.deepEqual(model.sceneOrigin,origin);assert(Object.isFrozen(model.root));assert(Object.isFrozen(model.sceneOrigin));
  assert.deepEqual(model.coverage.supportedKinds,['terrain','room','building']);
});

test('rooms preserve holes, rotate through the canonical scope frame and sit on the elevated terrain workplane without mutating input',()=>{
  const far=900_000_000_000,frame={x:far+64,y:far+64,angle:Math.PI/2},room={id:'room A',scopeId:'scope-a',floorId:'upper',name:'Hall',number:'1',revision:3,polygons:[{
    outer:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10},{x:0,y:0}],holes:[[{x:4,y:4},{x:6,y:4},{x:6,y:6},{x:4,y:6},{x:4,y:4}]]
  }]},saved=structuredClone(room),root={x:far-256,y:far-256,size:512};
  const binding={id:'binding-scope',kind:'dungeon',ownerId:'scope-a',parent:'world',parentId:null,x:frame.x,y:frame.y,angle:frame.angle,revision:1};
  const view=regionView({rooms:[room],bindings:[binding],frames:{'binding-scope':frame}});view.geometry.floors=[{id:'upper',scopeId:'scope-a',name:'Upper',elevation:5}];
  const model=buildAtlasMapLibreSceneModel({view,terrain:terrain({x:far-64,y:far-64,width:256,height:256}),root,sceneOrigin:{x:frame.x,y:frame.y}});
  const mesh=model.objects.find(o=>o.target.kind==='room');assert(mesh);assert.deepEqual(mesh.target,{kind:'room',id:'room A',scopeId:'scope-a',floorId:'upper'});
  const scale=root.size,z=15*2/scale;close(area2(mesh,scale,z),96,1e-3);
  for(let i=2;i<mesh.positions.length;i+=3)close(mesh.positions[i],z,1e-7);
  // Local X becomes positive world Y after the frame rotation; Deck uses the
  // same positive root-normalized Y convention as the bridge's localToGlobal.
  assert(mesh.positions.some((_,i)=>i%3===1&&mesh.positions[i]>0));
  assert.equal(model.targets.get(mesh.id),mesh.target);assert.deepEqual(room,saved);
});

test('building exteriors preserve rotated footprint holes, terrain anchor and floor-derived wall height',()=>{
  const cityFrame={x:0,y:0,angle:0},cityBinding={id:'city-binding',kind:'city',ownerId:'city-1',parent:'world',parentId:null,x:0,y:0,angle:0,revision:1};
  const building={id:'house-1',kind:'building',name:'House',protected:false,position:{x:20,y:20},angle:Math.PI/2,
    footprint:[{outer:[{x:-4,y:-4},{x:4,y:-4},{x:4,y:4},{x:-4,y:4}],holes:[[{x:-1,y:-1},{x:1,y:-1},{x:1,y:1},{x:-1,y:1}]]}],
    terrain:{mode:'ground',offsetM:2,wallM:4,roofM:3},floorElevations:[0,3]};
  const saved=structuredClone(building),city={header:{id:'city-1',roof:'#884422'},units:[building]},view=regionView({cities:[city],bindings:[cityBinding],frames:{'city-binding':cityFrame},interiors:{'house-1':'interior'}});
  const model=buildAtlasMapLibreSceneModel({view,terrain:terrain({x:-64,y:-64,width:128,height:128}),root:{x:-128,y:-128,size:256},sceneOrigin:{x:0,y:0}});
  const mesh=model.objects.find(o=>o.target.kind==='building');assert(mesh);assert.deepEqual(mesh.target,{kind:'building',id:'house-1',cityId:'city-1',scopeId:'interior'});
  close(area2(mesh,256,22*2/256),60,1e-3);
  assert.equal(model.targets.get(mesh.id),mesh.target);assert(mesh.indices.length>0);
  // The roof apex uses terrain base 10 + offset 2 + highest floor 3 + wall 4 + roof 3.
  close(Math.max(...Array.from({length:mesh.positions.length/3},(_,i)=>mesh.positions[i*3+2])),22*2/256,1e-7);
  assert.deepEqual(building,saved);
});

test('open building shells remain absent while their interior room uses the building terrain base',()=>{
  const cityFrame={x:0,y:0,angle:0},cityBinding={id:'city-binding',kind:'city',ownerId:'city-1',parent:'world',parentId:null,x:0,y:0,angle:0,revision:1};
  const childBinding={id:'scope-binding',kind:'dungeon',ownerId:'interior',parent:'building',parentId:'house-1',x:0,y:0,angle:0,revision:1};
  const building={id:'house-1',kind:'building',name:'House',protected:false,position:{x:20,y:20},angle:0,outline:[{x:-4,y:-4},{x:4,y:-4},{x:4,y:4},{x:-4,y:4}],terrain:{mode:'ground',offsetM:2,wallM:4,roofM:3},floorElevations:[0,3]};
  const room={id:'inside-room',scopeId:'interior',floorId:'upper',name:'Room',number:'1',revision:1,polygons:[{outer:[{x:0,y:0},{x:3,y:0},{x:3,y:3},{x:0,y:3}],holes:[]}]};
  const view=regionView({cities:[{header:{id:'city-1'},units:[building]}],rooms:[room],bindings:[cityBinding,childBinding],frames:{'city-binding':cityFrame,'scope-binding':{x:20,y:20,angle:0}},interiors:{'house-1':'interior'},scopeId:'interior'});
  view.geometry.floors=[{id:'upper',scopeId:'interior',name:'Upper',elevation:3}];
  const model=buildAtlasMapLibreSceneModel({view,terrain:terrain({x:-64,y:-64,width:128,height:128}),root:{x:-128,y:-128,size:256},sceneOrigin:{x:0,y:0},display:{metersPerPixel:1,roofs:true,scopeId:'interior'}});
  assert(!model.objects.some(o=>o.target.kind==='building'));
  const floor=model.objects.find(o=>o.target.kind==='room');assert(floor);
  // base = sampled terrain(10) + anchor offset(2), floor elevation = 3.
  for(let i=2;i<floor.positions.length;i+=3)close(floor.positions[i],15*2/256,1e-7);
});

test('raster-only geometry and missing terrain are reported as incomplete instead of invented vectors',()=>{
  const room={id:'hidden-by-raster',scopeId:'scope',floorId:'ground',name:'No vectors',number:'',revision:1,polygons:[]};
  const raster=buildAtlasMapLibreSceneModel({view:regionView({rooms:[room],coverage:'raster'}),terrain:terrain(),root:{x:-128,y:-128,size:256},sceneOrigin:{x:0,y:0}});
  assert(!raster.objects.some(o=>o.target.kind==='room'));
  assert(raster.coverage.unsupported.some(item=>item.code==='region-raster-only'));
  assert.equal(raster.coverage.complete,false);
  const noTerrain=buildAtlasMapLibreSceneModel({view:regionView(),terrain:null,root:{x:-128,y:-128,size:256},sceneOrigin:{x:0,y:0}});
  assert.equal(noTerrain.objects.length,0);assert(noTerrain.coverage.unsupported.some(item=>item.code==='terrain-grid-missing'));
  assert.equal(noTerrain.coverage.complete,false);
});

test('refined terrain vertices and triangles use the real continuous terrainGridLayout',()=>{
  const grid=terrain({x:-100,y:-100,width:200,height:200,columns:9,rows:9,refinement:{x:-30,y:-20,width:60,height:40},heights:Array.from({length:81},(_,i)=>i)}),layout=terrainGridLayout(grid.view);
  const model=buildAtlasMapLibreSceneModel({view:regionView(),terrain:grid,root:{x:-256,y:-256,size:512},sceneOrigin:{x:0,y:0}}),mesh=model.objects.find(o=>o.target.kind==='terrain');assert(mesh);
  for(let row=0;row<9;row++)for(let column=0;column<9;column++){
    const i=row*9+column;close(mesh.positions[i*3],layout.x.values[column]/512,1e-7);close(mesh.positions[i*3+1],layout.y.values[row]/512,1e-7);
  }
  const firstCell=[...mesh.indices.slice(0,6)];assert.deepEqual(firstCell,[0,9,1,1,9,10]);
});

test('positive scene-local Y matches the CRS tile-matrix Y after a nonzero and out-of-root fixed origin',()=>{
  const root={x:-128,y:-128,size:256},sceneOrigin={x:300,y:350},grid=terrain({x:-100,y:-100,width:200,height:200}),projection=metricProjectionParameters(root);
  const model=buildAtlasMapLibreSceneModel({view:regionView(),terrain:grid,root,sceneOrigin}),mesh=model.objects.find(o=>o.target.kind==='terrain');assert(mesh);
  const point={x:-100,y:-100},encoded=metricLngLat(root,point),encodedOrigin=metricLngLat(root,sceneOrigin),units=projection.unitsPerCoordinate;
  close(mesh.positions[0],(encoded[0]-encodedOrigin[0])*units/root.size);
  close(mesh.positions[1],-(encoded[1]-encodedOrigin[1])*units/root.size);
  assert(Math.abs(mesh.positions[1])>0,'the assertion must exercise nonzero map Y');
  assert(Object.isFrozen(model.root)&&Object.isFrozen(model.sceneOrigin));
});

test('canonical Store and AtlasRegionReader DTOs preserve both floor elevations through the scene adapter',async t=>{
  const dir=mkdtempSync(tmpdir()+'/atlas-scene-model-'),store=new CampaignStore(dir+'/campaign.sqlite'),initial={id:'ground-room',scopeId:'local',floorId:'ground',number:'1',name:'Ground',revision:0,
    polygons:[{outer:[{x:0,y:0},{x:8,y:0},{x:8,y:8},{x:0,y:8}],holes:[]}],sections:[{id:randomUUID(),kind:'markdown',markdown:'private'}]},campaign=store.create('Canonical scene',[initial]),shell=store.activateShell(campaign.id),db=new (require('better-sqlite3'))(store.filename,{readonly:true}),reader=new AtlasRegionReader(db);
  t.after(()=>{db.close();store.close();rmSync(dir,{recursive:true,force:true});});
  const command=action=>store.executeAtlasCommit({commandId:randomUUID(),token:shell.token,campaignId:campaign.id,action});
  store.executeDrawing({commandId:randomUUID(),token:shell.token,campaignId:campaign.id,action:{kind:'floor',scopeId:'local',id:'upper',name:'Obergeschoss',elevation:3,cloneId:null,hidden:false}});
  command({kind:'room-create',scopeId:'local',floorId:'upper',name:'Upper',polygons:[{outer:[{x:10,y:0},{x:18,y:0},{x:18,y:8},{x:10,y:8}],holes:[]}]});
  const byFloor=new Map();
  for(const floorId of ['ground','upper']){
    const source=store.atlasRegionSource(shell.token);await reader.sync(source);
    const region=reader.read(source,{box:{x:-32,y:-32,width:64,height:64},width:1024,height:768,scopeId:'local',floorId,slice:null,roofs:true});
    const view=store.atlasRegionView(shell.token,region),grid=terrain({x:-32,y:-32,width:64,height:64,focusM:0,exaggeration:1}),model=buildAtlasMapLibreSceneModel({view,terrain:grid,root:{x:-128,y:-128,size:256},sceneOrigin:{x:0,y:0}});
    const roomMesh=model.objects.find(o=>o.target.kind==='room');assert(roomMesh,`canonical ${floorId} room should become a mesh`);byFloor.set(floorId,roomMesh);
  }
  close(byFloor.get('ground').positions[2],10/256,1e-7);close(byFloor.get('upper').positions[2],13/256,1e-7);
  assert.deepEqual(byFloor.get('ground').target,{kind:'room',id:'ground-room',scopeId:'local',floorId:'ground'});
  assert.equal(byFloor.get('upper').target.floorId,'upper');
});
