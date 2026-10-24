import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const dir=mkdtempSync(join(tmpdir(),'atlas-physical-field-'));
const outfile=join(dir,'field.cjs');
buildSync({stdin:{contents:`export * from './tools/atlas-prototypes/physical-material-field';
export * from './src/app/terrain-height';
export * from './src/app/terrain-field-stream';
export * from './src/app/terrain-route';
export * from './src/app/terrain-interpolation';
export {readTerrainSettings} from './src/app/storage/terrain-color-raster';
export * from './src/app/atlas-landscape';`,resolveDir:process.cwd()},outfile,bundle:true,platform:'node',format:'cjs'});
const require=createRequire(import.meta.url);
const {createPhysicalMaterialFieldSnapshot,TerrainSampler,heightRecord,settingsRecord,readTerrainSettings,streamTerrainField,routeSpec,bounds,interpolateHeight}=require(outfile);
// All synthetic campaigns explicitly supply settings; they are not stream records.
const snapshot=(stream,query,options={})=>createPhysicalMaterialFieldSnapshot(stream,query,{...options,settings:options.settings??settingsRecord(options.seaLevelM??0).terrainSettings});
process.on('exit',()=>rmSync(dir,{recursive:true,force:true}));
const rectangle=(x,y,w,h)=>[{outer:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],holes:[]}];
const intersects=(a,b)=>a.x<=b.x+b.width&&a.x+a.width>=b.x&&a.y<=b.y+b.height&&a.y+a.height>=b.y;
function source(records,calls=[]){
 return function*(kind,query,samples){
  calls.push({kind,query,samples});
  assert.equal(samples,undefined,'area snapshot must never request sample-centre filtering');
  for(const r of records.filter(r=>kind==='height'?r.height:kind==='route'?r.route:r.surface==='freshwater').sort((a,b)=>b.resolution-a.resolution))if(intersects(bounds(r),query))yield r;
 };
}
function terrain(){
 return [4,1].flatMap(pixel=>[-1,0].flatMap(y=>[-1,0].map(x=>heightRecord(x*64*pixel,y*64*pixel,pixel,Float32Array.from({length:4096},(_,i)=>pixel===1&&i%3===0?NaN:10+(x*64+i%64)*pixel*.25+(y*64+Math.floor(i/64))*pixel*.1)))))
 .concat(heightRecord(0,0,1,Float32Array.from({length:4096},(_,i)=>i%5===0?.7:NaN),2));
}
const box={x:-70.125,y:-60.25,width:140,height:120};
test('bounded physical snapshot matches full canonical field across sparse scales, negative coordinates and seams',()=>{
 const records=terrain(),calls=[],field=snapshot(source(records,calls),box,{seaLevelM:3}),reference=new TerrainSampler([...records,settingsRecord(3)]);
 for(let y=0;y<=60;y++)for(let x=0;x<=70;x++){
  const p={x:box.x+x*2,y:box.y+y*2},z=reference.sample(p).heightM,actual=field.sample(p);
  assert.equal(actual.heightM,z);assert.equal(actual.water,reference.water(p,z));assert.equal(actual.waterLevelM,reference.waterLevel(p,z));
 }
 assert.equal(calls.length,3);assert.deepEqual(calls[0].query,box,'do not enlarge a local query to the whole world');
});
test('Hermite neighbour outside the authored polygon is retained; bilinear replacement changes coast classification',()=>{
 const a=heightRecord(0,0,1,Float32Array.from({length:4096},(_,i)=>i%64===63?10:0));
 const b=heightRecord(64,0,1,new Float32Array(4096).fill(20));
 const q={x:62.1,y:20,width:.8,height:1},field=snapshot(source([a,b]),q,{seaLevelM:4.6});
 const p={x:62.5,y:20.5},z=field.sample(p).heightM;
 assert.equal(z,interpolateHeight(0,0,10,20,.5));
 assert.equal(z,3.75);assert.equal(field.sample(p).water,true);
 assert.ok(5>4.6,'bilinear 0 to 10 would incorrectly classify this point as land');
});
test('water classification uses Float64 height before output quantization',()=>{
 const records=[heightRecord(0,0,1,Float32Array.from({length:4096},(_,i)=>1+(i%64)/1024))],p={x:20+2**-20,y:20};
 const sea=1+20/1024,q={x:20,y:19,width:1,height:2},actual=snapshot(source(records),q,{seaLevelM:sea}).sample(p);
 assert.ok(actual.heightM>sea);assert.equal(Math.fround(actual.heightM),sea);assert.equal(actual.water,false);
});
test('route beds, crossing river levels and lakes with holes agree with canonical streamed water',()=>{
 const route=(kind,z,y)=>{const points=[{x:-60,y},{x:60,y}],r=routeSpec(kind,points);r.nodes=points.map(p=>({...p,z,structure:'ground'}));r.limits={...r.limits,shoulder:12,cut:50,fill:50,depth:4};return{id:kind+z,revision:0,kind,name:'',points,polygons:[],resolution:1,width:8,values:{},route:r,line:{fadeIn:true}};};
 const lake={id:'lake',kind:'patch',revision:0,name:'',points:[],polygons:rectangle(-40,-40,80,80),resolution:1,width:0,values:{terrain:'water'},surface:'freshwater',waterLevelM:25};
 lake.polygons[0].holes=[rectangle(-5,-5,10,10)[0].outer];
 const records=[...terrain(),route('road',20,1),route('river',14,0),route('river',9,2),lake],field=snapshot(source(records),box);
 const lattice={x:-60,y:-50,dx:1,dy:1,columns:121,rows:101};
 const streamed=streamTerrainField(lattice,0,(kind,q)=>source(records)(kind,q));
 for(let y=0;y<101;y++)for(let x=0;x<121;x++){
  const v=field.sample({x:-60+x,y:-50+y}),i=y*121+x;
  assert.equal(Math.fround(v.heightM),streamed.heights[i]);assert.equal(Number(v.water),streamed.water[i]);
 }
});
test('snapshot owns immutable source data and rejects queries outside its captured area',()=>{
 const records=terrain(),q={x:10,y:10,width:20,height:20},field=snapshot(source(records),q),p={x:12,y:13},before=field.sample(p);
 records.forEach(r=>{r.height.data=heightRecord(r.height.x,r.height.y,r.height.pixel,new Float32Array(4096).fill(999),r.height.version).height.data;});
 q.x=999;assert.deepEqual(field.sample(p),before);
 for(const p of [{x:9,y:10},{x:10,y:31},{x:NaN,y:20},{x:Infinity,y:20}])assert.throws(()=>field.sample(p));
});
test('record and byte exhaustion fail explicitly and close the source iterator',()=>{
 const records=terrain();let closed=0;
 function* stream(kind){try{if(kind==='height')yield* records;}finally{closed++;}}
 assert.throws(()=>snapshot(stream,box,{maxRecords:1}),/budget|limit|Budget|Grenze/i);assert.equal(closed,1);
 closed=0;assert.throws(()=>snapshot(stream,box,{maxBytes:1}),/budget|limit|Budget|Grenze/i);assert.equal(closed,1);
});
test('unexpected source kinds fail rather than silently losing physical data and close the cursor',()=>{
 let closed=0;
 function* stream(){try{yield {id:'plain-road',kind:'road'};}finally{closed++;}}
 assert.throws(()=>snapshot(stream,box),/Quellenart|quellenart/);assert.equal(closed,1);
});
test('settings are captured independently without freezing caller objects',()=>{
 const style={version:1,mode:'drawn',land:'#eee5cf',ink:'#685639',lightDegrees:315,strength:.65};
 const settings={version:1,seaLevelM:7,style},field=snapshot(source([]),box,{settings});
 assert.equal(Object.isFrozen(settings),false);settings.seaLevelM=99;
 assert.equal(Object.isFrozen(style),false);style.land='#ffffff';
 assert.equal(field.diagnostics.seaLevelM,7);assert.equal(field.sample({x:0,y:0}).waterLevelM,7);
 assert.equal(field.diagnostics.recordCount,1);assert.equal(field.diagnostics.records.height,0);
 assert.ok(field.diagnostics.chargedBytes<=field.diagnostics.maxBytes);
});
test('campaign settings come from the canonical database reader, never an implicit zero sea level',()=>{
 const Database=require('better-sqlite3'),db=new Database(':memory:');
 try{
  db.exec('CREATE TABLE atlas_landscape (campaign_id TEXT, payload TEXT)');
  const insert=db.prepare('INSERT INTO atlas_landscape VALUES (?, ?)');
  insert.run('first',JSON.stringify(settingsRecord(123)));insert.run('second',JSON.stringify(settingsRecord(-456)));
  for(const [id,level]of [['first',123],['second',-456],['missing',0]]){
   const settings=readTerrainSettings(db,id).terrainSettings;
   const s=createPhysicalMaterialFieldSnapshot(source([]),box,{settings});
   assert.equal(s.diagnostics.seaLevelM,level);assert.equal(s.sample({x:0,y:0}).water,-100<=level);
  }
  assert.throws(()=>createPhysicalMaterialFieldSnapshot(source([]),box),/einstellungen fehlen/);
 }finally{db.close();}
});
