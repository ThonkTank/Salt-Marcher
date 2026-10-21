import {buildSync} from 'esbuild';
import assert from 'node:assert/strict';

/** Actual GPU pixels and upload commands, inside the owned native session. */
export function buildDetailProbe(){
 return buildSync({stdin:{resolveDir:process.cwd(),contents:`
  import * as THREE from 'three';
  import {TerrainDetailMaterial} from './src/app/terrain-detail-material';
  import {TerrainSpatialView} from './src/app/terrain-spatial-view';
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
      for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)pixels.set([x%256,y%256,35,r.height===17?[0,128,255][(x+y)%3]:255],(y*512+x)*4);
      uploads=[];const start=performance.now();update([r]);renderer.render(scene,camera);gl.finish();const ms=performance.now()-start,calls=uploads.slice(),partial=read();
      update();renderer.render(scene,camera);const full=read();let mismatch=0,changed=0;for(let i=0;i<full.length;i++){if(partial[i]!==full[i])mismatch++;if(partial[i]!==before[i])changed++;}
      patches.push({rect:r,ms,calls,mismatch,changed,textureCount:renderer.info.memory.textures});
     }
     result.push({layer,mode,textureCount,patches});scene.remove(mesh);owner.dispose();material.dispose();base.dispose();
    }
    const base=new THREE.DataTexture(new Uint8Array([230,220,200,255]),1,1);base.colorSpace=THREE.SRGBColorSpace;base.needsUpdate=true;
    const material=new THREE.MeshBasicMaterial({map:base}),owner=new TerrainDetailMaterial(renderer),mesh=new THREE.Mesh(geometry,material);scene.add(mesh);
    const world={x:-1000,y:500,width:512,height:512},pixels=new Uint8Array(512*512*4);
    for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(x<128||x>=384||y<128||y>=384)pixels.set([20,160,80,255],(y*512+x)*4);
    const values=Uint8Array.from({length:16},(_,i)=>i%4>0&&i%4<3&&i/4>=1&&i/4<3?0:255);
    const detail={box:world,width:512,height:512,pixels,coverage:{columns:4,rows:4,values}},data={grid:{view:{box:world}},detail};
    const pixel=(bytes,x,y)=>Array.from(bytes.slice((y*256+x)*4,(y*256+x+1)*4));
    owner.update(material,data);renderer.render(scene,camera);const before=read(),textures=renderer.info.memory.textures;
    const small=new Uint8Array(8*8*4);for(let i=0;i<small.length;i+=4)small.set([180,50,30,255],i);
    owner.update(material,{...data,brushDetail:{box:{x:world.x+128,y:world.y+128,width:256,height:256},width:8,height:8,pixels:small}});
    renderer.render(scene,camera);const composed=read(),during=renderer.info.memory.textures;
    owner.update(material,data);renderer.render(scene,camera);const cleared=read();
    const brush={before:pixel(before,128,128),confirmed:pixel(composed,128,128),unaffected:pixel(composed,24,24),cleared:pixel(cleared,128,128),textures,during,after:renderer.info.memory.textures,sourceBytes:small.byteLength};
    scene.remove(mesh);owner.dispose();material.dispose();base.dispose();
    const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:-1000px;top:0;width:256px;height:256px;pointer-events:none;';document.body.append(canvas);
    const view=new TerrainSpatialView(canvas,1),context=view.renderer.getContext(),sub=context.texSubImage2D.bind(context),productUploads=[];
    try{
      view.setData({generation:0,source:'probe',draft:false,width:16,height:16,pixels:new Uint8Array(16*16*4).fill(255),grid:{view:{box:world,frame:world,columns:2,rows:2,focusM:0,tilt:0,rotation:0,exaggeration:1},heights:new Float32Array(4),seaLevelM:0},detail});
      context.texSubImage2D=(...args)=>{productUploads.push({width:args[4],height:args[5]});return sub(...args);};
      // Ignore the small coverage-mask upload: the actual world colour must
      // use one rectangle rather than one command for every scanline.
      view.setDetail({...detail,coverage:undefined},[{x:128,y:128,width:256,height:256}]);
    }finally{context.texSubImage2D=sub;view.dispose();canvas.remove();}
    return {uploads:result,brush,productUploads};
   }finally{gl.texSubImage2D=original;geometry.dispose();renderer.dispose();renderer.forceContextLoss();}
  }
 `},bundle:true,format:'iife',globalName:'DetailPixelProbe',write:false}).outputFiles[0].text;
}
export async function terrainDetailPixels(page,source=buildDetailProbe()){
 const result=await page.evaluate(`(()=>{${source}\nreturn DetailPixelProbe.run();})()`);
 for(const row of result.uploads)for(const p of row.patches){assert.equal(p.mismatch,0,'partial output must equal a full texture upload');assert(p.changed>0);assert.equal(p.textureCount,row.textureCount,'CPU source must not allocate another GPU texture');assert.equal(p.calls.length,row.mode==='rows'?p.rect.height:1);}
 const near=(actual,expected)=>actual.forEach((v,i)=>assert(Math.abs(v-expected[i])<=1,JSON.stringify({actual,expected})));
 near(result.brush.before,[230,220,200,255]);near(result.brush.confirmed,[180,50,30,255]);near(result.brush.unaffected,[20,160,80,255]);near(result.brush.cleared,[230,220,200,255]);
 assert.equal(result.brush.during,result.brush.textures+1);assert.equal(result.brush.after,result.brush.textures);assert.equal(result.brush.sourceBytes,256);
 assert.deepEqual(result.productUploads,[{width:256,height:256}],'the actual camera constructor must enable rectangular uploads');
 return result;
}
