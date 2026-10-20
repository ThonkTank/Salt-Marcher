import {VegetationSpatialView} from '../../src/app/vegetation-spatial';
import type {VegetationScene} from '../../src/app/vegetation';
declare const __SCENE__:VegetationScene;
const canvas=document.querySelector<HTMLCanvasElement>('canvas')!,view=new VegetationSpatialView(canvas);
view.setData(__SCENE__);
document.querySelector<HTMLButtonElement>('#top')!.onclick=()=>{view.tilt=0;view.render();};
document.querySelector<HTMLButtonElement>('#tilted')!.onclick=()=>{view.tilt=45;view.render();};
new ResizeObserver(()=>view.render()).observe(canvas);
document.body.dataset.ready='true';
Object.assign(window,{vegetationProbe:{read:()=>({instances:__SCENE__.instances.length,tilt:view.tilt,calls:view.renderer.info.render.calls,triangles:view.renderer.info.render.triangles}),project:(x:number,y:number)=>view.project({x,y}),measure:async()=>{
  const frames:number[]=[],render:number[]=[];let previous=performance.now();
  for(let i=0;i<90;i++){await new Promise<void>(r=>requestAnimationFrame(()=>r()));const now=performance.now();if(i>10)frames.push(now-previous);previous=now;const start=performance.now();view.rotation=i;view.render();render.push(performance.now()-start);}
  view.rotation=0;view.render();frames.sort((a,b)=>a-b);render.sort((a,b)=>a-b);
  return{frames:frames.length,frameP95Ms:frames[Math.floor(frames.length*.95)],renderP95Ms:render[Math.floor(render.length*.95)],meanFps:1000/(frames.reduce((a,b)=>a+b,0)/frames.length)};
}}});
