import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=process.cwd(),baseline='360f8ee242428f310464d64a4923c4d688d249ad',require=createRequire(import.meta.url);
for(const version of ['before','after'])await build({stdin:{resolveDir:root,contents:"export * from './src/app/landscape-raster';export * from './src/app/vegetation';"},outfile:'.build/cover-local-'+version+'.cjs',bundle:true,platform:'node',format:'cjs',plugins:version==='before'?[{name:'baseline',setup(b){b.onLoad({filter:/landscape-cover-feather\.ts$/},()=>({contents:execFileSync('git',['show',baseline+':src/app/landscape-cover-feather.ts'],{encoding:'utf8'}),loader:'ts',resolveDir:root+'/src/app'}));}}]:[]});
const versions=Object.fromEntries(['before','after'].map(v=>[v,require(root+'/.build/cover-local-'+v+'.cjs')])),results=[];
for(const kind of ['small','full','many']){
 const timings={before:[],after:[]};let digest;
 for(let round=0;round<12;round++){
  const hashes={};
  for(const version of round%2?['after','before']:['before','after']){
   const {LandscapeRasterizer,vegetationSpec}=versions[version],box={x:0,y:0,width:4096,height:4096},image=new LandscapeRasterizer(box,256,256),lat=image.sampleLattice();
   image.setTerrainField({heights:new Float32Array(lat.columns*lat.rows).fill(100),water:new Uint8Array(lat.columns*lat.rows)});
   const side=kind==='full'?3800:128,records=Array.from({length:kind==='many'?256:1},(_,i)=>{
    const x=128+(i%16)*240,y=128+Math.floor(i/16)*240;
    return{id:'forest'+i,kind:'vegetation',points:[],polygons:[{outer:[{x,y},{x:x+side,y},{x:x+side,y:y+side},{x,y:y+side}],holes:[]}],vegetation:vegetationSpec()};
   });
   const start=performance.now();for(const record of records)image.paintCover(record);const pixels=image.finish(),elapsed=performance.now()-start;
   if(round>=4)timings[version].push(elapsed);hashes[version]=createHash('sha256').update(pixels).digest('hex');
  }
  assert.equal(hashes.after,hashes.before,kind+' changed pixels in round '+round);digest=hashes.after;
 }
 results.push({kind,pixelSha256:digest,...Object.fromEntries(Object.entries(timings).map(([k,v])=>{v.sort((a,b)=>a-b);return[k,{samples:v.length,medianMs:(v[3]+v[4])/2,rangeMs:[v[0],v.at(-1)]}];}))});
}
await writeFile('.build/cover-local-comparison.json',JSON.stringify({baseline,results},null,2));console.log(JSON.stringify(results,null,2));
