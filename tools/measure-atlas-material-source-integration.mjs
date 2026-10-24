import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {integrateMaterialArea,AreaBudgetExceeded} from './atlas-prototypes/material-area.mjs';
import {landscapeMaterialBackground,landscapeMaterialLayers,landscapeMaterialCentroidError,landscapeMaterialTriangleEstimate} from './atlas-prototypes/material-sources.mjs';
const output=resolve('.build/atlas-material-source-integration',`${Date.now()}-${process.pid}`);mkdirSync(output,{recursive:true});
const box={x:-2,y:-2,width:4,height:4};
const polygons=[{outer:[{x:-2,y:-2},{x:2,y:-2},{x:2,y:2},{x:-2,y:2}],holes:[]}];
const results=[];
for(let round=0;round<3;round++)for(const pixels of [1,16,256])for(const tip of ['round','soft','textured'])for(const integrated of (round%2?[true,false]:[false,true])){
 const record={polygons,points:[{x:0,y:0}],paint:{version:2,operation:'paint',target:'ground',fill:false,tip,radius:1,flow:1,opacity:1,color:'#000000',seed:19}};
 const start=performance.now();
 try{
  const result=integrateMaterialArea({box,width:pixels,height:pixels,background:landscapeMaterialBackground('#ffffff'),
   layers:landscapeMaterialLayers({colorRecords:[record],palette:{water:'#0000ff'},landColor:'#ffffff'}).map(layer=>integrated?layer:{...layer,integrationCut:undefined}),centroidErrorBound:landscapeMaterialCentroidError,triangleEstimate:integrated?landscapeMaterialTriangleEstimate:undefined,landscapeMaterialTriangleEstimate});
  const alpha=result.pixels.reduce((s,v,i)=>s+(i%14===8?v:0),0)/(pixels*pixels);
  const meanBound=result.errorBounds.reduce((s,v)=>s+v,0)/(pixels*pixels),maxBound=Math.max(...result.errorBounds);
  if(maxBound>1/255)throw Error('Cell error budget violated');
  if(tip==='round'&&Math.abs(alpha-Math.PI/16)>meanBound+1e-12)throw Error('Circle area bound violated');
  results.push({round,pixels,tip,integrated,status:'complete',ms:performance.now()-start,alpha,meanBound,maxBound,stats:result.stats});
 }catch(error){
  if(!(error instanceof AreaBudgetExceeded))throw error;
  results.push({round,pixels,tip,integrated,status:'budget-exceeded',ms:performance.now()-start,error:error.message,stats:error.stats});
 }
 console.error(JSON.stringify(results.at(-1)));
}
const files=['tools/atlas-prototypes/material-area.mjs','tools/atlas-prototypes/general-feather.mjs','tools/atlas-prototypes/convex-feather.mjs','tools/atlas-prototypes/material-sources.mjs','tools/atlas-prototypes/material-interval.mjs','tools/atlas-prototypes/pigment-stroke.mjs','tools/atlas-prototypes/material-smooth.mjs','tools/measure-atlas-material-source-integration.mjs'];
const report={scope:'Three sequential alternating source-integration on/off rounds, one radius-1 m stamp in 4x4 m, default 1/255 error and unchanged existing work/pending/adaptive-depth budgets; source cuts additionally have a separate path limit64. Synthetic source completeness/cost probe, not native/full-world performance.',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hashes:Object.fromEntries(files.map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')])),results};
writeFileSync(output+'/result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output},null,2));
