import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/terrain-brush';export * from './src/app/terrain-height';export * from './src/app/atlas-brush-worker';export * from './src/app/landscape-raster';export * from './src/app/storage/store';export * from './src/app/storage/atlas-landscape-region';export {validateRegion} from './src/app/atlas-region-contracts';",resolveDir:process.cwd()},outfile:'.build/terrain-brush-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {heightBrushResolution,applyTerrainBrush,TerrainSampler,heightRecord,LandscapeRasterizer,renderBrushPreview,CampaignStore,AtlasLandscapeReader,validateRegion}=require('../.build/terrain-brush-test.cjs');
const brush=(mode,extra={})=>({mode,radius:64,strength:300,feather:1,...(mode==='level'?{targetM:220}:{}),samples:[{x:0,y:0,t:0},{x:0,y:0,t:1000}],...extra});
const merge=(rs,tiles)=>[...rs.filter(r=>!tiles.some(t=>t.id===r.id)),...tiles];
const edit=(rs,s)=>merge(rs,applyTerrainBrush(rs,s));
const height=(rs,x=0,y=0)=>new TerrainSampler(rs).sample({x,y}).heightM;
const plane=(fn)=>{const rs=[];for(let y=-1;y<=0;y++)for(let x=-1;x<=0;x++)rs.push(heightRecord(x*64,y*64,1,Float32Array.from({length:4096},(_,i)=>fn(x*64+i%64,y*64+Math.floor(i/64)))));return rs;};
function pixels(rs,box,w,h,contours=0){const r=new LandscapeRasterizer(box,w,h,contours);rs.forEach(x=>r.paint(x));return r.finish();}
test('metres per second, soft rim, exact target and resampled gestures',()=>{
 const rs=edit([],brush('raise'));assert.equal(height(rs),200);assert.equal(height(rs,32),50);assert.equal(height(rs,64),-100);
 const flat=edit([],brush('level',{feather:0,strength:1000}));assert.equal(height(flat),220);assert.equal(height(flat,40),220);
 assert.equal(height(edit(flat,brush('lower',{radius:32,strength:400}))),-180);
 const a=brush('raise',{samples:[{x:-80,y:0,t:0},{x:80,y:0,t:1000}]}),b={...a,samples:Array.from({length:31},(_,i)=>({x:-80+i*160/30,y:0,t:i*1000/30}))};
 const one=edit([],a),many=edit([],b);for(let x=-80;x<=80;x+=8)assert(Math.abs(height(one,x)-height(many,x))<.1);
});
test('smoothing preserves a plane, reduces spikes and is independent of record order',()=>{
 const p=plane((x,y)=>200+x+2*y),s=brush('smooth',{radius:32});
 assert(Math.abs(height(edit(p,s))-200)<1e-5);
 const spike=plane((x,y)=>200+(x===0&&y===0?90:0)),a=edit(spike,s),b=edit([...spike].reverse(),s);
 assert(height(a)<290&&height(a)>=200);assert.equal(height(a),height(b));assert.equal(height(a,50),200);
});
test('coarse additive brushes move fine detail and smooth only their selected scale',()=>{
 const fine=edit([],brush('level',{radius:16,feather:0,strength:1000}));
 assert.equal(height(edit(fine,brush('raise',{radius:128}))),520);
 assert.equal(height(edit(fine,brush('lower',{radius:128}))),-80);
 assert.equal(height(edit(fine,brush('smooth',{radius:128}))),220);
 const capped=edit(fine,brush('level',{radius:128,targetM:900,strength:10000}));
 assert.equal(height(capped),1220); // target 900 plus the preserved fine contribution 320
 assert.deepEqual(capped.filter(r=>fine.some(f=>f.id===r.id)),fine);
});
test('gesture transaction, failed write, single undo/redo, restart and preview agree',t=>{
 const dir=mkdtempSync('/tmp/r2-brush-');let store=new CampaignStore(dir+'/world.sqlite');const cam=store.create('R2');let active=store.activate(cam.id);
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 const write=action=>store.executeAtlasCommit({commandId:randomUUID(),campaignId:cam.id,token:active.token,action});
 const box={x:-100,y:-100,width:200,height:200},records=()=>store.atlasMaskRegion(active.token,box).records;
 const s=brush('raise'),preview=renderBrushPreview({generation:1,records:[],box,width:100,height:100,heightStroke:s,contours:50});
 write({kind:'landscape-height-stroke',stroke:s});let saved=records();
 assert.deepEqual(pixels(saved,box,100,100,50),preview);assert.equal(store.atlasHeight(active.token,{x:0,y:0}).heightM,200);
 write({kind:'undo'});assert.equal(records().length,0);write({kind:'redo'});assert.deepEqual(records().map(r=>r.height),saved.map(r=>r.height));saved=records();
 // Force failure at the canonical writer, after the gesture has already produced its draft.
 store.db.exec("CREATE TEMP TRIGGER fail_height BEFORE UPDATE ON atlas_landscape BEGIN SELECT RAISE(ABORT,'R2 write failure'); END");
 assert.throws(()=>write({kind:'landscape-height-stroke',stroke:s}),/R2 write failure/);assert.deepEqual(records(),saved);
 store.db.exec('DROP TRIGGER fail_height');write({kind:'landscape-height-stroke',stroke:s});assert.equal(height(records()),500);
 const expected=records();store.close();store=new CampaignStore(dir+'/world.sqlite');active=store.activate(cam.id);assert.deepEqual(records(),expected);
});
test('shade and optional contours remain seamless across raster tiles and do not author data',()=>{
 const rs=plane((x,y)=>100+x*2+y*.5),before=JSON.stringify(rs),box={x:-32,y:-16,width:64,height:32};
 for(const interval of [10,-1]){
 const whole=pixels(rs,box,64,32,interval),left=pixels(rs,{...box,width:32},32,32,interval),right=pixels(rs,{...box,x:0,width:32},32,32,interval);
 for(let y=0;y<32;y++){assert.deepEqual(whole.slice(y*64*4,(y*64+32)*4),left.slice(y*32*4,(y+1)*32*4));assert.deepEqual(whole.slice((y*64+32)*4,(y+1)*64*4),right.slice(y*32*4,(y+1)*32*4));}
 assert.notDeepEqual(whole,pixels(rs,box,64,32));assert.equal(JSON.stringify(rs),before);}
 const north=pixels(plane((x,y)=>200+x+y),box,64,32),south=pixels(plane((x,y)=>200-x-y),box,64,32);assert(north[0]>south[0]);
});
test('invalid controls and excessive work fail before any height is produced',()=>{
 for(const extra of [{strength:NaN},{strength:-1},{feather:2},{roughness:-1},{roughness:3},{roughness:NaN},{seed:-1},{seed:1.5},{seed:4294967296},{targetM:Infinity},{mode:'unknown'},{radius:0},{alien:true}])assert.throws(()=>applyTerrainBrush([],brush('raise',extra)));
 assert.throws(()=>applyTerrainBrush([],brush('raise',{samples:[{x:0,y:0,t:0},{x:1e10,y:0,t:1000}]})),/zu lang/);
});

