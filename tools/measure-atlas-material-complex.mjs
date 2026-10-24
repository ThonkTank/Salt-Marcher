import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {integrateMaterialArea,AreaBudgetExceeded} from './atlas-prototypes/material-area.mjs';
import {landscapeMaterialBackground,landscapeMaterialLayers,landscapeMaterialLipschitz} from './atlas-prototypes/material-sources.mjs';

const output=resolve('.build/atlas-material-complex',`${Date.now()}-${process.pid}`);
mkdirSync(output,{recursive:true});
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const cover={polygons:[{outer:rect(0,0,6,6),holes:[rect(2,2,2,2)]}],vegetation:{preset:{edge:.5,density:.4,ground:'#000000'},edits:[]}};
const sources={coverRecords:[cover],palette:{water:'#0000ff'},landColor:'#ffffff',edgePolicy:'authored-world'};
const expectedForest=.5*(32-16*.5+(4-Math.PI)*.5**2/3)/36,results=[];
for(const tolerance of [.08,.02,1/255]){
 const start=performance.now();
 try{
  const result=integrateMaterialArea({box:{x:0,y:0,width:6,height:6},width:1,height:1,
   background:landscapeMaterialBackground(sources.landColor),layers:landscapeMaterialLayers(sources),
   lipschitz:landscapeMaterialLipschitz([cover]),tolerance});
  results.push({tolerance,status:'complete',ms:performance.now()-start,forest:result.pixels[4],expectedForest,
   absoluteError:Math.abs(result.pixels[4]-expectedForest),reportedBound:result.errorBounds[0],stats:result.stats});
 }catch(error){
  if(!(error instanceof AreaBudgetExceeded))throw error;
  results.push({tolerance,status:'budget-exceeded',ms:performance.now()-start,error:error.message});
 }
}
const files=['tools/atlas-prototypes/material-area.mjs','tools/atlas-prototypes/convex-feather.mjs','tools/atlas-prototypes/general-feather.mjs','tools/atlas-prototypes/material-sources.mjs','tools/measure-atlas-material-complex.mjs'];
const report={scope:'Single-run isolated 6x6 m ring in one output cell, not a tile or native Atlas timing. Default resource limits; no silent quality fallback on budget exhaustion.',
 source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 hashes:Object.fromEntries(files.map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')])),results};
writeFileSync(output+'/result.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,report},null,2));
