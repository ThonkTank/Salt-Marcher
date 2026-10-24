import test from 'node:test';
import assert from 'node:assert/strict';
import {integrateMaterialArea} from '../tools/atlas-prototypes/material-area.mjs';
import {landscapeMaterialBackground,landscapeMaterialLayers} from '../tools/atlas-prototypes/material-sources.mjs';
import {materialIntervalError} from '../tools/atlas-prototypes/material-interval.mjs';
import {pigmentStrokeSource} from '../tools/atlas-prototypes/pigment-stroke.mjs';

const polygon=(x0,y0,x1,y1)=>[{outer:[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}],holes:[]}];
const next=(value,direction)=>{
 const data=new DataView(new ArrayBuffer(8));
 if(value===0)return direction*Number.MIN_VALUE;
 data.setFloat64(0,value);let bits=data.getBigUint64(0);
 bits+=(value>0)===(direction>0)?1n:-1n;data.setBigUint64(0,bits);return data.getFloat64(0);
};
const cell=(x,radius)=>Math.floor(x/radius*24);
const record=(radius,seed,strokes)=>({points:[],polygons:polygon(-100,-100,100,100),paint:{version:2,tip:'textured',radius,flow:.7,opacity:1,seed,strokes}});

test('textured cuts bracket texture hashes at signed and large coordinates',()=>{
 for(const [radius,boundary] of [[1,7], [1,-7], [.37,12], [3.25,-19]]){
  const x=boundary/24*radius;
  const source=pigmentStrokeSource(record(radius,91,[[{x:0,y:0}]]));
  const tri=[{x:x-1e-9,y:0},{x:x+1e-9,y:0},{x:x-1e-9,y:1e-12}];
  const cut=source.integrationCut(tri);
  assert.ok(cut&&cut.axis==='x',`expected x texture cut near ${x}`);
  assert.ok(cut.value>Math.min(...tri.map(p=>p.x))&&cut.value<Math.max(...tri.map(p=>p.x)));
  assert.ok(cell(cut.value,radius)<boundary,'first cut remains on the lower hash side of the retained uncertainty strip');
 }
 const radius=.125, x=1_000_000_000.25, boundary=Math.floor(x/radius*24)+1, edge=boundary/24*radius;
 const source=pigmentStrokeSource(record(radius,91,[[{x:1_000_000_000,y:0}]]));
 const tri=[{x:edge-1e-3,y:0},{x:edge+1e-3,y:0},{x:edge-1e-3,y:1e-8}];
 const cut=source.integrationCut(tri);
 assert.ok(cut&&cut.axis==='x','large-coordinate adjacent-float bracket remains cuttable');
});

test('texture boundary ranges stay conservative, while same-cell interiors stay constant',()=>{
 const source=pigmentStrokeSource(record(1,17,[[{x:0,y:0}]]));
 const inside=[{x:.315,y:.315},{x:.315,y:.315},{x:.315,y:.315}];
 const range=source.alphaRange(inside);
 assert.equal(range[0],range[1]);
 assert.equal(range[0],source.alpha({x:.315,y:.315}));
 const edge=4/24, crossing=[{x:edge-1e-9,y:.1},{x:edge+1e-9,y:.1},{x:edge-1e-9,y:.2}];
 const [lo,hi]=source.alphaRange(crossing);
 assert.ok(lo<hi,'the transition strip retains a range instead of being smoothed');
 for(const x of [edge-5e-10,edge,edge+5e-10]){
  const a=source.alpha({x,y:.15});assert.ok(a>=lo&&a<=hi);
 }
 const other=pigmentStrokeSource(record(1,18,[[{x:0,y:0}]]));
 assert.notEqual(other.alpha({x:.315,y:.315}),source.alpha({x:.315,y:.315}),'texture seed continues to select the existing hash');
});

