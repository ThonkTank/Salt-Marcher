import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
const require=createRequire(import.meta.url),Database=require('better-sqlite3');
buildSync({stdin:{contents:"export * from './src/app/storage/store';export * from './src/app/storage/atlas-region';export * from './src/app/storage/shared-roads';export * from './src/app/landscape-line';export * from './src/app/line-types';export * from './src/app/city-model';export * from './src/app/landscape-raster';export * from './src/app/atlas-region-export';",resolveDir:process.cwd()},outfile:'.build/shared-roads-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,AtlasRegionReader,newLine,lineParts,linePoints,lineDisplay,lineHit,lineLength,splitLine,lineTypes,cityRoadRecord,atlasRegionPaint,LandscapeRasterizer}=require('../.build/shared-roads-test.cjs');
const road=(type='street',points=[{x:0,y:0},{x:500,y:0}])=>({id:randomUUID(),revision:0,kind:lineTypes.find(t=>t.id===type).kind,name:'Unveränderter Name',width:lineTypes.find(t=>t.id===type).width,points,polygons:[],resolution:1,values:{},line:newLine(lineTypes.find(t=>t.id===type).kind,42,type)});
function fixture(t){const dir=mkdtempSync('/tmp/shared-roads-');let store=new CampaignStore(dir+'/campaign.sqlite');const cam=store.create('Gemeinsame Wege');let w=store.activate(cam.id);const f={dir,cam,get store(){return store;},get token(){return w.token;},write(action){return store.executeAtlasCommit({commandId:randomUUID(),token:w.token,campaignId:cam.id,action});},get(id){return store.atlasLandscapeObject(w.token,id);},city(name='Stadt',x=1000,y=-500){return f.write({kind:'city-create',name,x,y,width:300,height:200}).result.id;},editCity(cityId,upsert,remove=[]){const commandId=randomUUID();return store.executeAtlasCommit({commandId,token:w.token,campaignId:cam.id,action:{kind:'city',command:{commandId,token:w.token,campaignId:cam.id,cityId,expectedRevision:store.city(w.token,cityId).header.revision,action:{kind:'change',upsert,remove,label:'Straße bearbeiten'}}}});},fresh(){store.close();store=new CampaignStore(dir+'/campaign.sqlite');w=store.activate(cam.id);}};t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});return f;}
const units=()=>[{id:randomUUID(),kind:'node',name:'',protected:true,point:{x:10,y:50}},{id:randomUUID(),kind:'node',name:'',protected:true,point:{x:200,y:50}}];
function cityStreet(f,id,type='alley'){const nodes=units(),u={id:randomUUID(),kind:'road',name:'Gasse zum Tor',protected:true,nodeIds:nodes.map(n=>n.id),via:[{x:80,y:70}],width:3,line:newLine('road',13,type)};f.editCity(id,[...nodes,u]);return u.id;}
test('fixed type vocabulary rejects custom paint while retaining existing legacy graphics',t=>{
 const f=fixture(t);assert.equal(lineTypes.length,15);for(const type of lineTypes){const r=road(type.id);f.write({kind:'landscape-put',record:r,expectedRevision:null});const saved=f.get(r.id);assert.equal(saved.line.type,type.id);assert.equal(saved.line.color,undefined);assert.equal(saved.line.style,undefined);assert(lineParts(saved).length>0);for(const option of [{color:'#ff0000'},{style:'arrows'},{catalogVersion:99}])assert.throws(()=>f.write({kind:'landscape-put',record:{...saved,line:{...saved.line,...option}},expectedRevision:saved.revision}),/prüfen/);}
 const r=road();r.line={...r.line,version:1,color:'#aa0011',style:'dotted'};delete r.line.type;delete r.line.catalogVersion;f.write({kind:'landscape-put',record:r,expectedRevision:null});assert.equal(lineParts(f.get(r.id))[0].color,'#aa0011');
});
test('zoom changes only display width, opacity and detail, never world geometry',()=>{
 const r=road('trade-road',[{x:-2e7,y:-100},{x:0,y:100},{x:2e7,y:-100}]),geometry=linePoints(r);for(const mpp of [.01,1,10,100,1000,1e5]){const d=lineDisplay(r,mpp);assert.equal(d.width,Math.max(r.width,2.25*mpp));assert.equal(d.opacity,1);lineParts(r,mpp);assert.deepEqual(linePoints(r),geometry);}const short=road('alley',[{x:0,y:0},{x:10,y:0}]);assert.equal(lineDisplay(short,10).opacity,0);assert(!lineHit(short,{x:5,y:0},10));assert(lineDisplay(short,10,true).opacity===1);assert.equal(lineDisplay(short,.01).width,3);
 const long=road('trail',[{x:0,y:0},{x:10000,y:0}]);assert(lineDisplay(long,10).opacity>lineDisplay({...long,points:[{x:0,y:0},{x:100,y:0}]},10).opacity);
});
test('city and landscape edits share one canonical geometry and preserve undo/reopen',t=>{
 const f=fixture(t),city=f.city(),id=cityStreet(f,city);let r=f.get(id);assert.equal(r.points[0].x,1010);assert.equal(r.points[0].y,-450);assert.equal(r.line.type,'alley');const raw=JSON.parse(f.store.db.prepare('SELECT payload FROM city_unit WHERE id=?').get(id).payload);assert.equal(raw.roadRef,id);assert(!raw.outline&&!raw.via&&!raw.nodeIds&&!raw.width);
 f.write({kind:'landscape-put',record:{...r,width:12,line:newLine('road',13,'avenue')},expectedRevision:r.revision});let u=f.store.city(f.token,city).units.find(u=>u.id===id);assert.equal(u.width,12);assert.equal(u.line.type,'avenue');assert.equal(u.outline[0].x,10);
 f.editCity(city,[{...u,name:'Gemeinsame Allee',width:14}]);assert.equal(f.get(id).name,'Gemeinsame Allee');f.write({kind:'undo'});assert.equal(f.get(id).name,'Gasse zum Tor');f.write({kind:'redo'});f.fresh();assert.equal(f.get(id).name,'Gemeinsame Allee');assert.equal(f.store.city(f.token,city).units.find(u=>u.id===id).width,14);
});
test('an outside road crossing two cities is one editable road in both',t=>{
 const f=fixture(t),a=f.city('West',0,0),b=f.city('Ost',500,0),r=road('trade-road',[{x:-100,y:50},{x:1000,y:50}]);f.write({kind:'landscape-put',record:r,expectedRevision:null});
 const inA=f.store.city(f.token,a).units.find(u=>u.id===r.id),inB=f.store.city(f.token,b).units.find(u=>u.id===r.id);assert(inA&&inB);assert.equal(inB.outline[0].x,-600);f.editCity(b,[{...inB,width:15}]);assert.equal(f.get(r.id).width,15);assert.equal(f.store.city(f.token,a).units.find(u=>u.id===r.id).width,15);
 assert.throws(()=>f.editCity(a,[{...inA,width:99}]),/inzwischen/);assert.equal(f.get(r.id).width,15);
});
test('legacy city roads project without changing bytes and convert atomically on edit',t=>{
 const f=fixture(t),city=f.city(),nodes=units(),id=randomUUID(),u={id,kind:'road',name:'Originalgasse',protected:true,nodeIds:nodes.map(n=>n.id),via:[],width:4};
 for(const unit of [...nodes,u]){const payload=JSON.stringify(unit);f.store.db.prepare('INSERT INTO city_unit VALUES(?,?,?,?,?,?)').run(f.cam.id,city,unit.id,unit.kind,payload,createHash('sha256').update(payload).digest('hex'));}
 const original=f.store.db.prepare('SELECT payload FROM city_unit WHERE id=?').get(id).payload;const r=f.get(id);assert.equal(r.line.color,'#c1ae8b');assert.equal(f.store.city(f.token,city).units.find(u=>u.id===id).width,4);assert.equal(f.store.db.prepare('SELECT payload FROM city_unit WHERE id=?').get(id).payload,original);
 f.write({kind:'landscape-put',record:{...r,line:newLine('road',1,'alley')},expectedRevision:r.revision});assert.equal(f.get(id).line.type,'alley');f.write({kind:'undo'});assert.equal(f.store.db.prepare('SELECT payload FROM city_unit WHERE id=?').get(id).payload,original);assert(!f.store.db.prepare('SELECT 1 FROM atlas_landscape WHERE id=?').get(id));assert.equal(f.get(id).line.color,'#c1ae8b');f.write({kind:'redo'});assert.equal(f.get(id).line.type,'alley');
});
test('explicit junctions move together, crossings do not, and split retains route-scale length',t=>{
 const f=fixture(t),a=road('country-road',[{x:-1000,y:0},{x:0,y:0},{x:1000,y:0}]),b=road('country-road',[{x:0,y:0},{x:0,y:1000}]),cross=road('alley',[{x:-100,y:500},{x:100,y:500}]);a.junctions=[{index:1,id:'junction'}];b.junctions=[{index:0,id:'junction'}];f.write({kind:'landscape-batch',records:[a,b,cross].map(record=>({record,expectedRevision:null}))});
 let saved=f.get(a.id),next=structuredClone(saved);next.points[1]={x:30,y:40};f.write({kind:'landscape-put',record:next,expectedRevision:saved.revision});assert.deepEqual(f.get(b.id).points[0],next.points[1]);assert.deepEqual(f.get(cross.id).points,cross.points);
 saved=f.get(a.id);const [first,second]=splitLine(saved,1,randomUUID());f.write({kind:'landscape-batch',records:[{record:first,expectedRevision:saved.revision},{record:second,expectedRevision:null}]});const x=f.get(first.id),y=f.get(second.id);assert.equal(x.routeId,y.routeId);assert.equal(x.routeLength,y.routeLength);assert(Math.abs(x.routeLength-saved.routeLength)<1e-6);assert.equal(lineDisplay(x,20).opacity,lineDisplay(y,20).opacity);
});
test('moving a city moves its anchors and connected endpoint, retaining the outside road',t=>{
 const f=fixture(t),city=f.city(),id=cityStreet(f,city),r=f.get(id),end=r.points.at(-1),outside=road('trade-road',[{...end},{x:2000,y:-450}]);outside.junctions=[{index:0,id:r.junctions.at(-1).id}];f.write({kind:'landscape-put',record:outside,expectedRevision:null});
 const binding=f.store.campaignAtlas(f.token).bindings.find(b=>b.ownerId===city);f.write({kind:'bind',binding:{...binding,x:binding.x+100,angle:Math.PI/2},expectedRevision:binding.revision});assert.deepEqual(f.get(outside.id).points[0],f.get(id).points.at(-1));assert.deepEqual(f.get(outside.id).points.at(-1),outside.points.at(-1));f.write({kind:'undo'});assert.deepEqual(f.get(id).points,r.points);
});
test('city-local undo sees shared geometry conflicts and restores a successful edit',t=>{
 const f=fixture(t),city=f.city(),id=cityStreet(f,city),u=f.store.city(f.token,city).units.find(u=>u.id===id);const command=action=>f.store.executeCity({commandId:randomUUID(),token:f.token,campaignId:f.cam.id,cityId:city,expectedRevision:f.store.city(f.token,city).header.revision,action});command({kind:'change',upsert:[{...u,width:9}],remove:[],label:'Breite'});command({kind:'undo'});assert.equal(f.get(id).width,3);command({kind:'redo'});assert.equal(f.get(id).width,9);const r=f.get(id);f.write({kind:'landscape-put',record:{...r,width:10},expectedRevision:r.revision});assert.throws(()=>command({kind:'undo'}),/inzwischen/);assert.equal(f.get(id).width,10);
});
test('copy and reopen retain shared road references with independent identifiers',async t=>{
 const f=fixture(t),city=f.city(),id=cityStreet(f,city),snapshot=f.dir+'/copy.sqlite';await f.store.campaignSnapshot(f.token,snapshot);const copy=f.store.acceptCampaignSnapshot(snapshot,'Kopie',{}),w=f.store.activate(copy.id),cities=f.store.cities(w.token).cities;const u=f.store.city(w.token,cities[0].id).units.find(u=>u.kind==='road');assert.notEqual(u.id,id);assert.equal(u.id,u.roadRef);const r=f.store.atlasLandscapeObject(w.token,u.id);assert.equal(r.line.type,'alley');assert.deepEqual(r.points,f.store.atlasLandscapeObject(f.store.activate(f.cam.id).token,id).points);
});
test('regional rendering and hits use typed world lines rather than duplicate city geometry',async t=>{
 const f=fixture(t),city=f.city(),id=cityStreet(f,city),db=new Database(f.store.filename,{readonly:true}),reader=new AtlasRegionReader(db);t.after(()=>db.close());const source=f.store.atlasRegionSource(f.token);await reader.sync(source);const q={box:{x:1000,y:-500,width:300,height:200},width:1200,height:800,scopeId:null,floorId:'ground',slice:null,roofs:true};const region=reader.read(source,q);assert.equal(region.landscape.records.filter(r=>r.id===id).length,1);assert(!region.cities.flatMap(c=>c.units).some(u=>u.id===id));const hit=reader.candidatesAt(source,q,f.get(id).points[0],0,'landscape');assert(hit.items.some(i=>i.id===id));
 const distant=reader.read(source,{...q,box:{x:-10000,y:-10000,width:20000,height:20000}});assert(!distant.landscape.records.some(r=>r.id===id));assert(!reader.candidatesAt(source,{...q,box:{x:-10000,y:-10000,width:20000,height:20000}},f.get(id).points[0],0,'landscape').items.some(i=>i.id===id));
 const view=f.store.atlasRegionView(f.token,region),paint=atlasRegionPaint(view,region.landscape.records,q.box,q.width,new Map(),{grid:false,level:0,references:true,floorId:'ground',roofs:true,rasters:region.landscape.tiles,lineRasters:region.landscape.lineTiles});assert(paint.children.length>0);const expected=linePoints(f.get(id));linePoints(cityRoadRecord(f.store.city(f.token,city).units.find(u=>u.id===id))).forEach((p,i)=>assert(Math.hypot(p.x+1000-expected[i].x,p.y-500-expected[i].y)<1e-8));
});
test('city drawing joins an existing landscape endpoint and one undo restores both records',t=>{
 const f=fixture(t),city=f.city('Torstadt',0,0),outside=road('country-road',[{x:-200,y:50},{x:10,y:50}]);f.write({kind:'landscape-put',record:outside,expectedRevision:null});const before=f.get(outside.id),nodes=units(),u={id:randomUUID(),kind:'road',name:'Verbindung',protected:true,nodeIds:nodes.map(n=>n.id),via:[],width:7,line:newLine('road')};f.editCity(city,[...nodes,u]);const a=f.get(outside.id),b=f.get(u.id);assert.equal(a.junctions.find(j=>j.index===1).id,b.junctions.find(j=>j.index===0).id);assert.equal(a.routeId,b.routeId);assert.equal(a.routeLength,b.routeLength);f.write({kind:'undo'});assert.deepEqual({...f.get(outside.id),revision:before.revision},before);assert.throws(()=>f.get(u.id));f.write({kind:'redo'});assert.equal(f.get(outside.id).routeId,f.get(u.id).routeId);
});
test('legacy paths retain original screen dashes and custom lines retain width at every zoom',()=>{
 const r=road();delete r.line;r.style='path';r.width=1;assert.deepEqual(lineParts(r,10)[0].dash,[50,30]);assert.equal(lineParts(r,10)[0].width,20);r.line={version:1,curve:'linear',color:'#aa0011',roughness:0,meander:0,fadeIn:false,seed:1,style:'dotted',overSymbols:false};assert.deepEqual(lineParts(r,1),lineParts(r,100));
});
test('typed curves remain identical across a rotated city frame even with unequal segment lengths',()=>{
 const r=road('avenue',[{x:-20,y:15},{x:0,y:0},{x:2000,y:900}]),angle=.71,transform=p=>({x:-3000+p.x*Math.cos(angle)-p.y*Math.sin(angle),y:1700+p.x*Math.sin(angle)+p.y*Math.cos(angle)}),expected=linePoints(r).map(transform),actual=linePoints({...r,points:r.points.map(transform)});for(let i=0;i<actual.length;i++)assert(Math.hypot(actual[i].x-expected[i].x,actual[i].y-expected[i].y)<1e-8);
});
test('typed river mouths leave no per-object bank seams inside receiving water',()=>{
 for(const type of lineTypes.filter(t=>t.kind==='river')){
  const r=road(type.id,[{x:0,y:0},{x:100,y:0}]);r.width=12;r.line={...r.line,roughness:0,meander:0,fadeIn:false};
  const raster=new LandscapeRasterizer({x:40,y:-10,width:20,height:20},200,200);
  raster.paintPolygons([{outer:[{x:40,y:-10},{x:60,y:-10},{x:60,y:10},{x:40,y:10}],holes:[]}],'#7fa8bd');
  const before=Uint8Array.from(raster.finish());raster.paintRecordLine(r,.1);
  assert.deepEqual(raster.finish(),before,type.id+' must merge without an interior outline');
 }
});
