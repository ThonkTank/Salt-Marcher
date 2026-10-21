import {test} from 'node:test';
import {parseHTML} from './helpers/dom.mjs';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {homedir} from 'node:os';
const cache=homedir()+'/.cache/saltmarcher';mkdirSync(cache,{recursive:true});
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/vegetation';export * from './src/app/vegetation-controls';export {LandscapeWorkbench} from './src/app/atlas-landscape-ui';export * from './src/app/terrain-height';export * from './src/app/atlas-landscape';export * from './src/app/storage/store';export * from './src/app/storage/atlas-landscape-region';export * from './src/app/landscape-raster';export * from './src/app/vegetation-view';export * from './src/app/atlas-paint';",resolveDir:process.cwd()},outfile:'.build/vegetation-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {LandscapeWorkbench,vegetationControls,vegetationInspector,vegetationSpec,vegetationPresets,validateVegetation,generateVegetation,vegetationEnvironment,heightRecord,emptyRecord,contains,CampaignStore,AtlasLandscapeReader,effectiveLandscape,LandscapeRasterizer,atlasPaint,drawVegetation}=require('../.build/vegetation-test.cjs');
const box={x:-100,y:-100,width:200,height:200};
const rectangle=(x,y,w,h)=>({outer:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],holes:[]});
const plane=(height=50)=>[-1,0].flatMap(y=>[-1,0].map(x=>heightRecord(x*256,y*256,4,new Float32Array(4096).fill(height))));
const area=(id='wood',preset='conifer')=>({...emptyRecord('vegetation'),id,order:1,name:'Testwald',points:[],polygons:[rectangle(-100,-100,200,200)],resolution:3,values:{terrain:vegetationPresets.find(p=>p.id===preset).terrain},vegetation:vegetationSpec(preset,123)});
function setup(t){
 const dir=mkdtempSync(cache+'/vegetation-test-');let store=new CampaignStore(dir+'/world.sqlite'),cam=store.create('Landschaft'),active=store.activate(cam.id);
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 const write=action=>store.executeAtlasCommit({commandId:randomUUID(),campaignId:cam.id,token:active.token,action});
 const save=r=>write({kind:'landscape-put',record:r,expectedRevision:r.revision||null});
 for(const r of plane())save(r);
 return{get store(){return store;},get token(){return active.token;},cam,dir,write,save,reopen(){store.close();store=new CampaignStore(dir+'/world.sqlite');active=store.activate(cam.id);}};
}
test('stable candidate identity across tiles, cameras, density changes and restart inputs',()=>{
 const r=area(),rs=[...plane(),r],env=vegetationEnvironment(rs),all=generateVegetation(r,env,box,1).instances;
 assert(all.length>50);
 const cropped=generateVegetation(r,env,{x:-40,y:-40,width:80,height:80},1).instances;
 for(const p of cropped)assert.deepEqual(p,all.find(i=>i.id===p.id));
 const dense=structuredClone(r);dense.vegetation.preset.density=1;
 const next=generateVegetation(dense,vegetationEnvironment([...plane(),dense]),box,1).instances;
 for(const p of all)assert.deepEqual(p,next.find(i=>i.id===p.id));
 assert.deepEqual(generateVegetation(r,env,box,1).instances,all);
});
test('water, roads, buildings and excessive slopes reject generated candidates',()=>{
 const r=area(),road={...emptyRecord('road'),points:[{x:-100,y:0},{x:100,y:0}],width:20},
   buildings=[rectangle(-30,-80,60,50)],env=vegetationEnvironment([...plane(),r,road],buildings),
   objects=generateVegetation(r,env,box,1).instances;
 assert(objects.length>10);for(const o of objects){assert(Math.abs(o.y)>10);assert(!contains(o,buildings));}
 assert.equal(generateVegetation(r,vegetationEnvironment([...plane(-5),r]),box,1).instances.length,0);
 r.vegetation.preset.slope=0;
 const steep=plane().map(t=>heightRecord(t.height.x,t.height.y,4,Float32Array.from({length:4096},(_,i)=>1000+(t.height.x+i%64*4)*2)));
 assert.equal(generateVegetation(r,vegetationEnvironment([...steep,r]),box,1).instances.length,0);
});
test('protected corrections and deletion tombstones survive clearing and flooding',()=>{
 const r=area(),original=generateVegetation(r,vegetationEnvironment([...plane(),r]),box,1).instances;
 const [keep,remove]=original;
 r.vegetation.overrides=[{...keep,x:keep.x+2,asset:'rock',size:7},{...remove,removed:true}];
 r.vegetation.edits.push({polygons:[rectangle(-100,-100,200,200)],mode:'clear'});
 const next=generateVegetation(r,vegetationEnvironment([...plane(-20),r]),box,1).instances;
 assert.equal(next.length,1);assert.equal(next[0].id,keep.id);assert.equal(next[0].protected,true);assert.equal(next[0].conflict,true);assert.equal(next[0].z,-20);
 assert.equal(generateVegetation(r,vegetationEnvironment([...plane(),r]),box,200).instances.length,1);
});
test('fine authored cover dominates a coarse repaint and keeps its own distribution',()=>{
 const fine=area('fine','meadow'),coarse=area('coarse');fine.resolution=1;coarse.resolution=100;coarse.order=2;
 const records=[...plane(),fine,coarse],env=vegetationEnvironment(records);
 assert.equal(generateVegetation(coarse,env,box,1).instances.length,0);
 assert.equal(effectiveLandscape(records,{x:0,y:0}).terrain,'plains');
 assert(generateVegetation(fine,env,box,1).instances.every(i=>i.asset!=='pine'));
});
test('area history, one-step correction, failure rollback, reopen and source fence',t=>{
 const f=setup(t),r=area();f.save(r);const initial=f.store.atlasVegetationScene(f.token,box,1);
 assert(initial.instances.length>50);const beforeHeight=f.store.atlasHeight(f.token,{x:0,y:0});
 assert.equal(effectiveLandscape(f.store.landscapeRegion(f.token,box).records,{x:0,y:0}).terrain,'forest');
 const fence=f.store.atlasRegionSource(f.token).fence;f.store.atlasVegetationScene(f.token,box,1);assert.equal(f.store.atlasRegionSource(f.token).fence,fence);
 f.write({kind:'landscape-vegetation-edit',mode:'clear',polygons:[rectangle(-100,-100,200,200)]});
 assert.equal(f.store.atlasVegetationScene(f.token,box,1).instances.length,0);
 f.write({kind:'undo'});assert.deepEqual(f.store.atlasVegetationScene(f.token,box,1).instances,initial.instances);
 f.write({kind:'redo'});assert.equal(f.store.atlasVegetationScene(f.token,box,1).instances.length,0);
 f.write({kind:'undo'});
 f.store.db.exec("CREATE TEMP TRIGGER fail_cover BEFORE UPDATE ON atlas_landscape WHEN json_extract(new.payload,'$.kind')='vegetation' BEGIN SELECT RAISE(ABORT,'cover failure'); END");
 assert.throws(()=>f.write({kind:'landscape-vegetation-edit',mode:'clear',polygons:[rectangle(-100,-100,200,200)]}),/cover failure/);
 assert.deepEqual(f.store.atlasVegetationScene(f.token,box,1).instances,initial.instances);f.store.db.exec('DROP TRIGGER fail_cover');
 f.reopen();assert.deepEqual(f.store.atlasVegetationScene(f.token,box,1).instances,initial.instances);
 assert.equal(f.store.atlasHeight(f.token,{x:0,y:0}).heightM,beforeHeight.heightM);
});
test('render projection, exact area hits and ground raster retain semantic cover',t=>{
 const f=setup(t);f.save(area());
 const Database=require('better-sqlite3'),db=new Database(f.dir+'/world.sqlite',{readonly:true}),reader=new AtlasLandscapeReader(db);
 t.after(()=>db.close());const source=f.store.atlasRegionSource(f.token);
 reader.sync(source);const q={box,width:256,height:256,scopeId:null,floorId:'ground',slice:null,roofs:true},view=reader.read(source,q,2*1024*1024);
 assert.equal(view.state,'ready');assert(view.records.find(r=>r.vegetation)?.vegetationView.instances.length>50);
 assert(reader.hits(source,q,{x:0,y:0}).items.some(i=>i.id==='wood'));assert(view.tiles.length>0);
 const r=area(),a=new LandscapeRasterizer(box,64,64),b=new LandscapeRasterizer(box,64,64);for(const tile of plane()){a.paint(tile);b.paint(tile);}b.paint(r);
 assert.notDeepEqual(a.finish(),b.finish());
 const root=atlasPaint('group');drawVegetation(root,view.records.find(r=>r.id==='wood'),box,1);assert(root.children.some(n=>n.data.vegetationInstance));
 assert.equal(f.store.atlasRegionSource(f.token).fence,source.fence);
});
test('invalid snapshots and forged display fields fail at canonical writer',t=>{
 const f=setup(t);
 for(const change of [
  r=>r.vegetation.preset.density=NaN,r=>r.vegetation.spacing=0,r=>r.values.terrain='desert',
  r=>r.vegetation.overrides=[{id:'a',x:Infinity,y:0,size:5,asset:'oak',angle:0}],
  r=>r.vegetationView={instances:[],mode:'surface'},
  r=>r.vegetation.edits=[{mode:'clear',polygons:[rectangle(NaN,0,10,10)]}],
 ]){const r=area(randomUUID());change(r);assert.throws(()=>f.save(r));}
 assert.throws(()=>validateVegetation({...area(),vegetation:undefined}));
 const giant={x:0,y:0,width:1e8,height:1e8};assert.throws(()=>f.store.atlasVegetationScene(f.token,giant,0));
});
test('rows use metre spacing and fixed candidate IDs; all six presets are bounded',()=>{
 for(const p of vegetationPresets){const r=area('p',p.id);validateVegetation(r);assert(generateVegetation(r,vegetationEnvironment([...plane(),r]),box,1).instances.length<2000);}
 const r=area();r.points=[{x:-80,y:0},{x:80,y:0}];r.vegetation.layout='row';r.vegetation.spacing=10;r.vegetation.preset.density=1;r.vegetation.preset.edge=0;
 const objects=generateVegetation(r,vegetationEnvironment([...plane(),r]),box,1).instances;
 assert.equal(objects.length,16);assert(objects.every(i=>i.y===0));assert.equal(objects[1].x-objects[0].x,10);
 r.points=[{x:-1e7,y:0},{x:1e7,y:0}];r.polygons=[rectangle(-1e7,-30,2e7,60)];
 assert(generateVegetation(r,vegetationEnvironment([...plane(),r]),box,1).instances.length<100);
});
test('coarse rock representations retain the positions and sizes of their local candidates',()=>{
 const r=area('rocks','scree'),env=vegetationEnvironment([...plane(),r]),fine=generateVegetation(r,env,box,1).instances;
 const coarse=generateVegetation(r,env,box,4).instances;assert(coarse.length>0);
 for(const i of coarse)assert.deepEqual(i,fine.find(p=>p.id===i.id));
});
test('spatial lakes use their water level and suppress the same generated candidates',t=>{
 const f=setup(t);f.save(area());
 f.save({...emptyRecord('patch'),polygons:[rectangle(-40,-40,80,80)],values:{terrain:'water'},surface:'freshwater',waterLevelM:70});
 const scene=f.store.atlasVegetationScene(f.token,box,1),center=32*65+32;
 assert.equal(scene.grid.heights[center],70);assert.equal(scene.grid.colors[center],'#88acb9');
 assert(scene.instances.every(i=>!contains(i,[rectangle(-40,-40,80,80)])));
});
test('live height edits regenerate automatic vegetation without moving protected author decisions',t=>{
 const f=setup(t),r=area();f.save(r);const original=f.store.atlasVegetationScene(f.token,box,1).instances;
 const keep=original[0],canonical=f.store.atlasLandscapeObject(f.token,r.id);
 canonical.vegetation.overrides=[{id:keep.id,x:350,y:30,asset:'rock',size:7,angle:0}];f.save(canonical);
 assert(f.store.atlasVegetationScene(f.token,{x:330,y:10,width:40,height:40},1).instances.some(o=>o.id===keep.id&&o.protected));
 const records=plane(-20).map(tile=>{const old=f.store.landscapeRegion(f.token,{x:tile.height.x,y:tile.height.y,width:1,height:1}).records.find(r=>r.height?.x===tile.height.x&&r.height?.y===tile.height.y);return {record:{...tile,id:old.id,revision:old.revision},expectedRevision:old.revision};});
 f.write({kind:'landscape-batch',records});assert.equal(f.store.atlasVegetationScene(f.token,box,1).instances.length,0);
 f.write({kind:'undo'});assert.equal(f.store.atlasVegetationScene(f.token,box,1).instances.length,original.length-1);
});
test('rotated city buildings exclude vegetation in their world footprint and removal restores candidates',t=>{
 const f=setup(t),r=area();f.save(r);
 const original=f.store.atlasVegetationScene(f.token,box,1).instances;
 const city=f.write({kind:'city-create',name:'Stadt im Wald',x:0,y:0,width:100,height:100}).result.id;
 f.store.db.prepare("UPDATE atlas_binding SET angle=? WHERE campaign_id=? AND owner_id=?").run(Math.PI/2,f.cam.id,city);
 const header=f.store.atlasCitySite(f.token,city).header,id=randomUUID(),commandId=randomUUID();
 const building={id,kind:'building',name:'Halle',protected:true,position:{x:40,y:40},outline:[{x:-25,y:-25},{x:25,y:-25},{x:25,y:25},{x:-25,y:25}],angle:0,notes:'',residentIds:[],workerIds:[]};
 f.store.executeAtlasCommit({commandId,token:f.token,campaignId:f.cam.id,action:{kind:'city',command:{commandId,token:f.token,campaignId:f.cam.id,cityId:city,expectedRevision:header.revision,action:{kind:'change',upsert:[building],remove:[],label:'Halle bauen'}}}});
 const scene=f.store.atlasVegetationScene(f.token,box,1);assert.equal(scene.buildings.length,1);
 assert(scene.instances.length<original.length);assert(scene.instances.every(i=>!contains(i,scene.buildings)));
 f.write({kind:'undo'});assert.deepEqual(f.store.atlasVegetationScene(f.token,box,1).instances,original);
});
test('campaign transfer remaps locations while preserving procedural identities and snapshots',async t=>{
 const f=setup(t),r=area();f.save(r);
 const before=f.store.atlasVegetationScene(f.token,box,1),original=before.instances[0];
 const saved=f.store.atlasLandscapeObject(f.token,r.id);
 const doc={kind:'location',version:1,id:randomUUID(),name:'Alte Eiche',type:'poi',sections:[{id:randomUUID(),title:'Beschreibung',markdown:'Unveränderter Ortstext'},{id:randomUUID(),title:'Notizen',markdown:''}],detailMaps:[],keyLinks:[]};
 saved.vegetation.overrides.push({id:original.id,x:original.x,y:original.y,asset:'oak',size:22,angle:.3,locationId:doc.id});
 f.write({kind:'landscape-place',record:saved,point:original,document:doc,expectedRevision:saved.revision,expectedLocationRevision:null});
 const filename=f.dir+'/snapshot.sqlite';await f.store.campaignSnapshot(f.token,filename);
 const target=new CampaignStore(f.dir+'/copy.sqlite');t.after(()=>target.close());
 const copied=target.acceptCampaignSnapshot(filename,'Kopie',{}),active=target.activate(copied.id),
   scene=target.atlasVegetationScene(active.token,box,1),record=scene.records.find(r=>r.vegetation);
 assert.notEqual(record.id,r.id);assert.equal(record.vegetation.preset.id,'conifer');assert.equal(record.vegetation.seed,123);
 const object=scene.instances.find(i=>i.id===original.id);
 assert(object.protected);assert.equal(object.size,22);assert.notEqual(object.locationId,doc.id);
 assert.equal(JSON.parse(target.db.prepare('SELECT payload FROM location WHERE id=?').get(object.locationId).payload).sections[0].markdown,'Unveränderter Ortstext');
 assert.equal(scene.instances.length,before.instances.length);
});

