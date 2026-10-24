import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {integrateMaterialArea,AreaBudgetExceeded} from './atlas-prototypes/material-area.mjs';
import {landscapeMaterialBackground,landscapeMaterialLayers,landscapeMaterialLipschitz,landscapeMaterialCentroidError} from './atlas-prototypes/material-sources.mjs';

const output=resolve('.build/atlas-material-curvature',`${Date.now()}-${process.pid}`);mkdirSync(output,{recursive:true});
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const cover={polygons:[{outer:rect(0,0,6,6),holes:[rect(2,2,2,2)]}],vegetation:{preset:{edge:.5,density:.4,ground:'#000000'},edits:[]}};
const sources={coverRecords:[cover],palette:{water:'#0000ff'},landColor:'#ffffff',edgePolicy:'authored-world'};
const expectedForest=.5*(32-16*.5+(4-Math.PI)*.5**2/3)/36;
const expectedGround=1-.78*(32-16*.5+.3*(4-Math.PI)*.5**2)/36,results=[];
for(let round=0;round<3;round++)for(const pixels of [1,16,256])for(const curvature of round%2?[true,false]:[false,true]){
 const start=performance.now();
 try{
  const r=integrateMaterialArea({box:{x:0,y:0,width:6,height:6},width:pixels,height:pixels,
   background:landscapeMaterialBackground(sources.landColor),layers:landscapeMaterialLayers(sources),
   lipschitz:landscapeMaterialLipschitz([cover]),tolerance:1/255,
   centroidErrorBound:curvature?landscapeMaterialCentroidError:undefined});
  const means=[4,9].map(channel=>r.pixels.reduce((s,v,i)=>s+(i%14===channel?v:0),0)/(pixels*pixels));
  const meanBound=r.errorBounds.reduce((s,v)=>s+v,0)/(pixels*pixels),maxBound=Math.max(...r.errorBounds);
  if(maxBound>1/255||Math.abs(means[0]-expectedForest)>meanBound+1e-12||Math.abs(means[1]-expectedGround)>meanBound+1e-12)throw Error('Analytic material bound violated');
  results.push({round,pixels,curvature,status:'complete',ms:performance.now()-start,forest:means[0],expectedForest,ground:means[1],expectedGround,meanBound,maxBound,stats:r.stats});
 }catch(error){
  if(!(error instanceof AreaBudgetExceeded))throw error;
  results.push({round,pixels,curvature,status:'budget-exceeded',ms:performance.now()-start,error:error.message});
 }
}
const files=['tools/atlas-prototypes/material-area.mjs','tools/atlas-prototypes/general-feather.mjs','tools/atlas-prototypes/convex-feather.mjs','tools/atlas-prototypes/material-sources.mjs','tools/measure-atlas-material-curvature.mjs'];
const report={scope:'Three alternating curvature on/off rounds for the same 6x6 m holed field at 1/255 cell error, unchanged default work and pending-triangle limits. Synthetic geometry; not native or full-world latency.',
 source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hashes:Object.fromEntries(files.map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')])),results};
writeFileSync(output+'/result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,report},null,2));
