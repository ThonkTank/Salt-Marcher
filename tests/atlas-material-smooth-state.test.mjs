import test from 'node:test';
import assert from 'node:assert/strict';
import {baseSmooth,coverSmooth,editSmooth,getAlpha,legacyPartSmooth,makeSmoothState,pigmentSmooth,scratchSmooth} from '../tools/atlas-prototypes/material-smooth.mjs';

const triangle=[{x:.2,y:.2},{x:.8,y:.2},{x:.2,y:.8}];
const base=[.2,.35,.5];
const coverColor=[.75,.25,.1];
const paintColor=[.9,.7,.15];
const point=(x,y=.3)=>({x,y});
const coverRegion={varying:true,featureOnTriangle:()=>({kind:'affine'}),fade:p=>.2+.5*p.x};
const cover=coverSmooth(coverColor,coverRegion,2);
const alpha=(s,t,p)=>{
  const value=.35+.1*p.x;
  return {value,gradient:.1,hessian:0,error:.015,range:[Math.max(0,value-.04),Math.min(1,value+.04)]};
};
const eraseAlpha=(s,t,p)=>{
  const value=.22+.04*p.x;
  return {value,gradient:.04,hessian:0,error:.01,range:[Math.max(0,value-.025),Math.min(1,value+.025)]};
};

function evaluate(x,withPaint=true,withErase=true){
  const background=[...base,1,.3,0,0,0,0,...base,1,0];
  const state=makeSmoothState(background);
  assert.equal(baseSmooth(base,.3)(state,triangle,point(x)),true);
  assert.equal(scratchSmooth(.6)(state,triangle,point(x)),true);
  assert.equal(cover(state,triangle,point(x)),true);
  if(withPaint)assert.equal(pigmentSmooth(paintColor,'paint',alpha)(state,triangle,point(x)),true);
  if(withErase)assert.equal(pigmentSmooth(paintColor,'erase',eraseAlpha)(state,triangle,point(x)),true);
  return state;
}

function independent(x){
  const t=.2+.5*x,s=t*t*(3-2*t),a=.78*s;
  const covered=base.map((v,c)=>v*(1-a)+coverColor[c]*a);
  let p=[0,0,0],A=0,final=[...covered];
  const b=.35+.1*x;
  for(let c=0;c<3;c++){p[c]=p[c]*(1-b)+paintColor[c]*b;final[c]=final[c]*(1-b)+paintColor[c]*b;}
  A=A*(1-b)+b;
  const e=.22+.04*x;
  for(let c=0;c<3;c++){p[c]*=1-e;final[c]=final[c]*(1-e)+covered[c]*e;}
  A*=1-e;
  return {covered,p,A,final};
}

test('smooth cover and paint/erase state follows independent point source-over composition',()=>{
  const x=.4,state=evaluate(x),oracle=independent(x);
  for(let c=0;c<3;c++){
    assert.ok(Math.abs(state.value[c]-oracle.covered[c])<1e-12);
    assert.ok(Math.abs(state.value[5+c]-oracle.p[c])<1e-12);
    assert.ok(Math.abs(state.value[9+c]-oracle.final[c])<1e-12);
  }
  assert.ok(Math.abs(state.value[8]-oracle.A)<1e-12);
  const alphaState=getAlpha(state,triangle,point(x));
  assert.equal(alphaState.value,state.value[8]);
  assert.ok(alphaState.range[0]<=state.value[8]&&state.value[8]<=alphaState.range[1]);
});

test('composed derivative bounds dominate finite differences through cover, paint, and erase',()=>{
  const x=.4,h=.0002,s=evaluate(x);
  for(const channel of [0,1,2,4,5,6,7,8,9,10,11]){
    const fm=evaluate(x-h).value[channel],f0=s.value[channel],fp=evaluate(x+h).value[channel];
    const d=Math.abs((fp-fm)/(2*h));
    const dd=Math.abs((fp-2*f0+fm)/(h*h));
    assert.ok(d<=s.gradient[channel]+2e-5,`channel ${channel} derivative ${d} > ${s.gradient[channel]}`);
    assert.ok(dd<=s.hessian[channel]+.01,`channel ${channel} Hessian ${dd} > ${s.hessian[channel]}`);
  }
});

test('uncertain alpha composes source error using its full range and alpha error',()=>{
  const s=makeSmoothState([...base,1,.3,0,0,0,0,...base,1,0]);
  s.error[5]=.12;
  const get=(state,tri,p)=>({value:.5,gradient:.2,hessian:.1,error:.03,range:[.25,.75]});
  assert.equal(pigmentSmooth([.8,.6,.4],'paint',get)(s,triangle,point(.4)),true);
  const expected=Math.max((1-.25)*.12+.25*0,(1-.75)*.12+.75*0)+.03;
  assert.ok(Math.abs(s.error[5]-expected)<1e-15);
  assert.ok(Math.abs(s.error[9]-.03)<1e-15,'a channel with no incoming source error keeps only alpha source error');
  assert.equal(s.gradient[5],.2);
  assert.equal(s.hessian[5],.1);
});

test('exact base, scratch, density edits, and legacy parts clear only their own source bounds',()=>{
  const s=makeSmoothState([...base,1,.3,0,0,0,0,...base,1,0]);
  s.error[0]=.4;s.gradient[0]=3;
  assert.equal(scratchSmooth(.4)(s),true);
  assert.equal(editSmooth('thin')(s),true);
  assert.equal(s.value[13],.12);
  assert.equal(legacyPartSmooth(.5)(s),true);
  assert.equal(s.gradient[13],0);assert.equal(s.hessian[13],0);assert.equal(s.error[13],0);
  assert.equal(baseSmooth([.1,.2,.3],.8)(s),true);
  assert.equal(s.value[0],.1);assert.equal(s.gradient[0],0);assert.equal(s.error[0],0);
});

test('unknown cover feature and malformed alpha fail without partial state updates',()=>{
  const s=makeSmoothState([...base,1,.3,0,0,0,0,...base,1,0]),before=structuredClone(s);
  const unknown=coverSmooth(coverColor,{varying:true,fade:()=>.5},1);
  assert.equal(unknown(s,triangle,point(.4)),false);
  assert.deepEqual(s,before);
  assert.equal(pigmentSmooth(paintColor,'paint',()=>undefined)(s,triangle,point(.4)),false);
  assert.deepEqual(s,before);
});
