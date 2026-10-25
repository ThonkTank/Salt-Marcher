// Render historical and current terrain pixels side by side; never overwrites test fixtures.
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const require=createRequire(import.meta.url),{PNG}=require('pngjs'),out='.build/contour-fixed-goldens';mkdirSync(out,{recursive:true});
const contents="export * from './src/app/storage/terrain-color';export * from './src/app/atlas/terrain-projection-cache';export * from './src/app/atlas/terrain-height';";
// Freeze the former slope-derived raster and ink together for an honest comparison.
const baseline='02673afb2e04e828a32cf17b22e86cac45fc48ea';
for(const mode of ['baseline','production'])await build({stdin:{contents,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:'.build/contour-golden-'+mode+'.cjs',plugins:mode==='baseline'?[{name:'baseline-contours',setup(b){b.onLoad({filter:/(landscape-raster|terrain-contour-style)\.ts$/},args=>({contents:execFileSync('git',['show',baseline+':src/app/'+args.path.split('/').at(-1)],{encoding:'utf8'}),loader:'ts'}));}}]:[]});
const old=JSON.parse(readFileSync('tests/fixtures/terrain-coast-goldens.json')),cases=old.cases,result={source:'Fixed zoom-selected contour elevations, 16 m at 1 logical m/px; clearer ink. Previous slope-derived pixels retained in terrain-coast-goldens.json.',cases:[]};
const sheet=new PNG({width:1536,height:768});
for(const variant of ['baseline','production']){
 const {readTerrainColorSteps,TerrainProjectionCache,heightRecord,settingsRecord}=require('../.build/contour-golden-'+variant+'.cjs'),records=[];
 for(let y=-1;y<=0;y++)for(let x=-1;x<=0;x++)records.push(heightRecord(x*1024,y*1024,16,Float32Array.from({length:4096},(_,i)=>80*Math.sin((x*1024+i%64*16)/150)+30*Math.cos((y*1024+Math.floor(i/64)*16)/75))));
 for(const c of cases){
  const {mode,contours,mpp}=c,settings=settingsRecord(0);settings.terrainSettings.style={version:1,mode,land:'#eee5cf',ink:'#685639',strength:.65,lightDegrees:315};
  const db={prepare(){return{get(){return{payload:JSON.stringify(settings)};}};}},box={x:-144.25,y:-128.5,width:256*mpp,height:256*mpp};
  const steps=readTerrainColorSteps(db,{campaignId:'fixture',revision:1,fence:'one'},{revision:1,fence:'one',box,routeContext:box,width:256,height:256,displayMpp:mpp,contours},kind=>kind==='height'?records:[],new TerrainProjectionCache());let step;do{step=steps.next();}while(!step.done);
  const pixels=step.value.pixels,sha256=createHash('sha256').update(pixels).digest('hex');if(variant==='baseline'&&sha256!==c.sha256)throw Error('Historical baseline mismatch');if(variant==='production')result.cases.push({mode,contours,mpp,sha256});
  const png=new PNG({width:256,height:256});png.data=Buffer.from(pixels);writeFileSync(out+'/'+mode+'-'+contours+'-'+variant+'.png',PNG.sync.write(png));
  const x=(['drawn','shaded','height'].indexOf(mode)*2+(variant==='production'?1:0))*256,y=([0,-1,10].indexOf(contours))*256;PNG.bitblt(png,sheet,0,0,256,256,x,y);
 }
}
writeFileSync(out+'/comparison.png',PNG.sync.write(sheet));writeFileSync(out+'/goldens.json',JSON.stringify(result,null,2)+'\n');
