import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({entryPoints:['src/app/drawing-door-placement.ts'],outfile:'.build/drawing-door-placement.cjs',bundle:true,platform:'node',format:'cjs'});
const {doorPlacement}=createRequire(import.meta.url)('../.build/drawing-door-placement.cjs');
const room=(id,x,y,w,h)=>({id,polygons:[{outer:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],holes:[]}]});
const U=1.524,gate=room('gate',U,3*U,4*U,4*U),hall=room('hall',5*U,4*U,3*U,U);
test('a click at the middle of a one-cell corridor stays on its end wall instead of snapping to a corner',()=>{
 const placed=doorPlacement({x:5*U,y:4.5*U},[gate,hall],U,'hall');
 assert.equal(placed.roomId,'hall');assert.equal(placed.anchor.edge,3);assert.equal(placed.anchor.t,.5);
 assert.deepEqual(placed.point,{x:5*U,y:4.5*U});
});
test('the nearest wall wins over an unrelated selected room; a door fits within the short wall',()=>{
 const placed=doorPlacement({x:8*U+.01,y:4.1*U},[gate,hall],U,'gate');
 assert.equal(placed.roomId,'hall');assert.equal(placed.anchor.edge,1);assert.equal(placed.anchor.t,.5);
});
test('wall projection remains on a diagonal and clamps a door away from the corner',()=>{
 const r={id:'diagonal',polygons:[{outer:[{x:0,y:0},{x:4,y:4},{x:0,y:8}],holes:[]}]};
 const placed=doorPlacement({x:.05,y:.04},[r],2,null);
 assert.equal(placed.anchor.edge,0);assert.ok(placed.point.x>.7&&placed.point.y>.7);assert.equal(placed.point.x,placed.point.y);
 assert.equal(doorPlacement({x:0,y:0},[],U,null),null);
});

test('a shared wall binds the unique room across it despite small drawing gaps and opposite winding',()=>{
 const left=room('left',0,0,5,10),right=room('right',5.004,0,5,10);right.polygons[0].outer.reverse();
 const placed=doorPlacement({x:5,y:5},[left,right],1.524,'left');
 assert.equal(placed.roomId,'left');assert.equal(placed.targetRoomId,'right');
 assert.equal(doorPlacement({x:0,y:5},[left,right],1.524,'left').targetRoomId,null);
});
test('a selected unrelated room, overlapping candidates and nearby exterior walls cannot invent portal links',()=>{
 const left=room('left',0,0,5,10),right=room('right',5,0,5,10),far=room('far',20,0,5,10);
 assert.equal(doorPlacement({x:5,y:5},[left,right,far],1.524,'far').targetRoomId,'right');
 assert.equal(doorPlacement({x:5,y:5},[left,right,room('duplicate',5,0,5,10)],1.524,'left').targetRoomId,null);
 assert.equal(doorPlacement({x:5,y:5},[left,room('overlap',4,0,5,10)],1.524,'left').targetRoomId,null);
 assert.equal(doorPlacement({x:5,y:5},[left,room('gap',5.2,0,5,10)],1.524,'left').targetRoomId,null);
});