test('region reader caches contour modes separately; display reads preserve the source fence',t=>{
 const dir=mkdtempSync('/tmp/r2-relief-reader-'),store=new CampaignStore(dir+'/world.sqlite');
 const cam=store.create('Relief'),active=store.activate(cam.id),s=brush('raise');
 store.executeAtlasCommit({commandId:randomUUID(),campaignId:cam.id,token:active.token,action:{kind:'landscape-height-stroke',stroke:s}});
 const Database=require('better-sqlite3'),db=new Database(dir+'/world.sqlite',{readonly:true}),reader=new AtlasLandscapeReader(db);
 t.after(()=>{db.close();store.close();rmSync(dir,{recursive:true,force:true});});
 const source=store.atlasRegionSource(active.token),query={box:{x:1,y:1,width:60,height:60},width:128,height:128,scopeId:null,floorId:'ground',slice:null,roofs:true};
 reader.sync(source);const plain=reader.read(source,query,2*1024*1024),lines=reader.read(source,{...query,contours:50},2*1024*1024);
 assert.equal(plain.state,'ready');assert.equal(lines.state,'ready');assert.notDeepEqual(plain.tiles.map(t=>t.data),lines.tiles.map(t=>t.data));
 assert.deepEqual(reader.read(source,query,2*1024*1024),plain);assert.equal(store.atlasRegionSource(active.token).fence,source.fence);
 validateRegion({...query,contours:-1});
 for(const contours of [-2,-.5,NaN,Infinity,1e7])assert.throws(()=>validateRegion({...query,contours}));
});

