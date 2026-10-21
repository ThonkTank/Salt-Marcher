import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const root=process.cwd(),out=root+'/.build/crown-style-prototype';
await mkdir(out,{recursive:true});
const app=`
import {TerrainSpatialView} from './src/app/terrain-spatial-view';
import {vegetationRandom} from './src/app/vegetation-lod';
export function setup(selector){
 const canvas=document.querySelector(selector),view=new TerrainSpatialView(canvas,1),instances=[];
 for(let y=-35;y<=35;y++)for(let x=-35;x<=35;x++){
  const rand=n=>vegetationRandom(37,x,y,n),px=x*17+rand(1)*12,py=y*17+rand(2)*12;
  if(Math.abs(py-px*.3)<11)continue;
  instances.push({id:'sample:'+x+':'+y,asset:x<2?'oak':'pine',x:px,y:py,z:0,size:9+rand(3)*10,angle:rand(4)*Math.PI*2,normal:{x:0,y:0,z:1},protected:true});
 }
 const box={x:-500,y:-500,width:1000,height:1000},frame={x:-170,y:-150,width:340,height:300};
 view.setData({generation:1,source:'crown-style',draft:false,grid:{view:{projection:'perspective',box,frame,columns:3,rows:3,focusM:0,tilt:0,rotation:0,exaggeration:1},heights:new Float32Array(9),seaLevelM:-100},width:1,height:1,pixels:new Uint8Array([160,171,132,255]),vegetation:[{id:'wood',vegetationView:{mode:'individual',instances}}]});
 return {measure:async()=>{const frames=[],renders=[];let previous=performance.now();for(let i=0;i<100;i++){await new Promise(r=>requestAnimationFrame(r));const now=performance.now();if(i>20)frames.push(now-previous);previous=now;const start=performance.now();view.reframe(frame,45,i*.2);renders.push(performance.now()-start);}frames.sort((a,b)=>a-b);renders.sort((a,b)=>a-b);return{instances:instances.length,frames:frames.length,frameP95:frames[Math.floor(frames.length*.95)],renderP95:renders[Math.floor(renders.length*.95)],fps:1000/(frames.reduce((a,b)=>a+b,0)/frames.length)};},pose:(tilt,rotation=0)=>{view.reframe(frame,tilt,rotation);return{calls:view.renderer.info.render.calls,triangles:view.renderer.info.render.triangles}},dispose:()=>view.dispose()};
}`;
for(const variant of ['before','after']){
 await build({stdin:{contents:app,resolveDir:root,loader:'ts'},bundle:true,format:'iife',globalName:variant,outfile:out+'/'+variant+'.js',plugins:variant==='before'?[{name:'main-baseline',setup(b){b.onLoad({filter:/(atlas-spatial-vegetation|vegetation-view)\.ts$/},async args=>({contents:execFileSync('git',['show','8591537f4d2f0e9742665cd51c4cc13b0e1ab9d4:'+args.path.slice(root.length+1)],{encoding:'utf8'}),loader:'ts',resolveDir:root+'/src/app'}));}}]:[]});
}
await writeFile(out+'/index.html',`<!doctype html><meta charset="utf-8"><style>body{overflow:hidden;margin:0;background:#eee5cf;color:#334c3e;font:16px sans-serif}main{display:grid;grid-template-columns:1fr 1fr}section{min-width:0}h2{font-size:18px;margin:16px}canvas{display:block;width:100%;height:calc(100vh - 60px)}</style><main><section><h2>Bisherige Kronen</h2><canvas id="before"></canvas></section><section><h2>Entwurf · gelappte Kronen und weiche Schattierung</h2><canvas id="after"></canvas></section></main><script src="before.js"></script><script src="after.js"></script><script>window.pair=[before.setup('#before'),after.setup('#after')];window.pose=(t,r)=>pair.map(v=>v.pose(t,r));window.pose(0,0);document.body.dataset.ready='true';</script>`);
await writeFile(out+'/main.cjs',`const {app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(out+'/profile')});app.whenReady().then(()=>{const w=new BrowserWindow({width:1400,height:740,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});w.loadFile(${JSON.stringify(out+'/index.html')});});app.on('window-all-closed',()=>app.quit());`);
