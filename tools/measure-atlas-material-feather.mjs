import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {convexFeatherRegions} from './atlas-prototypes/convex-feather.mjs';
import {integrateMaterialArea,rectangle} from './atlas-prototypes/material-area.mjs';
const output=resolve('.build/atlas-material-feather',`${Date.now()}-${process.pid}`);mkdirSync(output,{recursive:true});
const polygon={outer:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],holes:[]},box={x:0,y:0,width:1,height:1};
const results=[];
for(let round=0;round<3;round++)for(const method of round%2?['polynomial','adaptive']:['adaptive','polynomial']){
 const start=performance.now();
 const layers=method==='polynomial'?convexFeatherRegions(polygon,1,'smoothstep').map(region=>({...region,paint(value,point){value[0]=region.fade(point);}})):
 [{geometry:rectangle(0,0,1,1),varying:true,paint(v,{x,y}){const t=Math.min(x,1-x,y,1-y);v[0]=t*t*(3-2*t);}}];
 const r=integrateMaterialArea({box,width:1,height:1,background:[0],layers,tolerance:.005,lipschitz:method==='adaptive'?1.5:0});
 results.push({round,method,value:r.pixels[0],absoluteError:Math.abs(r.pixels[0]-.1),reportedBound:r.errorBounds[0],ms:performance.now()-start,stats:r.stats});
}
const radii=[];
for(const curve of ['linear','smoothstep'])for(const pixels of [1,4,16]){
 const regions=convexFeatherRegions(polygon,1,curve),start=performance.now();
 const r=integrateMaterialArea({box,width:pixels,height:pixels,background:[0],layers:regions.map(region=>({...region,paint(v,p){v[0]=region.fade(p);}}))});
 radii.push({curve,pixels,area:r.pixels.reduce((n,v)=>n+v,0)*r.pixelArea,expected:curve==='linear'?1/6:.1,ms:performance.now()-start,stats:r.stats});
}
const files=['tools/atlas-prototypes/material-area.mjs','tools/atlas-prototypes/convex-feather.mjs','tools/measure-atlas-material-feather.mjs'];
const report={scope:'Isolated convex source-boundary integration, not production or native performance. Constant authored radius; polynomial rules only for validated convex regions and composed degree <=3.',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hashes:Object.fromEntries(files.map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')])),results,radii};
writeFileSync(output+'/result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({complete:true,output,report}));
