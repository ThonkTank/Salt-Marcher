import {performance} from 'node:perf_hooks';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {integrateMaterialArea,rectangle} from './atlas-prototypes/material-area.mjs';
const output=resolve('.build/atlas-material-area',`${Date.now()}-${process.pid}`);mkdirSync(output,{recursive:true});
buildSync({stdin:{contents:"export * from './src/app/landscape-raster';export * from './src/app/terrain-height';",resolveDir:process.cwd()},outfile:output+'/production.cjs',bundle:true,platform:'node',format:'cjs'});
const {LandscapeRasterizer,settingsRecord}=createRequire(import.meta.url)(output+'/production.cjs');
const strip=rectangle(430.12,100,.25,600),asPolygon=geometry=>geometry.map(p=>({outer:p[0].slice(0,-1).map(([x,y])=>({x,y})),holes:p.slice(1).map(r=>r.slice(0,-1).map(([x,y])=>({x,y})))}));
function reference(box,polygons){
 const image=new LandscapeRasterizer(box,256,256,0,box.width/256,true),lattice=image.sampleLattice();
 image.setTerrainField({heights:new Float32Array(lattice.columns*lattice.rows).fill(100),water:new Uint8Array(lattice.columns*lattice.rows)});image.paint(settingsRecord(0));
 image.paint({id:'forest',kind:'patch',revision:0,order:1,resolution:1,width:0,points:[],polygons:asPolygon(polygons),values:{terrain:'forest'}});
 return image.materialChannelsSteps(function*(){},new Set(['forest'])).next().value.forest;
}
const solid=geometry=>({geometry,paint(value){value[0]=1;}});
const results=[];
for(let round=0;round<3;round++)for(const algorithm of round%2?['area','production']:['production','area'])for(const count of [1,4]){
 let area=0,byteArea=0,clips=0,work=0;const start=performance.now(),size=1024/count;
 for(let y=0;y<count;y++)for(let x=0;x<count;x++){
  const box={x:x*size,y:y*size,width:size,height:size};
  if(algorithm==='production'){const pixels=reference(box,strip);area+=pixels.reduce((n,v)=>n+v/255,0)*(size/256)**2;byteArea=area;}
  else{const result=integrateMaterialArea({box,width:256,height:256,background:[0],layers:[solid(strip)]});area+=result.pixels.reduce((n,v)=>n+v,0)*result.pixelArea;byteArea+=result.pixels.reduce((n,v)=>n+Math.round(v*255)/255,0)*result.pixelArea;clips+=result.stats.clipCalls;work+=result.stats.work;}
 }
 results.push({round,algorithm,tiles:count*count,areaM2:area,byteAreaM2:byteArea,ms:performance.now()-start,clipCalls:clips,work});
}
const workloads=[];
const detailed=solid([[Array.from({length:1025},(_,i)=>[512+400*Math.cos(i%1024*2*Math.PI/1024),512+400*Math.sin(i%1024*2*Math.PI/1024)])]]);
for(let round=0;round<3;round++)for(const localClipping of round%2?[true,false]:[false,true]){
 const start=performance.now();const r=integrateMaterialArea({box:{x:0,y:0,width:1024,height:1024},width:256,height:256,background:[0],layers:[detailed],localClipping});
 const bytes=Uint8Array.from(r.pixels,v=>Math.round(v*255));
 workloads.push({name:'detailed source hierarchy comparison',round,localClipping,ms:performance.now()-start,areaM2:r.pixels.reduce((n,v)=>n+v,0)*r.pixelArea,byteSha256:createHash('sha256').update(bytes).digest('hex'),stats:r.stats});
}

for(const interiorFastPath of [false,true]){
 const start=performance.now();const r=integrateMaterialArea({box:{x:0,y:0,width:1024,height:1024},width:256,height:256,background:[0],layers:[solid(rectangle(0,0,1024,1024))],interiorFastPath});
 workloads.push({name:'broad patch fast-path comparison',interiorFastPath,ms:performance.now()-start,areaM2:r.pixels.reduce((n,v)=>n+v,0)*r.pixelArea,stats:r.stats});
}
for(const [name,layers,width,limits] of [
 ['one broad patch',[solid(rectangle(0,0,1024,1024))],256,{}],
 ['detailed circular boundary',[solid([[Array.from({length:1025},(_,i)=>[512+400*Math.cos(i%1024*2*Math.PI/1024),512+400*Math.sin(i%1024*2*Math.PI/1024)])]])],256,{}],
 ['128 sparse patches',Array.from({length:128},(_,i)=>solid(rectangle(i%16*64+3,Math.floor(i/16)*128+5,8,8))),256,{}],
 ['overlap stress',Array.from({length:32},(_,i)=>solid(rectangle(i/64,0,1024-i/32,1024))),64,{work:100000}],
]){
 const start=performance.now();try{const r=integrateMaterialArea({box:{x:0,y:0,width:1024,height:1024},width,height:width,background:[0],layers,limits});workloads.push({name,ms:performance.now()-start,areaM2:r.pixels.reduce((n,v)=>n+v,0)*r.pixelArea,stats:r.stats});}
 catch(error){workloads.push({name,ms:performance.now()-start,rejected:error.message});}
}
const soft=[];
for(const tolerance of [.05,.02,.005]){
 const start=performance.now();try{const r=integrateMaterialArea({box:{x:0,y:0,width:1,height:1},width:1,height:1,background:[0],layers:[{geometry:rectangle(0,0,1,1),varying:true,paint(v,{x,y}){const t=Math.min(x,1-x,y,1-y);v[0]=t*t*(3-2*t);}}],lipschitz:1.5,tolerance});soft.push({tolerance,value:r.pixels[0],exact:.1,errorBound:r.errorBounds[0],stats:r.stats,ms:performance.now()-start});}catch(error){soft.push({tolerance,rejected:error.message,ms:performance.now()-start});}
}
function thinFeatherArea(w,h,r){const d=w/2;return 2*((w+h)*(d**3/r**2-.5*d**4/r**3)-4*(.75*d**4/r**2-.4*d**5/r**3));}
const report={source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hashes:Object.fromEntries(['tools/atlas-prototypes/material-area.mjs','tools/measure-atlas-material-area.mjs','src/app/landscape-raster.ts','src/app/landscape-cover-feather.ts'].map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')])),scope:'Isolated mathematical prototype, not production integration or native UI qualification. Timing scopes differ: production prepares physical field and samples; prototype integrates one forest channel only.',results,workloads,soft,decorativeRadius:{rule:'production paintCoverSteps uses max(preset.edge, displayMpp*3)',widthM:.25,lengthM:600,areaM2:150,authoredRadiusM:1,coarse:{displayMpp:4,radiusM:12,exactSoftCoverageM2:thinFeatherArea(.25,600,12)},fine:{displayMpp:1,radiusM:3,exactSoftCoverageM2:thinFeatherArea(.25,600,3)},interpretation:'Even exact integration cannot make a camera-dependent feather radius scale invariant. Semantic density and decorative edge softness need an explicit contract.'}};
writeFileSync(output+'/result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({complete:true,output,report}));
