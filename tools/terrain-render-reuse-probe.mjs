import {buildSync} from 'esbuild';
import assert from 'node:assert/strict';

/** Compare retained cursor pixels with the previous fresh-ring algorithm on
 * the same GPU. Separate contexts keep shader lifetime counts independent. */
export function buildRenderReuseProbe(){
 return buildSync({stdin:{resolveDir:process.cwd(),contents:`
  import * as THREE from 'three';
  import {TerrainSpatialView} from './src/app/terrain-spatial-view';
  import {gridHeight} from './src/app/terrain-spatial-model';
  export function run(){
   const make=()=>{const canvas=document.createElement('canvas');Object.defineProperty(canvas,'clientWidth',{value:256});Object.defineProperty(canvas,'clientHeight',{value:256});return new TerrainSpatialView(canvas,1);};
   const actual=make(),reference=make();let ring=null;
   const data=(origin=0,height=200,tilt=0)=>({generation:0,source:'reuse',draft:false,width:2,height:2,pixels:Uint8Array.from(Array(4).fill([216,200,163,255]).flat()),grid:{view:{projection:'perspective',box:{x:origin-2000,y:origin-2000,width:4000,height:4000},frame:{x:origin-1000,y:origin-1000,width:2000,height:2000},columns:33,rows:33,focusM:200,tilt,rotation:0,exaggeration:2},seaLevelM:0,heights:new Float32Array(33*33).fill(height)}});
   const pixels=view=>{const gl=view.renderer.getContext(),bytes=new Uint8Array(256*256*4);gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,bytes);if(gl.getError()!==gl.NO_ERROR)throw Error('Ring GPU read failed');return bytes;};
   const count=view=>{const gl=view.renderer.getContext(),counts={create:0,remove:0};for(const [name,key]of [['createProgram','create'],['deleteProgram','remove']]){const original=gl[name].bind(gl);gl[name]=(...args)=>{counts[key]++;return original(...args);};}return counts;};
   const legacy=(point,radius,g)=>{
    if(ring){reference.scene.remove(ring);ring.geometry.dispose();ring.material.dispose();ring=null;}
    if(point&&radius>0){const origin={x:g.view.frame.x+g.view.frame.width/2,y:g.view.frame.y+g.view.frame.height/2},positions=[];
     for(let i=0;i<=64;i++){const angle=i*Math.PI/32,p={x:point.x+Math.cos(angle)*radius,y:point.y+Math.sin(angle)*radius};positions.push(p.x-origin.x,origin.y-p.y,(gridHeight(g,p)-g.view.focusM)*g.view.exaggeration+g.view.frame.width*.00015);}
     const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));ring=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#a65f30',depthTest:true}));reference.scene.add(ring);
    }reference.render();
   };
   const comparisons=[];
   const compare=name=>{const a=pixels(actual),b=pixels(reference);let mismatch=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])mismatch++;comparisons.push({name,mismatch});};
   try{
    let current=data();actual.setData(data());reference.setData(current);const empty=pixels(actual),a=count(actual),b=count(reference);
    for(let i=0;i<24;i++){const p={x:(i%6-3)*100,y:(Math.floor(i/6)-2)*100},radius=80+i*3;actual.showCursor(p,radius);legacy(p,radius,current.grid);compare('move-'+i);}
    const visible=pixels(actual);let ink=0;for(let i=0;i<visible.length;i+=4)if(visible[i]!==empty[i]||visible[i+1]!==empty[i+1]||visible[i+2]!==empty[i+2])ink++;
    actual.showCursor(null,100);legacy(null,100,current.grid);compare('hidden');
    actual.showCursor({x:0,y:0},180);legacy({x:0,y:0},180,current.grid);compare('shown-again');
    const programs={actual:{...a},legacy:{...b}};
    for(const [name,origin,height,tilt]of [['raised',0,350,0],['tilted',0,350,50],['distant',2**35,200,35],['replaced-surface',0,200,0],['ridge',0,200,65]]){
     current=data(origin,height,tilt);
     if(name==='replaced-surface'){current.width=4;current.pixels=Uint8Array.from(Array(8).fill([216,200,163,255]).flat());}
     if(name==='ridge')for(let y=0;y<33;y++)for(let x=0;x<33;x++)current.grid.heights[y*33+x]=200+600*Math.exp(-(((y-15)/2)**2));
     actual.setData(structuredClone(current));reference.setData(current);
     const p={x:origin+150,y:origin-100};actual.showCursor(p,220);legacy(p,220,current.grid);compare(name);
    }
    return {programs,ink,comparisons};
   }finally{if(ring){reference.scene.remove(ring);ring.geometry.dispose();ring.material.dispose();}actual.dispose();reference.dispose();}
  }
 `},bundle:true,format:'iife',globalName:'RenderReuseProbe',write:false}).outputFiles[0].text;
}
export async function terrainRenderReusePixels(page,script){
 const result=await page.evaluate('(()=>{'+script+';return RenderReuseProbe.run();})()');
 assert(result.ink>50,'the cursor must actually paint visible pixels');
 assert(result.comparisons.every(c=>c.mismatch===0),'retained and fresh ring pixels must match through movement, hiding, height, tilt and rebasing');
 assert.equal(result.programs.actual.create,1,'cursor moves and hide/show keep one GPU program');
 assert.equal(result.programs.actual.remove,0,'cursor program stays alive until view disposal');
 assert(result.programs.legacy.create>=25,'reference reproduces the former program churn');
 return result;
}
