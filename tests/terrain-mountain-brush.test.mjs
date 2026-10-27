import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/terrain-brush';export * from './src/app/terrain-brush-form';export * from './src/app/terrain-brush-draft';export * from './src/app/terrain-height';export * from './src/app/terrain-spatial-model';export * from './src/app/storage/store';",resolveDir:process.cwd()},outfile:'.build/terrain-mountain-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {applyTerrainBrush,mountainBrushField,TerrainBrushDraft,TerrainSampler,CampaignStore,terrainGrid,heightRecord}=require('../.build/terrain-mountain-test.cjs');
const stroke={mode:'raise',form:'mountain',radius:64,strength:80,feather:.6,seed:4711,samples:[{x:-220,y:0,t:0},{x:220,y:0,t:1000}]};
const merge=(rs,tiles)=>[...rs.filter(r=>!tiles.some(t=>t.id===r.id)),...tiles];
const edit=(rs,s)=>merge(rs,applyTerrainBrush(rs,s));
const dense=s=>({...s,samples:s.samples.flatMap((a,i)=>i===s.samples.length-1?[a]:Array.from({length:16},(_,j)=>{const b=s.samples[i+1],t=j/16;return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,t:a.t+(b.t-a.t)*t};}))});
const box={x:-320,y:-128,width:640,height:256};
// Original native 05-wide world points, including its actual input rounding.
// Duplicate holds do not affect brushPath; these are its distinct points.
const originalWide={...stroke,radius:1450,strength:1000.0000000000001,samples:[
 [-2700.000089757985,400.00017951522506],[-2333.3332585356948,133.3333931717419],[-1966.666801303333,-133.33339317174153],[-1599.999970081044,-399.99999252026106],[-1066.666771384005,-200.00008975761253],[-533.3331986970384,0],[0,200.0000897576125],[499.99985040410354,0],[999.9997008082063,-200.00008975761253],[1500.0002991921656,-399.9999925202611],[1866.6667564245265,-133.33339317174153],[2233.333213656889,133.3333931717419],[2599.999670889249,400.000179515225]
].map(([x,y],i)=>({x,y,t:i*100}))};
const seamCases=[
 {name:'original native bend',stroke:originalWide,at:{x:-1552.4562994646549,y:-50},direction:{x:1,y:0}},
 {name:'tight return',stroke:{...stroke,radius:100,strength:100,samples:[{x:0,y:0},{x:1000,y:0},{x:1000,y:100},{x:0,y:100}]},at:{x:105,y:50},direction:{x:0,y:1}},
 {name:'crossing',stroke:{...stroke,radius:100,strength:100,samples:[{x:-200,y:-100},{x:200,y:100},{x:200,y:-100},{x:-200,y:100}]},at:{x:5,y:0},direction:{x:0,y:1}}
];
test('mountain height converges continuously at the original bend, tight returns and crossings',()=>{
 for(const c of seamCases){
  const field=mountainBrushField(c.stroke);let previous=Infinity;
  for(const epsilon of [1,.01,.0001,.000001,.00000001]){
   const a=field.amount({x:c.at.x-epsilon*c.direction.x,y:c.at.y-epsilon*c.direction.y});
   const b=field.amount({x:c.at.x+epsilon*c.direction.x,y:c.at.y+epsilon*c.direction.y});
   const delta=Math.abs(a-b),floor=c.stroke.strength*1e-10;
   assert(delta<=32*c.stroke.strength/c.stroke.radius*2*epsilon+floor,`${c.name}: finite spatial slope at ${epsilon}: ${delta}`);
   assert(delta<=previous*.1+floor,`${c.name}: difference shrinks with point separation`);previous=delta;
  }
  assert(previous<c.stroke.strength*1e-7,`${c.name}: no residual jump`);
 }
});
test('true circular arc sampling converges within the predeclared mountain geometry tolerance',()=>{
 const make=n=>mountainBrushField({...stroke,samples:Array.from({length:n+1},(_,i)=>{const a=-1.2+2.4*i/n;return{x:128*Math.sin(a),y:128*(1-Math.cos(a)),t:i/n*1000};})});
 const fine=make(128);
 for(const [n,limit] of [[16,9.6],[32,4.8],[64,2.4]]){
  const coarse=make(n);let worst=0;
  for(let y=-40;y<=140;y+=2)for(let x=-180;x<=180;x+=2)worst=Math.max(worst,Math.abs(coarse.amount({x,y})-fine.amount({x,y})));
  assert(worst<=limit,`${n}/128 true arc: ${worst} m > ${limit} m`);
 }
});
test('corrected bends, returns and crossings use identical local and canonical heights',()=>{
 const view={box:{x:-64,y:-64,width:128,height:128},frame:{x:-64,y:-64,width:128,height:128},columns:129,rows:129,focusM:0,tilt:0,rotation:0,exaggeration:1};
 for(const c of seamCases){
  const factor=32/c.stroke.radius,s={...c.stroke,radius:32,strength:40,samples:c.stroke.samples.map((p,i)=>({x:p.x*factor,y:p.y*factor,t:i*100}))};
  const grid={view,heights:new Float32Array(129*129).fill(-100),seaLevelM:0,editing:{ground:new Float32Array(129*129).fill(-100),water:new Float32Array(129*129)}};
  const draft=new TerrainBrushDraft(grid);draft.update(s);const sample=new TerrainSampler(edit([],s),false);
  for(let y=0;y<129;y+=2)for(let x=0;x<129;x+=2)assert(Math.abs(draft.ground[y*129+x]-sample.sample({x:x-64,y:y-64}).heightM)<.00005,`${c.name} ${x}/${y}`);
 }
});
test('mountain is one connected swept field across positive and negative tile boundaries, with soft outer slopes and repeatable spurs',()=>{
 const field=mountainBrushField(stroke),rs=edit([],stroke),sample=new TerrainSampler(rs,false);
 for(let x=-220;x<=220;x+=2){assert(field.amount({x,y:0})>15,'unbroken crest');assert(field.amount({x,y:0})>field.amount({x,y:48}),'crest above flanks');assert(Math.abs(sample.sample({x,y:0}).heightM+100-field.amount({x,y:0}))<1e-5);}
 for(const x of [-128,0,128]){const a=sample.sample({x:x-.001,y:8}).heightM,b=sample.sample({x:x+.001,y:8}).heightM;assert(Math.abs(a-b)<.01,'no author tile seam');}
 for(let x=-200;x<=200;x+=20){assert.equal(field.amount({x,y:64}),0);assert(field.amount({x,y:63.9})<.002);}
 assert.deepEqual(rs,edit([],stroke));assert.notDeepEqual(rs,edit([],{...stroke,seed:4712}));
 const heights=Array.from({length:100},(_,i)=>field.amount({x:-200+i*4,y:28}));assert(Math.max(...heights)-Math.min(...heights)>6,'flanks contain subordinate forms');
});
test('straight and bent subdivisions, time, hold duration and update batching do not change the form',()=>{
 for(const s of [stroke,{...stroke,samples:[{x:-200,y:-30,t:0},{x:-60,y:35,t:300},{x:80,y:-20,t:650},{x:200,y:40,t:1000}]}]){
  const a=edit([],s),b=edit([],dense(s));assert.deepEqual(a,b,'collinear subdivisions produce bit-identical authored bands');
  assert.deepEqual(a,edit([],{...s,samples:s.samples.map((p,i)=>({...p,t:i*5000}))}));
 }
 const held={...stroke,samples:[{x:0,y:0,t:0},{x:0,y:0,t:1}]};assert.deepEqual(edit([],held),edit([],{...held,samples:[{x:0,y:0,t:0},{x:0,y:0,t:300000}]}));
});
test('incremental local mountain image uses the writer field, including an overlapping second stroke and existing fine relief',()=>{
 const s={...stroke,radius:32,strength:40,samples:[{x:-50,y:-12,t:0},{x:0,y:12,t:500},{x:50,y:-12,t:1000}]};
 const base=[heightRecord(-32,-32,.5,Float32Array.from({length:4096},(_,i)=>220+3*Math.sin(i%64/2)))];
 const view={box:{x:-64,y:-64,width:128,height:128},frame:{x:-64,y:-64,width:128,height:128},columns:129,rows:129,focusM:0,tilt:0,rotation:0,exaggeration:1};
 let records=base,grid=terrainGrid(records,view);grid.editing={ground:Float32Array.from({length:129*129},(_,i)=>new TerrainSampler(records,false).sample({x:i%129-64,y:Math.floor(i/129)-64}).heightM),water:new Float32Array(grid.heights.length)};const original=grid.heights.slice();
 for(const next of [s,{...s,seed:815,samples:[{x:0,y:-50,t:0},{x:0,y:50,t:1000}]}]){
  const draft=new TerrainBrushDraft(grid),events=dense(next).samples;
  for(let i=2;i<=events.length;i++)draft.update({...next,samples:events.slice(0,i)});
  records=edit(records,next);const sample=new TerrainSampler(records,false);
  for(let y=10;y<118;y+=3)for(let x=10;x<118;x+=3){const expected=sample.sample({x:x-64,y:y-64}).heightM;assert(Math.abs(draft.ground[y*129+x]-expected)<.00005,`${x}/${y}`);}
  assert.equal(draft.update({...next,samples:events}),false);grid={...draft.grid,editing:{...grid.editing,ground:draft.ground}};
 }
 assert.notDeepEqual(grid.heights,original);assert(records.some(r=>r.id===base[0].id&&r.height.data===base[0].height.data),'preserve finer authored band');
});
test('canonical mountain writer agrees with the field, one Undo/Redo per gesture and fresh store reopening',t=>{
 const dir=mkdtempSync('/tmp/tw03-mountain-');let store=new CampaignStore(dir+'/world.sqlite');const cam=store.create('TW03 Berge');let active=store.activate(cam.id);
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 const write=action=>store.executeAtlasCommit({commandId:randomUUID(),campaignId:cam.id,token:active.token,action});
 const read=()=>store.atlasMaskRegion(active.token,box).records;
 write({kind:'landscape-height-stroke',stroke});const first=read();
 assert.deepEqual(first.map(r=>[r.id,r.height]).sort((a,b)=>a[0].localeCompare(b[0])),edit([],stroke).map(r=>[r.id,r.height]).sort((a,b)=>a[0].localeCompare(b[0])));
 const overlap={...stroke,seed:815,samples:[{x:-40,y:-55,t:0},{x:50,y:55,t:700}]};write({kind:'landscape-height-stroke',stroke:overlap});const both=read();
 const sample=new TerrainSampler(both,false),expected=new TerrainSampler(edit(edit([],stroke),overlap),false);
 for(let x=-220;x<=220;x+=8)assert(Math.abs(sample.sample({x,y:0}).heightM-expected.sample({x,y:0}).heightM)<.00005);
 const payloads=rs=>rs.map(r=>[r.id,r.height]).sort((a,b)=>a[0].localeCompare(b[0]));
 const snapshots=[[],first,both];
 for(const mode of ['lower','smooth']){
  const correction={mode,radius:20,strength:15,feather:.8,samples:[{x:-10,y:0,t:0},{x:10,y:0,t:1000}]};
  const prior=read(),predicted=edit(prior,correction);write({kind:'landscape-height-stroke',stroke:correction});const saved=read();
  assert.deepEqual(payloads(saved),payloads(predicted));assert.notDeepEqual(payloads(saved),payloads(prior));
  assert.equal(new TerrainSampler(saved,false).sample({x:180,y:0}).heightM,new TerrainSampler(prior,false).sample({x:180,y:0}).heightM,'correction remains local');snapshots.push(saved);
 }
 for(let i=snapshots.length-2;i>=0;i--){write({kind:'undo'});assert.deepEqual(payloads(read()),payloads(snapshots[i]));}
 for(let i=1;i<snapshots.length;i++){write({kind:'redo'});assert.deepEqual(payloads(read()),payloads(snapshots[i]));}
 store.close();store=new CampaignStore(dir+'/world.sqlite');active=store.activate(cam.id);assert.deepEqual(payloads(read()),payloads(snapshots.at(-1)));
});
test('mountain contract fails closed for unsupported forms, modes, targets and excessive work',()=>{
 for(const extra of [{form:'unknown'},{form:null},{mode:'lower'},{mode:'smooth'},{targetM:100}])assert.throws(()=>applyTerrainBrush([],{...stroke,...extra}),/Höhenpinsel/);
 assert.throws(()=>applyTerrainBrush([],{...stroke,samples:[{x:0,y:0,t:0},{x:1e10,y:0,t:1000}]}),/zu lang/);
});
test('an initial held footprint is fully replaced when motion derives the mountain backbone',()=>{
 const view={box:{x:-64,y:-64,width:128,height:128},frame:{x:-64,y:-64,width:128,height:128},columns:129,rows:129,focusM:0,tilt:0,rotation:0,exaggeration:1};
 const make=()=>({view,heights:new Float32Array(129*129).fill(200),seaLevelM:0,editing:{ground:new Float32Array(129*129).fill(200),water:new Float32Array(129*129)}});
 const held={...stroke,radius:32,strength:40,samples:[{x:0,y:0,t:0},{x:0,y:0,t:300}]},final={...held,samples:[...held.samples,{x:0,y:40,t:1000}]};
 const incremental=new TerrainBrushDraft(make());incremental.update(held);incremental.update(final);const batched=new TerrainBrushDraft(make());batched.update(final);assert.deepEqual(incremental.ground,batched.ground);
 assert.equal(incremental.update({...final,samples:[...final.samples,{x:0,y:40,t:300000}]}),false);
});
