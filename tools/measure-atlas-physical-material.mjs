// Read-only frozen-world probe of the physical source bridge, not an area or UI benchmark.
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {buildSync} from 'esbuild';
const source=resolve('.build/atlas-rebuild-m0-frames/source.sqlite');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const expected='19d4edc88b50d8074578a5c40c870a50331fec1c78a7a8b4f4feee5d463fdb12';
if(hash(readFileSync(source))!==expected)throw Error('Frozen world differs; run the inventory first.');
const out=resolve('.build/atlas-physical-material',`${Date.now()}-${process.pid}`);mkdirSync(out,{recursive:true});
const compiled=buildSync({stdin:{contents:`export * from './tools/atlas-prototypes/physical-material-field';export * from './src/app/terrain-field-stream';export {readTerrainSettings} from './src/app/storage/terrain-color-raster';`,resolveDir:process.cwd()},outfile:out+'/field.cjs',bundle:true,platform:'node',format:'cjs',metafile:true});
const require=createRequire(import.meta.url),Database=require('better-sqlite3');
const {createPhysicalMaterialFieldSnapshot,streamTerrainField,readTerrainSettings}=require(out+'/field.cjs');
const files=[...new Set([...Object.keys(compiled.metafile.inputs).filter(f=>f!=='<stdin>'),'tools/measure-atlas-physical-material.mjs','package-lock.json'])];
const hashes=()=>Object.fromEntries(files.map(f=>[f,hash(readFileSync(f))]));
const before=hashes(),db=new Database(source,{readonly:true,fileMustExist:true});
const campaign=db.prepare('SELECT id FROM campaign ORDER BY id LIMIT 1').get().id;
const settings=readTerrainSettings(db,campaign).terrainSettings;
// The fixture's older stored shape bounds may precede Hermite support. Compute
// the same support as bounds(record), rather than dropping neighbour tiles.
const statements=Object.fromEntries(['height','route','lake'].map(kind=>{
 const height=kind==='height',p="json_extract(payload,'$.height.pixel')";
 const x=height?`json_extract(payload,'$.height.x')-2*${p}`:'min_x',y=height?`json_extract(payload,'$.height.y')-2*${p}`:'min_y';
 const xx=height?`json_extract(payload,'$.height.x')+65*${p}`:'max_x',yy=height?`json_extract(payload,'$.height.y')+65*${p}`:'max_y';
 const predicate=height?"json_extract(payload,'$.height') IS NOT NULL":kind==='route'?"json_extract(payload,'$.route') IS NOT NULL":"json_extract(payload,'$.surface')='freshwater'";
 return [kind,db.prepare(`SELECT payload FROM atlas_landscape WHERE campaign_id=? AND ${predicate} AND ${xx}>=? AND ${x}<=? AND ${yy}>=? AND ${y}<=? ORDER BY json_extract(payload,'$.resolution') DESC,id`)];
}));
function* stream(kind,box){
 for(const row of statements[kind].iterate(campaign,box.x,box.x+box.width,box.y,box.y+box.height))yield JSON.parse(row.payload);
}
const results=[];
try{
 for(const [name,box] of [
  ['origin',{x:-2048,y:-2048,width:4096,height:4096}],
  ['author-tile-seam',{x:1032192,y:-32768,width:65536,height:65536}],
  ['remote',{x:-16000000,y:14000000,width:65536,height:65536}],
  ['coast-at-authored-world-edge',{x:16744448,y:1048576,width:131072,height:65536}],
 ]){
  const start=performance.now(),snapshot=createPhysicalMaterialFieldSnapshot(stream,box,{settings}),captured=performance.now();
  const lattice={x:box.x,y:box.y,dx:box.width/32,dy:box.height/32,columns:33,rows:33};
  const reference=streamTerrainField(lattice,settings.seaLevelM,stream);let maxHeightError=0,waterDifferences=0,wetPoints=0;
  for(let y=0;y<33;y++)for(let x=0;x<33;x++){
   const point={x:lattice.x+x*lattice.dx,y:lattice.y+y*lattice.dy},sample=snapshot.sample(point),i=y*33+x;
   maxHeightError=Math.max(maxHeightError,Math.abs(Math.fround(sample.heightM)-reference.heights[i]));
   waterDifferences+=Number(Number(sample.water)!==reference.water[i]);wetPoints+=Number(sample.water);
  }
  if(maxHeightError!==0||waterDifferences!==0)throw Error('Physical field mismatch: '+name);
  results.push({name,box,points:1089,wetPoints,maxFloat32HeightError:maxHeightError,waterDifferences,captureMs:captured-start,totalWithReferenceMs:performance.now()-start,diagnostics:snapshot.diagnostics});
 }
 const box={x:-20000000,y:-20000000,width:40000000,height:40000000};
 let budgetError;
 try{createPhysicalMaterialFieldSnapshot(stream,box,{settings,maxBytes:1024*1024});}
 catch(e){if(!/budget|limit|Budget|Grenze/i.test(e.message))throw e;budgetError=e;}
 if(!budgetError)throw Error('Whole-world source capture unexpectedly succeeded');
 results.push({name:'whole-world-budget-counterprobe',box,status:'explicit-budget-refusal',message:budgetError.message});
}finally{db.close();}
if(hash(readFileSync(source))!==expected||JSON.stringify(before)!==JSON.stringify(hashes()))throw Error('Sources changed during probe');
const report={scope:'Canonical point field snapshot only. Four frozen-world windows, independent streamed field comparison and explicit whole-world budget refusal. SQL fixture scans are not the production spatial index. No area integration, no native performance claim.',sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),databaseSha256:expected,hashes:before,results};
writeFileSync(out+'/result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,results},null,2));
