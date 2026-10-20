import {AtlasCanvasScene} from './atlas-canvas-scene';
import {TerrainSpatialView} from './terrain-spatial-view';
import {atlasCanvasBytes,drawScene} from './campaign-atlas-export';
import type {SpatialJob,SpatialReply} from './terrain-spatial-worker';
import type {AtlasPaint} from './atlas-paint';
import {validateTerrainView,type TerrainView,type TerrainGrid} from './terrain-spatial-model';
import type {PlayerFrame} from './player-contracts';
import {atlasHexAt} from './campaign-atlas-model';
import {terrainGridLayout} from './terrain-grid-layout';

/** Only the allowlisted player snapshot enters this field. Never fill forgotten heights from GM terrain. */
export function publicTerrainGrid(frame:PlayerFrame,view:TerrainView):TerrainGrid{
  validateTerrainView(view);const heights=new Float32Array(view.columns*view.rows),l=terrainGridLayout(view),cells=new Map(frame.map?.cells.map(c=>[c.q+':'+c.r,c]));
  if(frame.mode==='map'&&frame.map)for(let y=0;y<view.rows;y++)for(let x=0;x<view.columns;x++){
    const p={x:l.x.values[x]!,y:l.y.values[y]!},h=atlasHexAt(p,frame.map.hexMeters),cell=cells.get(h.q+':'+h.r);
    heights[y*view.columns+x]=cell?.elevationM??0;
  }
  const centre=frame.map?atlasHexAt({x:view.frame.x+view.frame.width/2,y:view.frame.y+view.frame.height/2},frame.map.hexMeters):null;
  return{view:{...view,focusM:centre?cells.get(centre.q+':'+centre.r)?.elevationM??0:0},heights,seaLevelM:0};
}
export async function prepareTerrainImage(job:SpatialJob,current:()=>boolean):Promise<SpatialReply>{
  if(!current())throw Error('Atlas-Ausgabe abgebrochen.');
  const worker=new Worker(new URL('terrain-spatial-worker.js',document.baseURI));
  try{return await new Promise((resolve,reject)=>{
    const timer=setInterval(()=>{if(!current())finish(undefined,Error('Atlas-Ausgabe abgebrochen.'));},50);
    const finish=(value?:SpatialReply,error?:Error)=>{clearInterval(timer);if(error)reject(error);else resolve(value!);};
    worker.onmessage=e=>{if(!current())finish(undefined,Error('Atlas-Ausgabe abgebrochen.'));else if(e.data.error)finish(undefined,Error(e.data.error));else finish(e.data);};
    worker.onerror=()=>finish(undefined,Error('Geländebild konnte nicht vorbereitet werden.'));
    try{worker.postMessage(job);}catch(error){finish(undefined,error as Error);}
  });}finally{worker.terminate();}
}
/** Bake optional geographic overlays into the surface, so they share the terrain projection. */
export async function terrainTextureOverlay(data:SpatialReply,scene:AtlasPaint,current:()=>boolean):Promise<SpatialReply>{
  const canvas=document.createElement('canvas');
  const check=()=>{if(!current())throw Error('Atlas-Ausgabe abgebrochen.');};
  try{
    check();canvas.width=data.width;canvas.height=data.height;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Bildausgabe nicht verfügbar.');
    ctx.putImageData(new ImageData(new Uint8ClampedArray(data.pixels),data.width,data.height),0,0);
    await drawScene(canvas,scene,data.grid.view.box,check,false);check();
    return {...data,pixels:new Uint8Array(ctx.getImageData(0,0,data.width,data.height).data)};
  }finally{canvas.width=canvas.height=0;}
}
/** One bounded GPU tile at a time; no editor cursor, selection rings or hidden DOM are copied. */
export async function terrainImage(data:SpatialReply,width:number,height:number,format:'png'|'jpeg',current:()=>boolean,progress:(done:number,total:number)=>void,overlay?:AtlasPaint,scene?:AtlasPaint,contours=0){
  if(!Number.isInteger(width)||!Number.isInteger(height)||Math.min(width,height)<1||Math.max(width,height)>8192)throw Error('Ungültige Bildgröße.');
  const canvas=document.createElement('canvas'),gpu=document.createElement('canvas');let view:TerrainSpatialView|undefined;let compiled:AtlasCanvasScene|undefined;const images=new Map<string,CanvasImageSource>();
  let lost=false;gpu.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;});
  const check=()=>{if(!current())throw Error('Atlas-Ausgabe abgebrochen.');if(lost||view?.renderer.getContext().isContextLost())throw Error('Grafikdarstellung verloren. In Draufsicht erneut ausgeben.');};
  try{
    check();canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Bildausgabe nicht verfügbar.');
    view=new TerrainSpatialView(gpu,1);view.setData(data);view.setContours(contours);
    if(scene){
      compiled=new AtlasCanvasScene(scene);
      for(const source of compiled.images){check();const image=new Image();image.src=source;await image.decode();check();images.set(source,image);}
      view.publish(compiled,{x:data.grid.view.box.x,y:data.grid.view.box.y},images);
    }
    const edge=1024,total=Math.ceil(width/edge)*Math.ceil(height/edge);let done=0;
    for(let y=0;y<height;y+=edge)for(let x=0;x<width;x+=edge){
      check();const w=Math.min(edge,width-x),h=Math.min(edge,height-y);view.renderTile(width,height,x,y,w,h);check();ctx.drawImage(gpu,x,y);progress(++done,total);
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    }
    check();if(overlay)await drawScene(canvas,overlay,data.grid.view.frame,check,false);
    return await atlasCanvasBytes(canvas,format,current);
  }finally{view?.dispose();compiled?.dispose();images.clear();canvas.width=canvas.height=gpu.width=gpu.height=0;}
}
/** Project exactly the approved 2D player scene onto the approved height field. */
export async function publicTerrainImage(scene:AtlasPaint,frame:PlayerFrame,view:TerrainView,width:number,height:number,format:'png'|'jpeg',current:()=>boolean,progress:(done:number,total:number)=>void,overlay?:AtlasPaint){
  const canvas=document.createElement('canvas');
  try{
    canvas.width=Math.min(1024,width);canvas.height=Math.max(1,Math.round(canvas.width*view.box.height/view.box.width));
    if(canvas.height>1024){canvas.height=1024;canvas.width=Math.max(1,Math.round(1024*view.box.width/view.box.height));}
    await drawScene(canvas,scene,view.box,()=>{if(!current())throw Error('Atlas-Ausgabe abgebrochen.');});
    const ctx=canvas.getContext('2d')!,pixels=new Uint8Array(ctx.getImageData(0,0,canvas.width,canvas.height).data);
    return await terrainImage({generation:0,source:'public',draft:false,grid:publicTerrainGrid(frame,view),pixels,width:canvas.width,height:canvas.height},width,height,format,current,progress,overlay);
  }finally{canvas.width=canvas.height=0;}
}
