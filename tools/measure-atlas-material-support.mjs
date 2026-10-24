import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {integrateMaterialArea,AreaBudgetExceeded} from './atlas-prototypes/material-area.mjs';
import {landscapeMaterialBackground,landscapeMaterialLayers,landscapeMaterialCentroidError,landscapeMaterialTriangleEstimate} from './atlas-prototypes/material-sources.mjs';

const output=resolve('.build/atlas-material-support',`${Date.now()}-${process.pid}`);mkdirSync(output,{recursive:true});
const outfile=output+'/brush.cjs';
const compiled=buildSync({entryPoints:['src/app/landscape-brush.ts'],outfile,bundle:true,platform:'node',format:'cjs',metafile:true});
const {brushFootprint}=createRequire(import.meta.url)(outfile);
const files=[...new Set(['material-area','general-feather','convex-feather','material-sources','material-interval','pigment-stroke','material-smooth','material-mean','circle-triangle','round-stroke-mean'].map(f=>`tools/atlas-prototypes/${f}.mjs`).concat('tools/measure-atlas-material-support.mjs','package-lock.json',Object.keys(compiled.metafile.inputs)))];
const hashes=()=>Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')]));
const before=hashes(),box={x:-2,y:-2,width:4,height:4},background=landscapeMaterialBackground('#ffffff');
const polygons=[{outer:[{x:-2,y:-2},{x:2,y:-2},{x:2,y:2},{x:-2,y:2}],holes:[]}];
const footprints={wide:polygons,authored:brushFootprint([{x:0,y:0}],1)};
const record=(polygons,extra={})=>({polygons,points:[{x:0,y:0}],paint:{version:2,operation:'paint',target:'ground',fill:false,tip:'round',radius:1,flow:.4,opacity:.8,color:'#b02080',seed:19,...extra}});
const results=[];
for(let round=0;round<3;round++)for(const pixels of [16,256])for(const [scenario,footprint] of Object.entries(footprints))for(const mode of (round%2?['optimized','support','reference']:['reference','support','optimized'])){
 const start=performance.now();
 try{
  const layers=landscapeMaterialLayers({palette:{water:'#0000ff'},landColor:'#ffffff',edgePolicy:'authored-world',strokeSupport:mode!=='reference',
   colorRecords:[record(footprint),record(footprint,{tip:'soft',flow:.2,opacity:.5,color:'#229911'}),record(footprint,{tip:'textured',flow:.3,opacity:.6,operation:'erase'})],
   coverRecords:[{polygons,vegetation:{preset:{ground:'#ccbbaa',density:.5,edge:.4}}}]});
  const r=integrateMaterialArea({box,width:pixels,height:pixels,background,layers,centroidErrorBound:landscapeMaterialCentroidError,
   triangleEstimate:mode==='optimized'?landscapeMaterialTriangleEstimate:(active,tri,context)=>landscapeMaterialTriangleEstimate(active,tri,{...context,meanErrorTarget:0})});
  const mean=Array(14).fill(0);r.pixels.forEach((v,i)=>mean[i%14]+=v/(pixels*pixels));
  const meanBound=r.errorBounds.reduce((s,v)=>s+v,0)/(pixels*pixels),maxBound=Math.max(...r.errorBounds);
  if(maxBound>1/255)throw Error('Cell error budget violated');
  results.push({round,pixels,scenario,mode,status:'complete',ms:performance.now()-start,mean,meanBound,maxBound,stats:r.stats});
 }catch(error){
  if(!(error instanceof AreaBudgetExceeded))throw error;
  results.push({round,pixels,scenario,mode,status:'budget-exceeded',ms:performance.now()-start,error:error.message,stats:error.stats});
 }
 console.error(JSON.stringify(results.at(-1)));
}
if(JSON.stringify(before)!==JSON.stringify(hashes()))throw Error('Sources changed during measurement');
const report={scope:'Three sequential alternating reference/support-only/support-plus-sufficient-interval rounds. Mixed round/soft/textured erase plus cover, with wide synthetic footprint and production brushFootprint; unchanged 1/255 error and work/memory limits. Prototype, not native/full-world performance.',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hashes:before,results};
writeFileSync(output+'/result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output},null,2));
