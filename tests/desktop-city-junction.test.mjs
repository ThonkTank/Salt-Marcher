import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({entryPoints:['src/app/city-street-junction.ts'],outfile:'.build/city-junction.cjs',bundle:true,platform:'node',format:'cjs'});
const {createStreet,streetSnap,streetPreview}=createRequire(import.meta.url)('../.build/city-junction.cjs');
const node=(id,x,y)=>({id,kind:'node',name:'',protected:true,point:{x,y}});
const original={id:'main',kind:'road',name:'Marktstraße',protected:true,nodeIds:['a','b'],via:[{x:50,y:0},{x:50,y:100}],width:8,notes:'Exact\nmetadata',recipe:{seed:'kept',algorithm:'manual'}};
const base=[node('a',0,0),node('b',100,100),original];
const ids=()=>{let n=0;return()=>`new-${++n}`;};
test('a midway junction preserves the complete bent street and its metadata',()=>{
 const before=structuredClone(base),at={x:52,y:40},preview=streetPreview(base,[{x:90,y:40},at]);
 assert.deepEqual(preview.path.at(-1),{x:50,y:40});assert.equal(preview.junctions[0].roadId,'main');
 const result=createStreet(base,[{x:90,y:40},at],4,ids()),updates=result.upsert;
 const roads=updates.filter(u=>u.kind==='road'),main=roads.find(u=>u.id==='main'),tail=roads.find(u=>u.id!==result.road.id&&u.id!=='main');
 const junction=updates.find(u=>u.kind==='node'&&u.point.x===50);
 assert.deepEqual(main.nodeIds,['a',junction.id]);assert.deepEqual(main.via,[{x:50,y:0}]);
 assert.deepEqual(tail.nodeIds,[junction.id,'b']);assert.deepEqual(tail.via,[{x:50,y:100}]);
 for(const road of [main,tail])for(const key of ['name','protected','width','notes','recipe'])assert.deepEqual(road[key],original[key]);
 assert.equal(result.road.nodeIds[1],junction.id);assert.deepEqual(base,before);
});
test('both ends may split the same street, including an existing bend',()=>{
 const result=createStreet(base,[{x:50,y:0},{x:80,y:20},{x:50,y:70}],4,ids());
 const streets=result.upsert.filter(u=>u.kind==='road'&&u.id!==result.road.id);
 assert.equal(streets.length,3);assert.equal(new Set(streets.map(u=>u.id)).size,3);
 for(const end of result.road.nodeIds)assert.equal(streets.filter(u=>u.nodeIds.includes(end)).length,2);
 assert.deepEqual(streets.flatMap(u=>u.via),[{x:50,y:100}]);
});
test('existing street nodes are reused; walls never attract a new street',()=>{
 const wall=[node('w1',10,10),node('w2',30,10),{id:'wall',kind:'wall',name:'Wall',protected:true,nodeIds:['w1','w2'],width:8}];
 assert.equal(streetSnap(wall,{x:10,y:10}),null);assert.equal(streetSnap(wall,{x:20,y:10}),null);
 const result=createStreet(base,[{x:1,y:1},{x:0,y:30}],4,ids());
 assert.equal(result.road.nodeIds[0],'a');assert.equal(result.upsert.filter(u=>u.kind==='road').length,1);
 assert.throws(()=>createStreet(base,[{x:1,y:0},{x:2,y:0}],4,ids()),/aufeinander/);
});