test('adding and removing a road changes only affected candidates and reports protected conflicts',t=>{
 const f=setup(t),r=area();f.save(r);
 const before=f.store.atlasVegetationScene(f.token,box,1).instances;
 const protectedTree=before.find(i=>i.asset==='pine'),saved=f.store.atlasLandscapeObject(f.token,r.id);
 saved.vegetation.overrides.push({...protectedTree});f.save(saved);
 const road={...emptyRecord('road'),points:[{x:-100,y:protectedTree.y},{x:100,y:protectedTree.y}],width:25};
 f.save(road);const after=f.store.atlasVegetationScene(f.token,box,1).instances;
 assert(after.length<before.length);
 assert.equal(after.find(i=>i.id===protectedTree.id)?.conflict,true);
 for(const i of after.filter(i=>!i.protected))assert.deepEqual(i,before.find(x=>x.id===i.id));
 f.write({kind:'undo'});const restored=f.store.atlasVegetationScene(f.token,box,1).instances;
 assert.equal(restored.length,before.length);assert.equal(restored.find(i=>i.id===protectedTree.id)?.conflict,false);
});

test('three display scales preserve candidate coordinates, template snapshots and authored clearings',()=>{
 const r=area(),env=vegetationEnvironment([...plane(),r]),snapshot=JSON.stringify(r.vegetation);
 const local=generateVegetation(r,env,box,1),region=generateVegetation(r,env,box,8),world=generateVegetation(r,env,box,100);
 assert.equal(local.mode,'individual');assert.equal(region.mode,'canopy');assert.equal(world.mode,'surface');
 assert.equal(world.instances.length,0);assert(region.instances.length<local.instances.length);
 for(const i of region.instances)assert.deepEqual(i,local.instances.find(x=>x.id===i.id));
 assert.equal(JSON.stringify(r.vegetation),snapshot);
 const changed=structuredClone(r);changed.vegetation.edits.push({mode:'clear',polygons:[rectangle(-100,-100,100,200)]});
 const cleared=generateVegetation(changed,vegetationEnvironment([...plane(),changed]),box,1).instances;
 assert(cleared.length>0&&cleared.length<local.instances.length);
 for(const i of cleared){assert(i.x>0);assert.deepEqual(i,local.instances.find(x=>x.id===i.id));}
 const laterTemplate=vegetationSpec('conifer',999);laterTemplate.preset.size=60;
 assert.equal(JSON.stringify(r.vegetation),snapshot,'new template choices cannot mutate an existing area snapshot');
});

