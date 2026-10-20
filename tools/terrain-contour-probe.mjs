import {buildSync} from 'esbuild';
import assert from 'node:assert/strict';

/** Real GPU pixels in the existing isolated Electron window; no product hooks. */
export async function terrainContourPixels(page){
  const source=buildSync({stdin:{resolveDir:process.cwd(),contents:`
    import * as THREE from 'three';
    import {terrainContourMaterial,terrainContourUniforms} from './src/app/terrain-contours';
    export function run(){
      const canvas=document.createElement('canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:false,preserveDrawingBuffer:true});
      renderer.setPixelRatio(1);renderer.setSize(512,512);renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.debug.onShaderError=(gl,program)=>{throw Error(gl.getProgramInfoLog(program));};
      const uniforms=terrainContourUniforms();uniforms.terrainContourInk.value.set('#000000');uniforms.terrainContourSea.value=-10000;
      const material=new THREE.MeshBasicMaterial({color:'#ffffff'});terrainContourMaterial(material,uniforms);
      const geometry=new THREE.PlaneGeometry(2000,2000,2,2),elevations=Float32Array.from({length:9},(_,i)=>geometry.attributes.position.getX(i));
      geometry.setAttribute('terrainElevation',new THREE.BufferAttribute(elevations,1));
      const scene=new THREE.Scene();scene.add(new THREE.Mesh(geometry,material));
      const camera=new THREE.OrthographicCamera(-500,500,500,-500,.1,10);camera.position.z=2;
      const gl=renderer.getContext(),pixels=new Uint8Array(512*4);
      const row=(width,interval)=>{
        camera.left=-width/2;camera.right=width/2;camera.top=width/2;camera.bottom=-width/2;camera.updateProjectionMatrix();
        uniforms.terrainContourInterval.value=interval;renderer.render(scene,camera);gl.readPixels(0,256,512,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        if(gl.getError()!==gl.NO_ERROR)throw Error('Contour GPU read failed');
        return Array.from({length:512},(_,i)=>pixels[i*4]);
      };
      try{
        const measurements=[1000,500,250].map(width=>{
          const colors=row(width,100),center=colors.slice(250,262),at100=Math.round(256+100/width*512);
          return {width,inkPixels:center.filter(v=>v<245).length,centerMinimum:Math.min(...center),height100Minimum:Math.min(...colors.slice(at100-2,at100+2))};
        });
        const disabledMin=Math.min(...row(1000,0)),denseMin=Math.min(...row(1000,.001));
        elevations.forEach((v,i)=>elevations[i]=Math.max(0,v));geometry.attributes.terrainElevation.needsUpdate=true;uniforms.terrainContourSea.value=0;
        const coast=row(1000,100),seaMinimum=Math.min(...coast.slice(0,262));
        return {measurements,disabledMin,denseMin,seaMinimum};
      }finally{geometry.dispose();material.dispose();renderer.dispose();renderer.forceContextLoss();}
    }
  `},bundle:true,format:'iife',globalName:'ContourPixelProbe',write:false}).outputFiles[0].text;
  const result=await page.evaluate(`(()=>{${source}\nreturn ContourPixelProbe.run();})()`);
  for(const m of result.measurements){assert(m.inkPixels>=1&&m.inkPixels<=3,JSON.stringify(m));assert(m.centerMinimum<230);assert(m.height100Minimum<250,'fixed 100 m contour must retain its world height');}
  assert(Math.max(...result.measurements.map(m=>m.inkPixels))-Math.min(...result.measurements.map(m=>m.inkPixels))<=1);
  assert.equal(result.disabledMin,255);assert.equal(result.denseMin,255);assert.equal(result.seaMinimum,255,'the sea plateau must never become a contour');
  return result;
}
