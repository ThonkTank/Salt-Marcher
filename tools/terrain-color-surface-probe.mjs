import {buildSync} from 'esbuild';
import assert from 'node:assert/strict';
export function buildColorSurfaceProbe(){
 return buildSync({stdin:{resolveDir:process.cwd(),contents:`
 import * as THREE from 'three';
 import {TerrainColorSurface} from './src/app/terrain-color-surface';
 import {TerrainSpatialView} from './src/app/terrain-spatial-view';
 import {invalidateColorFrame,colorFrameReference} from './src/app/terrain-color-frame';
 import {sampleRetainedColor} from './tools/terrain-color-reference.mjs';
 export async function run(){
  const renderer=new THREE.WebGLRenderer({canvas:document.createElement('canvas'),antialias:false,preserveDrawingBuffer:true});renderer.setSize(256,256);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.debug.onShaderError=(gl,p)=>{throw Error(gl.getProgramInfoLog(p));};
  const gl=renderer.getContext(),start=performance.now(),owner=new TerrainColorSurface(renderer),prepareIssueMs=performance.now()-start;await owner.ready;const prepareMs=performance.now()-start;
  const bytes=(width,height)=>({pixels:Uint8Array.from({length:width*height*4},(_,i)=>(i*29+Math.floor(i/1007))%256),forest:Uint8Array.from({length:width*height},(_,i)=>i*17%256)});
  const frame=(detail,fill)=>{const {box,width,height}=detail,columns=Math.ceil(width/256),rows=Math.ceil(height/256),tiles=new Map();
   if(fill)for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const rect={x:col*256,y:row*256,width:Math.min(256,width-col*256),height:Math.min(256,height-row*256)},color={pixels:new Uint8Array(rect.width*rect.height*4),forest:new Uint8Array(rect.width*rect.height)};
    for(let y=0;y<rect.height;y++){const at=(rect.y+y)*width+rect.x;color.pixels.set(detail.pixels.subarray(at*4,(at+rect.width)*4),y*rect.width*4);color.forest.set(detail.forest.subarray(at,at+rect.width),y*rect.width);}
    tiles.set(row*columns+col,{rect,color});
   }return {id:{},box,width,height,tiles,coverage:{columns,rows,values:new Uint8Array(columns*rows).fill(255)}};
  };
  const compare=(expected)=>{const target=owner.resident.target,rgba=new Uint8Array(expected.width*expected.height*4),forest=new Uint8Array(expected.width*expected.height);
   renderer.readRenderTargetPixels(target,0,0,expected.width,expected.height,rgba,undefined,0);renderer.readRenderTargetPixels(target,0,0,expected.width,expected.height,forest,undefined,1);
   let mismatch=0,max=0,forestMismatch=0;for(let i=0;i<rgba.length;i++){const d=Math.abs(rgba[i]-expected.pixels[i]);if(d)mismatch++;max=Math.max(max,d);}for(let i=0;i<forest.length;i++)if(forest[i]!==expected.forest[i])forestMismatch++;
   if(gl.getError())throw Error('GPU frame error');return{mismatch,max,forestMismatch};
  };
  const results=[],box={x:-20000000,y:-20000000,width:2048*16384,height:1536*16384},old={box,width:2048,height:1536,...bytes(2048,1536)},original=frame(old,true);
  for(const [name,b]of [['same',box],['pan',{...box,x:box.x+256*16384,y:box.y-256*16384}],['zoom-in',{...box,width:box.width/2,height:box.height/2}],['zoom-out',{...box,width:box.width*2,height:box.height*2}]]){
   const cold=performance.now();owner.update(original);const sourceMs=performance.now()-cold;
   const current=frame({...old,box:b},false);current.previous=colorFrameReference(original);
   if(name==='pan')for(const [key,t]of original.tiles){const x=t.rect.x-256,y=t.rect.y+256;if(x>=0&&y+t.rect.height<=current.height)current.tiles.set(y/256*current.coverage.columns+x/256,{rect:{...t.rect,x,y},color:t.color});}

   const expected={box:b,width:old.width,height:old.height,pixels:new Uint8Array(old.pixels.length),forest:new Uint8Array(old.forest.length)};sampleRetainedColor(expected,old);
   let uploads=0;const upload=gl.texSubImage2D;gl.texSubImage2D=function(...args){uploads++;return upload.apply(gl,args);};
   const begin=performance.now();try{owner.update(current);}finally{gl.texSubImage2D=upload;}const issueMs=performance.now()-begin;results.push({name,sourceMs,issueMs,uploads,...compare(expected)});
   const changed={reset:false,bounds:[{x:b.x+b.width*.52,y:b.y+b.height*.52,width:1,height:1}]},next=invalidateColorFrame(current,changed);
   for(const r of next.clear)for(let y=r.y;y<r.y+r.height;y++){expected.pixels.fill(0,(y*expected.width+r.x)*4,(y*expected.width+r.x+r.width)*4);expected.forest.fill(0,y*expected.width+r.x,y*expected.width+r.x+r.width);}
   const invalidating=performance.now();owner.update(next);results.push({name:name+'-clear',issueMs:performance.now()-invalidating,...compare(expected)});
   const r=next.clear[0],color={pixels:new Uint8Array(r.width*r.height*4).fill(255),forest:new Uint8Array(r.width*r.height).fill(117)},key=r.y/256*next.coverage.columns+r.x/256;next.tiles.set(key,{rect:r,color});
   for(let y=0;y<r.height;y++){expected.pixels.set(color.pixels.subarray(y*r.width*4,(y+1)*r.width*4),((r.y+y)*expected.width+r.x)*4);expected.forest.set(color.forest.subarray(y*r.width,(y+1)*r.width),(r.y+y)*expected.width+r.x);}
   const count=renderer.info.memory.textures,uploading=performance.now();owner.update(next);results.push({name:name+'-upload',issueMs:performance.now()-uploading,newTextures:renderer.info.memory.textures-count,...compare(expected)});
   // Losing a predecessor reconstructs only independently accepted tiles. It
   // must not expose stale pixels from the previously bound image.
   const lost={...next,id:{},previous:{...next.previous,id:{}}};owner.update(lost);
   const restored={...expected,pixels:new Uint8Array(expected.pixels.length),forest:new Uint8Array(expected.forest.length)};
   for(const {rect:r,color}of next.tiles.values())for(let y=0;y<r.height;y++){restored.pixels.set(color.pixels.subarray(y*r.width*4,(y+1)*r.width*4),((r.y+y)*expected.width+r.x)*4);restored.forest.set(color.forest.subarray(y*r.width,(y+1)*r.width),(r.y+y)*expected.width+r.x);}
   results.push({name:name+'-missing-base',...compare(restored)});
  }
  const mpp=1/512,tiny={box:{x:0,y:0,width:4*mpp,height:2*mpp},width:4,height:2,...bytes(4,2)},a=frame(tiny,true);owner.update(a);
  const distant={box:{x:-(2**31)*mpp,y:0,width:4*(2**32)*mpp,height:2*mpp},width:4,height:2,pixels:new Uint8Array(32),forest:new Uint8Array(8)},b=frame(distant,false);b.previous=colorFrameReference(a);sampleRetainedColor(distant,tiny);owner.update(b);results.push({name:'world-to-room-no-integer-wrap',...compare(distant)});
  for(const origin of [-20000000,1e12])for(const scale of [.125,65536])for(const ratio of [.5,2]){
   const original={box:{x:origin,y:origin,width:32*scale,height:24*scale},width:32,height:24,...bytes(32,24)},source=frame(original,true);owner.update(source);
   const expected={box:{x:origin-5.3*scale,y:origin+3*scale,width:36*scale*ratio,height:28*scale*ratio},width:36,height:28,pixels:new Uint8Array(36*28*4),forest:new Uint8Array(36*28)},current=frame(expected,false);current.previous=colorFrameReference(source);sampleRetainedColor(expected,original);owner.update(current);results.push({name:'clipped:'+origin+':'+scale+':'+ratio,...compare(expected)});
  }
  owner.dispose();const textures=renderer.info.memory.textures;renderer.dispose();renderer.forceContextLoss();
  const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:-10000px;top:0;width:192px;height:192px';document.body.append(canvas);
  const view=new TerrainSpatialView(canvas,1);await view.prepareColorFrames();
  const output=view.renderer.getContext(),read=()=>{const bytes=new Uint8Array(192*192*4);output.readPixels(0,0,192,192,output.RGBA,output.UNSIGNED_BYTE,bytes);return bytes;};
  const renderBox={x:-20000000,y:20000000,width:262144,height:262144},detail={box:renderBox,width:512,height:512,...bytes(512,512)},accepted=frame(detail,true),rendered=[];
  for(const tilt of [0,45])for(const tiled of [false,true]){
   const data={generation:0,source:'fixture',draft:false,grid:{view:{box:renderBox,frame:renderBox,columns:33,rows:33,focusM:1000,tilt,rotation:25,exaggeration:1},heights:Float32Array.from({length:1089},(_,i)=>1000+600*Math.sin(i%33/9)*Math.cos(Math.floor(i/33)/7)),seaLevelM:0},pixels:new Uint8Array([230,220,200,255]),forest:new Uint8Array([0]),width:1,height:1};
   view.setData({...data,detail});view.setContours(-1);if(tiled)view.renderTile(384,384,192,0,192,192);const expected=read();
   view.setData(data,accepted);if(tiled)view.renderTile(384,384,192,0,192,192);const actual=read();let max=0,mismatch=0;for(let i=0;i<actual.length;i++){const d=Math.abs(actual[i]-expected[i]);max=Math.max(max,d);if(d)mismatch++;}rendered.push({tilt,tiled,max,mismatch});
  }
  view.dispose();canvas.remove();return{prepareMs,prepareIssueMs,results,textures,rendered,viewTextures:view.renderer.info.memory.textures};
 }
 `},bundle:true,format:'iife',globalName:'ColorSurfaceProbe',write:false}).outputFiles[0].text;
}
export async function terrainColorSurfacePixels(page,probe=buildColorSurfaceProbe()){
 const result=await page.evaluate('(async()=>{'+probe+';return ColorSurfaceProbe.run();})()');
 for(const r of result.results){assert.equal(r.max,0,JSON.stringify(r));assert.equal(r.forestMismatch,0,JSON.stringify(r));if(r.newTextures!==undefined)assert.equal(r.newTextures,0);}
 assert.equal(result.textures,0);assert.equal(result.viewTextures,0);assert.equal(result.results.find(r=>r.name==='pan').uploads,0,'same-lattice pan must reuse GPU pixels of accepted tiles');for(const r of result.rendered)assert(r.max<=1,JSON.stringify(r));return result;
}
