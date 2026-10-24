// Sequential source-area prototype comparisons; never a native product benchmark.
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const output=resolve('.build/atlas-physical-area',`${Date.now()}-${process.pid}`);mkdirSync(output,{recursive:true});
const build=buildSync({stdin:{contents:`export * from './tools/atlas-prototypes/physical-material-field';export * from './tools/atlas-prototypes/material-area.mjs';export * from './tools/atlas-prototypes/physical-material-layers.mjs';export * from './src/app/terrain-height';`,resolveDir:process.cwd()},outfile:output+'/api.cjs',bundle:true,platform:'node',format:'cjs',metafile:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),require=createRequire(import.meta.url);
const files=[...Object.keys(build.metafile.inputs).filter(f=>f!=='<stdin>'),'tools/measure-atlas-physical-area.mjs','package-lock.json'];
const hashes=()=>Object.fromEntries(files.map(f=>[f,sha(readFileSync(f))])),before=hashes();
const optimized=require(output+'/api.cjs'),referencePath=process.argv[2]?resolve(process.argv[2]):undefined;
const reference=referencePath?require(referencePath):undefined;
const polygons=b=>[{outer:[{x:b.x,y:b.y},{x:b.x+b.width,y:b.y},{x:b.x+b.width,y:b.y+b.height},{x:b.x,y:b.y+b.height}],holes:[]}];
function run(api,scenario,width){
 const box=scenario==='island'?{x:0,y:20,width:64,height:1}:{x:31,y:scenario==='saddle'?31:20,width:2,height:2};
 const records=[api.heightRecord(0,0,1,Float32Array.from({length:4096},(_,i)=>scenario==='island'?(i%64===32?1:-1):scenario==='flat'?10:scenario==='saddle'?(i%64-32)*(Math.floor(i/64)-32):i%64-32))];
 const start=performance.now();
 const field=api.createPhysicalMaterialFieldSnapshot(kind=>kind==='height'?records:[],box,{settings:api.settingsRecord(0).terrainSettings});
 const materials=scenario==='mixed'?{coverRecords:[{polygons:polygons(box),vegetation:{preset:{ground:'#228822',density:.4,edge:0}}}],colorRecords:[
  {polygons:polygons(box),points:[],paint:{version:2,fill:true,target:'water',operation:'paint',color:'#ff0000',opacity:.5}},
  {polygons:polygons(box),points:[],paint:{version:2,fill:true,target:'ground',operation:'paint',color:'#000000',opacity:.5}},
 ]}:{};
 const layers=api.physicalMaterialLayers({field,box,palette:{water:'#0000ff'},landColor:'#ffffff',...materials});
 try{
  const result=api.integrateMaterialArea({box,width,height:width,background:api.physicalMaterialBackground('#ffffff'),layers,tolerance:scenario==='island'?1/1024:1/255,centroidErrorBound:api.physicalMaterialCentroidError,triangleEstimate:api.physicalMaterialTriangleEstimate});
  const mean=Array(15).fill(0);result.pixels.forEach((value,i)=>mean[i%15]+=value/(width*width));
  const error=result.errorBounds.reduce((a,b)=>a+b,0)/(width*width),expectedWater=scenario==='island'?63/64:scenario==='flat'?0:.5;
  if(Math.abs(mean[14]-expectedWater)>error+1e-10)throw Error('Analytic water area mismatch');
  return {status:'complete',ms:performance.now()-start,mean,error,maxError:Math.max(...result.errorBounds),stats:result.stats};
 }catch(e){if(!(e instanceof api.AreaBudgetExceeded))throw e;return {status:'budget-exceeded',ms:performance.now()-start,message:e.message,stats:e.stats};}
}
const results=[];
for(let round=0;round<3;round++)for(const [scenario,width]of [['coast',1],['island',1],['saddle',1],['mixed',16],['flat',256],['coast',256]]){
 const modes=reference?(round%2?['optimized','reference']:['reference','optimized']):['optimized'];
 for(const mode of modes){const result={round,scenario,width,mode,...run(mode==='reference'?reference:optimized,scenario,width)};results.push(result);console.error(JSON.stringify(result));}
}
if(JSON.stringify(before)!==JSON.stringify(hashes()))throw Error('Source changed during measurement');
const report={scope:'Three sequential alternating synthetic comparisons including saddle and full coast tiles, with analytic water areas and unchanged work/error budgets. No native or complete-world qualification.',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hashes:before,reference:referencePath?{path:referencePath,sha256:sha(readFileSync(referencePath))}:null,results};
writeFileSync(output+'/result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output}));
