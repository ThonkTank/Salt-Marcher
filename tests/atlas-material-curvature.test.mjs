import test from 'node:test';
import assert from 'node:assert/strict';
import {authoredFeatherRegions} from '../tools/atlas-prototypes/general-feather.mjs';
import {integrateMaterialArea,rectangle} from '../tools/atlas-prototypes/material-area.mjs';
import {landscapeMaterialBackground,landscapeMaterialCentroidError,landscapeMaterialLayers,landscapeMaterialLipschitz} from '../tools/atlas-prototypes/material-sources.mjs';

const polygon=(outer,holes=[])=>({outer:outer.map(([x,y])=>({x,y})),holes:holes.map(r=>r.map(([x,y])=>({x,y})))});
const squareHole=()=>polygon([[0,0],[6,0],[6,6],[0,6]],[[[2,2],[4,2],[4,4],[2,4]]]);
const tri=(...points)=>points.map(([x,y])=>({x,y}));
const rect=(x,y,w,h)=>polygon([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);

test('radial hole-corner ties are certified only when both edges project to their shared endpoint',()=>{
 const region=authoredFeatherRegions([squareHole()],3)[0];
 const triangle=tri([1.55,1.55],[1.7,1.55],[1.55,1.7]);
 const feature=region.featureOnTriangle(triangle);
 assert.equal(feature.kind,'point');
 assert.ok(feature.minDistance>0);
 assert.ok(Math.abs(feature.minDistance-Math.hypot(.3,.3))<.25);

 // A nearby third edge can win elsewhere in a broad triangle, so the shared
 // endpoint tie no longer proves one smooth radial feature throughout.
 assert.equal(region.featureOnTriangle(tri([1.2,1.2],[2.8,1.2],[1.2,2.8])),undefined);
 // Crossing from the endpoint Voronoi region into a segment projection is unknown.
 assert.equal(region.featureOnTriangle(tri([1.8,1.5],[2.2,1.5],[1.8,1.8])),undefined);
 // A triangle crossing the feather clamp has no one smooth radial formula.
 const clamped=authoredFeatherRegions([squareHole()],.5)[0];
 assert.equal(clamped.featureOnTriangle(tri([2.5,1.4],[2.6,1.6],[2.4,1.6])),undefined);
 // The endpoint itself has zero separation, so the derivative certificate is unknown.
 assert.equal(region.featureOnTriangle(tri([2,2],[1.8,1.7],[1.7,1.8])),undefined);
});

test('feature certificates invalidate mutable triangles and preserve world scale',()=>{
 const base=polygon([[0,0],[8,0],[8,8],[0,8]],[[[2,2],[6,2],[6,6],[2,6]]]),region=authoredFeatherRegions([base],2)[0];
 const mutable=tri([1.4,1.4],[1.5,1.4],[1.4,1.5]);
 assert.equal(region.featureOnTriangle(mutable).kind,'point');
 mutable[0]={x:4,y:1.4};mutable[1]={x:4.1,y:1.4};mutable[2]={x:4,y:1.5};
 assert.equal(region.featureOnTriangle(mutable).kind,'affine','same array identity must not reuse its old point certificate');
 for(const [scale,offset] of [[1e-6,0],[1,0],[1e6,1e9]]){
  const transform=p=>({x:p.x*scale+offset,y:p.y*scale-offset});
  const mapped=authoredFeatherRegions([{outer:base.outer.map(transform),holes:base.holes.map(r=>r.map(transform))}],2*scale)[0];
  const query=tri([1.4,1.4],[1.5,1.4],[1.4,1.5]).map(transform);
  assert.equal(mapped.featureOnTriangle(query).kind,'point');
  if(scale===1e-6){
   const invalid=tri([Number.MAX_VALUE,0],[Number.MAX_VALUE,1],[Number.MAX_VALUE,2]);
   assert.throws(()=>mapped.featureOnTriangle(invalid),/numeric extent/);
   assert.throws(()=>mapped.featureOnTriangle(invalid),/numeric extent/,'a failed query must not cache the preceding valid feature');
  }
 }
});

const cover=(polygons,edge=.8,density=.4,ground='#000000')=>({polygons,vegetation:{preset:{ground,density,edge},edits:[]}});
const options={palette:{water:'#0000ff'},landColor:'#ffffff',edgePolicy:'authored-world'};
const sourceLayers=covers=>landscapeMaterialLayers({...options,coverRecords:covers});

function triangularCentroidMean(fn,triangle,n=300){
 const [a,b,c]=triangle,at=(u,v)=>({x:a.x*(1-u-v)+b.x*u+c.x*v,y:a.y*(1-u-v)+b.y*u+c.y*v});
 let sum=0,count=0;
 // The two orientations tile the full barycentric triangle; each little
 // triangle has equal area and contributes its centroid to the mean.
 for(let i=0;i<n;i++)for(let j=0;j<n-i;j++){
  sum+=fn(at((i+1/3)/n,(j+1/3)/n));count++;
  if(i+j<n-1){sum+=fn(at((i+2/3)/n,(j+2/3)/n));count++;}
 }
 return sum/count;
}
function squareHoleDistance(point){
 const dx=Math.max(2-point.x,0,point.x-4),dy=Math.max(2-point.y,0,point.y-4);
 return Math.hypot(dx,dy);
}
function independentComposition(point,covers,background){
 const value=[...background];
 for(const item of covers){
  const {density,edge,ground}=item.vegetation.preset,t=Math.min(1,squareHoleDistance(point)/edge),smooth=t*t*(3-2*t),alpha=.78*smooth;
  const color=[1,3,5].map(i=>parseInt(ground.slice(i,i+2),16)/255);
  for(let c=0;c<3;c++)value[c]=color[c]*alpha+value[c]*(1-alpha);
  value[4]=value[4]*(1-t)+Math.min(1,density/.8)*t;
  value[13]=density;
  for(let c=0;c<4;c++)value[9+c]=value[c];
 }
 return value;
}

test('adapter centroid remainder bounds final channels for two overlapping holed covers',()=>{
 const outer=rect(0,0,6,6),hole=rect(2,2,2,2),donut={...outer,holes:[hole.outer]};
 const covers=[cover([donut],.8,.35,'#c04030'),cover([donut],.7,.55,'#3060c0')];
 const layers=sourceLayers(covers),background=landscapeMaterialBackground(options.landColor);
 const triangle=tri([1.55,1.55],[1.7,1.55],[1.55,1.7]);
 const active=layers.filter(layer=>layer.varying||layer.materialDerivativesOnTriangle?.(triangle)?.hessian===0);
 assert.equal(active.filter(layer=>layer.varying).length,2,'both real clipped feather regions cover the test triangle');
 assert.equal(active.length,4,'one density reset and one feather layer per cover');
 for(const layer of active.filter(layer=>layer.varying))assert.equal(layer.materialDerivativesOnTriangle(triangle).hessian>0,true);
 const bound=landscapeMaterialCentroidError(active,triangle);
 assert.ok(Number.isFinite(bound)&&bound>0,`expected a finite certificate, got ${bound}`);
 // Verify the exact adapter layer order at the centroid against an independent
 // square-hole distance and source-over calculation, then compare the mean.
 const channels=background.length;
 const center={x:triangle.reduce((s,p)=>s+p.x,0)/3,y:triangle.reduce((s,p)=>s+p.y,0)/3},actual=[...background];
 for(const layer of active)layer.paint(actual,center);
 const independentCenter=independentComposition(center,covers,background);
 for(let c=0;c<channels;c++)assert.ok(Math.abs(actual[c]-independentCenter[c])<1e-12,`layer composition channel ${c}`);
 const oracle=Array.from({length:channels},(_,channel)=>triangularCentroidMean(point=>independentComposition(point,covers,background)[channel],triangle));
 for(let c=0;c<channels;c++)assert.ok(Math.abs(actual[c]-oracle[c])<=bound+.0002,`channel ${c}: remainder ${Math.abs(actual[c]-oracle[c])}, bound ${bound}`);

 // The generic integrator must call the adapter on its actual active layers
 // and use the smaller certificate while retaining its advertised error limit.
 const box={x:1.4,y:1.4,width:.4,height:.4};
 const integrated=integrateMaterialArea({box,width:1,height:1,background,layers,
  lipschitz:landscapeMaterialLipschitz(covers),centroidErrorBound:landscapeMaterialCentroidError,tolerance:.02});
 assert.ok(integrated.stats.curvatureBounds>0);
 assert.ok(integrated.errorBounds[0]<=.02);
});

test('centroid callback rejects invalid bounds and unknown layers retain Lipschitz fallback',()=>{
 const box={x:0,y:0,width:1,height:1},geometry=rectangle(0,0,1,1),background=[0];
 const input={box,width:1,height:1,background,layers:[{geometry,varying:true,paint(v,p){v[0]=p.x;}}],lipschitz:1,tolerance:.1};
 for(const invalid of [-1,NaN,Infinity])assert.throws(()=>integrateMaterialArea({...input,centroidErrorBound:()=>invalid}),/Invalid centroid error bound/);
 const result=integrateMaterialArea({...input,centroidErrorBound:landscapeMaterialCentroidError});
 assert.ok(result.errorBounds[0]<=.1);
 assert.ok(result.stats.curvatureQueries>0);
 assert.equal(result.stats.curvatureBounds,0);
});

test('full 256-square material tile meets analytic forest and ground bounds without more work allowance',()=>{
 const covers=[cover([squareHole()],.5)],width=256;
 const result=integrateMaterialArea({box:{x:0,y:0,width:6,height:6},width,height:width,
  background:landscapeMaterialBackground(options.landColor),layers:sourceLayers(covers),
  lipschitz:landscapeMaterialLipschitz(covers),centroidErrorBound:landscapeMaterialCentroidError});
 const mean=c=>result.pixels.reduce((s,v,i)=>s+(i%14===c?v:0),0)/(width*width);
 const bound=result.errorBounds.reduce((s,v)=>s+v,0)/(width*width);
 const forest=.5*(32-16*.5+(4-Math.PI)*.5**2/3)/36;
 const ground=1-.78*(32-16*.5+.3*(4-Math.PI)*.5**2)/36;
 assert.ok(Math.abs(mean(4)-forest)<=bound);
 for(const c of [9,10,11])assert.ok(Math.abs(mean(c)-ground)<=bound);
 assert.ok(Math.max(...result.errorBounds)<=1/255);
 assert.ok(result.stats.curvatureBounds>0);
 assert.ok(result.stats.work<=2000000);
 assert.ok(result.stats.peakPendingTriangles<=65536);
});
