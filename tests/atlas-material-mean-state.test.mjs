import test from 'node:test';
import assert from 'node:assert/strict';
import {baseMean,coverMean,editMean,legacyPartMean,makeMeanState,pigmentMean,scratchMean} from '../tools/atlas-prototypes/material-mean.mjs';

const tri=[{x:0,y:0},{x:1,y:0},{x:0,y:1}], center={x:1/3,y:1/3};
const background=[.2,.3,.4,1,.25,.1,.15,.2,.3,.2,.3,.4,1,.5];
test('McCormick mean bounds retain shared X and alpha dependence',()=>{
 // X=A is positively correlated, then X=1-A is oppositely correlated.
 // Both have the same marginal ranges and means, but distinct exact means.
 const target=.9, xr=[0,1], ar=[0,1], xm=[.5,.5], am=[.5,.5];
 const positively=Array.from({length:10001},(_,i)=>{const a=i/10000;return a*(1-a)+target*a;}).reduce((x,y)=>x+y,0)/10001;
 const negatively=Array.from({length:10001},(_,i)=>{const a=i/10000,x=1-a;return x*(1-a)+target*a;}).reduce((x,y)=>x+y,0)/10001;
 const bounds=(xmean,amean)=>{
  const s=makeMeanState(background);s.range[5]=xr;s.mean[5]=xmean;
  const ok=pigmentMean([target,.2,.3],'paint',()=>({range:ar,mean:amean}))(s,tri,center);assert.equal(ok,true);return s.mean[5];
 };
 const p=bounds(xm,am),n=bounds(xm,am);
 assert.ok(p[0]<=positively&&p[1]>=positively);assert.ok(n[0]<=negatively&&n[1]>=negatively);
 assert.ok(p[1]-p[0]<.95,'bound improves on the independent pointwise interval');
});

test('exact base, scratch, edits, legacy parts, and constant pigment stay exact',()=>{
 const s=makeMeanState(background);assert.equal(baseMean([.1,.2,.3],.8)(s),true);
 assert.equal(scratchMean(.6)(s),true);assert.equal(editMean('thin')(s),true);assert.deepEqual(s.mean[13],[.18,.18]);
 assert.equal(legacyPartMean(.5)(s),true);assert.deepEqual(s.mean[13],[Math.round((.5+.18*.5)*255)/255,Math.round((.5+.18*.5)*255)/255]);
 const alpha={range:[.4,.4],mean:[.4,.4]};assert.equal(pigmentMean([.9,.7,.5],'paint',()=>alpha)(s,tri,center),true);
 assert.deepEqual(s.mean[5],[.42000000000000004,.42000000000000004]);assert.ok(Math.abs(s.mean[8][0]-.58)<1e-14);assert.ok(Math.abs(s.mean[9][0]-.42)<1e-14);
});

test('paint and erase preserve exact values when their inputs are constant',()=>{
 const s=makeMeanState(background);const a={range:[.25,.25],mean:[.25,.25]};
 assert.equal(pigmentMean([.8,.6,.4],'paint',()=>a)(s,tri,center),true);
 assert.deepEqual(s.mean[5],[.275,.275]);assert.ok(Math.abs(s.mean[9][0]-.35)<1e-14);
 assert.equal(pigmentMean([0,0,0],'erase',()=>a)(s,tri,center),true);
 assert.ok(Math.abs(s.mean[5][0]-.20625)<1e-14);assert.ok(Math.abs(s.mean[9][0]-.3125)<1e-14);
});

test('varying-base erase bounds correlated and opposite-correlated X, Y, and alpha fields',()=>{
 const scenarios=[
  {name:'same alpha correlation',x:u=>u,y:u=>1-u,a:u=>u,expected:1/3},
  {name:'opposite alpha correlation',x:u=>u,y:u=>1-u,a:u=>1-u,expected:2/3},
 ];
 for(const scenario of scenarios){
  const alphaMean=scenario.name==='same alpha correlation'?1/3:2/3;
  const s=makeMeanState(background);s.range[9]=[0,1];s.mean[9]=[1/3,1/3];s.range[0]=[0,1];s.mean[0]=[2/3,2/3];
  assert.equal(pigmentMean([0,0,0],'erase',()=>({range:[0,1],mean:[alphaMean,alphaMean]}))(s,tri,center),true);
  const [lo,hi]=s.mean[9];assert.ok(lo<=scenario.expected&&scenario.expected<=hi,`${scenario.name}: ${lo}..${hi} misses ${scenario.expected}`);
  // Dense integration over the unit right triangle, normalized by its area.
  let total=0,count=0,N=400;for(let i=0;i<N;i++)for(let j=0;j<N-i;j++){
   const u=(i+1/3)/N;const x=scenario.x(u),y=scenario.y(u),a=scenario.a(u);total+=x*(1-a)+y*a;count++;
  }
  const dense=total/count;assert.ok(lo<=dense&&dense<=hi,`${scenario.name}: dense mean ${dense} outside ${lo}..${hi}`);
 }
 assert.notEqual(scenarios[0].expected,scenarios[1].expected);
 // Marginal ranges and first moments do not identify joint dependence. Both
 // actual joint fields must be enclosed; the bound must not assume independence.
});

test('mixed cover produces enclosing means and falls back safely for unknown features',()=>{
 const s=makeMeanState(background),region={varying:true,featureOnTriangle:()=>({kind:'affine'}),fade:p=>p.x};
 assert.equal(coverMean([.8,.6,.4],region,1)(s,tri,center),true);
 assert.ok(s.mean[0][0]<=.8&&s.mean[0][1]>=.2);assert.ok(s.mean[4][0]<=.375&&s.mean[4][1]>=.375);
 const u=makeMeanState(background);
 assert.equal(coverMean([.8,.6,.4],{varying:true,fade:()=>.5},2)(u,tri,center),true);
 assert.ok(u.mean[0][0]<=u.range[0][0]&&u.mean[0][1]>=u.range[0][1]);
});

test('random dense blend fields stay within reported mean bounds',()=>{
 let seed=92813;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 for(let trial=0;trial<80;trial++){
  const x0=rand(),x1=rand(),a0=rand(),a1=rand(),y=rand();const xr=[Math.min(x0,x1),Math.max(x0,x1)],ar=[Math.min(a0,a1),Math.max(a0,a1)];
  const xm=[xr[0]+(xr[1]-xr[0])*rand(),xr[0]+(xr[1]-xr[0])*rand()].sort((a,b)=>a-b),am=[ar[0]+(ar[1]-ar[0])*rand(),ar[0]+(ar[1]-ar[0])*rand()].sort((a,b)=>a-b);
  const s=makeMeanState(background);s.range[5]=xr;s.mean[5]=xm;
  assert.equal(pigmentMean([y,.5,.4],'paint',()=>({range:ar,mean:am}))(s,tri,center),true);
  let sum=0,n=2000;for(let i=0;i<n;i++){const x=xm[0]+rand()*(xm[1]-xm[0]),a=am[0]+rand()*(am[1]-am[0]);sum+=x*(1-a)+y*a;}
  const actual=sum/n;assert.ok(s.mean[5][0]-1e-12<=actual&&actual<=s.mean[5][1]+1e-12);
 }
});
