import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({entryPoints:['src/app/city-shape.ts'],outfile:'.build/city-shape.cjs',bundle:true,platform:'node',format:'cjs'});
const {CityShape}=createRequire(import.meta.url)('../.build/city-shape.cjs');
function setup(){
 const units=[{id:'a',kind:'node',point:{x:0,y:0}},{id:'b',kind:'node',point:{x:50,y:0}},{id:'r',kind:'road',nodeIds:['a','b'],via:[],protected:true},{id:'other',kind:'road',nodeIds:['b','a'],via:[]},{id:'house',kind:'building',notes:'Keep',position:{x:20,y:20},rooms:[{id:'room'}]}];
 let owner={token:'token',cityId:'city',revision:4,unit:units[2],units};const writes=[];let send=async(...args)=>writes.push(structuredClone(args));
 const editor=new CityShape({current:()=>owner,drain:async()=>true,send:(...args)=>send(...args),rejected:e=>e.message==='Rejected',changed:()=>{}});
 return {editor,units,writes,setOwner:o=>owner=o,owner,setSend:f=>send=f};
}
test('shape preview changes shared node and road in one command while preserving houses',async()=>{
 const x=setup();await x.editor.begin();x.editor.choose(1);x.editor.point({x:60,y:10});x.editor.insert(0);x.editor.point({x:30,y:20});
 assert.equal(x.writes.length,0);const preview=x.editor.units(x.units);assert.deepEqual(preview.find(u=>u.id==='b').point,{x:60,y:10});assert.equal(preview[4],x.units[4]);
 await x.editor.accept();assert.equal(x.writes.length,1);const [action,,revision]=x.writes[0];assert.equal(revision,4);assert.deepEqual(action.upsert.map(u=>u.id),['a','b','r']);assert.deepEqual(action.upsert[2].via,[{x:30,y:20}]);assert.deepEqual(x.units[1].point,{x:50,y:0});assert.equal(x.editor.active,false);
});
test('shape cancel and changed revision never write stale geometry',async()=>{
 const x=setup();await x.editor.begin();x.editor.point({x:10,y:10});x.editor.cancel();assert.equal(x.writes.length,0);assert.equal(x.editor.units(x.units),x.units);
 await x.editor.begin();x.editor.point({x:10,y:10});x.setOwner({...x.owner,revision:5});await x.editor.accept();assert.equal(x.writes.length,0);assert.match(x.editor.state.message,/Stadtstand geändert/);
});
test('unconfirmed shape acceptance freezes edits and retries exactly the same command',async()=>{
 const x=setup();let first=true;x.setSend(async(...args)=>{x.writes.push(structuredClone(args));if(first){first=false;throw new Error('Lost acknowledgement');}});await x.editor.begin();x.editor.point({x:10,y:10});await x.editor.accept();assert.equal(x.editor.locked,true);assert.equal(x.editor.cancel(),false);x.editor.point({x:99,y:99});await x.editor.accept();assert.deepEqual(x.writes[0],x.writes[1]);assert.equal(x.editor.active,false);
});
test('polygon draft retains at least three corners; shared road ends cannot be removed',async()=>{
 const x=setup();await x.editor.begin();x.editor.remove();assert.equal(x.editor.state.points.length,2);x.editor.cancel();const district={id:'district',kind:'district',protected:true,outline:[{x:0,y:0},{x:10,y:0},{x:10,y:10}]};x.setOwner({...x.owner,unit:district,units:[district]});await x.editor.begin();x.editor.remove();assert.equal(x.editor.state.points.length,3);x.editor.insert(1);assert.equal(x.editor.state.points.length,4);await x.editor.accept();assert.equal(x.writes[0][0].upsert[0].outline.length,4);
});
test('closed road or wall keeps both handles on its single shared end node',async()=>{
 const x=setup(),road={...x.owner.unit,kind:'wall',nodeIds:['a','a'],via:[{x:50,y:0},{x:50,y:50}]};x.setOwner({...x.owner,unit:road,units:[x.units[0],road,x.units[4]]});await x.editor.begin();x.editor.choose(3);x.editor.point({x:5,y:5});assert.deepEqual(x.editor.state.points[0],{x:5,y:5});assert.deepEqual(x.editor.state.points[3],{x:5,y:5});await x.editor.accept();assert.deepEqual(x.writes[0][0].upsert[0].point,{x:5,y:5});assert.equal(x.writes[0][0].upsert.filter(u=>u.kind==='node').length,1);
});
