import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/terrain-height';export * from './src/app/landscape-raster';export * from './src/app/storage/store';export * from './src/app/storage/atlas-landscape-region';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['better-sqlite3'],outfile:'.build/terrain-raster-reuse-test.cjs'});
const {TerrainSampler,heightRecord,LandscapeRasterizer,landscapeRasterSlice,CampaignStore,AtlasLandscapeReader}=require('../.build/terrain-raster-reuse-test.cjs');
test('cached bilinear cells match sparse inheritance across negative coordinates, tile boundaries and repeated queries',()=>{
 const records=[];
 for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)records.push({...heightRecord(x*64,y*64,1,Float32Array.from({length:4096},(_,i)=>100+Math.sin(x*64+i%64)*20+(y*64+Math.floor(i/64))*.25)),revision:1+(y+1)*3+x+1});
 for(const sparse of [false,true]){
  const rs=sparse?[...records.filter(r=>r.height.x!==0||r.height.y!==0),heightRecord(0,0,1,new Float32Array(4096).fill(NaN))]:records;
  // An empty finer level leaves values unchanged but forces hierarchical sampling.
  const fast=new TerrainSampler(rs),reference=new TerrainSampler([...rs,heightRecord(0,0,.5,new Float32Array(4096).fill(NaN))]);
  for(const x of [-64.1,-64,-1.1,-1,0,.01,.5,.99,1,63,63.5,64,127.75])for(const y of [-63.5,-.25,0,.5,63,64])for(let repeat=0;repeat<2;repeat++){
   const a=fast.sample({x,y}),b=reference.sample({x,y});assert(Math.abs(a.heightM-b.heightM)<1e-10,JSON.stringify({x,y,a,b}));assert.equal(a.revision,b.revision);assert.equal(a.resolutionM,b.resolutionM);
  }
 }
});
test('house edits reuse pure terrain rasters while a height change still refreshes their pixels',t=>{
 const root=homedir()+'/.cache/saltmarcher/tests';mkdirSync(root,{recursive:true});const dir=mkdtempSync(root+'/raster-reuse-'),store=new CampaignStore(dir+'/world.sqlite'),cam=store.create('Raster'),token=store.activate(cam.id).token;
 const write=action=>store.executeAtlasCommit({commandId:action.command?.commandId??randomUUID(),campaignId:cam.id,token,action});
 write({kind:'landscape-put',expectedRevision:null,record:heightRecord(0,0,1,new Float32Array(4096).fill(100))});
 const cityId=write({kind:'city-create',name:'Dorf',x:0,y:0,width:64,height:64}).result.id;
 const db=new (require('better-sqlite3'))(store.filename,{readonly:true}),reader=new AtlasLandscapeReader(db),originalFinish=LandscapeRasterizer.prototype.finish;
 let rasterizations=0,source;
 LandscapeRasterizer.prototype.finish=function(...args){rasterizations++;return originalFinish.apply(this,args);};
 t.after(()=>{LandscapeRasterizer.prototype.finish=originalFinish;db.close();store.close();rmSync(dir,{recursive:true,force:true});});
 const q={box:{x:1,y:1,width:32,height:32},width:64,height:64,scopeId:null,floorId:'ground',slice:null,roofs:true};
 const read=()=>{source=store.atlasRegionSource(token,source);reader.sync(source);return reader.read(source,q,2*1024*1024);};
 const before=read(),count=rasterizations;assert(count>0);
 const house={id:'h',kind:'building',name:'Haus',protected:true,position:{x:20,y:20},angle:0,outline:[{x:-4,y:-4},{x:4,y:-4},{x:4,y:4},{x:-4,y:4}],notes:'',terrain:{mode:'ground',offsetM:2,wallM:4,roofM:3}};
 write({kind:'city',command:{commandId:randomUUID(),campaignId:cam.id,token,cityId,expectedRevision:store.city(token,cityId).header.revision,action:{kind:'change',upsert:[house],remove:[],label:'Haus'}}});
 const after=read();assert.equal(rasterizations,count);assert.deepEqual(after.tiles.map(t=>t.data),before.tiles.map(t=>t.data));
 write({kind:'landscape-put',expectedRevision:1,record:heightRecord(0,0,1,new Float32Array(4096).fill(-100))});
 const changed=read();assert(rasterizations>count);assert.notDeepEqual(changed.tiles.map(t=>t.data),before.tiles.map(t=>t.data));
});

test('world-aligned half-open extents do not allocate extra tiles along exact far edges',t=>{
 const root=homedir()+'/.cache/saltmarcher/tests';mkdirSync(root,{recursive:true});const dir=mkdtempSync(root+'/raster-edge-'),store=new CampaignStore(dir+'/world.sqlite'),cam=store.create('Edges'),token=store.activate(cam.id).token;
 store.executeAtlasCommit({commandId:randomUUID(),campaignId:cam.id,token,action:{kind:'landscape-put',expectedRevision:null,record:heightRecord(0,0,512,new Float32Array(4096).fill(100))}});
 const db=new (require('better-sqlite3'))(store.filename,{readonly:true}),reader=new AtlasLandscapeReader(db),source=store.atlasRegionSource(token);reader.sync(source);
 t.after(()=>{db.close();store.close();rmSync(dir,{recursive:true,force:true});});
 for(const edge of [1024,2**21])for(const origin of [0,-edge]){
  const box={x:origin,y:origin,width:edge,height:edge},q={box,width:16,height:16,scopeId:null,floorId:'ground',slice:null,roofs:true},layer=reader.read(source,q,2*1024*1024);
  assert.equal(layer.state,'ready');assert.equal(layer.tiles.length,1);assert.deepEqual(layer.tiles[0].box,box);
 }
});

