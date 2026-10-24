import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const dir=mkdtempSync(join(tmpdir(),'atlas-route-interval-')),outfile=join(dir,'api.cjs');
buildSync({stdin:{contents:`export * from './tools/atlas-prototypes/route-field-interval';export * from './src/app/terrain-route';`,resolveDir:process.cwd()},outfile,bundle:true,platform:'node',format:'cjs'});
const {createRouteFieldIntervals,RouteSurface}=createRequire(import.meta.url)(outfile);
process.on('exit',()=>rmSync(dir,{recursive:true,force:true}));

const limits=(overrides={})=>({corridor:100,cut:3,fill:3,shoulder:6,grade:.12,depth:2,clearance:4,...overrides});
const route=(id,kind,nodes,options={})=>({id,revision:1,kind,name:id,points:[],polygons:[],resolution:1,width:options.width??8,values:{},route:{version:1,anchors:[{x:nodes[0].x,y:nodes[0].y},{x:nodes.at(-1).x,y:nodes.at(-1).y}],limits:limits(options.limits),protected:true,sections:nodes.slice(1).map(n=>n.structure),nodes,conflict:options.conflict},line:options.fadeIn?{fadeIn:true}:undefined});
const box=(x,y,width,height)=>({x,y,width,height});

function check(records,boxes,bases=[0],n=20){
 const exact=new RouteSurface(records),field=createRouteFieldIntervals(records);let samples=0;
 for(const region of boxes)for(const base of bases){
  const result=field.range(region,[base,base]);
  assert.ok(Number.isFinite(result.heightM[0])&&Number.isFinite(result.heightM[1])&&result.heightM[0]<=result.heightM[1],`invalid height range ${JSON.stringify(result)}`);
  assert.ok([0,1].includes(result.water[0])&&[0,1].includes(result.water[1])&&result.water[0]<=result.water[1],`invalid water range ${JSON.stringify(result)}`);
  for(let y=0;y<=n;y++)for(let x=0;x<=n;x++){
   const p={x:region.x+region.width*x/n,y:region.y+region.height*y/n},at=exact.at(p,base);
   assert.ok(result.heightM[0]<=at.height&&at.height<=result.heightM[1],`${JSON.stringify(region)} base=${base}: ${result.heightM[0]} <= ${at.height} <= ${result.heightM[1]} at ${JSON.stringify(p)}`);
   const wet=at.water===undefined?0:1;
   assert.ok(result.water[0]<=wet&&wet<=result.water[1],`${JSON.stringify(region)}: water ${result.water} excludes ${wet} at ${JSON.stringify(p)}`);samples++;
  }
 }
 return {field,exact,samples};
}

test('empty and conflicted routes preserve the supplied base and never invent water',()=>{
 const conflict=route('conflict','river',[{x:0,y:0,z:7,structure:'ground'},{x:40,y:0,z:7,structure:'ground'}],{conflict:'overlap'});
 const {field}=check([conflict],[box(-4,-4,48,8)],[-120,0,35]);
 for(const base of [-120,0,35])assert.deepEqual(field.range(box(-10,-10,20,20),[base,base]),{heightM:[base,base],water:[0,0]});
});

test('road cut and fill clamps bound the corridor, shoulder and far field',()=>{
 const road=route('road','road',[{x:-80,y:0,z:100,structure:'ground'},{x:80,y:0,z:-100,structure:'ground'}],{width:12,limits:{cut:2,fill:1,shoulder:10}});
 check([road],[box(-2,-16,4,32),box(18,-16,4,32),box(-300,-1,1,2)],[-20,0,80],32);
 const field=createRouteFieldIntervals([road]);
 for(const base of [-20,0,80]){
  const r=field.range(box(-2,-2,4,4),[base,base]);
  assert.ok(r.heightM[0]>=base-2-1e-9&&r.heightM[1]<=base+1+1e-9,`cut/fill escaped for ${base}: ${r.heightM}`);
 }
});

test('river bed profile, bank shoulder, physical-water presence and fade-in station are enclosed',()=>{
 const river=route('river','river',[{x:0,y:0,z:24,structure:'ground'},{x:100,y:0,z:14,structure:'ground'}],{width:10,fadeIn:true,limits:{depth:4,shoulder:8,cut:9}});
 const {field}=check([river],[box(-1,-7,2,14),box(49,-13,2,26),box(99,-8,2,16)],[-10,0,30],40);
 assert.deepEqual(field.range(box(40,-2,5,4),[0,0]).water,[1,1]);
 assert.deepEqual(field.range(box(40,8,5,2),[0,0]).water,[0,0]);
 const fade=field.range(box(0,-.2,.4,.4),[30,30]).heightM;
 const full=field.range(box(80,-.2,.4,.4),[30,30]).heightM;
 assert.ok(fade[0]>full[0],`fade-in bed should be shallower: ${fade} vs ${full}`);
});

test('bridge and tunnel transitions keep structure gaps out of ground cuts while ford remains ground-shaped',()=>{
 const road=route('structures','road',[
  {x:0,y:0,z:30,structure:'ground'},{x:20,y:0,z:30,structure:'bridge'},
  {x:40,y:0,z:30,structure:'tunnel'},{x:60,y:0,z:30,structure:'ford'},{x:80,y:0,z:30,structure:'ground'},
 ],{width:8,limits:{cut:20,fill:20,shoulder:4}});
 const {exact}=check([road],[box(5,-5,70,10)],[0],50);
 assert.equal(exact.at({x:20,y:0},0).height,0,'bridge transition point is structure-covered');
 assert.equal(exact.at({x:40,y:0},0).height,0,'tunnel transition point is structure-covered');
 assert.ok(exact.at({x:60,y:0},0).height>0,'ford is still a ground surface');
});

