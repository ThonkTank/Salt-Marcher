import {build} from 'esbuild';import {execFileSync} from 'node:child_process';import {writeFile} from 'node:fs/promises';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const root=process.cwd(),baseline='6c72342d5db7f2cbc5fcec6e60c30f005409409d',require=createRequire(import.meta.url),files=['src/app/landscape-raster.ts','src/app/landscape-cover-feather.ts'];
for(const version of ['before','after'])await build({stdin:{resolveDir:root,contents:"export * from './src/app/landscape-raster';export * from './src/app/vegetation';"},outfile:'.build/cover-distance-'+version+'.cjs',bundle:true,platform:'node',format:'cjs',plugins:version==='before'?[{name:'main-baseline',setup(b){b.onLoad({filter:/\.ts$/},args=>{const path=args.path.slice(root.length+1);return files.includes(path)?{contents:execFileSync('git',['show',baseline+':'+path],{encoding:'utf8'}),loader:'ts',resolveDir:root+'/src/app'}:undefined;});}}]:[]});
const versions=Object.fromEntries(['before','after'].map(v=>[v,require(root+'/.build/cover-distance-'+v+'.cjs')])),results=[];
for(const kind of ['inside','edge','complex','scattered','visible']){
 const timings={before:[],after:[]},digests={};
 for(let round=0;round<12;round++)for(const version of round%2?['after','before']:['before','after']){
  const {LandscapeRasterizer,vegetationSpec}=versions[version],box={x:-128,y:-128,width:256,height:256},image=new LandscapeRasterizer(box,256,256),lat=image.sampleLattice();
  image.setTerrainField({heights:new Float32Array(lat.columns*lat.rows).fill(100),water:new Uint8Array(lat.columns*lat.rows)});
  let polygons;
  if(kind==='scattered'||kind==='visible'){
   const spacing=kind==='scattered'?1000:5,side=kind==='scattered'?100:3;
   polygons=Array.from({length:2000},(_,i)=>{const x=(i%50-25)*spacing,y=(Math.floor(i/50)-20)*spacing;return{outer:[{x,y},{x:x+side,y},{x:x+side,y:y+side},{x,y:y+side}],holes:[]};});
  }else{
   const radius=kind==='inside'?1000:120,vertices=kind==='complex'?2000:12;
   polygons=[{outer:Array.from({length:vertices},(_,i)=>{const a=i/vertices*Math.PI*2,r=radius*(1+.08*Math.sin(a*11));return{x:Math.cos(a)*r,y:Math.sin(a)*r};}),holes:[]}];
  }
  const record={id:'forest',kind:'vegetation',points:[],polygons,vegetation:vegetationSpec()};
  const start=performance.now();image.paintCover(record);const pixels=image.finish(),elapsed=performance.now()-start;if(round>=4)timings[version].push(elapsed);
  digests[version]=createHash('sha256').update(pixels).digest('hex');
 }
 assert.equal(digests.after,digests.before,kind+' changed pixels');
 results.push({kind,pixelSha256:digests.after,...Object.fromEntries(Object.entries(timings).map(([k,v])=>{v.sort((a,b)=>a-b);return[k,{samples:v.length,medianMs:(v[3]+v[4])/2,rangeMs:[v[0],v.at(-1)]}];}))});
}
await writeFile('.build/cover-distance-comparison.json',JSON.stringify({baseline,results},null,2));console.log(JSON.stringify(results,null,2));