test('optional directional target never overshoots or reverses existing terrain',()=>{
 const p=plane((x)=>x<0?500:-200);
 for(const roughness of [0,2]){
  const up=edit(p,brush('raise',{radius:32,strength:100000,targetM:100,roughness,seed:123}));
  assert.equal(height(up,8),100);assert.equal(height(up,-8),500);
  const down=edit(p,brush('lower',{radius:32,strength:100000,targetM:100,roughness,seed:123}));
  assert.equal(height(down,-8),100);assert.equal(height(down,8),-200);
 }
 const capped=edit([],brush('raise',{targetM:0,strength:100000}));assert.equal(height(capped),0);
 assert.equal(new TerrainSampler(capped).query({x:0,y:0}).water,true);
 assert(height(edit([],brush('raise',{strength:100000})))>0);
 assert.throws(()=>edit([],brush('level',{targetM:undefined})),/Höhenpinsel/);
});
test('roughness is seeded, directional, time based and independent of sample density',()=>{
 const s=brush('raise',{roughness:2,seed:987}),a=edit([],s);
 assert.deepEqual(a,edit([],s));assert.notEqual(height(a),height(edit([],{...s,seed:321})));
 assert(height(a)>-100&&height(a)<height(edit([],{...s,roughness:0})));
 assert(height(edit([],brush('lower',{roughness:2,seed:987})))<-100);
 const doubled=edit([], {...s,samples:[{x:0,y:0,t:0},{x:0,y:0,t:2000}]});
 assert(Math.abs((height(doubled)+100)-2*(height(a)+100))<.001);
 const sparse={...s,samples:[{x:-80,y:0,t:0},{x:80,y:0,t:1000}]},dense={...sparse,samples:Array.from({length:31},(_,i)=>({x:-80+i*160/30,y:0,t:i*1000/30}))};
 const one=edit([],sparse),many=edit([],dense);for(let x=-80;x<=80;x+=8)assert(Math.abs(height(one,x)-height(many,x))<.1);
 const box={x:-100,y:-100,width:200,height:200};
 assert.deepEqual(renderBrushPreview({generation:1,records:[],box,width:100,height:100,heightStroke:{...s,targetM:50}}),pixels(edit([],{...s,targetM:50}),box,100,100));
 const p=plane((x,y)=>200+x+y);assert.deepEqual(edit(p,brush('smooth')),edit(p,brush('smooth',{roughness:2,seed:123,targetM:999})));
});

test('screen-sized brushes below one metre produce bounded, persistent fine geometry',()=>{
 for(const radius of [.5,.01,.0005]){
  const s=brush('raise',{radius,feather:0}),records=edit([],s);
  assert.equal(height(records),200);assert.equal(height(records,radius*2),-100);
  assert(records.length<=16);assert.deepEqual(height(JSON.parse(JSON.stringify(records))),200);
 }
});


test('the displayed brush resolution is the resolution actually authored at every supported scale',()=>{
 for(const radius of [.0001,.5,16,32,120,700]){
  const records=applyTerrainBrush([],brush('raise',{radius})),resolution=heightBrushResolution(radius);
  assert(records.length>0);assert(records.every(r=>r.height.pixel===resolution));
  assert.equal(new TerrainSampler(records).sample({x:0,y:0}).resolutionM,resolution);
 }
});

test('stationary holds combine dose without exhausting the moving-stroke work budget',()=>{
 const held=brush('raise',{strength:1,samples:[{x:0,y:0,t:0},{x:0,y:0,t:300000}]}),dense={...held,samples:Array.from({length:2001},(_,i)=>({x:0,y:0,t:i*150}))};
 const a=edit([],held),b=edit([],dense),short=edit([],brush('raise'));
 for(const x of [0,4,16,32,48,64]){assert.equal(height(a,x),height(short,x));assert.equal(height(b,x),height(short,x));}
});
