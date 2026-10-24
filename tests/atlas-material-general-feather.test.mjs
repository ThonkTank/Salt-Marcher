import test from 'node:test';
import assert from 'node:assert/strict';
import {authoredFeatherRegions,GENERAL_FEATHER_LIMITS} from '../tools/atlas-prototypes/general-feather.mjs';
import {integrateMaterialArea,area} from '../tools/atlas-prototypes/material-area.mjs';

const polygon=(outer,holes=[])=>({outer:outer.map(([x,y])=>({x,y})),holes:holes.map(r=>r.map(([x,y])=>({x,y})))});
const rect=(x,y,w,h)=>polygon([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
const totalArea=regions=>regions.reduce((sum,r)=>sum+area(r.geometry),0);
function minBoundaryDistance(point,polygons){
 let best=Infinity;
 for(const p of polygons)for(const ring of [p.outer,...p.holes])for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy)));
  best=Math.min(best,Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy));
 }
 return best;
}
function lShapeContains({x,y}){return x>=0&&y>=0&&x<=4&&y<=4&&(x<=1||y<=1);}

test('concave L uses its actual six-edge boundary and agrees with an independent area oracle',()=>{
 const l=polygon([[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]]),regions=authoredFeatherRegions([l],1,'linear');
 assert.equal(regions.length,1);assert.equal(regions[0].varying,true);assert.equal(regions[0].polynomialDegree,undefined);
 assert.equal(totalArea(regions),7);
 assert.ok(Math.abs(regions[0].fade({x:.5,y:.5})-.5)<1e-12);
 assert.ok(Math.abs(regions[0].fade({x:.5,y:2})-.5)<1e-12);
 // Independent high-resolution midpoint oracle over the L's authored face.
 const samples=360,step=4/samples;let oracle=0;
 for(let y=0;y<samples;y++)for(let x=0;x<samples;x++){
  const p={x:(x+.5)*step,y:(y+.5)*step};if(lShapeContains(p))oracle+=Math.min(1,minBoundaryDistance(p,[l]));
 }
 oracle*=step*step;
 const integrated=integrateMaterialArea({box:{x:0,y:0,width:4,height:4},width:1,height:1,background:[0],lipschitz:1.5,tolerance:.03,
  layers:regions.map(r=>({...r,paint(v,p){v[0]=r.fade(p);}}))});
 const estimated=integrated.pixels[0]*integrated.pixelArea,errorBound=integrated.errorBounds[0]*integrated.pixelArea;
 assert.ok(Math.abs(estimated-oracle)<=errorBound+.02,`adaptive=${estimated} ± ${errorBound}, oracle=${oracle}`);
 assert.ok(integrated.stats.subdivisions>0);
});

test('hole remains a real boundary and is excluded from the material area',()=>{
 const donut=polygon([[0,0],[6,0],[6,6],[0,6]],[[[2,2],[4,2],[4,4],[2,4]]]);
 const regions=authoredFeatherRegions([donut],2,'smoothstep');
 assert.equal(regions.length,1);assert.equal(totalArea(regions),32);
 assert.equal(regions[0].geometry[0][0].length,5);assert.equal(regions[0].geometry[0][1].length,5);
 assert.equal(regions[0].fade({x:3,y:2}),0);
 assert.ok(Math.abs(regions[0].fade({x:3,y:1})-.5)<1e-12,'one unit from the hole boundary gives smoothstep(1/2)');
 const exact=integrateMaterialArea({box:{x:0,y:0,width:6,height:6},width:1,height:1,background:[0],layers:regions.map(r=>({...r,varying:false,paint(v){v[0]=1;}}))});
 assert.ok(Math.abs(exact.pixels[0]*exact.pixelArea-32)<1e-12);
});

test('overlapping and touching parts union away shared edges before sampling',()=>{
 const overlap=[rect(0,0,4,3),rect(2,0,4,3)],touch=[rect(0,0,2,3),rect(2,0,2,3)];
 for(const parts of [overlap,touch]){
  const regions=authoredFeatherRegions(parts,3,'linear');
  assert.equal(totalArea(regions),parts===overlap?18:12);
  assert.ok(regions.filter(r=>r.varying).some(r=>Math.abs(r.fade({x:2,y:1.5})-.5)<1e-12),'shared seam is 1.5 units from top/bottom boundary, not zero');
 }
 const separate=authoredFeatherRegions([rect(0,0,2,3),rect(8,0,2,3)],1);
 assert.equal(totalArea(separate),12);
 for(const r of separate)assert.ok(r.polynomialDegree!==undefined,'disjoint convex pieces retain exact convex fast path');
});

test('union keeps the exact convex fast path, and complexity limits reject inputs explicitly',()=>{
 const regions=authoredFeatherRegions([rect(0,0,4,8)],1,'smoothstep');
 assert.ok(regions.every(r=>r.polynomialDegree===0||r.polynomialDegree===3));
 assert.equal(totalArea(regions),32);
 const ring=Array.from({length:GENERAL_FEATHER_LIMITS.inputVertices+1},(_,i)=>({x:i,y:i%2}));
 assert.throws(()=>authoredFeatherRegions([{outer:ring,holes:[]}],1),/input vertex limit/);
 assert.throws(()=>authoredFeatherRegions([rect(0,0,1,1)],-1),/Invalid feather parameters/);
});

test('general distance is scale and translation invariant without squared-radius overflow or underflow',()=>{
 const base=polygon([[0,0],[6,0],[6,6],[0,6]],[[[2,2],[4,2],[4,4],[2,4]]]);
 for(const [scale,offset] of [[1e-6,0],[1,0],[1e6,0],[1,1e9],[1e6,-1e9]]){
  const transform=p=>({x:p.x*scale+offset,y:p.y*scale-offset});
  const mapped={outer:base.outer.map(transform),holes:base.holes.map(r=>r.map(transform))};
  const regions=authoredFeatherRegions([mapped],2*scale);
  for(const p of [{x:3,y:1},{x:1,y:1},{x:3,y:2},{x:4.5,y:4.5}]){
   const actual=regions[0].fade(transform(p)),expected=Math.min(1,minBoundaryDistance(p,[base])/2);
   assert.ok(Math.abs(actual-expected)<1e-10,`${scale}, ${offset}: ${actual} vs ${expected}`);
  }
 }
 const small=authoredFeatherRegions([base],1e-200)[0];
 assert.equal(small.fade({x:3,y:1}),1);
 assert.equal(small.fade({x:3,y:2}),0);
 const large=authoredFeatherRegions([base],1e200)[0].fade({x:3,y:1});
 assert.ok(Math.abs(large/1e-200-1)<1e-12);
 assert.throws(()=>authoredFeatherRegions([base],Number.MIN_VALUE),/numeric extent/);
});

test('union fills authored holes before constructing the distance field',()=>{
 const donut=polygon([[0,0],[6,0],[6,6],[0,6]],[[[2,2],[4,2],[4,4],[2,4]]]);
 const partial=authoredFeatherRegions([donut,rect(2,2,1,2)],1);
 assert.equal(totalArea(partial),34);
 assert.ok(Math.abs(partial[0].fade({x:2,y:3})-1)<1e-12,'filled former hole edge no longer fades');
 assert.equal(partial[0].fade({x:3,y:3}),0,'remaining hole edge still fades');
 const filled=authoredFeatherRegions([donut,rect(2,2,2,2)],1);
 assert.equal(totalArea(filled),36);
 assert.ok(filled.every(r=>r.polynomialDegree!==undefined),'filled hole recovers the convex path');
});
