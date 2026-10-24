import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import polygonClipping from 'polygon-clipping';
import {integrateMaterialArea,rectangle} from '../tools/atlas-prototypes/material-area.mjs';
import {landscapeMaterialBackground,landscapeMaterialCentroidError,landscapeMaterialLayers} from '../tools/atlas-prototypes/material-sources.mjs';

const landColor='#808080';
const palette={water:'#2040c0',plains:'#808080',forest:'#408040'};
const ring=(x0,y0,x1,y1)=>[{outer:[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}],holes:[]}];
const record=(id,polygons,paint)=>({id,revision:0,kind:'color',name:id,points:[],polygons,paint});
const opts={palette,landColor};
const makeLayers=(colorRecords,more={})=>landscapeMaterialLayers({...opts,colorRecords,...more});
const run=(box,layers,extra={})=>integrateMaterialArea({box,width:1,height:1,background:landscapeMaterialBackground(landColor),layers,centroidErrorBound:landscapeMaterialCentroidError,tolerance:1/255,...extra});
const full=ring(0,0,1,1);
const strokeRecord=(id,{color='#ff0000',tip='round',radius=2,flow=.5,opacity=.8,target='ground',operation='paint',strokes=[[{x:.5,y:.5}]]}={})=>record(id,full,{version:2,tip,radius,flow,opacity,seed:2,target,operation,color,strokes});
const close=(actual,expected,tolerance,label)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: ${actual} vs ${expected}`);

test('a single round v2 stamp integrates to its analytic circle coverage',()=>{
 const radius=.25,flow=.5,opacity=.8,color='#ff0000';
 const stroke=strokeRecord('round',{radius,flow,opacity});
 const result=run({x:0,y:0,width:1,height:1},makeLayers([stroke]));
 const alpha=Math.round(255*Math.fround(flow))/255*opacity;
 const expected=[128/255+Math.PI*radius*radius*alpha*(1-128/255),128/255*(1-Math.PI*radius*radius*alpha),128/255*(1-Math.PI*radius*radius*alpha)];
 for(let c=0;c<3;c++){
  close(result.pixels[9+c],expected[c],result.errorBounds[0]+1e-12,`channel ${c}, reported integration error ${result.errorBounds[0]}`);
  close(result.pixels[9+c],expected[c],1/255,`channel ${c} default tolerance`);
 }
});

test('v2 paint and erase compose in authored order',()=>{
 const paint=strokeRecord('paint',{flow:.8,opacity:.8,strokes:[[{x:.5,y:.5}]]});
 const erase=strokeRecord('erase',{flow:.5,opacity:.7,operation:'erase',color:'#000000',strokes:[[{x:.5,y:.5}]]});
 const forward=run({x:0,y:0,width:1,height:1},makeLayers([paint,erase])).pixels;
 const reverse=run({x:0,y:0,width:1,height:1},makeLayers([erase,paint])).pixels;
 assert.ok(forward[11]>reverse[11]+.1,`expected order-sensitive blue channel: ${forward[11]} vs ${reverse[11]}`);
 close(forward[12],1,1e-12,'opaque base remains opaque');
});

test('water-target pigment changes water while preserving dry forest semantics',()=>{
 const box={x:0,y:0,width:1,height:1},water=ring(0,0,.5,1);
 const base={id:'forest',revision:0,kind:'patch',name:'forest',points:[],polygons:full,resolution:1,width:1,values:{terrain:'forest'}};
 const cover={...base,kind:'vegetation',vegetation:{preset:{ground:'#408040',density:.8,edge:0},edits:[]}};
 const paint=strokeRecord('water-paint',{flow:1,opacity:1,target:'water',strokes:[[{x:.5,y:.5}]]});
 const pixel=run(box,makeLayers([paint],{baseRecords:[base],coverRecords:[cover],waterGeometry:water})).pixels;
 assert.ok(pixel[9]>.6,`water-target pigment should raise the red channel, got ${pixel[9]}`);
 close(pixel[4],.5,1e-12,'forest semantic channel only covers dry half');
});

test('soft and textured point opacity agrees with the independent production raster coverage',async()=>{
 const out=resolve('.build/atlas-material-v2-coverage.mjs');await mkdir(resolve('.build'),{recursive:true});
 const built=await build({entryPoints:['src/app/landscape-pigment-coverage.ts'],bundle:true,platform:'node',format:'esm',write:false});
 await writeFile(out,built.outputFiles[0].contents);
 const production=await import(pathToFileURL(out).href+`?v2=${Date.now()}`);
 for(const tip of ['soft','textured']){
  const pigment=record(tip,full,{version:2,tip,radius:.24,flow:.63,opacity:.77,seed:1927,target:'ground',operation:'paint',color:'#d02080',strokes:[[{x:.37,y:.44},{x:.61,y:.53}],[{x:.55,y:.62}]]});
  const layer=makeLayers([pigment])[0],mask=new Uint8Array(4);mask[3]=255;
  for(const [x,y] of [[.5,.5],[.375,.5],[.625,.625],[.875,.875]]){
   const raster=production.pigmentStrokeCoverage({x:x-5e-7,y:y-5e-7,width:1e-6,height:1e-6},1,1,pigment,mask,function*(){}).next().value;
   const vector=landscapeMaterialBackground(landColor);layer.paint(vector,{x,y});
   const expected=Math.round(255*raster[0])/255*pigment.paint.opacity;
   close(vector[8],expected,1e-12,`${tip} opacity at ${x},${y}`);
  }
 }
});

test('final-channel bounds contain dense ranges and means for cover and multiple v2 strokes',()=>{
 const stroke=record('texture',full,{version:2,tip:'textured',radius:.38,flow:.72,opacity:.81,seed:44,target:'ground',operation:'paint',color:'#d02080',strokes:[[{x:.42,y:.48},{x:.65,y:.5}]]});
 const erase=record('second-stroke',full,{version:2,tip:'soft',radius:.31,flow:.58,opacity:.62,seed:91,target:'ground',operation:'erase',color:'#302080',strokes:[[{x:.57,y:.42},{x:.69,y:.61}]]});
 const canopy={id:'canopy',revision:0,kind:'vegetation',name:'canopy',points:[],polygons:[{...full[0],holes:[ring(.8,.8,.95,.95)[0].outer]}],vegetation:{preset:{ground:'#568044',density:.7,edge:.4},edits:[]}};
 const layers=makeLayers([stroke,erase],{coverRecords:[canopy],edgePolicy:'authored-world'});
 // The hole keeps the cover in its general single-region path. Every triangle
 // is wholly inside the same arrangement face and crosses actual pigment.
 const triangles=[
  [{x:.38,y:.41},{x:.415,y:.41},{x:.38,y:.445}],
  [{x:.49,y:.46},{x:.56,y:.46},{x:.49,y:.53}],
  [{x:.58,y:.5},{x:.69,y:.5},{x:.58,y:.61}],
 ];
 const n=120;
 for(const tri of triangles.slice(0,3)){
  const geom=[[[...tri.map(q=>[q.x,q.y]),[tri[0].x,tri[0].y]]]];
  for(const layer of layers)assert.deepEqual(polygonClipping.difference(geom,layer.geometry),[], 'triangle must lie wholly in every selected layer');
  const active=layers;
  const center={x:(tri[0].x+tri[1].x+tri[2].x)/3,y:(tri[0].y+tri[1].y+tri[2].y)/3};
  const context={background:landscapeMaterialBackground(landColor),evaluateCenter(){const v=[...this.background];for(const l of active)l.paint(v,center);return v;}};
  const bound=landscapeMaterialCentroidError(active,tri,context),centerValue=context.evaluateCenter();
  assert.ok(Number.isFinite(bound)&&bound>=0);
  const sum=Array(14).fill(0),min=Array(14).fill(Infinity),max=Array(14).fill(-Infinity);let samples=0;
  for(let orientation=0;orientation<2;orientation++)for(let i=0;i<n;i++)for(let j=0;j<n-i-orientation;j++){
   // Centroids of both orientations in a complete n² equal-area triangulation.
   const u=(i+(orientation?2/3:1/3))/n,v=(j+(orientation?2/3:1/3))/n;
   const p={x:tri[0].x+(tri[1].x-tri[0].x)*u+(tri[2].x-tri[0].x)*v,y:tri[0].y+(tri[1].y-tri[0].y)*u+(tri[2].y-tri[0].y)*v};
   const value=[...context.background];for(const l of active)l.paint(value,p);
   for(let c=0;c<value.length;c++){sum[c]+=value[c];min[c]=Math.min(min[c],value[c]);max[c]=Math.max(max[c],value[c]);}samples++;
  }
  assert.equal(samples,n*n);
  assert.ok(max[8]>min[8], 'probe must contain varying composed pigment alpha');
  for(let c=0;c<sum.length;c++){
   assert.ok(min[c]>=centerValue[c]-bound-1e-12&&max[c]<=centerValue[c]+bound+1e-12,`channel ${c} sample range escapes bound ${bound}`);
   close(centerValue[c],sum[c]/samples,bound+1/samples,`channel ${c} sampled triangle mean`);
  }
 }
});

test('unknown discontinuous material descriptors fail closed',()=>{
 const bad={geometry:rectangle(0,0,1,1),varying:true,discontinuous:true,paint(v){v[0]=1;}};
 assert.throws(()=>integrateMaterialArea({box:{x:0,y:0,width:1,height:1},width:1,height:1,background:[0],layers:[bad],centroidErrorBound:landscapeMaterialCentroidError}),/Unknown material interval operation/);
});
