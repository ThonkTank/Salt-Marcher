import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/storage/store';export * from './src/app/storage/atlas-landscape-region';export * from './src/app/storage/terrain-grid';export * from './src/app/terrain-projection';export * from './src/app/terrain-spatial-model';export * from './src/app/terrain-height';export * from './src/app/terrain-brush';export * from './src/app/landscape-brush';export * from './src/app/terrain-spatial-worker';",resolveDir:process.cwd()},outfile:'.build/terrain-projection-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,AtlasLandscapeReader,readTerrainGrid,validateTerrainProjection,heightRecord,terrainGrid,applyTerrainBrush,TerrainSampler,brushFootprint,renderTerrainSpatial}=require('../.build/terrain-projection-test.cjs');
function fixture(t,side=1){
 const base=homedir()+'/.cache/saltmarcher/tests';mkdirSync(base,{recursive:true});const dir=mkdtempSync(base+'/terrain-projection-'),store=new CampaignStore(dir+'/world.sqlite'),campaign=store.create('Projection'),token=store.activate(campaign.id).token;
 const pixel=512,edge=side*64*pixel,template=heightRecord(0,0,pixel,new Float32Array(4096).fill(100)),put=store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
 store.db.transaction(()=>{for(let y=0;y<side;y++)for(let x=0;x<side;x++){
  const px=x*64*pixel,py=y*64*pixel,r={...template,id:`height:9:${x}:${y}`,height:{...template.height,x:px,y:py},polygons:[{outer:[{x:px-pixel,y:py-pixel},{x:px+64*pixel,y:py-pixel},{x:px+64*pixel,y:py+64*pixel},{x:px-pixel,y:py+64*pixel}],holes:[]}]};put.run(campaign.id,r.id,1,px-pixel,px+64*pixel,py-pixel,py+64*pixel,JSON.stringify(r));
 }})();
 const db=new (require('better-sqlite3'))(store.filename,{readonly:true});db.pragma('temp_store=FILE');db.pragma('cache_size=-8192');const reader=new AtlasLandscapeReader(db);
 t.after(()=>{db.close();store.close();rmSync(dir,{recursive:true,force:true});});
 const source=()=>store.atlasRegionSource(token),view={box:{x:0,y:0,width:edge,height:edge},frame:{x:0,y:0,width:edge,height:edge},columns:33,rows:33,focusM:100,tilt:45,rotation:0,exaggeration:2};
 const request=(extra={})=>({view,width:64,height:64,revision:source().revision,contours:0,displayMpp:edge/1000,...extra});
 const read=q=>{const s=source();reader.sync(s);return reader.terrain(s,q??request());};
 const commit=action=>store.executeAtlasCommit({campaignId:campaign.id,token,commandId:randomUUID(),action});
 return{store,token,reader,read,request,source,view,commit,db,edge};
}
test('streamed spatial display matches existing geometry, sea and object heights on a local field',t=>{
 const f=fixture(t),q=f.request(),r=f.read(q),records=f.store.atlasMaskRegion(f.token,q.view.box).records,expected=terrainGrid(records,q.view);
 assert.deepEqual(r.grid.heights,expected.heights);assert.equal(r.width,64);assert.equal(r.pixels.length,64*64*4);assert.equal(r.draft,false);
 f.commit({kind:'landscape-put',expectedRevision:null,record:{id:'plain-road',revision:0,kind:'road',name:'Path',points:[{x:4000,y:4000},{x:4500,y:4000}],polygons:[],resolution:1,width:4,values:{}}});
 const withRoad=f.read();assert(withRoad.routes.some(r=>r.id==='plain-road'),'ordinary roads survive the spatial projection');
 assert.deepEqual(withRoad.pixels,r.pixels,'mesh roads are not baked a second time into the ground texture');
 const o={kind:'building',id:'house',name:'House',anchor:{x:4000,y:4000},outline:[{x:3990,y:3990},{x:4010,y:3990},{x:4010,y:4010},{x:3990,y:4010}],binding:{mode:'ground',offsetM:2},wallM:3,roofM:2,floorElevations:[0,3],color:'#abcdef'};
 const house=f.read(f.request({objects:[o]})).objects[0];assert.equal(house.baseM,102);assert.equal(house.topM,108);assert.deepEqual(house.groundM,[100,100,100,100]);
 assert.throws(()=>f.read(f.request({fence:'obsolete'})),/inzwischen/);assert.throws(()=>f.read(f.request({revision:999})),/inzwischen/);
});
test('world above raw record budget remains drawable and locally sculptable, smoothable and paintable',t=>{
 const f=fixture(t,32),p={x:f.edge/2,y:f.edge/2},radius=8000;
 assert.throws(()=>f.store.atlasMaskRegion(f.token,f.view.box),/zu groß/);
 const q=f.request(),saved=f.read(q);assert.equal(saved.grid.heights[16*33+16],100);assert(saved.pixels.byteLength<100000);assert(!('records' in saved));
 const stroke={mode:'raise',radius,strength:50,feather:.5,samples:[{...p,t:0},{...p,t:500}],visibility:f.view};
 const preview=f.read(f.request({heightStroke:stroke}));assert(preview.draft);assert(preview.heightM>120);assert.equal(f.store.atlasHeight(f.token,p).heightM,100,'preview never writes');
 f.commit({kind:'landscape-height-stroke',stroke});assert.equal(f.store.atlasHeight(f.token,p).heightM,preview.heightM);
 const raised=f.store.atlasHeight(f.token,p).heightM;
 f.commit({kind:'landscape-height-stroke',stroke:{...stroke,mode:'smooth',strength:10}});assert(f.store.atlasHeight(f.token,p).heightM<=raised);
 const color={id:'color-test',revision:0,kind:'patch',name:'',width:0,resolution:256,points:[p],polygons:brushFootprint([p],radius),values:{},paint:{version:2,operation:'paint',target:'ground',color:'#ff0000',opacity:1,flow:1,tip:'round',radius,seed:1,fill:false,visibility:f.view}};
 const painted=f.read(f.request({color}));assert(painted.draft);f.commit({kind:'landscape-color-stroke',record:color});
 const persisted=JSON.parse(f.store.db.prepare('SELECT payload FROM atlas_landscape WHERE id=?').get(color.id).payload);assert(persisted.polygons.length);assert.equal(persisted.paint.visibility,undefined);
 const after=f.read();assert(after.pixels.some((v,i)=>v!==saved.pixels[i]),'the world texture reflects authored changes');
});
test('canonical streamed visibility preserves occlusion independently of local author records',t=>{
 const f=fixture(t),values=Float32Array.from({length:4096},(_,i)=>Math.abs(Math.floor(i/64)-32)<2?300:0),r=heightRecord(0,0,1,values);
 f.commit({kind:'landscape-put',expectedRevision:null,record:r});
 const view={box:{x:0,y:0,width:63,height:63},frame:{x:0,y:0,width:63,height:63},columns:64,rows:64,focusM:0,tilt:65,rotation:0,exaggeration:2},p={x:32,y:20};
 const all=f.store.atlasMaskRegion(f.token,view.box).records,grid=readTerrainGrid(f.db,f.source().campaignId,view),ordinary=terrainGrid(all,view);
 assert.deepEqual(grid.heights,ordinary.heights);
 const stroke={mode:'raise',radius:2,strength:10,feather:.5,samples:[{...p,t:0},{...p,t:500}],visibility:view},before=f.store.atlasHeight(f.token,p).heightM;
 f.commit({kind:'landscape-height-stroke',stroke});assert.equal(f.store.atlasHeight(f.token,p).heightM,before,'a ridge outside the brush still shields the far slope');
});
test('projection bounds reject unbounded buffers, unknown fields and renderer-supplied source heights',()=>{
 const view={box:{x:0,y:0,width:10,height:10},frame:{x:0,y:0,width:10,height:10},columns:33,rows:33,focusM:0,tilt:45,rotation:0,exaggeration:2},q={view,width:64,height:64,revision:0,contours:0,displayMpp:1};
 validateTerrainProjection(q);validateTerrainProjection({...q,contours:-1});
 validateTerrainProjection({...q,detail:{x:1,y:1,width:8,height:8},detailResolution:1024});
 for(const bad of [{detailResolution:512},{detail:q.view.box,detailResolution:2048},{detail:q.view.box,detailResolution:255.5},{contours:-2},{contours:-.5},{width:4096},{displayMpp:0},{heights:[1,2]},{objects:Array(1501).fill({})},{view:{...view,heights:[1]}}])assert.throws(()=>validateTerrainProjection({...q,...bad}));
});
