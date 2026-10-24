import test from 'node:test';
import assert from 'node:assert/strict';
import {pigmentStrokeSource} from '../tools/atlas-prototypes/pigment-stroke.mjs';
import {integrateMaterialArea} from '../tools/atlas-prototypes/material-area.mjs';
import {landscapeMaterialBackground,landscapeMaterialLayers,landscapeMaterialCentroidError,landscapeMaterialTriangleEstimate} from '../tools/atlas-prototypes/material-sources.mjs';

const polygons=[{outer:[{x:-2,y:-2},{x:2,y:-2},{x:2,y:2},{x:-2,y:2}],holes:[]}];
const record=(extra={})=>({polygons,points:[{x:0,y:0}],paint:{version:2,tip:'round',radius:1,flow:.4,opacity:.8,seed:19,target:'ground',operation:'paint',color:'#b02080',...extra}});
const triangle=[{x:-4,y:-4},{x:4,y:-4},{x:0,y:4}],center={x:0,y:-4/3};
const lens=d=>2*Math.acos(d/2)-d*Math.sqrt(4-d*d)/2;
function raster(records,width=1,extra={}){
 const background=landscapeMaterialBackground('#718293');
 const layers=landscapeMaterialLayers({colorRecords:records,landColor:'#718293',palette:{water:'#112233'},...extra});
 return integrateMaterialArea({box:{x:-2,y:-2,width:4,height:4},width,height:width,background,layers,centroidErrorBound:landscapeMaterialCentroidError,triangleEstimate:landscapeMaterialTriangleEstimate});
}
function average(result,c){return result.pixels.reduce((s,v,i)=>s+(i%14===c?v:0),0)/(result.pixels.length/14);}
const averageError=result=>result.errorBounds.reduce((s,v)=>s+v,0)/result.errorBounds.length;

test('one disk and 4000 coincident stamps preserve exact stored alpha means',()=>{
 for(const count of [1,2,4000]){
  const source=pigmentStrokeSource(record({strokes:Array.from({length:count},()=>[{x:0,y:0}])}));
  const mean=source.mean(triangle,center),expected=source.alpha({x:0,y:0})*Math.PI/32;
  assert.ok(mean.mean[0]<=expected&&expected<=mean.mean[1]);
  assert.ok(mean.mean[1]-mean.mean[0]<1e-8);
 }
});
test('overlapping distinct disks enclose the analytic lens mean without independence assumptions',()=>{
 const source=pigmentStrokeSource(record({strokes:[[{x:-.25,y:0}],[{x:.25,y:0}]]}));
 const one=source.alpha({x:-1,y:0}),two=source.alpha({x:0,y:0});
 const expected=(one*(2*Math.PI-2*lens(.5))+two*lens(.5))/32;
 const {mean}=source.mean(triangle,center);
 assert.ok(mean[0]<=expected&&expected<=mean[1]);
 const r=raster([record({strokes:[[{x:-.25,y:0}],[{x:.25,y:0}]]})],16);
 assert.ok(Math.abs(average(r,8)-expected*2)<=averageError(r)+1e-12);
});
test('unequal repeated groups retain their joint count and final byte rounding',()=>{
 for(const flow of [.1,.13,.49,.93]){
  const strokes=[...Array.from({length:7},()=>[{x:-.25,y:0}]),...Array.from({length:3},()=>[{x:.25,y:0}])];
  const source=pigmentStrokeSource(record({flow,strokes}));
  const left=source.alpha({x:-1,y:0}),right=source.alpha({x:1,y:0}),both=source.alpha({x:0,y:0});
  const expected=((left+right)*(Math.PI-lens(.5))+both*lens(.5))/32;
  const {mean}=source.mean(triangle,center);
  assert.ok(mean[0]<=expected&&expected<=mean[1],`flow ${flow}: ${mean} misses ${expected}`);
 }
});
test('full round tile meets original budgets with analytic area instead of boundary subdivision',()=>{
 const r=raster([record({flow:1,opacity:1})],256);
 assert.ok(Math.abs(average(r,8)-Math.PI/16)<=averageError(r)+1e-12);
 assert.ok(Math.max(...r.errorBounds)<=1/255);
 assert.ok(r.stats.estimateBounds>0&&r.stats.work<2000000);
 assert.ok(r.stats.peakPendingTriangles<65536);
});
test('paint then erase and reverse order retain their different analytic results',()=>{
 const a=record({flow:.7,opacity:.9}),b=record({flow:.4,opacity:.6,operation:'erase'});
 b.points=[{x:.5,y:0}];
 const aa=pigmentStrokeSource(a).alpha({x:0,y:0}),ab=pigmentStrokeSource(b).alpha({x:.5,y:0});
 const forward=raster([a,b],16),reverse=raster([b,a],16);
 assert.ok(Math.abs(average(forward,8)-(aa*Math.PI-aa*ab*lens(.5))/16)<=averageError(forward)+1e-12);
 assert.ok(Math.abs(average(reverse,8)-aa*Math.PI/16)<=averageError(reverse)+1e-12);
 assert.ok(average(reverse,8)>average(forward,8)+.01);
});
test('mixed round, soft, textured and cover sources retain all material channels',()=>{
 const records=[record(),record({tip:'soft',flow:.2,opacity:.5,color:'#229911'}),record({tip:'textured',flow:.3,opacity:.6,operation:'erase'})];
 const coverRecords=[{polygons,vegetation:{preset:{ground:'#ccbbaa',density:.5,edge:.4}}}];
 const options={coverRecords,edgePolicy:'authored-world'};
 const r=raster(records,16,options);
 const background=landscapeMaterialBackground('#718293');
 const layers=landscapeMaterialLayers({colorRecords:records,landColor:'#718293',palette:{water:'#112233'},...options});
 const sample=n=>{
  const sum=Array(14).fill(0);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const point={x:-2+(x+.5)*4/n,y:-2+(y+.5)*4/n},v=[...background];
   // This rectangle cover has several feather regions; sample the source
   // directly through its polygon-gated adapter in a separate reference below.
   const t=Math.min(1,(2-Math.max(Math.abs(point.x),Math.abs(point.y)))/.4),a=.78*t*t*(3-2*t);
   for(let c=0;c<3;c++)v[c]=[.8,187/255,170/255][c]*a+v[c]*(1-a);
   v[4]=.625*t;v[13]=.5;for(let c=0;c<4;c++)v[9+c]=v[c];
   for(const layer of layers.filter(l=>l.discontinuous))layer.paint(v,point);
   for(let c=0;c<14;c++)sum[c]+=v[c]/(n*n);
  }
  return sum;
 };
 const coarse=sample(384),fine=sample(768),bound=averageError(r);
 for(let c=0;c<14;c++){
  const delta=Math.abs(fine[c]-coarse[c]);assert.ok(delta<.0003);
  assert.ok(Math.abs(average(r,c)-fine[c])<=bound+delta+1e-8,`channel ${c}`);
 }
});
