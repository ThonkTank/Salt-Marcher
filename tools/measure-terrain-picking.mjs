// Isolated CPU ray kernel comparison, not an end-to-end input/frame-rate claim.
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/terrain-picking-measure');mkdirSync(out,{recursive:true});
buildSync({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/terrain-ray';export * from './src/app/terrain-surface-mesh';export * from './src/app/terrain-contours';export * as THREE from 'three';"},outfile:out+'/model.cjs',bundle:true,platform:'node',format:'cjs'});
const {THREE,terrainRaycast,updateTerrainMesh,terrainContourUniforms}=createRequire(import.meta.url)(out+'/model.cjs'),runs=[];
for(const columns of [193,257]){
 const view={box:{x:-1500,y:-1500,width:3000,height:3000},frame:{x:-500,y:-500,width:1000,height:1000},columns,rows:columns,focusM:100,tilt:45,rotation:0,exaggeration:1,...(columns===257?{refinement:{x:-750,y:-750,width:1500,height:1500}}:{})};
 const grid={view,heights:new Float32Array(columns*columns).fill(100),seaLevelM:0};
 const {mesh}=updateTerrainMesh(null,{grid,width:16,height:16,pixels:new Uint8Array(1024)},null,{x:0,y:0},{x:0,y:0},undefined,terrainContourUniforms());mesh.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(50,40,1000),new THREE.Vector3(0,0,-1));
 const classic=()=>ray.intersectObject(mesh)[0]?.distance,cell=()=>terrainRaycast(grid,{x:ray.ray.origin.x,y:-ray.ray.origin.y,z:1100},{x:0,y:0,z:-1});
 for(const [name,read]of [['triangles',classic],['cells',cell]]){
  for(let i=0;i<10;i++)assert(Math.abs(read()-1000)<1e-7);
  const count=200,start=performance.now();for(let i=0;i<count;i++){ray.ray.origin.x=50+Math.sin(i);assert(Math.abs(read()-1000)<1e-7);}
  const result={name,columns,nodes:columns*columns,rays:count,averageRayMs:(performance.now()-start)/count};runs.push(result);console.log(JSON.stringify(result));
 }
 mesh.geometry.dispose();mesh.material.map.dispose();mesh.material.dispose();
}
writeFileSync(out+'/result.json',JSON.stringify({source:process.env.TERRAIN_SOURCE_COMMIT??'working tree',runs},null,2));
