import {buildSync} from 'esbuild';
import assert from 'node:assert/strict';

/** Actual GPU pixels and upload commands, inside the owned native session. */
export async function terrainDetailPixels(page){
 const source=buildSync({stdin:{resolveDir:process.cwd(),contents:`
  import * as THREE from 'three';
  import {TerrainDetailMaterial} from './src/app/terrain-detail-material';
  import {uploadTerrainTexture} from './src/app/terrain-texture-upload';
  export function run(){
   const renderer=new THREE.WebGLRenderer({canvas:document.createElement('canvas'),antialias:false,preserveDrawingBuffer:true});renderer.setSize(256,256);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
   renderer.debug.onShaderError=(gl,program)=>{throw Error(gl.getProgramInfoLog(program));};
   const gl=renderer.getContext(),original=gl.texSubImage2D.bind(gl);let uploads=[];
   gl.texSubImage2D=(...args)=>{uploads.push({width:args[4],height:args[5]});return original(...args);};
   const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;
   const scene=new THREE.Scene(),geometry=new THREE.PlaneGeometry(2,2),box={x:0,y:0,width:512,height:512},result=[];
   const read=()=>{const bytes=new Uint8Array(256*256*4);gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,bytes);if(gl.getError()!==gl.NO_ERROR)throw Error('Detail upload GPU error');return bytes;};
   try{
    for(const layer of ['detail','ground'])for(const mode of ['rows','rectangles']){
     const base=new THREE.DataTexture(new Uint8Array([230,220,200,255]),1,1);base.colorSpace=THREE.SRGBColorSpace;base.needsUpdate=true;
     const material=new THREE.MeshBasicMaterial({map:base}),owner=new TerrainDetailMaterial(mode==='rectangles'?renderer:undefined),mesh=new THREE.Mesh(geometry,material);scene.add(mesh);
     const pixels=new Uint8Array(512*512*4);for(let i=0;i<pixels.length;i+=4)pixels.set([100,140,180,255],i);
     const detail={box,width:512,height:512,pixels},data={grid:{view:{box}},detail};
     const update=rects=>{if(layer==='detail')owner.update(material,data,rects);else{base.image={data:pixels,width:512,height:512};uploadTerrainTexture(base,rects,mode==='rectangles'?renderer:undefined);}};
     update();renderer.render(scene,camera);const before=read(),textureCount=renderer.info.memory.textures;
     const patches=[];
     for(const r of [{x:128,y:128,width:256,height:256},{x:3,y:401,width:31,height:17}]){
      for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)pixels.set([x%256,y%256,35,255],(y*512+x)*4);
      uploads=[];const start=performance.now();update([r]);renderer.render(scene,camera);gl.finish();const ms=performance.now()-start,calls=uploads.slice(),partial=read();
      update();renderer.render(scene,camera);const full=read();let mismatch=0,changed=0;for(let i=0;i<full.length;i++){if(partial[i]!==full[i])mismatch++;if(partial[i]!==before[i])changed++;}
      patches.push({rect:r,ms,calls,mismatch,changed,textureCount:renderer.info.memory.textures});
     }
     result.push({layer,mode,textureCount,patches});scene.remove(mesh);owner.dispose();material.dispose();base.dispose();
    }
    return result;
   }finally{gl.texSubImage2D=original;geometry.dispose();renderer.dispose();renderer.forceContextLoss();}
  }
 `},bundle:true,format:'iife',globalName:'DetailPixelProbe',write:false}).outputFiles[0].text;
 const result=await page.evaluate(`(()=>{${source}\nreturn DetailPixelProbe.run();})()`);
 for(const row of result)for(const p of row.patches){assert.equal(p.mismatch,0,'partial output must equal a full texture upload');assert(p.changed>0);assert.equal(p.textureCount,row.textureCount,'CPU source must not allocate another GPU texture');assert.equal(p.calls.length,row.mode==='rows'?p.rect.height:1);}
 return result;
}
