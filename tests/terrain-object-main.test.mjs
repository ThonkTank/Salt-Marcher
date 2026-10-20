import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
buildSync({stdin:{contents:"export * from './src/app/terrain-object-view';export * from './src/app/terrain-objects';export * from './src/app/terrain-projection';export * as THREE from 'three';",resolveDir:process.cwd()},outfile:'.build/terrain-object-main-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {terrainObjectMeshes,TerrainObjectLayer,resolveTerrainObjects,validateTerrainProjection,THREE}=createRequire(import.meta.url)('../.build/terrain-object-main-test.cjs');
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const source={kind:'building',id:'house',scopeId:'rooms',name:'Courtyard',anchor:{x:0,y:0},outline:rect(0,0,10,10),footprint:[{outer:rect(0,0,10,10),holes:[rect(3,3,4,4)]},{outer:rect(20,0,4,4),holes:[]}],binding:{mode:'fixed',offsetM:10},wallM:3,roofM:2,floorElevations:[0,3],color:'#985c49'};
const resolved=()=>resolveTerrainObjects([structuredClone(source)],[])[0];
const hit=(meshes,x,y)=>new THREE.Raycaster(new THREE.Vector3(x,-y,100),new THREE.Vector3(0,0,-1)).intersectObjects(meshes,false);
test('shared room footprints preserve courtyards and disconnected components at a horizontal fixed elevation',()=>{
 const o=resolved(),meshes=terrainObjectMeshes(o,{x:0,y:0,z:0},1);
 assert.equal(o.baseM,10);assert.equal(o.topM,16);assert.deepEqual(o.floorsM,[10,13]);
 assert.equal(hit(meshes,5,5).length,0,'courtyard stays open');assert.equal(hit(meshes,15,2).length,0,'disconnected footprint gap stays open');
 assert.equal(hit(meshes,1,1)[0].point.z,18);assert(hit(meshes,22,2)[0].point.z>=16);
 for(const m of meshes){m.geometry.dispose();m.material.dispose();}
});
test('object layer reuses resources on unrelated frames, disposes changes, and opens focused interiors',()=>{
 const layer=new TerrainObjectLayer(),o=resolved(),origin={x:0,y:0,z:0};
 assert.equal(layer.update([o],origin,1),true);const meshes=layer.meshes;
 let disposed=0;for(const m of meshes)m.geometry.addEventListener('dispose',()=>disposed++);
 assert.equal(layer.update([structuredClone(o)],origin,1),false);assert.equal(layer.meshes[0],meshes[0]);
 assert.equal(layer.heights.get('house'),18);assert.equal(layer.scopeBases.get('rooms'),10);
 assert.equal(layer.update([{...o,closed:false}],origin,1),true);assert.equal(disposed,meshes.length);assert.equal(layer.meshes.length,0);assert.equal(layer.closedIds.size,0);assert.equal(layer.scopeBases.get('rooms'),10);
 layer.dispose();assert.equal(layer.scopeBases.size,0);
});
test('object hits keep normal Atlas identity and respect nearer terrain',()=>{
 const layer=new TerrainObjectLayer();layer.update([resolved()],{x:0,y:0,z:0},1);layer.group.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(1,-1,100),new THREE.Vector3(0,0,-1));
 assert.equal(layer.hit(ray,['atlasObject']).data.id,'house');assert.equal(layer.hit(ray,['atlasObject'],10),null);assert.equal(layer.hit(ray,['atlasVertex']),null);layer.dispose();
});
test('projection validation checks all footprint rings and rejects malformed geometry',()=>{
 const q={view:{box:{x:0,y:0,width:30,height:30},frame:{x:0,y:0,width:30,height:30},columns:33,rows:33,focusM:0,tilt:45,rotation:0,exaggeration:1},width:32,height:32,revision:0,contours:0,displayMpp:1,objects:[source]};
 assert.doesNotThrow(()=>validateTerrainProjection(q));
 for(const bad of [{footprint:[null]},{footprint:[{outer:source.outline,holes:[[null,null,null]]}]},{footprint:[{outer:source.outline,holes:[rect(Infinity,0,1,1)]}]},{closed:'true'},{scopeId:1}])assert.throws(()=>validateTerrainProjection({...q,objects:[{...source,...bad}]}),/Baukörper/);
});
