import test from 'node:test';
import assert from 'node:assert/strict';
import {AreaBudgetExceeded,integrateMaterialArea,rectangle} from '../tools/atlas-prototypes/material-area.mjs';

function stepInput(adaptiveStrategy='cell-error'){
 const edge=.371;
 return {box:{x:0,y:0,width:1,height:1},width:1,height:1,background:[0],tolerance:.001,adaptiveStrategy,
  centroidErrorBound:(_layers,triangle)=>Math.min(...triangle.map(p=>p.x))<edge&&Math.max(...triangle.map(p=>p.x))>edge?1:0,
  layers:[{geometry:rectangle(0,0,1,1),varying:true,discontinuous:true,
   integrationCut:()=>({axis:'x',value:edge}),paint(value,p){value[0]=p.x<edge?0:1;}}]};
}

for(const strategy of ['cell-error','uniform'])test(`${strategy} source cut integrates a non-dyadic step exactly`,()=>{
 const result=integrateMaterialArea(stepInput(strategy));
 assert.ok(Math.abs(result.pixels[0]-.629)<1e-12);
 assert.ok(result.stats.sourceCuts>0);
 assert.ok(result.stats.sourceCutQueries>=result.stats.sourceCuts);
});

test('malformed source cuts and callback failures are surfaced',()=>{
 for(const cut of [null,{}, {axis:'z',value:.5},{axis:'x',value:NaN}])
  assert.throws(()=>integrateMaterialArea({...stepInput(),layers:[{...stepInput().layers[0],integrationCut:()=>cut}]}),/Invalid material integration cut/);
 assert.throws(()=>integrateMaterialArea({...stepInput(),layers:[{...stepInput().layers[0],integrationCut:()=>{throw Error('cut failure');}}]}),/cut failure/);
 assert.throws(()=>integrateMaterialArea({...stepInput(),layers:[{geometry:rectangle(0,0,1,1),varying:true,discontinuous:true,integrationCut:4,paint(){}}]}),/Invalid material integration cut callback/);
});

test('noninterior source cuts are ignored and ordinary refinement remains available',()=>{
 const input=stepInput();input.layers[0].integrationCut=()=>({axis:'x',value:0});
 const result=integrateMaterialArea(input);
 assert.equal(result.stats.sourceCuts,0);
 assert.ok(result.stats.subdivisions>0);
});

test('cuts on multiple axes preserve area, including thin pieces',()=>{
 const layer={geometry:rectangle(0,0,1,1),varying:true,discontinuous:true,
  integrationCut:triangle=>{
   const xs=triangle.map(p=>p.x),ys=triangle.map(p=>p.y);
   if(Math.min(...xs)<.333333333333&&Math.max(...xs)>.333333333333)return {axis:'x',value:.333333333333};
   if(Math.min(...ys)<.0000002&&Math.max(...ys)>.0000002)return {axis:'y',value:.0000002};
   return undefined;
  },paint(value){value[0]=1;}};
 const result=integrateMaterialArea({box:{x:0,y:0,width:1,height:1},width:1,height:1,background:[0],tolerance:.001,
  centroidErrorBound:(_layers,triangle)=>{
   const xs=triangle.map(p=>p.x),ys=triangle.map(p=>p.y);
   return Math.min(...xs)<.333333333333&&Math.max(...xs)>.333333333333||Math.min(...ys)<.0000002&&Math.max(...ys)>.0000002?1:0;
  },layers:[layer]});
 assert.ok(Math.abs(result.pixels[0]-1)<1e-12);
 assert.ok(result.stats.sourceCuts>=2);
});

test('source cut work is bounded by the work budget',()=>{
 const input=stepInput();input.limits={work:1};
 assert.throws(()=>integrateMaterialArea(input),error=>error instanceof AreaBudgetExceeded&&error.stats?.work>1&&Number.isInteger(error.stats.sourceCuts));
});

test('uniform repeated midpoint cuts fail at the explicit source depth budget',()=>{
 const input=stepInput('uniform');
 input.centroidErrorBound=()=>1;
 input.layers[0].integrationCut=triangle=>{
  const xs=triangle.map(p=>p.x),min=Math.min(...xs),max=Math.max(...xs);
  return max>min?{axis:'x',value:(min+max)/2}:undefined;
 };
 input.limits={sourceDepth:8,depth:1};
 assert.throws(()=>integrateMaterialArea(input),error=>error instanceof AreaBudgetExceeded&&/source cut depth/.test(error.message));
});

test('numerically unsafe adjacent-float cut falls back without losing the thin triangle area',()=>{
 const points=[[130.6875,85.33333333333333],[130.67708333333331,85.32291666666666],[130.67708333333331,85.30208333333333]];
 const ring=[...points,points[0]],expected=Math.abs((points[1][0]-points[0][0])*(points[2][1]-points[0][1])-(points[1][1]-points[0][1])*(points[2][0]-points[0][0]))/2;
 const input={box:{x:0,y:0,width:256,height:256},width:256,height:256,background:[0],tolerance:1e-8,
  centroidErrorBound:(_layers,triangle)=>Math.max(...triangle.map(p=>p.y))-Math.min(...triangle.map(p=>p.y))>.02?1:0,
  layers:[{geometry:[[[...ring]]],varying:true,discontinuous:true,
   integrationCut:()=>({axis:'y',value:85.33333333333331}),paint(value){value[0]=1;}}]};
 const result=integrateMaterialArea(input),index=85*256+130;
 assert.ok(result.stats.rejectedSourceCuts>0);
 assert.equal(result.stats.sourceCuts,0);
 assert.ok(Math.abs(result.pixels[index]-expected)<1e-14,`integrated ${result.pixels[index]}, expected ${expected}`);
});
