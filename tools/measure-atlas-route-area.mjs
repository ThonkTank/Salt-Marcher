// Sequential physical-route prototype comparison, not a native benchmark.
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const output=resolve('.build/atlas-route-area',`${Date.now()}-${process.pid}`);mkdirSync(output,{recursive:true});
const build=buildSync({stdin:{contents:`export * from './tools/atlas-prototypes/physical-material-field';export * from './tools/atlas-prototypes/material-area.mjs';export * from './tools/atlas-prototypes/physical-material-layers.mjs';export * from './src/app/terrain-height';export * from './src/app/terrain-route';`,resolveDir:process.cwd()},outfile:output+'/api.cjs',bundle:true,platform:'node',format:'cjs',metafile:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),require=createRequire(import.meta.url);
const files=[...Object.keys(build.metafile.inputs).filter(f=>f!=='<stdin>'),'tools/measure-atlas-route-area.mjs','package-lock.json'];
const hashes=()=>Object.fromEntries(files.map(f=>[f,sha(readFileSync(f))])),before=hashes();
const optimized=require(output+'/api.cjs'),referencePath=process.argv[2]?resolve(process.argv[2]):undefined,reference=referencePath?require(referencePath):undefined;
function run(api,scenario,width){
 const box={x:20,y:8,width:8,height:8},isRoad=scenario==='road-cut',base=isRoad?10:30;
 const route=(id,kind,points)=>{const route=api.routeSpec(kind,points);route.nodes=points.map(p=>({...p,z:kind==='road'?-10:20,structure:'ground'}));if(kind==='road'){route.limits.cut=20;route.limits.shoulder=1;}return {id,kind,points,polygons:[],width:2,route};};
 const records=[api.heightRecord(0,0,1,new Float32Array(4096).fill(base)),route('east',isRoad?'road':'river',[{x:0,y:12},{x:64,y:12}])];
 if(scenario==='crossing')records.push(route('north','river',[{x:24,y:0},{x:24,y:64}]));
 const start=performance.now();
 const field=api.createPhysicalMaterialFieldSnapshot(kind=>records.filter(r=>kind==='height'?r.height:kind==='route'?r.route:false),box,{settings:api.settingsRecord(0).terrainSettings});
 const layers=api.physicalMaterialLayers({field,box,landColor:'#ffffff',palette:{water:'#0000ff'}});
 try{
  const result=api.integrateMaterialArea({box,width,height:width,background:api.physicalMaterialBackground('#ffffff'),layers,tolerance:1/255,centroidErrorBound:api.physicalMaterialCentroidError,triangleEstimate:api.physicalMaterialTriangleEstimate});
  const mean=Array(15).fill(0);result.pixels.forEach((value,i)=>mean[i%15]+=value/(width*width));
  const error=result.errorBounds.reduce((a,b)=>a+b,0)/(width*width),maxError=Math.max(...result.errorBounds),expected=scenario==='crossing'?7/16:isRoad?3/8:1/4;
  if(!mean.every(Number.isFinite)||!Number.isFinite(error)||maxError>1/255||Math.abs(mean[14]-expected)>error+1e-10)throw Error('Analytic water area/error mismatch');
  return {status:'complete',ms:performance.now()-start,mean,error,maxError,expected,stats:result.stats};
 }catch(e){if(!(e instanceof api.AreaBudgetExceeded))throw e;return {status:'budget-exceeded',ms:performance.now()-start,message:e.message,stats:e.stats};}
}
const results=[];
for(let round=0;round<3;round++)for(const [scenario,width]of [['river',1],['crossing',1],['road-cut',1],['river',256]]){
 const modes=reference?(round%2?['optimized','reference']:['reference','optimized']):['optimized'];
 for(const mode of modes){const result={round,scenario,width,mode,...run(mode==='reference'?reference:optimized,scenario,width)};results.push(result);console.error(JSON.stringify(result));}
}
if(JSON.stringify(before)!==JSON.stringify(hashes()))throw Error('Source changed during measurement');
const report={scope:'Three sequential alternating synthetic physical-route comparisons with analytic water areas and unchanged work/error budgets. No native/world qualification.',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hashes:before,reference:referencePath?{path:referencePath,sha256:sha(readFileSync(referencePath))}:null,results};
writeFileSync(output+'/result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output}));
