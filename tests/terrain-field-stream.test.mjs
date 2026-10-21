import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/terrain-field-stream';export * from './src/app/terrain-height';export * from './src/app/terrain-route';export * from './src/app/landscape-raster';export * from './src/app/landscape-brush';export * from './src/app/atlas-landscape';export * from './src/app/storage/atlas-landscape-region';export * from './src/app/storage/store';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['better-sqlite3'],outfile:'.build/terrain-field-stream-test.cjs'});
const {streamTerrainField,streamTerrainFieldSteps,streamTerrainFieldBlock,TerrainSampler,heightRecord,settingsRecord,routeSpec,LandscapeRasterizer,orderedColors,bounds,AtlasLandscapeReader,CampaignStore}=require('../.build/terrain-field-stream-test.cjs');
const rectangle=(x,y,w,h)=>[{outer:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],holes:[]}];
const stream=records=>(kind)=>records.filter(r=>kind==='height'?r.height:kind==='route'?r.route:r.surface==='freshwater').sort((a,b)=>b.resolution-a.resolution);
const ground=()=>[4,1].flatMap(pixel=>[-1,0].flatMap(y=>[-1,0].map(x=>heightRecord(x*64*pixel,y*64*pixel,pixel,Float32Array.from({length:4096},(_,i)=>pixel===1&&i%3===0?NaN:10+(x*64+i%64)*pixel*.25+(y*64+Math.floor(i/64))*pixel*.1)))));
const check=(records,lattice,sea=0)=>{
 const field=streamTerrainField(lattice,sea,stream(records)),sampler=new TerrainSampler([...records,settingsRecord(sea)]);
 for(let row=0;row<lattice.rows;row++)for(let col=0;col<lattice.columns;col++){
  const i=row*lattice.columns+col,p={x:lattice.x+col*lattice.dx,y:lattice.y+row*lattice.dy},z=sampler.sample(p).heightM;
  assert.equal(field.heights[i],Math.fround(z),'height '+JSON.stringify(p));assert.equal(field.water[i],sampler.water(p,z)?1:0,'water '+JSON.stringify(p));assert.equal(field.surface[i],Math.fround(Math.max(z,sampler.waterLevel(p,z)??sea)), 'surface '+JSON.stringify(p));
 }
 return field;
};
test('streamed heights match canonical sparse inheritance, negative coordinates, exact nodes and tile seams',()=>{
 const records=ground();for(const offset of [0,.125,-.5])check(records,{x:-90+offset,y:-80+offset,dx:.5,dy:.5,columns:361,rows:321},3);
 assert.throws(()=>streamTerrainField({x:0,y:0,dx:1,dy:1,columns:1,rows:1},0,()=>[records.at(-1),records[0]]),/grob nach fein/);
});
test('sea, lake holes, crossing roads and rivers retain effective ground and canonical water precedence',()=>{
 const road=(kind,z,y)=>{const points=[{x:-100,y},{x:100,y}],route=routeSpec(kind,points);route.nodes=points.map(p=>({...p,z,structure:'ground'}));route.limits={...route.limits,shoulder:12,cut:50,fill:50,depth:4};return{id:kind+z,revision:0,kind,name:'',points,polygons:[],resolution:1,width:8,values:{},route,line:{fadeIn:true}};};
 const lake={id:'lake',kind:'patch',revision:0,name:'',points:[],polygons:rectangle(-40,-40,80,80),resolution:1,width:0,values:{terrain:'water'},surface:'freshwater',waterLevelM:25};lake.polygons[0].holes=rectangle(-5,-5,10,10)[0].outer.length?[rectangle(-5,-5,10,10)[0].outer]:[];
 const records=[...ground(),road('road',20,1),road('river',14,0),road('river',9,2),lake];check(records,{x:-80,y:-60,dx:1,dy:1,columns:161,rows:121});
 records[5].height.data=heightRecord(-64,-64,1,new Float32Array(4096).fill(NaN)).height.data;check(records,{x:-20,y:-12,dx:.25,dy:.25,columns:161,rows:97});
});
test('scanline bands keep the same lattice at their boundary and can omit unused water geometry',()=>{
 const records=ground(),lattice={x:-70.125,y:-60.25,dx:.5,dy:.5,columns:513,rows:257},field=check(records,lattice);
 const compact=streamTerrainField(lattice,0,stream(records),false);assert.deepEqual(compact.heights,field.heights);assert.deepEqual(compact.water,field.water);assert.equal(compact.surface,undefined);
});
test('two-dimensional blocks preserve canonical sample arithmetic at fractional origins and seams',()=>{
 const records=ground();
 for(const [x,y,dx,dy]of [[-70.125,-60.25,.5,.5],[-64.1,-63.7,.7,.3],[-.1,-.2,1/3,2/7]]){
  const lattice={x,y,dx,dy,columns:193,rows:137},expected=check(records,lattice,3),actual={heights:new Float32Array(193*137),water:new Uint8Array(193*137),surface:new Float32Array(193*137)};
  for(let row=0;row<137;row+=32)for(let col=0;col<193;col+=32){
   const rect={x:col,y:row,width:Math.min(32,193-col),height:Math.min(32,137-row)},block=streamTerrainFieldBlock(lattice,rect,3,stream(records));
   for(const key of Object.keys(actual))for(let r=0;r<rect.height;r++)actual[key].set(block[key].subarray(r*rect.width,(r+1)*rect.width),(row+r)*193+col);
  }
  assert.deepEqual(actual,expected);
 }
});
test('streamed field produces identical relief, contours and painted coast pixels',()=>{
 const records=ground(),box={x:-70,y:-70,width:140,height:140},a=new LandscapeRasterizer(box,192,160,20),b=new LandscapeRasterizer(box,192,160,20);
 for(const r of records)a.paint(r);b.setTerrainField(streamTerrainField(b.sampleLattice(),0,stream(records),false));assert.deepEqual(b.finish(),a.finish());
});
test('database raster streams colors in their canonical order, including erase across resolutions',t=>{
 const root=homedir()+'/.cache/saltmarcher/tests';mkdirSync(root,{recursive:true});const dir=mkdtempSync(root+'/field-stream-'),store=new CampaignStore(dir+'/world.sqlite'),campaign=store.create('Stream'),token=store.activate(campaign.id).token;
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 const records=ground();
 for(let y=2;y<10;y++)for(let x=2;x<10;x++)records.push(heightRecord(x*64,y*64,1,new Float32Array(4096).fill(20+x+y)));
 for(let i=0;i<4;i++)records.push({id:'color'+i,revision:1,kind:'patch',name:'',width:0,resolution:[1,4,2,8][i],points:[{x:0,y:0}],polygons:rectangle(-40+i*10,-40,60,60),values:{},order:[3,1,4,2][i],paint:{version:2,operation:i===0?'erase':'paint',target:'ground',color:i%2?'#ff0000':'#00ff00',opacity:.8,flow:1,tip:'round',radius:32,seed:1,fill:true}});
 const insert=store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');store.db.transaction(()=>{for(const r of records){const b=bounds(r);insert.run(campaign.id,r.id,1,b.x,b.x+b.width,b.y,b.y+b.height,JSON.stringify(r));}})();
 const db=new (require('better-sqlite3'))(store.filename,{readonly:true});t.after(()=>db.close());const reader=new AtlasLandscapeReader(db),source=store.atlasRegionSource(token);reader.sync(source);
 const layer=reader.read(source,{box:{x:-60,y:-60,width:700,height:700},width:128,height:128,scopeId:null,floorId:'ground',slice:null,roofs:true},2*1024*1024);assert.equal(layer.state,'ready');
 for(const tile of layer.tiles){const expected=new LandscapeRasterizer(tile.box,tile.width,tile.height,0,700/128);for(const r of records.sort((a,b)=>b.resolution-a.resolution||(a.order??0)-(b.order??0)))expected.paint(r);for(const r of orderedColors(records))expected.paintColor(r);const actual=require('pngjs').PNG.sync.read(Buffer.from(tile.data.split(',')[1],'base64'));assert.deepEqual(new Uint8Array(actual.data),expected.finish());}
});