test('dense raster fallback stays bounded at the two metre detail boundary and retains protected picking',t=>{
 const f=setup(t),r=area();
 r.polygons=[rectangle(-3000,-3000,6000,6000)];
 r.vegetation.overrides.push({id:'protected-rock',x:0,y:0,asset:'rock',size:6,angle:0});
 f.save(r);
 const Database=require('better-sqlite3'),db=new Database(f.dir+'/world.sqlite',{readonly:true}),reader=new AtlasLandscapeReader(db);
 t.after(()=>db.close());const source=f.store.atlasRegionSource(f.token);reader.sync(source);
 // The Atlas prefetch doubles a local viewport; its padded fallback tiles are 2048 m.
 const q={box:{x:-552,y:-519,width:1104,height:1038},width:1712,height:1608,scopeId:null,floorId:'ground',slice:null,roofs:true},
   result=reader.read(source,q,16384);
 assert.equal(result.state,'ready');assert.equal(result.coverage.mode,'raster');assert(result.tiles.length>0);
 const selected=result.records.find(r=>r.id==='wood');
 assert.equal(selected.vegetationView.instances.length,1);
 assert.equal(selected.vegetationView.instances[0].id,'protected-rock');
 assert(Buffer.byteLength(JSON.stringify(result))<=16384);
 const root=atlasPaint('group');drawVegetation(root,selected,q.box,q.box.width/q.width);
 assert(root.children.some(n=>n.data['vegetation-rocks']==='protected-rock'));
});


