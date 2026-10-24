import test from 'node:test';
import assert from 'node:assert/strict';
import {integrateMaterialArea} from '../tools/atlas-prototypes/material-area.mjs';
import {landscapeMaterialBackground,landscapeMaterialLayers,landscapeMaterialLipschitz} from '../tools/atlas-prototypes/material-sources.mjs';

const rect=(x,y,width,height)=>({outer:[{x,y},{x:x+width,y},{x:x+width,y:y+height},{x,y:y+height}],holes:[]});
const cover=(polygons,edge=.5)=>({polygons,vegetation:{preset:{ground:'#000000',density:.4,edge},edits:[]}});
const options={palette:{water:'#0000ff'},landColor:'#ffffff',edgePolicy:'authored-world'};
const layersFor=(covers,waterGeometry=[])=>landscapeMaterialLayers({...options,coverRecords:covers,waterGeometry});
const integrate=(box,covers,extra={})=>integrateMaterialArea({box,width:1,height:1,background:landscapeMaterialBackground(options.landColor),layers:layersFor(covers),lipschitz:landscapeMaterialLipschitz(covers),tolerance:.08,...extra});
const close=(a,b,tolerance)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} vs ${b}; tolerance ${tolerance}`);

test('overlapping and touching source parts have the same integrated channels as one authored outline',()=>{
 const box={x:0,y:0,width:6,height:3},whole=cover([rect(0,0,6,3)],1);
 for(const parts of [[rect(0,0,4,3),rect(2,0,4,3)],[rect(0,0,2,3),rect(2,0,4,3)]]){
  for(const width of [1,4]){
   const expected=integrate(box,[whole],{width,height:width});
   const actual=integrate(box,[cover(parts,1)],{width,height:width});
   actual.pixels.forEach((v,i)=>close(v,expected.pixels[i],1e-12));
   assert.equal(actual.stats.subdivisions,0,'union retains exact convex integration');
  }
 }
});

test('holed cover keeps unknown polynomial degree and satisfies an analytic forest area bound',()=>{
 const polygon=rect(0,0,6,6);polygon.holes=[rect(2,2,2,2).outer];
 const covers=[cover([polygon])],layers=layersFor(covers),box={x:0,y:0,width:6,height:6};
 assert.ok(layers.some(l=>l.varying&&l.polynomialDegree===undefined));
 assert.throws(()=>integrate(box,covers,{layers,lipschitz:0}),/Lipschitz/);
 const actual=integrate(box,covers,{layers});
 // Layer cake: for 0 <= t <= r=.5, the inset ring area is
 // (6-2t)^2 - (4+8t+pi*t^2). Integrate A(t)/r, then density .4/.8.
 const r=.5,expected=.5*(32-16*r+(4-Math.PI)*r*r/3)/36;
 close(actual.pixels[4],expected,actual.errorBounds[0]);
 close(actual.pixels[4],expected,.001);
 assert.ok(actual.stats.subdivisions>0);
 // Hole interior is untouched by the cover, including its density scratch.
 const hole=integrate({x:2.25,y:2.25,width:1.5,height:1.5},covers);
 assert.deepEqual([...hole.pixels],landscapeMaterialBackground(options.landColor));
});

test('physical water masks a concave cover without becoming an authored forest edge',()=>{
 const polygon={outer:[{x:0,y:0},{x:4,y:0},{x:4,y:1},{x:1,y:1},{x:1,y:4},{x:0,y:4}],holes:[]};
 const covers=[cover([polygon],1)],box={x:.25,y:2,width:.5,height:.25};
 const dry=integrate(box,covers,{tolerance:.01});
 const wet=integrate(box,covers,{layers:layersFor(covers,[rect(.5,0,4,4)]),tolerance:.01});
 // Symmetry of this arm: clipping its right half removes exactly half forest.
 close(wet.pixels[4],dry.pixels[4]/2,wet.errorBounds[0]+dry.errorBounds[0]/2);
 close(wet.pixels[4],dry.pixels[4]/2,.0001);
 const fullyWet=integrate(box,covers,{layers:layersFor(covers,[rect(0,0,4,4)])});
 assert.equal(fullyWet.pixels[4],0);
 assert.deepEqual([...fullyWet.pixels.slice(9,13)],[0,0,1,1]);
});
