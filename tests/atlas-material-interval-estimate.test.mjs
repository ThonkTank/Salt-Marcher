import test from 'node:test';
import assert from 'node:assert/strict';
import {integrateMaterialArea,rectangle} from '../tools/atlas-prototypes/material-area.mjs';
import {landscapeMaterialBackground,landscapeMaterialCentroidError,landscapeMaterialTriangleEstimate} from '../tools/atlas-prototypes/material-sources.mjs';
import {materialIntervalError,takeMaterialIntervalEstimate} from '../tools/atlas-prototypes/material-interval.mjs';

const background=landscapeMaterialBackground('#000000');
const triangle=[{x:0,y:0},{x:1,y:0},{x:0,y:1}];
test('complete interval midpoint replaces a biased centroid without repeating source composition',()=>{
 let expensive=0;
 const layer={geometry:rectangle(0,0,1,1),varying:true,discontinuous:true,analyticMean:true,
  paint(v,p){v[9]=p.x<.8?0:.004;},
  materialRange(v){v[9]=[0,.004];},
  materialSmooth(){expensive++;throw Error('sufficient interval must skip smooth evaluation');},
  materialMean(){expensive++;throw Error('sufficient interval must skip moment evaluation');}};
 const r=integrateMaterialArea({box:{x:0,y:0,width:1,height:1},width:1,height:1,background,layers:[layer],tolerance:.003,
  centroidErrorBound:landscapeMaterialCentroidError,triangleEstimate:landscapeMaterialTriangleEstimate});
 assert.equal(expensive,0);
 assert.equal(r.pixels[9],.002);
 assert.ok(Math.abs(r.pixels[9]-.2*.004)<=r.errorBounds[0]);
 assert.ok(r.errorBounds[0]<=.003);
 assert.ok(r.stats.estimateBounds>0);
});
test('a wider interval retains the existing smooth estimate path',()=>{
 let calls=0;
 const layer={discontinuous:true,materialRange(v){v[9]=[0,1];},materialSmooth(){calls++;return true;}};
 const context={background,meanErrorTarget:.001,evaluateCenter:()=>[...background]};
 materialIntervalError([layer],triangle,context);
 const estimate=landscapeMaterialTriangleEstimate([layer],triangle,context);
 assert.equal(calls,1);assert.ok(estimate.error<.001);assert.equal(estimate.value[9],0);
});
test('interval candidates are consumed once, cover every channel, and reject malformed ranges',()=>{
 const layer={materialRange(v){v[5]=[.1,.3];v[13]=[.2,.6];}};
 const context={background,meanErrorTarget:1,evaluateCenter:()=>[...background]};
 materialIntervalError([layer],triangle,context);
 const candidate=takeMaterialIntervalEstimate(context);
 assert.equal(candidate.value.length,14);assert.equal(candidate.value[5],.2);assert.equal(candidate.value[13],.4);
 assert.ok(candidate.error>=.2&&candidate.error<.200000000001);
 assert.equal(takeMaterialIntervalEstimate(context),undefined);
 assert.equal(takeMaterialIntervalEstimate({...context}),undefined);
 assert.throws(()=>materialIntervalError([{materialRange(v){v[9]=[NaN,1];}}],triangle,context),/Invalid composed material interval/);
 assert.equal(takeMaterialIntervalEstimate(context),undefined);
});
test('source-cut children receive fresh range candidates and the validated error target',()=>{
 const edge=.37,contexts=new Set();let smoothCalls=0;
 const layer={geometry:rectangle(0,0,1,1),varying:true,discontinuous:true,
  integrationCut:()=>({axis:'x',value:edge}),paint(v,p){v[9]=p.x<edge?0:1;},
  materialRange(v,tri){
   const xs=tri.map(p=>p.x),lo=Math.min(...xs),hi=Math.max(...xs);
   v[9]=hi<=edge?[0,0]:lo>=edge?[1,1]:[0,1];
  },materialSmooth(){smoothCalls++;return false;}};
 const r=integrateMaterialArea({box:{x:0,y:0,width:1,height:1},width:1,height:1,background,layers:[layer],tolerance:.01,
  centroidErrorBound:(active,tri,context)=>{
   assert.equal(context.meanErrorTarget,.01);assert.ok(!contexts.has(context));contexts.add(context);
   return landscapeMaterialCentroidError(active,tri,context);
  },triangleEstimate:landscapeMaterialTriangleEstimate});
 assert.ok(r.stats.sourceCuts>0&&smoothCalls>0);
 assert.ok(Math.abs(r.pixels[9]-(1-edge))<=r.errorBounds[0]+1e-12);
 assert.ok(r.errorBounds[0]<=.01);
 assert.equal(contexts.size,r.stats.curvatureQueries);
});
