import {buildSync} from 'esbuild';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

// Supplement to the main-Atlas workflow: asymmetric pixels expose image flips
// that symmetric terrain/reference fixtures cannot detect.
export async function atlasImageOrientationPixels(page,out){
 const source=buildSync({stdin:{resolveDir:process.cwd(),contents:`
 import * as THREE from 'three';
 import {AtlasSpatialScene} from './src/app/atlas-spatial-scene';
 import {atlasPaint} from './src/app/atlas-paint';
 export async function run(){
  const source=document.createElement('canvas');source.width=64;source.height=64;
  const ctx=source.getContext('2d'),colors=['#ff0000','#00ff00','#0000ff','#ffcc00'];
  colors.forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(i%2*32,Math.floor(i/2)*32,32,32);});
  const image=new Image();image.src=source.toDataURL();await image.decode();
  const bitmap=await createImageBitmap(image),renderer=new THREE.WebGLRenderer({preserveDrawingBuffer:true,antialias:false});renderer.setSize(256,256);renderer.setClearColor('#ffffff');
  const camera=new THREE.OrthographicCamera(-30,30,30,-30,.1,1000),results=[];
  const node=atlasPaint('image',{source:'quadrants',x:0,y:0,width:40,height:40}),command={node,matrix:{a:1,b:0,c:0,d:1,e:0,f:0},style:{fill:null,stroke:null},alpha:1,pointer:false,hud:false,title:'',ancestry:[node]};
  const surface={origin:{x:0,y:0},focusM:0,exaggeration:1,segment:10,height:()=>0};
  try{
   for(const [kind,input] of [['canvas',source],['image',image],['bitmap',bitmap]])for(const tilt of [0,45]){
    const atlas=new AtlasSpatialScene({commands:[command]},{x:0,y:0},new Map([['quadrants',input]]),surface),scene=new THREE.Scene();scene.add(atlas.group);
    try{
     const radians=tilt*Math.PI/180;camera.position.set(20,-20-100*Math.sin(radians),100*Math.cos(radians));camera.lookAt(20,-20,0);camera.updateMatrixWorld(true);renderer.render(scene,camera);
     const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const capture=canvas.getContext('2d');capture.drawImage(renderer.domElement,0,0);
     const samples=[[10,10],[30,10],[10,30],[30,30]].map(([x,y])=>{const p=new THREE.Vector3(x,-y,0).project(camera);return Array.from(capture.getImageData(Math.floor((p.x+1)*128),Math.floor((1-p.y)*128),1,1).data);});
     results.push({kind,tilt,samples,png:canvas.toDataURL()});
    }finally{scene.remove(atlas.group);atlas.dispose();}
   }
   return results;
  }finally{bitmap.close();renderer.dispose();renderer.forceContextLoss();}
 }
 `},bundle:true,format:'iife',globalName:'AtlasImageOrientation',write:false}).outputFiles[0].text;
 const samples=await page.evaluate(`(()=>{${source}\nreturn AtlasImageOrientation.run();})()`);
 for(const sample of samples){await writeFile(`${out}/${sample.kind}-${sample.tilt}.png`,Buffer.from(sample.png.split(',')[1],'base64'));delete sample.png;}
 await writeFile(out+'/pixels.json',JSON.stringify(samples,null,2));
 const expected=[[255,0,0,255],[0,255,0,255],[0,0,255,255],[255,204,0,255]];
 for(const sample of samples)assert.deepEqual(sample.samples,expected,`${sample.kind}, tilt ${sample.tilt}: image corners stay at their authored world positions`);
 return samples;
}
