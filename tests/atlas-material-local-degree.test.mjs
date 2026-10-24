import test from 'node:test';
import assert from 'node:assert/strict';
import {authoredFeatherRegions} from '../tools/atlas-prototypes/general-feather.mjs';
import {integrateMaterialArea,rectangle,AreaBudgetExceeded} from '../tools/atlas-prototypes/material-area.mjs';

const polygon=(outer,holes=[])=>({outer:outer.map(([x,y])=>({x,y})),holes:holes.map(r=>r.map(([x,y])=>({x,y})))});
const rect=(x,y,w,h)=>polygon([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
const tri=points=>points.map(([x,y])=>({x,y}));

test('general feather triangle certificates reject saturation, nearest-edge, endpoint, and clamp crossings',()=>{
 const donut=polygon([[0,0],[8,0],[8,8],[0,8]],[[[3,3],[5,3],[5,5],[3,5]]]);
 const region=authoredFeatherRegions([donut],1,'smoothstep')[0];
 const classify=points=>region.polynomialDegreeOnTriangle(tri(points));

 // The centroid is 1.2 m from the bottom edge (already saturated), but one
 // triangle corner is only 0.8 m away. A center-only test would be unsound.
 assert.equal(classify([[3,.8],[5,1.6],[7,1.2]]),undefined);
 // At the lower-left corner the two incident true boundaries can exchange
 // which one is nearest inside the triangle.
 assert.equal(classify([[.2,.2],[1.1,.2],[.2,1.1]]),undefined);
 // The projection onto the bottom segment reaches its endpoint at x=0.
 assert.equal(classify([[.05,.3],[.8,.3],[.05,1.05]]),undefined);
 // Even with one nearest edge, crossing the full-strength clamp changes the
 // polynomial inside the triangle.
 assert.equal(classify([[3,.2],[5,1.1],[7,1.8]]),undefined);

 assert.equal(classify([[3,.2],[4.2,.25],[3.4,.45]]),3,'smoothstep distance to one edge is cubic');
 assert.equal(classify([[1.3,1.3],[1.5,1.3],[1.3,1.5]]),0,'the whole triangle is saturated');
});

test('local certificates remain sound after translation and scale normalization',()=>{
 const base=polygon([[0,0],[8,0],[8,8],[0,8]],[[[3,3],[5,3],[5,5],[3,5]]]),points=[[2,.2],[3.2,.25],[2.4,.45]];
 for(const [scale,offset] of [[1e-6,0],[1,1e9],[1e6,-1e9]]){
  const transform=p=>[p[0]*scale+offset,p[1]*scale-offset];
  const mapped={outer:base.outer.map(p=>{const [x,y]=transform([p.x,p.y]);return {x,y};}),holes:base.holes.map(r=>r.map(p=>{const [x,y]=transform([p.x,p.y]);return {x,y};}))};
  const region=authoredFeatherRegions([mapped],scale,'linear')[0];
  assert.equal(region.polynomialDegreeOnTriangle(tri(points.map(transform))),1,`${scale} at ${offset}`);
  const mixed=points.map(transform);
  mixed[2]=transform([4,1.2]);
  assert.equal(region.polynomialDegreeOnTriangle(tri(mixed)),undefined,'the radius clamp crossing stays uncertified');
 }
});

test('genuine holed geometry uses local certificates while retaining adaptive fallback',()=>{
 const donut=polygon([[0,0],[6,0],[6,6],[0,6]],[[[2,2],[4,2],[4,4],[2,4]]]);
 const region=authoredFeatherRegions([donut],2,'smoothstep')[0];
 const result=integrateMaterialArea({box:{x:0,y:0,width:6,height:6},width:1,height:1,background:[0],
  layers:[{...region,paint(value,p){value[0]=region.fade(p);}}],lipschitz:1.5,tolerance:.08});
 assert.ok(result.stats.degreeQueries>0);
 assert.ok(result.stats.localPolynomialTriangles>0);
 assert.ok(result.stats.subdivisions>0,'uncertain triangles still use adaptive integration');
 assert.ok(result.pixels[0]>0&&result.pixels[0]<1);
});

test('invalid classifier results fail and mixed unknown/high-degree layers require a bound',()=>{
 const geometry=[[ [[0,0],[1,0],[1,1],[0,1],[0,0]] ]];
 const layer=(extra={})=>({geometry,varying:true,paint(v){v[0]=.5;},...extra});
 const input={box:{x:0,y:0,width:1,height:1},width:1,height:1,background:[0],layers:[]};
 assert.throws(()=>integrateMaterialArea({...input,layers:[layer({polynomialDegreeOnTriangle:()=>4})],lipschitz:1}),/Invalid classified material polynomial degree/);
 assert.throws(()=>integrateMaterialArea({...input,layers:[layer(),layer({polynomialDegree:3})]}),/Lipschitz/);
 const bounded=integrateMaterialArea({...input,layers:[layer(),layer({polynomialDegree:3})],lipschitz:2,tolerance:.2});
 assert.ok(bounded.stats.subdivisions>0);
 assert.ok(bounded.errorBounds[0]>0);
});

test('one cell error budget covers separate faces and disconnected source components',()=>{
 const input={box:{x:0,y:0,width:1,height:1},width:1,height:1,background:[0],lipschitz:2,tolerance:.02};
 const split=integrateMaterialArea({...input,layers:[
  {geometry:rectangle(0,0,.4,1),varying:true,paint(v,p){v[0]=p.x*p.x;}},
  {geometry:rectangle(.4,0,.6,1),varying:true,paint(v,p){v[0]=(p.x-.4)**2;}}
 ]});
 const islands=integrateMaterialArea({...input,layers:[
  {geometry:[...rectangle(0,0,.2,1),...rectangle(.8,0,.2,1)],varying:true,paint(v,p){v[0]=p.x*p.x;}}
 ]});
 for(const [result,expected] of [[split,(.4**3+.6**3)/3],[islands,(.2**3+1-.8**3)/3]]){
  assert.ok(result.errorBounds[0]<=input.tolerance);
  assert.ok(Math.abs(result.pixels[0]-expected)<=result.errorBounds[0]+1e-14);
  assert.ok(result.stats.peakPendingTriangles>0);
  assert.ok(result.stats.errorSumRechecks>0,'accepted cell recomputes its positive leaf error sum');
 }
});

test('pending refinement storage and depth limits reject instead of publishing a partial cell',()=>{
 const input={box:{x:0,y:0,width:1,height:1},width:1,height:1,background:[0],lipschitz:2,tolerance:1e-8,
  layers:[{geometry:rectangle(0,0,1,1),varying:true,paint(v,p){v[0]=p.x*p.x;}}]};
 assert.throws(()=>integrateMaterialArea({...input,limits:{pendingTriangles:2}}),error=>error instanceof AreaBudgetExceeded&&/pending triangle/.test(error.message));
 assert.throws(()=>integrateMaterialArea({...input,limits:{depth:1}}),error=>error instanceof AreaBudgetExceeded&&/depth/.test(error.message));
});

test('two cubic affine fades compose to degree six and use a bounded adaptive estimate',()=>{
 const geometry=[[ [[0,0],[1,0],[1,1],[0,1],[0,0]] ]];
 const cubicLayer={geometry,varying:true,polynomialDegreeOnTriangle:()=>3,
  // Each source-over transform multiplies the current channel by x^3.
  paint(value,p){value[0]*=p.x**3;}};
 const result=integrateMaterialArea({box:{x:0,y:0,width:1,height:1},width:1,height:1,
  background:[1],layers:[cubicLayer,cubicLayer],lipschitz:6,tolerance:.04});
 const estimate=result.pixels[0]*result.pixelArea;
 const errorBound=result.errorBounds[0]*result.pixelArea;
 assert.ok(result.stats.subdivisions>0,'the composed degree-six field cannot use the cubic exact rule');
 assert.ok(errorBound<=.04+1e-12,`reported bound ${errorBound} exceeds requested tolerance`);
 assert.ok(Math.abs(estimate-1/7)<=errorBound+1e-12,`estimate ${estimate}, analytic x^6 mean 1/7, bound ${errorBound}`);
});
