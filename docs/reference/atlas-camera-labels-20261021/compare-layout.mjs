import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),require=createRequire(root+'/package.json'),beforeRef='dce92f7831b56a5144930e09d9d8c77ae6d353a9';
const before=execFileSync('git',['show',beforeRef+':src/app/atlas-cartography.ts'],{encoding:'utf8'});
async function load(name,contents){const outfile=path.join(root,'.build/label-layout-'+name+'.cjs');await build({entryPoints:['src/app/atlas-cartography.ts'],outfile,bundle:true,platform:'node',format:'cjs',plugins:contents?[{name:'prior-source',setup(b){b.onLoad({filter:/\/atlas-cartography\.ts$/},()=>({contents,loader:'ts',resolveDir:path.join(root,'src/app')}));}}]:[]});return require(outfile).MapLabelLayout;}
const Old=await load('before',before),New=await load('after');
const candidates=Array.from({length:1200},(_,i)=>({id:'dense'+i,text:'Ort '+i,kind:'place',rank:3,point:{x:(i%40-20)*20,y:(Math.floor(i/40)-15)*20}}));
const box={x:0,y:0,width:800,height:600},measure=(s,n)=>s.length*n*.6,a=new Old(),b=new New(),times={before:[],after:[]};
for(let i=0;i<100;i++){
 const angle=i*.003,project=c=>({point:{x:400+c.point.x*Math.cos(angle)-c.point.y*Math.sin(angle),y:300+c.point.x*Math.sin(angle)+c.point.y*Math.cos(angle)},mpp:1,angle:0});
 let old,next;
 for(const which of i%2?['after','before']:['before','after']){const start=performance.now(),r=(which==='before'?a:b).layout(candidates,box,1,measure,undefined,false,project);if(i>=20)times[which].push(performance.now()-start);if(which==='before')old=r;else next=r;}
 assert.deepEqual(next,old,'Priority, collision results and geometry must be identical at rotation '+angle);
}
const stats=values=>{values.sort((a,b)=>a-b);return{count:values.length,medianMs:values[Math.floor(values.length*.5)],p95Ms:values[Math.floor(values.length*.95)]};};
const result={beforeRef,afterRef:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),candidates:1200,iterations:100,warmup:20,comparison:'Alternating order, same process, exact equality at every step; CPU layout only, no GPU or terrain visibility',before:stats(times.before),after:stats(times.after)};
writeFileSync('.build/label-layout-comparison.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
