import {TerrainSpatialView} from '../../src/app/terrain-spatial-view';
import {atlasPreviewScene} from '../atlas-preview-scene';
import type {VegetationScene} from '../../src/app/vegetation';
declare const __SCENE__:VegetationScene;
const canvas=document.querySelector<HTMLCanvasElement>('canvas')!,view=new TerrainSpatialView(canvas);
let tilt=45;view.setData(atlasPreviewScene(__SCENE__,tilt));
document.querySelector<HTMLButtonElement>('#top')!.onclick=()=>{tilt=0;view.reframe(__SCENE__.box,tilt,0);};
document.querySelector<HTMLButtonElement>('#tilted')!.onclick=()=>{tilt=45;view.reframe(__SCENE__.box,tilt,0);};
new ResizeObserver(()=>view.render()).observe(canvas);
document.body.dataset.ready='true';
Object.assign(window,{vegetationProbe:{read:()=>({instances:__SCENE__.instances.length,tilt,calls:view.renderer.info.render.calls,triangles:view.renderer.info.render.triangles}),project:(x:number,y:number)=>view.project({x,y}),measure:async()=>{
  const frames:number[]=[],render:number[]=[];let previous=performance.now();
  for(let i=0;i<90;i++){await new Promise<void>(r=>requestAnimationFrame(()=>r()));const now=performance.now();if(i>10)frames.push(now-previous);previous=now;const start=performance.now();view.reframe(__SCENE__.box,tilt,i);render.push(performance.now()-start);}
  view.reframe(__SCENE__.box,tilt,0);frames.sort((a,b)=>a-b);render.sort((a,b)=>a-b);
  return{frames:frames.length,frameP95Ms:frames[Math.floor(frames.length*.95)],renderP95Ms:render[Math.floor(render.length*.95)],meanFps:1000/(frames.reduce((a,b)=>a+b,0)/frames.length)};
}}});