test('adapter texture cuts preserve small-fixture area integration within reported error',()=>{
 const box={x:0,y:0,width:.12,height:.12},radius=.08;
 const r={...record(radius,123,[[{x:.06,y:.06}]]),polygons:polygon(0,0,.12,.12),
  paint:{...record(radius,123,[[{x:.06,y:.06}]]).paint,operation:'paint',color:'#c04080',target:'ground'}};
 const args={colorRecords:[r],palette:{water:'#3265a0'},landColor:'#809060'};
 const layers=landscapeMaterialLayers(args);
 const pigmentLayer=layers.find(layer=>layer.discontinuous);
 assert.ok(pigmentLayer?.integrationCut&&typeof pigmentLayer.materialRange==='function');
 const background=landscapeMaterialBackground('#809060');
 const color=[0xc0/255,0x40/255,0x80/255];
 const stroke=pigmentStrokeSource(r);
 // This budget override keeps the conservative cell-error comparison small
 // enough for a focused diagnostic; default-budget qualification is separate.
 const baseline={box,width:1,height:1,background,layers,tolerance:.2,
  centroidErrorBound:materialIntervalError,limits:{work:2000000,pendingTriangles:250000}};
 const cut=integrateMaterialArea(baseline);
 const noCut=integrateMaterialArea({...baseline,layers:layers.map(layer=>({...layer,integrationCut:undefined}))});
 assert.ok(cut.stats.sourceCuts>0);
 for(const channel of [5,6,7,8,9,10,11]){
  const difference=Math.abs(cut.pixels[channel]-noCut.pixels[channel]);
  assert.ok(difference<=cut.errorBounds[0]+noCut.errorBounds[0],
   `channel ${channel} difference ${difference} exceeds combined bounds ${cut.errorBounds[0]} + ${noCut.errorBounds[0]}`);
 }
 assert.ok(cut.pixels[8]>0&&cut.pixels[8]<1,'integrated pigment alpha is nonzero and spatially partial');
 assert.ok(cut.pixels[5]>0&&cut.pixels[6]>0&&cut.pixels[7]>0,'integrated pigment color channels are present');
 assert.ok(cut.pixels[9]!==background[9]&&cut.pixels[10]!==background[10]&&cut.pixels[11]!==background[11],
  'pigment changes all final RGB channels');

 const dense=resolution=>{
  const sums=new Array(8).fill(0),count=resolution*resolution;
  for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
   const alpha=stroke.alpha({x:box.x+(x+.5)/resolution*box.width,y:box.y+(y+.5)/resolution*box.height});
   const overlay=color.map(channel=>channel*alpha);
   sums[0]+=overlay[0];sums[1]+=overlay[1];sums[2]+=overlay[2];sums[3]+=alpha;
   for(let c=0;c<3;c++)sums[4+c]+=color[c]*alpha+background[9+c]*(1-alpha);
   sums[7]+=1;
  }
  return sums.slice(0,7).map(value=>value/count);
 };
 const coarse=dense(256),fine=dense(512);
 for(const [index,channel] of [[0,5],[1,6],[2,7],[3,8],[4,9],[5,10],[6,11]]){
  const samplingDelta=Math.abs(fine[index]-coarse[index]);
  const integrationDelta=Math.abs(cut.pixels[channel]-fine[index]);
  assert.ok(integrationDelta<=cut.errorBounds[0]+samplingDelta,
   `channel ${channel} value ${cut.pixels[channel]} differs from dense scalar estimate ${fine[index]} by ${integrationDelta}; bound ${cut.errorBounds[0]} plus observed grid delta ${samplingDelta}`);
 }
});

test('a sub-guard texture transition retains its interval instead of requesting an unstable cut',()=>{
 const radius=.7,boundary=13/24*radius;
 let lo=boundary,hi=boundary;for(let i=0;i<8;i++){lo=next(lo,-1);hi=next(hi,1);}
 const source=pigmentStrokeSource(record(radius,42,[[{x:boundary,y:.2}]]));
 const triangle=[{x:lo,y:.201},{x:hi,y:.201},{x:lo,y:.202}];
 // y lies in one texture cell; x is narrower than the round-trip guard.
 assert.equal(source.integrationCut(triangle),undefined);
 const [min,max]=source.alphaRange(triangle);
 assert.ok(max>min);
 for(const point of [...triangle,{x:boundary,y:.2015}]){
  const value=source.alpha(point);assert.ok(value>=min&&value<=max);
 }
});
