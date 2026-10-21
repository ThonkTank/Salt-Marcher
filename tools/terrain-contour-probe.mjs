import {buildSync} from 'esbuild';
import assert from 'node:assert/strict';

/** Real GPU pixels in the existing isolated Electron window; no product hooks. */
export async function terrainContourPixels(page){
  const source=buildSync({stdin:{resolveDir:process.cwd(),contents:`
    import * as THREE from 'three';
    import {terrainContourMaterial,terrainContourUniforms} from './src/app/terrain-contours';
    import {terrainContourInk} from './src/app/terrain-contour-style';
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
        const automatic=[.25,4,64,1000].map(width=>{
          const colors=row(width,-1),gradient=width/512;
          const expected=colors.map((_,i)=>{
            const ink=terrainContourInk(((i+.5)/512-.5)*width,gradient,-1,-10000);
            return Math.round(new THREE.Color(1-ink,1-ink,1-ink).convertLinearToSRGB().r*255);
          });
          return {width,inkPixels:colors.filter(v=>v<250).length,maxError:Math.max(...colors.map((v,i)=>Math.abs(v-expected[i])))};
        });
        const highDpi=[];
        for(const ratio of [1,1.5,2])for(const width of [250,1000]){
          renderer.setPixelRatio(ratio);renderer.setSize(512,512);uniforms.terrainContourPixelRatio.value=ratio;
          camera.left=-width/2;camera.right=width/2;camera.top=width/2;camera.bottom=-width/2;camera.updateProjectionMatrix();
          renderer.render(scene,camera);const size=512*ratio,values=new Uint8Array(size*4);gl.readPixels(0,size/2,size,1,gl.RGBA,gl.UNSIGNED_BYTE,values);
          let maxError=0;for(let i=0;i<size;i++){
            const ink=terrainContourInk(((i+.5)/size-.5)*width,width/size,-1,-10000,ratio),expected=Math.round(new THREE.Color(1-ink,1-ink,1-ink).convertLinearToSRGB().r*255);
            maxError=Math.max(maxError,Math.abs(values[i*4]-expected));
          }
          highDpi.push({ratio,width,maxError});
        }
        renderer.setPixelRatio(1);renderer.setSize(512,512);uniforms.terrainContourPixelRatio.value=1;
        const full=row(1000,-1),tiled=[];
        for(let tile=0;tile<2;tile++){
          renderer.setSize(256,512);camera.setViewOffset(512,512,tile*256,0,256,512);renderer.render(scene,camera);
          gl.readPixels(0,256,256,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
          tiled.push(...Array.from({length:256},(_,i)=>pixels[i*4]));
        }
        camera.clearViewOffset();renderer.setSize(512,512);
        const tileError=Math.max(...full.map((v,i)=>Math.abs(v-tiled[i])));
        elevations.forEach((v,i)=>elevations[i]=Math.max(0,v));geometry.attributes.terrainElevation.needsUpdate=true;uniforms.terrainContourSea.value=0;
        const coast=row(1000,100),seaMinimum=Math.min(...coast.slice(0,262));
        const automaticSeaMinimum=Math.min(...row(1000,-1).slice(0,256));
        return {measurements,automatic,highDpi,tileError,disabledMin,denseMin,seaMinimum,automaticSeaMinimum};
      }finally{geometry.dispose();material.dispose();renderer.dispose();renderer.forceContextLoss();}
    }
  `},bundle:true,format:'iife',globalName:'ContourPixelProbe',write:false}).outputFiles[0].text;
  const result=await page.evaluate(`(()=>{${source}\nreturn ContourPixelProbe.run();})()`);
  for(const m of result.measurements){assert(m.inkPixels>=1&&m.inkPixels<=3,JSON.stringify(m));assert(m.centerMinimum<230);assert(m.height100Minimum<250,'fixed 100 m contour must retain its world height');}
  assert(Math.max(...result.measurements.map(m=>m.inkPixels))-Math.min(...result.measurements.map(m=>m.inkPixels))<=1);
  assert.equal(result.disabledMin,255);assert.equal(result.denseMin,255);assert.equal(result.seaMinimum,255,'the sea plateau must never become a contour');
  for(const m of result.automatic){assert(m.inkPixels>0&&m.inkPixels<=170,JSON.stringify(m));assert(m.maxError<=2,JSON.stringify(m));}
  for(const m of result.highDpi)assert(m.maxError<=2,JSON.stringify(m));
  assert(result.tileError<=1,'export tiles must preserve the full-image intervals and blending');assert.equal(result.automaticSeaMinimum,255);
  return result;
}