test('additive bands compose after the full legacy field at shared addresses, holes and negative seams',()=>{
 const base=ground(),bands=[8,4,1].flatMap(pixel=>[-1,0].flatMap(y=>[-1,0].map(x=>heightRecord(x*64*pixel,y*64*pixel,pixel,Float32Array.from({length:4096},(_,i)=>i%7===0?NaN:Math.sin(i)*17),2))));
 check([...base,...bands],{x:-90.125,y:-80.375,dx:.5,dy:.5,columns:361,rows:321},3);
});

test('level coordinate reuse preserves fractional samples beyond 32-bit cell indices',()=>{
 for(const origin of [2**35,-(2**35)]){
  const records=[8,.25].flatMap(pixel=>[1,2].flatMap(version=>[-1,0].flatMap(y=>[-1,0].map(x=>heightRecord(origin+x*64*pixel,origin+y*64*pixel,pixel,Float32Array.from({length:4096},(_,i)=>i%11===0?NaN:(version===2?3:40)+Math.sin(i)*17),version)))));
  check(records,{x:origin-5.125,y:origin-4.375,dx:.125,dy:.375,columns:97,rows:37},3);
 }
});

test('yielded height bands preserve pixels and close all record iterators before yielding or cancellation',()=>{
 const records=ground(),lattice={x:-64.1,y:-63.7,dx:.7,dy:.3,columns:193,rows:137},expected=streamTerrainField(lattice,3,stream(records));let active=0,yields=0;
 function* read(kind){active++;try{yield* stream(records)(kind);}finally{active--;}}
 const steps=streamTerrainFieldSteps(lattice,3,read,true,function*(){yield;});
 for(;;){const step=steps.next();assert.equal(active,0,'SQLite-style iterators must not cross a snapshot checkpoint');if(step.done){assert.deepEqual(step.value,expected);break;}yields++;}
 assert(yields>1);
 const cancelled=streamTerrainFieldSteps(lattice,3,read,false,function*(){yield;});assert.equal(cancelled.next().done,false);cancelled.return();assert.equal(active,0);
});

test('compact source lattices preserve repeated cells, disjoint cells and duplicate-tile rejection',()=>{
 const records=ground();
 check(records,{x:-.125,y:-.25,dx:1/128,dy:1/64,columns:193,rows:65},3);
 check(records,{x:-80.125,y:-60.25,dx:19.25,dy:13.5,columns:21,rows:17},3);
 const tile=heightRecord(0,0,1,new Float32Array(4096).fill(10));
 assert.throws(()=>streamTerrainField({x:10.25,y:10.5,dx:.1,dy:.2,columns:17,rows:13},0,kind=>kind==='height'?[tile,tile]:[]),/Doppelte Höhenkachel/);
});
