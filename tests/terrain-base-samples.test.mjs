import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/storage/store';export * from './src/app/storage/atlas-landscape-region';export * from './src/app/storage/terrain-color-raster';export * from './src/app/atlas-landscape';export * from './src/app/landscape-raster';export * from './src/app/terrain-height';export * from './src/app/land-mask';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['better-sqlite3'],outfile:'.build/terrain-base-samples-test.cjs'});
const {CampaignStore,AtlasLandscapeReader,renderTerrainColor,LandscapeRasterizer,bounds,heightRecord,settingsRecord,encodeMask}=require('../.build/terrain-base-samples-test.cjs');
const rect=(x,y,w,h=w)=>({outer:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],holes:[]});
const patch=(id,polygon,extra={})=>({id,revision:0,kind:'patch',name:'',points:[],polygons:[polygon],resolution:1,width:0,values:{terrain:'forest'},...extra});
function fixture(t,records){
 const root=homedir()+'/.cache/saltmarcher/tests';mkdirSync(root,{recursive:true});const dir=mkdtempSync(root+'/base-samples-'),store=new CampaignStore(dir+'/world.sqlite'),campaign=store.create('Sampled colour'),source=store.atlasRegionSource(store.activate(campaign.id).token);
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 const insert=store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
 store.db.transaction(()=>{for(const r of records){const b=bounds(r);insert.run(campaign.id,r.id,1,b.x,b.x+b.width,b.y,b.y+b.height,JSON.stringify(r));}})();
 const reader=new AtlasLandscapeReader(store.db);reader.sync(source);
 return reader.terrainStream(source);
}
function draw(read,box,width,height,filtered,batchEdge=Math.max(width,height)){
 let payloads=0;
 function* stream(kind,area,samples){for(const r of read(kind,area,kind==='base'&&!filtered?undefined:samples)){if(kind==='base')payloads++;yield r;}}
 const steps=renderTerrainColor(box,width,height,box.width/width,{settings:settingsRecord(0),stream,batchEdge,contours:0,revision:0,denseRoutes:false,retainedRoutes:new Set(),checkpoint:function*(){}});
 for(;;){const step=steps.next();if(step.done)return {pixels:step.value,payloads};}
}
test('world colour skips subpixel base payloads with byte-identical pixels',t=>{
 const records=[heightRecord(0,0,512,new Float32Array(4096).fill(100))];
 for(let y=0;y<100;y++)for(let x=0;x<100;x++)records.push(patch(`base:${x}:${y}`,rect(x*20+.125,y*20+.375,1),{values:{terrain:(x+y)%2?'forest':'desert'}}));
 const read=fixture(t,records),box={x:0,y:0,width:2000,height:2000};
 const expected=draw(read,box,64,64,false),actual=draw(read,box,64,64,true);
 assert.deepEqual(actual.pixels,expected.pixels);
 assert.equal(expected.payloads,10000);assert(actual.payloads<200,`decoded ${actual.payloads} base payloads`);
 const empty=draw(kind=>kind==='height'?[records[0]]:[],box,64,64,true);
 assert.notDeepEqual(actual.pixels,empty.pixels,'retained tiny terrain patches still affect the image');
 t.diagnostic(JSON.stringify({unfiltered:expected.payloads,filtered:actual.payloads}));
});
test('base sample filtering preserves halos, holes, layer order and masks at fractional and large origins',t=>{
 for(const origin of [0,2**35,-(2**35)]){
  const box={x:origin-33.125,y:origin-17.375,width:117.25,height:73.75},width=37,height=23;
  const lattice=new LandscapeRasterizer(box,width,height).sampleLattice(),records=[];
  for(const y of [-1,0])for(const x of [-1,0])records.push(heightRecord(origin+x*4096,origin+y*4096,64,new Float32Array(4096).fill(100)));
  const hole=rect(origin-45,origin-25,110,80);hole.holes=[rect(origin-10,origin-5,35,25).outer];
  records.push(patch('coarse',hole,{resolution:64,values:{terrain:'desert'}}));
  for(let i=0;i<300;i++){
   const x=lattice.x+(i%30)*lattice.dx*2,y=lattice.y+Math.floor(i/30)*lattice.dy*4;
   records.push(patch(`edge:${i}`,rect(x+(i%3===0?0:-.00001),y,.015,.02),{order:i%7,values:{terrain:i%2?'snow':'forest'}}));
  }
  records.push(patch('overlap',rect(origin-20,origin-10,30),{order:10,values:{terrain:'marsh'}}));
  records.push(patch('mask',rect(origin-256,origin-256,256),{mask:{version:1,x:origin-256,y:origin-256,pixel:1,data:encodeMask(new Uint16Array(65536).fill(65535))}}));
  const read=fixture(t,records);
  for(const edge of [64,16])assert.deepEqual(draw(read,box,width,height,true,edge).pixels,draw(read,box,width,height,false,edge).pixels,`origin ${origin}, batch ${edge}`);
 }
});
