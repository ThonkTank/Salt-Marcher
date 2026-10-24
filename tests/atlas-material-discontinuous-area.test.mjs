import test from 'node:test';
import assert from 'node:assert/strict';
import {integrateMaterialArea,rectangle} from '../tools/atlas-prototypes/material-area.mjs';

const input={box:{x:0,y:0,width:1,height:1},width:1,height:1,background:[0],tolerance:.01,
 layers:[{geometry:rectangle(0,0,1,1),varying:true,discontinuous:true,
  paint(value,point){value[0]=point.x<.5?0:1;}}]};

test('step discontinuity uses callback bounds and integrates its analytic cell mean',()=>{
 let callbackCalls=0,centerCalls=0;
 const result=integrateMaterialArea({...input,centroidErrorBound:(_layers,triangle,context)=>{
  callbackCalls++;
  assert.deepEqual(context.background,[0]);
  const first=context.evaluateCenter(),second=context.evaluateCenter();
  centerCalls++;
  assert.deepEqual(first,second,'the lazily evaluated centroid vector is cached');
  const xs=triangle.map(point=>point.x);
  return Math.min(...xs)<.5&&Math.max(...xs)>.5?1:0;
 }});
 assert.ok(callbackCalls>0);
 assert.equal(centerCalls,callbackCalls);
 assert.equal(result.stats.evaluations,result.stats.curvatureQueries,
  'the callback centroid sample is reused as the triangle estimate');
 assert.ok(result.errorBounds[0]<=input.tolerance);
 assert.ok(Math.abs(result.pixels[0]-.5)<=result.errorBounds[0]+1e-12,
  `estimate ${result.pixels[0]} should enclose the analytic mean 0.5`);
});

test('discontinuous unknown triangles fail closed without a finite callback bound',()=>{
 assert.throws(()=>integrateMaterialArea(input),/requires a centroid error callback/);
 assert.throws(()=>integrateMaterialArea({...input,centroidErrorBound:()=>undefined}),/Discontinuous material needs a finite centroid error bound/);
 assert.throws(()=>integrateMaterialArea({...input,centroidErrorBound:()=>Infinity}),/Invalid centroid error bound/);
});

test('exact local constant certificates bypass callback evaluation',()=>{
 let calls=0;
 const layer={...input.layers[0],polynomialDegreeOnTriangle:()=>0,paint(value){value[0]=.75;}};
 const result=integrateMaterialArea({...input,layers:[layer],centroidErrorBound:()=>{calls++;throw Error('exact triangle should not need a bound');}});
 assert.equal(result.pixels[0],.75);
 assert.equal(result.errorBounds[0],0);
 assert.equal(result.stats.localConstantTriangles,2);
 assert.equal(calls,0);
});
