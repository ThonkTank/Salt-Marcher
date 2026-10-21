import {buildSync} from 'esbuild';
/** Build before launching the native session. Actual WebGL pixels are checked
 * in that session, including full-image versus tiled export coordinates. */
export function buildHexGridProbe(){
 return buildSync({stdin:{resolveDir:process.cwd(),contents:`
 import * as THREE from 'three';
 import {TerrainHexGrid} from './src/app/terrain-hex-grid';
 import {atlasPaint} from './src/app/atlas-paint';
 import {AtlasSpatialScene} from './src/app/atlas-spatial-scene';
 import {AtlasCanvasScene} from './src/app/atlas-canvas-scene';
 import {drawLandscapeGrid} from './src/app/atlas-landscape-view';
 export function run(){
  const canvas=document.createElement('canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:false,preserveDrawingBuffer:true});renderer.setSize(512,512);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.debug.onShaderError=(gl,program)=>{throw Error(gl.getProgramInfoLog(program));};
  const material=new THREE.MeshBasicMaterial({color:'white'}),geometry=new THREE.PlaneGeometry(100,100),scene=new THREE.Scene(),grid=new TerrainHexGrid();
  scene.add(new THREE.Mesh(geometry,material));grid.attach(material);
  const root=atlasPaint('group'),level=atlasPaint('group');level.mapGrid={size:10};root.append(level);grid.set({root});
  const camera=new THREE.OrthographicCamera(-50,50,50,-50,.1,10);camera.position.z=2;camera.updateMatrixWorld();
  const gl=renderer.getContext(),read=(origin={x:0,y:0},ratio=1)=>{grid.update(origin,ratio);renderer.render(scene,camera);const p=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
  try{
   const full=read(),at=(x,y)=>{const ix=Math.floor((x/100+.5)*512),iy=Math.floor((y/100+.5)*512);return full[(iy*512+ix)*4];};
   const centres=[],edges=[];for(let q=-3;q<=3;q++)for(let r=-3;r<=3;r++){
    const x=(q+r/2)*10,y=r*Math.sqrt(3)*5;if(Math.abs(x)>40||Math.abs(y)>40)continue;
    centres.push(at(x,y));edges.push(at(x+5,y));
   }
   const shifted=read({x:10000000,y:Math.sqrt(3)*10000000});let periodicError=0;for(let i=0;i<full.length;i++)periodicError=Math.max(periodicError,Math.abs(full[i]-shifted[i]));
   const tiled=new Uint8Array(full.length);for(let tile=0;tile<2;tile++){
    renderer.setSize(256,512);camera.setViewOffset(512,512,tile*256,0,256,512);const p=read();
    for(let y=0;y<512;y++)tiled.set(p.subarray(y*256*4,(y+1)*256*4),(y*512+tile*256)*4);
   }
   let tileError=0;for(let i=0;i<full.length;i++)tileError=Math.max(tileError,Math.abs(full[i]-tiled[i]));camera.clearViewOffset();renderer.setSize(512,512);
   root.children.length=0;grid.set({root});const hidden=read();
   const fallback=atlasPaint('group');drawLandscapeGrid(fallback,{x:-50,y:-50,width:100,height:100},0,1);const compiled=new AtlasCanvasScene(fallback);
   const adapter=new AtlasSpatialScene(compiled,{x:0,y:0},new Map(),{origin:{x:0,y:0},focusM:0,exaggeration:1,height:()=>0,segment:1});
   const gridObjects=adapter.group.children.length;adapter.dispose();compiled.dispose();
   return {centreMin:Math.min(...centres),edgeMax:Math.max(...edges),periodicError,tileError,hiddenMin:hidden.reduce((a,b)=>Math.min(a,b),255),gridObjects};
  }finally{geometry.dispose();material.dispose();renderer.dispose();renderer.forceContextLoss();}
 }
 `},bundle:true,format:'iife',globalName:'HexGridProbe',write:false}).outputFiles[0].text;
}
