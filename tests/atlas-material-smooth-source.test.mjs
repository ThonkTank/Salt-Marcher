import test from 'node:test';
import assert from 'node:assert/strict';
import {pigmentStrokeSource} from '../tools/atlas-prototypes/pigment-stroke.mjs';
import {integrateMaterialArea} from '../tools/atlas-prototypes/material-area.mjs';
import {landscapeMaterialBackground,landscapeMaterialLayers,landscapeMaterialCentroidError,landscapeMaterialTriangleEstimate} from '../tools/atlas-prototypes/material-sources.mjs';
const polygons=[{outer:[{x:-2,y:-2},{x:2,y:-2},{x:2,y:2},{x:-2,y:2}],holes:[]}];
const record=(tip='soft',extra={})=>({points:[{x:0,y:0}],polygons,paint:{version:2,tip,radius:1,flow:.73,opacity:.82,seed:19,target:'ground',operation:'paint',color:'#b02080',...extra}});
const eachPoint=(tri,n,fn)=>{for(let o=0;o<2;o++)for(let i=0;i<n;i++)for(let j=0;j<n-i-o;j++){
 const a=(i+(o?2/3:1/3))/n,b=(j+(o?2/3:1/3))/n;
 fn({x:tri[0].x+(tri[1].x-tri[0].x)*a+(tri[2].x-tri[0].x)*b,y:tri[0].y+(tri[1].y-tri[0].y)*a+(tri[2].y-tri[0].y)*b});
}};
test('smooth source error contains quantized Float32 coverage including overlapping stamps',()=>{
 for(const tip of ['soft','textured']){
 const source=pigmentStrokeSource(record(tip,{strokes:[[{x:0,y:0},{x:.3,y:.1}],[{x:.1,y:.2}],[{x:0,y:0}]]}));
 const tri=[{x:.21,y:.21},{x:.24,y:.21},{x:.21,y:.24}];
 eachPoint(tri,40,point=>{
  const result=source.smooth(tri,point);assert.ok(result);
  assert.ok(Math.abs(source.alpha(point)-result.value)<=result.error);
  assert.ok(result.error<1/255);
 });
 }
});
test('a texture boundary and a round circle crossing decline the smooth certificate',()=>{
 const tri=[{x:.01,y:.01},{x:.07,y:.01},{x:.01,y:.07}],point={x:.03,y:.03};
 assert.equal(pigmentStrokeSource(record('textured')).smooth(tri,point),undefined);
 assert.equal(pigmentStrokeSource(record('round')).smooth([{x:.9,y:0},{x:1.1,y:0},{x:.9,y:.2}],{x:.97,y:.07}),undefined);
});
test('composed paint and erase mean certificate contains dense quantized reference',()=>{
 const sources=[record('soft',{strokes:[[{x:0,y:0},{x:.2,y:0}]]}),record('soft',{operation:'erase',opacity:.47,radius:.7,strokes:[[{x:.3,y:.2}]]})];
 const layers=landscapeMaterialLayers({colorRecords:sources,landColor:'#718293',palette:{water:'#112233'}});
 const tri=[{x:.2,y:.2},{x:.22,y:.2},{x:.2,y:.22}],background=landscapeMaterialBackground('#718293');
 const estimate=landscapeMaterialTriangleEstimate(layers,tri,{background});assert.ok(estimate);
 const sum=Array(14).fill(0),n=150;
 eachPoint(tri,n,point=>{const v=[...background];for(const layer of layers)layer.paint(v,point);for(let c=0;c<14;c++)sum[c]+=v[c]/(n*n);});
 for(let c=0;c<14;c++)assert.ok(Math.abs(sum[c]-estimate.value[c])<=estimate.error+1e-8,`${c}: reference ${sum[c]}, estimated ${estimate.value[c]}, error ${estimate.error}`);
});
test('full soft-stamp tile meets the unchanged default budgets and analytic integral with byte allowance',()=>{
 const layers=landscapeMaterialLayers({colorRecords:[record('soft',{flow:1,opacity:1,color:'#000000'})],landColor:'#ffffff',palette:{water:'#112233'}});
 const result=integrateMaterialArea({box:{x:-2,y:-2,width:4,height:4},width:256,height:256,background:landscapeMaterialBackground('#ffffff'),layers,centroidErrorBound:landscapeMaterialCentroidError,triangleEstimate:landscapeMaterialTriangleEstimate});
 assert.ok(result.stats.estimateBounds>0);assert.ok(result.stats.work<2000000);
 const alpha=result.pixels.reduce((s,v,i)=>s+(i%14===8?v:0),0)/65536;
 const bound=result.errorBounds.reduce((s,v)=>s+v,0)/65536;
 // Integral of (1-r²)² over the unit disk is pi/3, over this box pi/48.
 // Quantization only affects the disk area, by at most half a byte plus f32.
 assert.ok(Math.abs(alpha-Math.PI/48)<=bound+(1/510+2**-25)*Math.PI/16);
 assert.ok(Math.max(...result.errorBounds)<=1/255);
});
test('full textured tile retains the sampled quantized source mean within its bounded integration error',()=>{
 const r=record('textured',{flow:1,opacity:1,color:'#000000'}),source=pigmentStrokeSource(r);
 const layers=landscapeMaterialLayers({colorRecords:[r],landColor:'#ffffff',palette:{water:'#112233'}});
 const result=integrateMaterialArea({box:{x:-2,y:-2,width:4,height:4},width:256,height:256,background:landscapeMaterialBackground('#ffffff'),layers,centroidErrorBound:landscapeMaterialCentroidError,triangleEstimate:landscapeMaterialTriangleEstimate});
 const alpha=result.pixels.reduce((s,v,i)=>s+(i%14===8?v:0),0)/65536;
 const bound=result.errorBounds.reduce((s,v)=>s+v,0)/65536;
 const sample=n=>{let sum=0;for(let y=0;y<n;y++)for(let x=0;x<n;x++)sum+=source.alpha({x:-2+(x+.5)*4/n,y:-2+(y+.5)*4/n});return sum/(n*n);};
 const coarse=sample(1024),fine=sample(2048),samplingDelta=Math.abs(coarse-fine);
 assert.ok(samplingDelta<.0001,'independent source-grid mean is stable at doubled density');
 assert.ok(Math.abs(alpha-fine)<=bound+samplingDelta);
 assert.ok(result.stats.sourceCuts>0&&result.stats.estimateBounds>0);
 assert.ok(result.stats.work<2000000&&result.stats.peakPendingTriangles<65536);
 assert.ok(Math.max(...result.errorBounds)<=1/255);
});
