import test from 'node:test';
import assert from 'node:assert/strict';
import {convexFeatherRegions} from '../tools/atlas-prototypes/convex-feather.mjs';
import {integrateMaterialArea,area,rectangle} from '../tools/atlas-prototypes/material-area.mjs';
const polygon=(x,y,w,h)=>({outer:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],holes:[]});
function render(shape,radius,curve,box,width=1,height=1){
 const regions=convexFeatherRegions(shape,radius,curve);
 return integrateMaterialArea({box,width,height,background:[0],layers:regions.map(r=>({...r,paint(v,p){v[0]=r.fade(p);}}))});
}
const integral=r=>r.pixels.reduce((n,v)=>n+v,0)*r.pixelArea;

test('degree-one through degree-three triangle quadrature matches analytic monomials',()=>{
 const factorial=n=>n<2?1:n*factorial(n-1);
 for(let i=0;i<=3;i++)for(let j=0;j<=3-i;j++){
  const r=integrateMaterialArea({box:{x:0,y:0,width:1,height:1},width:1,height:1,background:[0],layers:[{
   geometry:[[[[0,0],[1,0],[0,1],[0,0]]]],varying:true,polynomialDegree:i+j,paint(v,p){v[0]=p.x**i*p.y**j;}
  }]});
  const exact=factorial(i)*factorial(j)/factorial(i+j+2);
  assert.ok(Math.abs(r.pixels[0]-exact)<1e-14,`${i},${j}`);assert.equal(r.stats.subdivisions,0);
 }
});

test('world-radius feather integrates unit-square linear and smoothstep exactly',()=>{
 // Perimeter of an inset square is 4-8d. Integrate d or (3d²-2d³), d=0..1/2.
 for(const [curve,expected] of [['linear',1/6],['smoothstep',.1]]){
  for(const size of [1,4,16]){
   const r=render(polygon(0,0,1,1),1,curve,{x:0,y:0,width:1,height:1},size,size);
   assert.ok(Math.abs(integral(r)-expected)<1e-12);assert.equal(r.stats.subdivisions,0);
  }
 }
});

test('convex regions partition support once, including full-strength interior',()=>{
 const shape=polygon(0,0,4,8);
 for(const curve of ['linear','smoothstep']){
  const regions=convexFeatherRegions(shape,1,curve);
  assert.ok(Math.abs(regions.reduce((n,r)=>n+area(r.geometry),0)-32)<1e-12);
  const result=render(shape,1,curve,{x:0,y:0,width:4,height:8});
  // Inset perimeter: 24-8d. Saturated core area=12.
  const expected=curve==='linear'?32-12+4/3:32-12+1.2;
  assert.ok(Math.abs(integral(result)-expected)<1e-12);
 }
});

test('collinear source vertices and clockwise rings do not double-compose feather',()=>{
 const original=polygon(0,0,2,4),extra={outer:[{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:2,y:4},{x:0,y:4}],holes:[]};
 const box={x:0,y:0,width:2,height:4};
 const expected=integral(render(original,1,'linear',box));
 for(const shape of [extra,{outer:[...extra.outer].reverse(),holes:[]}]){
  const r=render(shape,1,'linear',box);assert.ok(Math.abs(integral(r)-expected)<1e-12);
  const total=convexFeatherRegions(shape,1).reduce((n,r)=>n+area(r.geometry),0);assert.ok(Math.abs(total-8)<1e-12);
 }
});

test('authored radius and clipping stay invariant across split tiles and large translations',()=>{
 const shape=polygon(0,0,4,8),full=integral(render(shape,1,'smoothstep',{x:0,y:0,width:4,height:8},4,8));
 let parts=0;for(let y=0;y<8;y+=2)for(let x=0;x<4;x+=2)parts+=integral(render(shape,1,'smoothstep',{x,y,width:2,height:2},2,2));
 assert.ok(Math.abs(parts-full)<1e-12);
 const o=1e9;assert.ok(Math.abs(integral(render(polygon(o,-o,4,8),1,'linear',{x:o,y:-o,width:4,height:8}))-(32-12+4/3))<1e-6);
});

test('concavity, holes and excessive composed degree are rejected explicitly',()=>{
 assert.throws(()=>convexFeatherRegions({outer:[{x:0,y:0},{x:2,y:0},{x:1,y:1},{x:2,y:2},{x:0,y:2}],holes:[]},1),/concave/);
 assert.throws(()=>convexFeatherRegions({...polygon(0,0,4,4),holes:[polygon(1,1,1,1).outer]},1),/holes/);
 const layer={geometry:rectangle(0,0,1,1),varying:true,polynomialDegree:3,paint(v,p){v[0]=v[0]*(1-p.x**3)+p.x**3;}};
 assert.throws(()=>integrateMaterialArea({box:{x:0,y:0,width:1,height:1},width:1,height:1,background:[0],layers:[layer,layer]}),/Lipschitz/);
});

test('accepted source-over products integrate in author order at composed degree two',()=>{
 const red={geometry:rectangle(0,0,1,1),varying:true,polynomialDegree:1,paint(v,p){v[0]=v[0]*(1-p.x)+p.x;}},
 black={geometry:rectangle(0,0,1,1),varying:true,polynomialDegree:1,paint(v,p){v[0]*=1-p.y;}};
 const run=layers=>integrateMaterialArea({box:{x:0,y:0,width:1,height:1},width:1,height:1,background:[0],layers}).pixels[0];
 assert.ok(Math.abs(run([red,black])-.25)<1e-14);
 assert.ok(Math.abs(run([black,red])-.5)<1e-14);
 const tint={geometry:rectangle(0,0,1,1),paint(v){v[0]*=.5;}};
 assert.ok(Math.abs(run([red,black,tint])-.125)<1e-14);
});

test('angled convex geometry and relative coordinate scales preserve authored-radius area',()=>{
 for(const size of [1e-6,1,1e6]){
  const theta=Math.PI/7,c=Math.cos(theta),s=Math.sin(theta),shape=polygon(0,0,size,size);
  shape.outer=shape.outer.map(p=>({x:c*p.x-s*p.y,y:s*p.x+c*p.y}));
  const box={x:-size,y:-size,width:3*size,height:3*size},r=render(shape,size,'linear',box,3,3);
  assert.ok(Math.abs(integral(r)/(size*size)-1/6)<1e-10);
  const sum=convexFeatherRegions(shape,size).reduce((n,r)=>n+area(r.geometry),0);
  assert.ok(Math.abs(sum/(size*size)-1)<1e-10);
 }
});
