import test from 'node:test';
import assert from 'node:assert/strict';
import {integrateMaterialArea,rectangle} from '../tools/atlas-prototypes/material-area.mjs';

const triangle=[[[[0,0],[1,0],[0,1],[0,0]]]];
const base={box:{x:0,y:0,width:1,height:1},width:1,height:1,background:[0],tolerance:.2,lipschitz:1,
 layers:[{geometry:triangle,varying:true,paint(value,p){value[0]=p.x*p.x;}}]};

test('certified triangle mean replaces centroid with a distinct value and encloses the analytic mean',()=>{
 let contextCalls=0,lastContext;
 const result=integrateMaterialArea({...base,centroidErrorBound:(_active,_world,context)=>{lastContext=context;return .5;},triangleEstimate:(active,world,context)=>{
  assert.equal(active.length,1);assert.equal(world.length,3);
  assert.equal(context,lastContext,'both callbacks share the visit context');
  assert.deepEqual(context.background,[0]);
  contextCalls++;
  return {value:[.2],error:.04};
 }});
 const exactMean=1/6,area=.5;
 assert.equal(result.pixels[0],.1,'selected triangle estimate differs from centroid value (1/9)');
 assert.ok(Math.abs(result.pixels[0]-exactMean*area)<=result.errorBounds[0]+1e-12);
 assert.equal(result.stats.estimateQueries,contextCalls);
 assert.equal(result.stats.estimateBounds,1);
});

test('malformed triangle estimates fail closed and larger errors leave centroid estimate in place',()=>{
 for(const estimate of [{value:[],error:0},{value:[NaN],error:0},{value:[.2],error:-1},{value:[.2],error:Infinity},null])
  assert.throws(()=>integrateMaterialArea({...base,triangleEstimate:()=>estimate}),/Invalid triangle mean estimate/);
 const result=integrateMaterialArea({...base,tolerance:2,triangleEstimate:()=>({value:[.9],error:10})});
 assert.ok(Math.abs(result.pixels[0]-(1/9)*.5)<1e-12);
 assert.equal(result.stats.estimateBounds,0);
});

test('source cuts recompute and preserve each child triangle estimate',()=>{
 const edge=.37;let queries=0;
 const result=integrateMaterialArea({box:base.box,width:1,height:1,background:[0],tolerance:.1,lipschitz:1,
  layers:[{geometry:rectangle(0,0,1,1),varying:true,discontinuous:true,
   integrationCut:()=>({axis:'x',value:edge}),paint(value,p){value[0]=p.x<edge?0:1;}}],
  centroidErrorBound:(_layers,tri)=>Math.min(...tri.map(p=>p.x))<edge&&Math.max(...tri.map(p=>p.x))>edge?1:.1,
  triangleEstimate:(_layers,tri)=>{
   queries++;
   const xs=tri.map(p=>p.x);
   if(Math.min(...xs)<edge&&Math.max(...xs)>edge)return {value:[.5],error:1};
   return {value:[Math.min(...xs)>=edge?1:0],error:.05};
  }});
 assert.ok(Math.abs(result.pixels[0]-(1-edge))<1e-12);
 assert.ok(result.stats.sourceCuts>0);
 assert.ok(result.stats.estimateBounds>0);
 assert.equal(result.stats.estimateQueries,queries);
});