test('crossings, nearest-segment ties, and record order stay enclosed',()=>{
 const east=route('east','road',[{x:-50,y:0,z:20,structure:'ground'},{x:50,y:0,z:20,structure:'ground'}],{width:10});
 const north=route('north','river',[{x:0,y:-50,z:-5,structure:'ground'},{x:0,y:50,z:-5,structure:'ground'}],{width:8,limits:{depth:1,shoulder:6}});
 const region=box(-5,-5,10,10),records=[east,north];
 const a=check(records,[region],[-10,0,25],28),b=check([...records].reverse(),[region],[-10,0,25],28);
 // Both record orders independently enclose their canonical floating-point
 // accumulation; the interval endpoints need not be bit-identical.
 assert.deepEqual(a.exact.at({x:0,y:0},0).water,-5,'crossing water uses the lower physical river level');
});

test('same-route equidistant loop segments retain the first nearest-segment tie',()=>{
 const loop=route('loop','road',[
  {x:-20,y:-2,z:10,structure:'ground'},{x:20,y:-2,z:10,structure:'ground'},
  {x:20,y:2,z:100,structure:'ground'},{x:-20,y:2,z:100,structure:'ground'},
 ],{width:20,limits:{cut:100,fill:100,shoulder:4}});
 const {exact}=check([loop],[box(-.01,-.01,.02,.02)],[0],4);
 assert.equal(exact.at({x:0,y:0},0).height,10,'strict nearest-distance ties keep the earlier segment');
});

test('degenerate route segments remain sampleable at their authored point',()=>{
 const degenerate=route('point-route','road',[
  {x:-3,y:7,z:9,structure:'ground'},{x:-3,y:7,z:15,structure:'ground'},
 ],{width:8,limits:{cut:30,fill:30,shoulder:4}});
 const {exact}=check([degenerate],[box(-3.01,6.99,.02,.02),box(20,20,.1,.1)],[0,12],8);
 assert.equal(exact.at({x:-3,y:7},0).height,9,'zero-length segment uses its first endpoint at t=0');
});

test('negative and distant coordinates, cell edges, and neighboring index cells enclose exact samples',()=>{
 const far=2**36;
 const road=route('far','road',[{x:far-100,y:-far,z:11,structure:'ground'},{x:far+100,y:-far,z:15,structure:'ground'}],{width:18,limits:{shoulder:12}});
 check([road],[box(far-1,-far-1,2,2),box(far+63.9,-far-15,1.2,30),box(far+64,-far-14,0,20),box(far+1000,-far+1000,1,1)],[-1e4,0,1e4],28);
});

test('shrinking local boxes tighten away from route discontinuities',()=>{
 const road=route('converge','road',[{x:-100,y:0,z:18,structure:'ground'},{x:100,y:0,z:22,structure:'ground'}],{width:12,limits:{shoulder:20}});
 const field=createRouteFieldIntervals([road]),p={x:23.456,y:2.345},base=3,exact=new RouteSurface([road]).at(p,base).height;
 const widths=[];
 for(const half of [4,1,.25,.0625]){
  const r=field.range(box(p.x-half,p.y-half,2*half,2*half),[base,base]);
  assert.ok(r.heightM[0]<=exact&&exact<=r.heightM[1]);widths.push(r.heightM[1]-r.heightM[0]);
 }
 assert.ok(widths.at(-1)<widths[0]/3,`local intervals did not tighten: ${widths}`);
});

test('variable base intervals enclose independently varying terrain under crossing routes',()=>{
 const records=[
  route('east','road',[{x:-50,y:0,z:20,structure:'ground'},{x:50,y:0,z:-10,structure:'ground'}],{width:10}),
  route('north','river',[{x:0,y:-50,z:5,structure:'ground'},{x:0,y:50,z:-5,structure:'ground'}],{width:8,fadeIn:true}),
 ];
 const field=createRouteFieldIntervals(records),exact=new RouteSurface(records),region=box(-6,-6,12,12),r=field.range(region,[-40,40]);
 for(let iy=0;iy<=24;iy++)for(let ix=0;ix<=24;ix++){
  const p={x:-6+ix/2,y:-6+iy/2};
  for(const base of [-40,40,40*Math.sin(ix+iy)]){
   const value=exact.at(p,base);
   assert.ok(r.heightM[0]<=value.height&&value.height<=r.heightM[1]);
   const water=Number(value.water!==undefined);assert.ok(r.water[0]<=water&&water<=r.water[1]);
  }
 }
});

test('oversized route-cell queries return explicit uncertainty and a subdivision hint',()=>{
 const records=[route('short','river',[{x:0,y:0,z:10,structure:'ground'},{x:50,y:0,z:5,structure:'ground'}])];
 const field=createRouteFieldIntervals(records),region=box(-1e6,-1e6,2e6,2e6);
 assert.deepEqual(field.range(region,[0,0]),{heightM:[-Infinity,Infinity],water:[0,1]});
 const cut=field.integrationCut([{x:-1e6,y:-1e6},{x:1e6,y:-1e6},{x:1e6,y:1e6}]);
 assert.ok(cut.value>-1e6&&cut.value<1e6);
});
