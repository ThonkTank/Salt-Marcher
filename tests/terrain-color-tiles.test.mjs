import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
buildSync({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/terrain-color';export * from './src/app/terrain-detail-material';export {MeshBasicMaterial,DataTexture} from 'three';export * from './src/app/terrain-detail-tiles';export * from './src/app/storage/terrain-color';export * from './src/app/storage/terrain-projection';export * from './src/app/terrain-projection-cache';export * from './src/app/terrain-height';export {vegetationSpec} from './src/app/vegetation';export {emptyRecord} from './src/app/atlas-landscape';"},outfile:'.build/terrain-color-tiles-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {vegetationSpec,emptyRecord,TerrainDetailMaterial,MeshBasicMaterial,DataTexture,validateTerrainColor,terrainDetailTiles,TerrainDetailTiles,readTerrainColorSteps,readTerrainProjection,TerrainProjectionCache,heightRecord}=createRequire(import.meta.url)('../.build/terrain-color-tiles-test.cjs');
const drain=g=>{for(;;){const r=g.next();if(r.done)return r.value;}};
const identity={revision:1,fence:'one'},query={...identity,routeContext:{x:-1024,y:-1024,width:2048,height:2048},contours:0};
const colour=q=>({...q,pixels:new Uint8Array(q.width*q.height*4).fill(255)});
test('colour preserves bounded cubic terrain, narrow coast ink and density-aware contours in all three styles',()=>{
 const golden=JSON.parse(readFileSync(new URL('./fixtures/terrain-coast-goldens.json',import.meta.url),'utf8'));
 const {settingsRecord}=createRequire(import.meta.url)('../.build/terrain-color-tiles-test.cjs'),records=[];
 for(let y=-1;y<=0;y++)for(let x=-1;x<=0;x++)records.push(heightRecord(x*1024,y*1024,16,Float32Array.from({length:4096},(_,i)=>80*Math.sin((x*1024+i%64*16)/150)+30*Math.cos((y*1024+Math.floor(i/64)*16)/75))));
 for(const {mode,contours,mpp,sha256}of golden.cases){
  const settings=settingsRecord(0);settings.terrainSettings.style={version:1,mode,land:'#eee5cf',ink:'#685639',strength:.65,lightDegrees:315};
  const db={prepare(){return{get(){return{payload:JSON.stringify(settings)};}};}},box={x:-144.25,y:-128.5,width:256*mpp,height:256*mpp};
  const value=drain(readTerrainColorSteps(db,{campaignId:'fixture',...identity},{...query,box,routeContext:box,width:256,height:256,displayMpp:mpp,contours},kind=>kind==='height'?records:[],new TerrainProjectionCache()));
  assert.equal(createHash('sha256').update(value.pixels).digest('hex'),sha256,`${mode}, ${contours}, ${mpp}; reference ${golden.source}`);
 }
});
test('world tiles are bounded and aligned across portrait, negative origins and scale changes',()=>{
 for(const scale of [.001,1,1e6])for(const ratio of [.1,1,10]){
  const area={x:-337*scale,y:19*scale,width:1000*scale,height:1000*scale*ratio},plan=terrainDetailTiles(area);
  assert(plan.tiles.length<=81);assert(plan.mpp<=Math.max(area.width,area.height)/1024);assert(plan.box.x<=area.x&&plan.box.y<=area.y);assert(plan.box.x+plan.box.width>=area.x+area.width);assert(plan.box.y+plan.box.height>=area.y+area.height);
  for(const tile of plan.tiles){validateTerrainColor({...query,box:tile.box,width:256,height:256,displayMpp:plan.mpp});assert.equal(tile.box.width/256,plan.mpp);}
  const distances=plan.tiles.map(t=>Math.hypot(t.box.x+t.box.width/2-area.x-area.width/2,t.box.y+t.box.height/2-area.y-area.height/2));assert.deepEqual(distances,[...distances].sort((a,b)=>a-b));
 }
 assert.throws(()=>validateTerrainColor({...query,box:query.routeContext,width:257,height:256,displayMpp:1}),/Geländefarbe/);
 assert.throws(()=>validateTerrainColor({...query,box:query.routeContext,width:256,height:256,displayMpp:1,heightStroke:{}}),/Geländefarbe/);
});
test('independently rendered neighbouring tiles equal the complete projection including their shared edge',()=>{
 const records=[heightRecord(0,0,16,Float32Array.from({length:4096},(_,i)=>40+20*Math.sin(i%64/7)*Math.cos(Math.floor(i/64)/9)))],cover={...emptyRecord('vegetation'),id:'forest',vegetation:vegetationSpec(),values:{terrain:'forest'},polygons:[{outer:[{x:80,y:90},{x:530,y:75},{x:550,y:300},{x:100,y:290}],holes:[[{x:280,y:150},{x:370,y:160},{x:350,y:220},{x:270,y:230}]]}]},stream=kind=>kind==='height'?records:kind==='cover'?[cover]:[];
 const db={prepare(){return {get(){}};}},source={campaignId:'test',...identity},box={x:64,y:64,width:512,height:256},view={box,frame:box,columns:33,rows:33,focusM:0,tilt:45,rotation:0,exaggeration:1};
 for(const contours of [0,10]){
  const expected=readTerrainProjection(db,source,{view,width:512,height:256,contours,displayMpp:1,revision:1},stream,new TerrainProjectionCache()),assembled=new Uint8Array(expected.pixels.length),forest=new Uint8Array(expected.forest.length);
  for(let x=0;x<2;x++){
   const q={...query,box:{...box,x:box.x+x*256,width:256},routeContext:box,width:256,height:256,displayMpp:1,contours},value=drain(readTerrainColorSteps(db,source,q,stream,new TerrainProjectionCache()));
   for(let y=0;y<256;y++)forest.set(value.forest.subarray(y*256,(y+1)*256),y*512+x*256);
   assert.equal(value.grid,undefined);assert.equal(value.objects,undefined);
   for(let y=0;y<256;y++)assembled.set(value.pixels.subarray(y*256*4,(y+1)*256*4),(y*512+x*256)*4);
  }
  assert.deepEqual(assembled,expected.pixels);assert.deepEqual(forest,expected.forest);assert(forest.some(v=>v>0));assert(forest.some(v=>v===0));
 }
 assert.throws(()=>drain(readTerrainColorSteps(db,{...source,revision:2},{...query,box,width:256,height:256,displayMpp:1},stream,new TerrainProjectionCache())),/inzwischen geändert/);
});
test('progress is incremental, pans reuse world tiles, and revisions invalidate renderer colour',async()=>{
 const loader=new TerrainDetailTiles(),area={x:0,y:0,width:256,height:256};let reads=0,last;const uploads=[];
 const read=async q=>{reads++;return colour(q);};
 await loader.load('one',area,query,read,()=>true,(detail,rect,done,total)=>{last=detail;uploads.push({rect,done,total,available:detail.coverage.values.filter(v=>v===255).length});});
 assert.equal(uploads[0].done,1);assert.equal(uploads[0].available,1);assert.equal(uploads[0].rect,undefined);assert(uploads.slice(1).every(u=>u.rect?.width===256));assert.equal(uploads.at(-1).done,uploads.at(-1).total);assert.equal(uploads.at(-1).available,uploads.at(-1).total);
 const original=reads;await loader.load('one',area,query,read,()=>true,()=>{});assert.equal(reads,original);
 await loader.load('one',{...area,x:16},query,read,()=>true,()=>{},last);assert(reads-original>0&&reads-original<original,'pan loads only its newly exposed column');
 const before=reads;await loader.load('two',area,{...query,revision:2,fence:'two'},read,()=>true,()=>{});assert.equal(reads-before,original,'new revision cannot reuse old pigment');
});
test('revoked tile replies neither paint nor populate the next frame cache',async()=>{
 const loader=new TerrainDetailTiles(),area={x:0,y:0,width:256,height:256};let release,valid=true,paints=0,reads=0;
 const loading=loader.load('one',area,query,q=>new Promise(r=>release=()=>r(colour(q))),()=>valid,()=>paints++);
 valid=false;release();assert.equal(await loading,false);assert.equal(paints,0);
 valid=true;await loader.load('one',area,query,async q=>{reads++;return colour(q);},()=>valid,()=>paints++);
 assert.equal(reads,terrainDetailTiles(area).tiles.length);
});


test('coverage feathering ends at full quality and cannot leak into live/full textures',()=>{
 const material=new MeshBasicMaterial({map:new DataTexture(new Uint8Array(16),2,2)}),owner=new TerrainDetailMaterial(),box={x:0,y:0,width:2,height:2};
 const coverage={columns:2,rows:2,values:new Uint8Array([255,0,0,0])},detail={box,width:2,height:2,pixels:new Uint8Array(16).fill(255),coverage},data={grid:{view:{box}},detail};
 owner.update(material,data);const uniforms=material.userData.terrainDetail;assert.equal(uniforms.coverageEnabled.value,true);assert.equal(uniforms.coverageMap.value.image.data,coverage.values);
 const mask=uniforms.coverageMap.value;let disposed=0;mask.addEventListener('dispose',()=>disposed++);
 coverage.values.fill(255);owner.update(material,data);assert.equal(uniforms.coverageEnabled.value,false,'completed colour uses its exact unfeathered pixels');
 const {coverage:unused,...complete}=detail;owner.update(material,{...data,detail:complete});assert.equal(uniforms.coverageEnabled.value,false);assert.equal(disposed,1,'live/full frame releases the progressive mask');owner.dispose();material.map.dispose();material.dispose();
});


test('material retains base masks on detail-only progress and updates one-component rectangles',()=>{
 const material=new MeshBasicMaterial({map:new DataTexture(new Uint8Array(4*4*4),4,4)}),owner=new TerrainDetailMaterial(),box={x:0,y:0,width:4,height:4};
 const data={grid:{view:{box}},width:4,height:4,forest:new Uint8Array(16).fill(255),detail:{box,width:4,height:4,pixels:new Uint8Array(64).fill(255),forest:new Uint8Array(16).fill(127)}};
 owner.update(material,data);const base=owner.forestUniforms.forestMap.value,detail=owner.forestUniforms.detailForestMap.value;let disposed=0;detail.addEventListener('dispose',()=>disposed++);
 data.detail.forest[6]=0;owner.update(material,{grid:data.grid,detail:data.detail},[{x:2,y:1,width:1,height:1}]);
 assert.equal(owner.forestUniforms.forestMap.value,base);assert.deepEqual(detail.updateRanges,[{start:6,count:1}]);assert.equal(detail.image.data[6],0);
 owner.update(material,{grid:data.grid,width:4,height:4});assert.equal(disposed,1);assert.equal(owner.forestUniforms.forestMap.value.image.data.length,1);assert.equal(owner.forestUniforms.forestMap.value.image.data[0],0);
 owner.dispose();material.map.dispose();material.dispose();
});
