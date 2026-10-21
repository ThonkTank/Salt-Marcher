import {buildSync} from 'esbuild';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
/** Actual renderer, retained candidate publication, no author/data shortcuts. */
export async function atlasCameraLabelPixels(page,out){
 const source=buildSync({stdin:{resolveDir:process.cwd(),contents:`
 import {TerrainSpatialView} from './src/app/terrain-spatial-view';
 import {AtlasCanvasScene} from './src/app/atlas-canvas-scene';
 import {atlasPaint} from './src/app/atlas-paint';
 import {Vector3} from 'three';
 export function run(){
  const canvas=document.createElement('canvas'),view=new TerrainSpatialView(canvas,1),root=atlasPaint('group');
  canvas.style.cssText='position:fixed;left:-10000px;width:800px;height:600px';document.body.append(canvas);
  const candidates=[{id:'minor',text:'Waldweg',point:{x:0,y:0},kind:'road',rank:1,angle:0,available:12000},{id:'major',text:'Hauptfluss',point:{x:0,y:130},kind:'river',rank:4,angle:0,available:12000}];
  root.mapLabels={candidates};const compiled=new AtlasCanvasScene(root);
  const frame={x:-400,y:-300,width:800,height:600},terrain={projection:'perspective',box:{x:-1200,y:-900,width:2400,height:1800},frame,columns:17,rows:17,focusM:0,tilt:0,rotation:0,exaggeration:1};
  const data={generation:1,source:'probe',draft:false,grid:{view:terrain,heights:new Float32Array(289),seaLevelM:-100},width:2,height:2,pixels:new Uint8Array(16).fill(255)};
  const sample=(width,tilt=0,rotation=0)=>{
   view.reframe({x:-width/2,y:-width*3/8,width,height:width*3/4},tilt,rotation);view.renderTile(800,600,0,0,800,600);
   const rows=[];view.scene.traverse(o=>{if(o.userData.mapLabel){const eye=o.position.clone().applyMatrix4(view.camera.matrixWorldInverse),pixels=o.scale.y*view.camera.projectionMatrix.elements[5]*300/-eye.z;rows.push({id:o.userData.mapLabel,visible:o.visible,opacity:o.material.opacity,font:pixels*48/80,rotation:o.material.rotation,texture:o.material.map.uuid});}});return rows;
  };
  try{
   view.setData(data);view.publish(compiled,{x:0,y:0},new Map());
   const near=sample(800),closer=sample(400),far=sample(12000),tilted=sample(800,60,35);
   const screenshot=canvas.toDataURL();
   // Republishing equal candidates must not re-rasterize glyph textures.
   const republished=atlasPaint('group');republished.mapLabels={candidates:[...candidates]};const second=new AtlasCanvasScene(republished);view.publish(second,{x:0,y:0},new Map());const retained=sample(800,60,35);
   const full=document.createElement('canvas');full.width=800;full.height=600;full.getContext('2d').drawImage(canvas,0,0);
   const tiled=document.createElement('canvas');tiled.width=800;tiled.height=600;
   for(let y=0;y<600;y+=300)for(let x=0;x<800;x+=400){view.renderTile(800,600,x,y,400,300);tiled.getContext('2d').drawImage(canvas,x,y);}
   const a=full.getContext('2d').getImageData(0,0,800,600).data,b=tiled.getContext('2d').getImageData(0,0,800,600).data;let mismatch=0;for(let i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>1)mismatch++;
   let ink=0;for(let y=150;y<450;y++)for(let x=150;x<650;x++){const i=(y*800+x)*4;if(a[i]<200||a[i+1]<200||a[i+2]<200)ink++;}
   // A ridge between the eye and the label hides the entire name. The same
   // candidates reappear when the ridge is removed, without an author change.
   const ridge=Float32Array.from({length:289},(_,i)=>Math.floor(i/17)===8?500:0);
   const hiddenRoot=atlasPaint('group');hiddenRoot.mapLabels={candidates:[{id:'behind',text:'Hinter dem Berg',point:{x:0,y:-225},kind:'area',rank:5}]};
   const hiddenScene=new AtlasCanvasScene(hiddenRoot);
   view.setData({...data,grid:{...data.grid,heights:new Float32Array(289)}});view.publish(hiddenScene,{x:0,y:0},new Map());const clear=sample(800,60,0);
   view.setData({...data,grid:{...data.grid,heights:ridge}});const blocked=sample(800,60,0);
   view.setData(data);view.publish(compiled,{x:0,y:0},new Map());view.renderer.setPixelRatio(2);const highDpi=sample(800,60,35);view.renderer.setPixelRatio(1);
   const denseRoot=atlasPaint('group');denseRoot.mapLabels={candidates:Array.from({length:1200},(_,i)=>({id:'dense'+i,text:'Ort '+i,kind:'place',rank:3,point:{x:(i%40-20)*20,y:(Math.floor(i/40)-15)*20}}))};
   const denseScene=new AtlasCanvasScene(denseRoot);view.publish(denseScene,{x:0,y:0},new Map());sample(800,45,0);
   const timings=[];for(let i=0;i<30;i++){const start=performance.now();sample(800,45,i*.2);timings.push(performance.now()-start);}timings.sort((a,b)=>a-b);
   const dense={candidates:1200,visible:sample(800,45,6).filter(r=>r.visible).length,medianMs:timings[15],p95Ms:timings[28]};denseScene.dispose();
   hiddenScene.dispose();second.dispose();return {near,closer,far,tilted,retained,mismatch,ink,screenshot,clear,blocked,highDpi,dense};
  }finally{compiled.dispose();view.dispose();canvas.remove();}
 }
 `},bundle:true,format:'iife',globalName:'CameraLabelProbe',write:false}).outputFiles[0].text;
 const result=await page.evaluate(`(()=>{${source}\nreturn CameraLabelProbe.run();})()`);
 await writeFile(out+'/label-camera.png',Buffer.from(result.screenshot.split(',')[1],'base64'));delete result.screenshot;
 await writeFile(out+'/label-camera-result.json',JSON.stringify(result,null,2));
 const at=(rows,id)=>rows.find(r=>r.id===id);
 for(const rows of [result.near,result.closer,result.tilted,result.retained,result.highDpi]){
  assert(at(rows,'minor').visible);assert(Math.abs(at(rows,'minor').font-12)<1e-6);
  assert(at(rows,'major').visible);assert(Math.abs(at(rows,'major').font-14)<1e-6);
 }
 assert.equal(at(result.far,'minor').visible,false);assert(at(result.far,'major').visible);
 assert.equal(at(result.near,'minor').texture,at(result.retained,'minor').texture);
 assert(Math.abs(at(result.tilted,'minor').rotation)>.1);assert.equal(result.mismatch,0);
 assert(at(result.clear,'behind')?.visible);assert(!at(result.blocked,'behind')?.visible,'ridge must hide the geographic anchor');
 assert(result.ink>100,'Actual GPU text must be visible, not just a correctly sized sprite');return result;
}
