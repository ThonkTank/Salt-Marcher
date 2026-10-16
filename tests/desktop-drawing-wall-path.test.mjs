import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({entryPoints:['src/app/drawing-wall-path.ts'],outfile:'.build/drawing-wall-path.cjs',bundle:true,platform:'node',format:'cjs'});
const {roomWallPath}=createRequire(import.meta.url)('../.build/drawing-wall-path.cjs'),U=1.524;
const room=(id,x,y,w,h)=>({id,scopeId:'local',floorId:'ground',polygons:[{outer:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],holes:[]}]});
const gate=room('gate',0,0,4*U,4*U),hall=room('hall',4*U,U,3*U,U),guard=room('guard',7*U,0,4*U,4*U),rooms=[gate,hall,guard];
const side=id=>({target:{kind:'geometry',id}}),passage=(id,owner,x,face)=>({id,assigned:true,roomId:owner,otherRoomId:'hall',pathId:'route',anchor:{volumeId:owner,local:{x,y:1,z:0,face}},widthSteps:1,outbound:side('hall'),inbound:side(owner)});
const view={paths:[{id:'route',roomId:'hall'}],passages:[passage('A','gate',3,'east'),passage('B','guard',0,'west')],volumes:[{id:'gate',scopeId:'local',floorId:'ground',columns:[{x:0,y:0}]},{id:'guard',scopeId:'local',floorId:'ground',columns:[{x:7,y:0}]}]};
function blocked(d,x,y){const lines=[...d.matchAll(/M([^,]+),([^L]+)L([^,]+),([^M ]+)/g)].map(m=>m.slice(1).map(Number));return lines.some(([ax,ay,bx,by])=>Math.abs((x-ax)*(by-ay)-(y-ay)*(bx-ax))<1e-6&&x>=Math.min(ax,bx)-1e-6&&x<=Math.max(ax,bx)+1e-6&&y>=Math.min(ay,by)-1e-6&&y<=Math.max(ay,by)+1e-6);}
test('physical corridor openings cut both the endpoint room and generated corridor walls',()=>{
 for(const r of rooms){const d=roomWallPath(r,rooms,view);if(r.id!=='guard')assert.equal(blocked(d,4*U,1.5*U),false);if(r.id!=='gate')assert.equal(blocked(d,7*U,1.5*U),false);}
 assert.equal(blocked(roomWallPath(gate,rooms,view),4*U,.5*U),true);
});
test('a hidden corridor cannot leave a telltale opening in the public endpoint wall',()=>{
 const visible=[gate,guard];assert.equal(blocked(roomWallPath(gate,visible,view),4*U,1.5*U),true);assert.equal(blocked(roomWallPath(guard,visible,view),7*U,1.5*U),true);
});
test('a hidden destination closes both visible ends even when the corridor itself remains visible',()=>{
 const visible=[gate,hall];assert.equal(blocked(roomWallPath(hall,visible,view),7*U,1.5*U),true);
});
test('unassigned passages retain the wall and a vertical floor passage does not cut a wall',()=>{
 for(const passage of [{...view.passages[0],assigned:false},{...view.passages[0],anchor:{...view.passages[0].anchor,local:{...view.passages[0].anchor.local,face:'up'}}}]){
  const d=roomWallPath(gate,rooms,{...view,passages:[passage]});assert.equal(blocked(d,4*U,1.5*U),true);
 }
});

test('a two-field corridor opens precisely its full occupied edge without a half-field notch',()=>{
 const wide=room('hall',4*U,U,3*U,2*U),visible=[gate,wide,guard],data={...view,passages:view.passages.map(p=>({...p,widthSteps:2}))};
 for(const [r,x]of [[gate,4*U],[wide,4*U],[wide,7*U],[guard,7*U]]){
  const d=roomWallPath(r,visible,data);assert.equal(blocked(d,x,1.25*U),false);assert.equal(blocked(d,x,2.75*U),false);
  if(r.id!=='hall'){assert.equal(blocked(d,x,.75*U),true);assert.equal(blocked(d,x,3.25*U),true);}
 }
});
