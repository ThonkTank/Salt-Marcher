import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {integrateMaterialArea,AreaBudgetExceeded} from './atlas-prototypes/material-area.mjs';
import {landscapeMaterialBackground,landscapeMaterialLayers,landscapeMaterialCentroidError,landscapeMaterialTriangleEstimate} from './atlas-prototypes/material-sources.mjs';
const files=['material-area','general-feather','convex-feather','material-sources','material-interval','pigment-stroke','material-smooth','material-mean','circle-triangle','round-stroke-mean'].map(f=>`tools/atlas-prototypes/${f}.mjs`).concat('tools/measure-atlas-material-round-mean.mjs');
const hashes=()=>Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')]));
const before=hashes(),output=resolve('.build/atlas-material-round-mean',`${Date.now()}-${process.pid}`);mkdirSync(output,{recursive:true});
const box={x:-2,y:-2,width:4,height:4};
const polygons=[{outer:[{x:-2,y:-2},{x:2,y:-2},{x:2,y:2},{x:-2,y:2}],holes:[]}];
const record=(extra={})=>({polygons,points:[{x:0,y:0}],paint:{version:2,operation:'paint',target:'ground',fill:false,tip:'round',radius:1,flow:1,opacity:1,color:'#000000',seed:19,...extra}});
const scenarios={
 single:{colorRecords:[record()]},
 overlap:{colorRecords:[record({flow:.4,opacity:.8,strokes:[[{x:-.25,y:0}],[{x:.25,y:0}]]})]},
 mixed:{colorRecords:[record({flow:.4,opacity:.8,color:'#b02080'}),record({tip:'soft',flow:.2,opacity:.5,color:'#229911'}),record({tip:'textured',flow:.3,opacity:.6,operation:'erase'})],coverRecords:[{polygons,vegetation:{preset:{ground:'#ccbbaa',density:.5,edge:.4}}}],edgePolicy:'authored-world'},
};
const results=[];
for(let round=0;round<3;round++)for(const pixels of [1,16,256])for(const [scenario,options] of Object.entries(scenarios))for(const integrated of (round%2?[true,false]:[false,true])){
 const start=performance.now();
 try{
  const layers=landscapeMaterialLayers({...options,palette:{water:'#0000ff'},landColor:'#ffffff'}).map(l=>integrated?l:{...l,analyticMean:false});
  const r=integrateMaterialArea({box,width:pixels,height:pixels,background:landscapeMaterialBackground('#ffffff'),layers,centroidErrorBound:landscapeMaterialCentroidError,triangleEstimate:landscapeMaterialTriangleEstimate});
  const alpha=r.pixels.reduce((s,v,i)=>s+(i%14===8?v:0),0)/(pixels*pixels);
  const meanBound=r.errorBounds.reduce((s,v)=>s+v,0)/(pixels*pixels),maxBound=Math.max(...r.errorBounds);
  if(maxBound>1/255)throw Error('Cell error budget violated');
  if(scenario==='single'&&Math.abs(alpha-Math.PI/16)>meanBound+1e-12)throw Error('Circle area bound violated');
  results.push({round,pixels,scenario,integrated,status:'complete',ms:performance.now()-start,alpha,meanBound,maxBound,stats:r.stats});
 }catch(error){
  if(!(error instanceof AreaBudgetExceeded))throw error;
  results.push({round,pixels,scenario,integrated,status:'budget-exceeded',ms:performance.now()-start,error:error.message,stats:error.stats});
 }
 console.error(JSON.stringify(results.at(-1)));
}
if(JSON.stringify(before)!==JSON.stringify(hashes()))throw Error('Sources changed during measurement');
const report={scope:'Three sequential alternating analytic round mean on/off rounds; prior smooth estimates and texture cuts remain enabled on both sides. Unit stamps in 4x4 m, default 1/255 tolerance and unchanged budgets. Synthetic source/mixed-material cost probe, not native/full-world performance.',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hashes:before,results};
writeFileSync(output+'/result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output},null,2));