test('visible invalid vegetation numbers reach canonical rejection; recovery saves the entered value',async t=>{
 const {window,document}=parseHTML('<html><body></body></html>'),previous={document:globalThis.document,Option:globalThis.Option};
 Object.assign(globalThis,{document,Option:function(text,value){const option=document.createElement('option');option.textContent=text;option.value=value;return option;}});
 const proto=window.HTMLSelectElement.prototype,descriptor=Object.getOwnPropertyDescriptor(proto,'value');
 Object.defineProperty(proto,'value',{configurable:true,get(){return this.getAttribute('data-value')??'';},set(v){this.setAttribute('data-value',v);}});
 proto.add=function(option){this.append(option);};
 t.after(()=>{Object.assign(globalThis,previous);Object.defineProperty(proto,'value',descriptor);delete proto.add;});
 const f=setup(t),r=area();f.save(r);
 const original=f.store.atlasLandscapeObject(f.token,r.id),source=f.store.atlasRegionSource(f.token).revision;
 for(const prefix of ['vegetation','spatial-vegetation']){
   const draft=structuredClone(original),root=document.createElement('div');let edits=0;
   vegetationControls(root,prefix,draft.vegetation,()=>edits++);
   const density=root.querySelector('#'+prefix+'-density');
   for(const value of ['1.25','','-0.1']){
     density.value=value;density.oninput();
     const workbench=Object.assign(Object.create(LandscapeWorkbench.prototype),{host:{write(){assert.fail('invalid draft reached the journal');}}});
     for(const action of [{kind:'landscape-put',record:draft},{kind:'landscape-place',record:draft},{kind:'landscape-batch',records:[{record:draft}]}])
       await assert.rejects(()=>workbench.commit(action),/Bewuchs/);
     assert.throws(()=>f.save(draft),/Bewuchs/);
     assert.equal(density.value,value);assert.equal(f.store.atlasRegionSource(f.token).revision,source);
     assert.deepEqual(f.store.atlasLandscapeObject(f.token,r.id),original);
   }
   assert.equal(edits,3,'invalid raw edits still own the unsaved draft');
   density.value='0.33';density.oninput();validateVegetation(draft);
   assert.equal(draft.vegetation.preset.density,.33,'canonical fractional values must not fall back to the old preset');
 }
 const draft=structuredClone(original),root=document.createElement('div');let edits=0;
 vegetationInspector(root,draft,{id:'manual:rock',x:0,y:0,asset:'rock',size:4,angle:0},()=>edits++,()=>{},()=>{});
 for(const [key,value]of [['x','0'],['y','0'],['size','4'],['angle','0']]){
   const input=root.querySelector('#vegetation-object-'+key);
   input.value='';input.oninput();assert.throws(()=>f.save(draft),/Einzelkorrektur/);
   assert.equal(input.value,'');assert.deepEqual(f.store.atlasLandscapeObject(f.token,r.id),original);
   input.value=value;input.oninput();
 }
 assert.equal(edits,8);f.save(draft);f.reopen();
 assert.deepEqual(f.store.atlasLandscapeObject(f.token,r.id).vegetation.overrides,[{id:'manual:rock',x:0,y:0,asset:'rock',size:4,angle:0}]);
});
