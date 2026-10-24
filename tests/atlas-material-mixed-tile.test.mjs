import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {integrateMaterialArea} from '../tools/atlas-prototypes/material-area.mjs';
import {pigmentStrokeSource} from '../tools/atlas-prototypes/pigment-stroke.mjs';
import {landscapeMaterialBackground,landscapeMaterialLayers,landscapeMaterialCentroidError,landscapeMaterialTriangleEstimate} from '../tools/atlas-prototypes/material-sources.mjs';

const box={x:-2,y:-2,width:4,height:4};
const polygons=[{outer:[{x:-2,y:-2},{x:2,y:-2},{x:2,y:2},{x:-2,y:2}],holes:[]}];
const background=landscapeMaterialBackground('#ffffff');
const record=(footprint,extra={})=>({polygons:footprint,points:[{x:0,y:0}],paint:{version:2,tip:'round',radius:1,flow:.4,opacity:.8,seed:19,target:'ground',operation:'paint',color:'#b02080',...extra}});
function layersFor(footprint,strokeSupport=true){
 return landscapeMaterialLayers({landColor:'#ffffff',palette:{water:'#0000ff'},strokeSupport,edgePolicy:'authored-world',
  colorRecords:[record(footprint),record(footprint,{tip:'soft',flow:.2,opacity:.5,color:'#229911'}),record(footprint,{tip:'textured',flow:.3,opacity:.6,operation:'erase'})],
  coverRecords:[{polygons,vegetation:{preset:{ground:'#ccbbaa',density:.5,edge:.4}}}]});
}
function render(layers,width,shortcut=true){
 return integrateMaterialArea({box,width,height:width,background,layers,centroidErrorBound:landscapeMaterialCentroidError,
  triangleEstimate:shortcut?landscapeMaterialTriangleEstimate:(active,tri,context)=>landscapeMaterialTriangleEstimate(active,tri,{...context,meanErrorTarget:0})});
}
test('full broad-footprint mixed tile now completes under unchanged work and accuracy limits',()=>{
 const result=render(layersFor(polygons),256);
 assert.equal(result.errorBounds.length,65536);
 assert.ok(result.pixels.every(Number.isFinite));
 assert.ok(Math.max(...result.errorBounds)<=1/255);
 assert.ok(result.stats.work<2000000&&result.stats.peakPendingTriangles<65536);
 const small=render(layersFor(polygons),16),reference=render(layersFor(polygons,false),16,false);
 for(let i=0;i<small.pixels.length;i++)assert.ok(Math.abs(small.pixels[i]-reference.pixels[i])<=small.errorBounds[Math.floor(i/14)]+reference.errorBounds[Math.floor(i/14)]+1e-10);
});
test('real brushFootprint mixed tile retains all channels against a dense source oracle',()=>{
 const dir=mkdtempSync(join(tmpdir(),'atlas-mixed-tile-'));
 try{
  const outfile=join(dir,'source.cjs');
  buildSync({stdin:{contents:"export {brushFootprint} from './src/app/landscape-brush'; export {contains} from './src/app/atlas-landscape';",resolveDir:process.cwd()},outfile,bundle:true,platform:'node',format:'cjs'});
  const {brushFootprint,contains}=createRequire(import.meta.url)(outfile);
  const footprint=brushFootprint([{x:0,y:0}],1),layers=layersFor(footprint);
  const r=render(layers,256);
  assert.ok(r.stats.work<2000000);assert.ok(Math.max(...r.errorBounds)<=1/255);
  const records=[record(footprint),record(footprint,{tip:'soft',flow:.2,opacity:.5,color:'#229911'}),record(footprint,{tip:'textured',flow:.3,opacity:.6,operation:'erase'})];
  const sources=records.map(pigmentStrokeSource),colors=[[176/255,32/255,128/255],[34/255,153/255,17/255],[0,0,0]];
  const sample=n=>{
   const sum=Array(14).fill(0);
   for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const p={x:-2+(x+.5)*4/n,y:-2+(y+.5)*4/n},v=[...background];
    const t=Math.min(1,(2-Math.max(Math.abs(p.x),Math.abs(p.y)))/.4),a=.78*t*t*(3-2*t);
    for(let c=0;c<3;c++)v[c]=[.8,187/255,170/255][c]*a+v[c]*(1-a);
    v[4]=.625*t;v[13]=.5;for(let c=0;c<4;c++)v[9+c]=v[c];
    if(contains(p,footprint))for(let j=0;j<3;j++){
     const a=sources[j].alpha(p),erase=j===2;
     for(let c=0;c<3;c++){
      v[5+c]=v[5+c]*(1-a)+(erase?0:colors[j][c])*a;
      v[9+c]=v[9+c]*(1-a)+(erase?v[c]:colors[j][c])*a;
     }
     v[8]=v[8]*(1-a)+(erase?0:a);
    }
    for(let c=0;c<14;c++)sum[c]+=v[c]/(n*n);
   }
   return sum;
  };
  const coarse=sample(512),fine=sample(1024),mean=Array(14).fill(0);
  r.pixels.forEach((v,i)=>mean[i%14]+=v/65536);
  const bound=r.errorBounds.reduce((s,v)=>s+v,0)/65536;
  for(let c=0;c<14;c++){
   const delta=Math.abs(coarse[c]-fine[c]);assert.ok(delta<.0002,`oracle convergence channel ${c}`);
   assert.ok(Math.abs(mean[c]-fine[c])<=bound+delta+1e-8,`channel ${c}: ${mean[c]} vs ${fine[c]}, bound ${bound}`);
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
