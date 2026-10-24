import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {integrateMaterialArea,AreaBudgetExceeded} from './atlas-prototypes/material-area.mjs';
import {landscapeMaterialBackground,landscapeMaterialLayers,landscapeMaterialLipschitz} from './atlas-prototypes/material-sources.mjs';

const output=resolve('.build/atlas-material-local',`${Date.now()}-${process.pid}`);mkdirSync(output,{recursive:true});
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const cover={polygons:[{outer:rect(0,0,6,6),holes:[rect(2,2,2,2)]}],vegetation:{preset:{edge:.5,density:.4,ground:'#000000'},edits:[]}};
const sources={coverRecords:[cover],palette:{water:'#0000ff'},landColor:'#ffffff',edgePolicy:'authored-world'};
const expectedForest=.5*(32-16*.5+(4-Math.PI)*.5**2/3)/36,results=[];
const methods=[['uniform',false],['uniform',true],['cell-error',false],['cell-error',true]];
function run(round,pixels,adaptiveStrategy,certificates){
 const start=performance.now();
 try{
  const layers=landscapeMaterialLayers(sources).map(layer=>certificates?layer:{...layer,polynomialDegreeOnTriangle:undefined});
  const result=integrateMaterialArea({box:{x:0,y:0,width:6,height:6},width:pixels,height:pixels,
   background:landscapeMaterialBackground(sources.landColor),layers,lipschitz:landscapeMaterialLipschitz([cover]),tolerance:1/255,adaptiveStrategy});
  const forest=result.pixels.reduce((n,v,i)=>n+(i%14===4?v:0),0)/(pixels*pixels);
  results.push({round,pixels,adaptiveStrategy,certificates,status:'complete',ms:performance.now()-start,forest,expectedForest,
   absoluteError:Math.abs(forest-expectedForest),meanReportedBound:result.errorBounds.reduce((s,v)=>s+v,0)/(pixels*pixels),
   maxReportedBound:Math.max(...result.errorBounds),stats:result.stats});
 }catch(error){
  if(!(error instanceof AreaBudgetExceeded))throw error;
  results.push({round,pixels,adaptiveStrategy,certificates,status:'budget-exceeded',ms:performance.now()-start,error:error.message});
 }
}
for(let round=0;round<3;round++)for(const [strategy,certificates] of round%2?[...methods].reverse():methods)run(round,1,strategy,certificates);
// Synthetic tile-scale costs, still no field/source-page or native product load.
for(const pixels of [16,256])run(0,pixels,'cell-error',true);
const files=['tools/atlas-prototypes/material-area.mjs','tools/atlas-prototypes/general-feather.mjs','tools/atlas-prototypes/convex-feather.mjs','tools/atlas-prototypes/material-sources.mjs','tools/measure-atlas-material-local.mjs'];
const report={scope:'Same 6x6 m holed authored cover, 1/255 cell error, unchanged default work limits. Three alternating one-cell rounds; single synthetic 16x16/256x256 probes. Not native/product latency.',
 source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 hashes:Object.fromEntries(files.map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')])),results};
writeFileSync(output+'/result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,report},null,2));
