import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/terrain-coverage';export {terrainVisible} from './src/app/terrain-spatial-model';export * from './src/app/terrain-navigation-plan';export * from './src/app/terrain-spatial-source';export * from './src/app/terrain-grid-layout';export * from './src/app/atlas-camera';export * from './src/app/terrain-route-clip';export * from './src/app/terrain-route-view';export {terrainColorRoutes} from './src/app/storage/terrain-color-raster';export {emptyRecord} from './src/app/atlas-landscape';"},outfile:'.build/terrain-coverage-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {terrainCoverageLevel,terrainSourceWindow,terrainNavigationPlan,terrainGridLayout,terrainGridCoordinate,atlasPlanePoint,atlasCameraEye,atlasProject,terrainHorizon,terrainVisible,routeSampleSections,routeMeshes,terrainColorRoutes,emptyRecord}=createRequire(import.meta.url)('../.build/terrain-coverage-test.cjs');
const frame={x:-400,y:-300,width:800,height:600};
test('tilted coverage includes visible ground across portrait, landscape, rotation and retained gestures',()=>{
 for(const ratio of [.2,1,5])for(const tilt of [0,15,45,60,61,64,67,68,70,71,75])for(const rotation of [0,35,90,150]){
  const f={...frame,height:800*ratio},window=terrainSourceWindow(null,f,1000,1000*ratio,terrainCoverageLevel(tilt));
  const view=terrainNavigationPlan(window,1,{tilt,rotation,exaggeration:1},[])[0].view;
  for(const scale of [.81,1,1.24]){
   const v={...view,frame:{x:f.x+f.width*(1-scale)/2+f.width*.2,y:f.y+f.height*(1-scale)/2-f.height*.2,width:f.width*scale,height:f.height*scale}},fog=terrainHorizon(v),eye=atlasCameraEye(v);
   for(let y=0;y<=10;y++)for(let x=0;x<=10;x++)for(const z of [0,-Math.min(f.width,f.height)*.25]){
    const p=atlasPlanePoint(v,{x:x/10,y:y/10},z);if(!p)continue;
    const projected=atlasProject(v,p,z);if(projected.depth>=fog.far)continue;
    const b=view.box;assert(p.x>=b.x&&p.x<=b.x+b.width&&p.y>=b.y&&p.y<=b.y+b.height,JSON.stringify({ratio,tilt,rotation,scale,p,b,eye}));
   }
  }
 }
});
test('coverage tier expansion invalidates a pending narrow window; smaller poses reuse its lattice',()=>{
 const a=terrainSourceWindow(null,frame,800,600,terrainCoverageLevel(0));
 const b=terrainSourceWindow(a,frame,800,600,terrainCoverageLevel(60));assert.notEqual(a,b);
 assert.equal(terrainSourceWindow(b,frame,800,600,terrainCoverageLevel(45)),b);
 assert.equal(terrainSourceWindow(b,frame,800,600,terrainCoverageLevel(59)),b);
 assert.notEqual(terrainSourceWindow(b,frame,800,600,terrainCoverageLevel(75)),b);
});
test('wide surroundings retain centre resolution and bounded, continuous sampling bands',()=>{
 const plan=tilt=>terrainNavigationPlan(terrainSourceWindow(null,frame,800,600,terrainCoverageLevel(tilt)),1,{tilt,rotation:0,exaggeration:1},[])[0].view;
 const near=terrainGridLayout(plan(0)),far=terrainGridLayout(plan(75));
 assert.equal(near.minimumStep,far.minimumStep);assert(far.blocks.length<=81);
 for(const axis of [far.x,far.y]){
  assert.equal(axis.values.length,257);
  for(let i=0;i<257;i++){assert(Math.abs(terrainGridCoordinate(axis,axis.values[i])-i)<1e-8);if(i)assert(axis.values[i]>axis.values[i-1]);}
  assert(axis.values[33]-axis.values[32]<=far.minimumStep*1.4);
  assert(axis.values[32]-axis.values[31]<=axis.minimumStep*2.1);
 }
});

test('a world-spanning route retains fine central geometry without oversampling the horizon',()=>{
 const v=terrainNavigationPlan({frame,pixelWidth:800,pixelHeight:600},1,{tilt:75,rotation:0,exaggeration:1},[])[0].view,layout=terrainGridLayout(v),a={x:-1e7,y:0},b={x:1e7,y:0};
 const sections=routeSampleSections(a,b,v.box,layout.minimumStep/2,layout);
 assert(sections.length<=9);assert(sections.some(s=>s.step>1000));assert(sections.some(s=>s.step<4));
 const r={...emptyRecord('road'),id:'long',points:[a,b],width:2};let samples=0;
 const meshes=routeMeshes(r,()=>{samples++;return 0;},{x:0,y:0,z:0},1,layout.minimumStep/2,false,v.box,layout);
 assert(meshes.length>=2);assert(samples>100&&samples<10000,`bounded directional samples: ${samples}`);
 const overview=meshes.find(m=>m.userData.routeOverview);assert(overview.geometry.getAttribute('instanceStart').count<1000);
 for(const m of meshes){m.geometry.dispose();m.material.dispose();}
});
test('distant routes cannot evict nearby author vectors from the bounded retained set',()=>{
 const focus={x:-10,y:-10,width:20,height:20},context={x:-1000,y:-1000,width:2000,height:2000},near={id:'near'},far=Array.from({length:700},(_,i)=>({id:'far'+i}));
 const stream=(_kind,area)=>area===focus?[near]:[...far,near];
 const result=terrainColorRoutes(stream,context,focus);assert.equal(result.routes.length,500);assert.equal(result.routes[0],near);assert(result.denseRoutes);assert.equal(result.retainedRoutes.size,500);
});

test('ground beyond the atmospheric horizon is not an author-visible brush target',()=>{
 const v=terrainNavigationPlan({frame,pixelWidth:800,pixelHeight:600},1,{tilt:75,rotation:0,exaggeration:1},[])[0].view;
 const p={x:0,y:v.box.y+10},screen=atlasProject(v,p,0),fog=terrainHorizon(v);
 assert(screen.x>=0&&screen.x<=1&&screen.y>=0&&screen.y<=1);assert(screen.depth>fog.far);
 assert.equal(terrainVisible({view:v,heights:new Float32Array(v.columns*v.rows),seaLevelM:0},p),false);
});