test('raster slices keep the world pixel lattice and cover thin, negative and distant intersections',()=>{
 for(const origin of [0,-1024,2**35])for(const width of [1,127,513])for(const height of [1,79,511]){
  const tile={x:origin,y:origin,width:1024,height:1024},view={x:origin+17.25,y:origin+49.75,width,height},s=landscapeRasterSlice(tile,1024,view);
  assert(s.box.x<=view.x&&s.box.y<=view.y);assert(s.box.x+s.box.width>=view.x+width&&s.box.y+s.box.height>=view.y+height);
  assert.equal(s.box.width/s.width,1);assert.equal(s.box.height/s.height,1);assert.equal((s.box.x-origin)%128,0);assert.equal((s.box.y-origin)%128,0);
  assert(s.width<=1024&&s.height<=1024);
 }
 const tile={x:-1024,y:0,width:1024,height:1024};assert.deepEqual(landscapeRasterSlice(tile,16,tile),{box:tile,width:16,height:16});
 assert.throws(()=>landscapeRasterSlice(tile,1024,{x:1,y:1,width:10,height:10}),/Rasterüberdeckung/);
});

test('cropped fallback matches full-tile coast, automatic contours and thin pigment, and reuses nearby pans',t=>{
 const root=homedir()+'/.cache/saltmarcher/tests';mkdirSync(root,{recursive:true});const dir=mkdtempSync(root+'/raster-crop-'),store=new CampaignStore(dir+'/world.sqlite'),cam=store.create('Crop'),token=store.activate(cam.id).token;
 const write=record=>store.executeAtlasCommit({commandId:randomUUID(),campaignId:cam.id,token,action:{kind:'landscape-put',record,expectedRevision:null}}),records=[];
 for(let y=-1;y<3;y++)for(let x=-1;x<3;x++)records.push(heightRecord(x*64,y*64,1,Float32Array.from({length:4096},(_,i)=>Math.sin((x*64+i%64)/15)*10+(y*64+Math.floor(i/64))*.3-5)));
 // One supersample-high base pigment catches square-grid filtering on a rectangular raster.
 records.push({id:'thin-base',revision:0,kind:'patch',name:'',width:0,resolution:1,points:[{x:20,y:20.05}],polygons:[{outer:[{x:20,y:20.05},{x:25,y:20.05},{x:25,y:20.075},{x:20,y:20.075}],holes:[]}],values:{terrain:'forest'}});
 for(const r of records)write(r);
 const db=new (require('better-sqlite3'))(store.filename,{readonly:true}),reader=new AtlasLandscapeReader(db),source=store.atlasRegionSource(token);reader.sync(source);
 t.after(()=>{db.close();store.close();rmSync(dir,{recursive:true,force:true});});
 const q={box:{x:18,y:12,width:96,height:24},width:384,height:96,scopeId:null,floorId:'ground',slice:null,roofs:true,contours:-1},layer=reader.read(source,q,2*1024*1024);
 assert.equal(layer.state,'ready');assert.equal(layer.tiles.length,1);const tile=layer.tiles[0];assert.deepEqual(tile.box,{x:0,y:0,width:128,height:64});assert.equal(tile.width,512);assert.equal(tile.height,256);
 const full=new LandscapeRasterizer({x:0,y:0,width:128,height:128},512,512,-1,.25);for(const row of store.db.prepare('SELECT payload FROM atlas_landscape ORDER BY rowid').all())full.paint(JSON.parse(row.payload));const expected=full.finish(),actual=require('pngjs').PNG.sync.read(Buffer.from(tile.data.split(',')[1],'base64')).data;
 const mismatch=[];for(let i=0;i<actual.length;i++)if(actual[i]!==expected[i]){if(mismatch.length<20)mismatch.push({x:Math.floor(i/4)%512,y:Math.floor(i/4/512),channel:i%4,actual:actual[i],expected:expected[i]});}
 assert.equal(Buffer.compare(actual,expected.subarray(0,actual.length)),0,JSON.stringify(mismatch));
 const finish=LandscapeRasterizer.prototype.finish;let draws=0;LandscapeRasterizer.prototype.finish=function(){draws++;return finish.call(this);};
 try{const moved=reader.read(source,{...q,box:{...q.box,x:19,y:13}},2*1024*1024);assert.equal(draws,0);assert.deepEqual(moved.tiles,layer.tiles);}finally{LandscapeRasterizer.prototype.finish=finish;}
});
