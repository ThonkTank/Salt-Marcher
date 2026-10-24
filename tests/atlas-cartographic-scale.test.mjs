import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {validateShaderModuleUniformLayout} from '@luma.gl/shadertools';
buildSync({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/atlas-route-geometry';export * from './src/app/terrain-route';export * from './src/app/atlas-public-forest-layer';export * from './src/app/atlas-terrain-material-layer';export * from './src/app/atlas-vegetation-layer';export * from './src/app/atlas-cartographic-style';export * from './src/app/atlas-deck-vegetation';export * from './src/app/atlas-metric-camera';export * from './src/app/atlas-scale-policy';export * from './src/app/vegetation';export * from './src/app/vegetation-lod';export * from './src/app/atlas-tile-plan';"},outfile:'.build/atlas-cartographic-scale.cjs',bundle:true,platform:'node',format:'cjs'});
const {atlasRouteGeometry,routeSpec,AtlasTerrainMaterialLayer,AtlasPublicForestLayer,AtlasVegetationLayer,forestSurfaceWeight,cartographicPhase,CARTOGRAPHIC_PERIOD,AtlasDeckVegetation,atlasMetricFrame,vegetationSpec,vegetationOpacity,vegetationCrownScale,mapLineOpacity,atlasTilePlan,atlasPrefetchTiles}=createRequire(import.meta.url)('../.build/atlas-cartographic-scale.cjs');

test('forest surface replaces automatic crowns continuously while protected objects retain their size',()=>{
 assert.equal(forestSurfaceWeight(2),0);assert.equal(forestSurfaceWeight(8),1);
 let previous=1;
 for(let mpp=0.25;mpp<12;mpp+=.05){
  const alpha=vegetationOpacity(mpp,8);assert(alpha<=previous+1e-10);previous=alpha;
  assert.equal(vegetationOpacity(mpp,0),1);
  assert(vegetationCrownScale(14,mpp,4)<=2);
 }
 assert.equal(vegetationOpacity(8,8),0);assert.equal(vegetationCrownScale(14,1,4),1);
});

test('panning and zooming retain the exact instance arrays and physical transform attributes',()=>{
 const instance={id:'row:0',asset:'oak',x:5,y:10,z:20,size:14,angle:.3,normal:{x:0,y:0,z:1}};
 const layer=new AtlasDeckVegetation([{id:'forest',vegetation:vegetationSpec(),vegetationView:{mode:'individual',instances:[instance]}}]);
 let original;
 for(const mpp of [.25,1,2,4,8,128]){
  const frame=atlasMetricFrame({focus:{x:mpp,y:0},focusHeightM:20,metersPerPixel:mpp,rotation:0,tilt:45,exaggeration:1},1280,900);
  const layers=layer.layers(frame,'test');
  if(!original)original=layers;
  for(let i=0;i<layers.length;i++){
   assert.equal(layers[i].props.data,original[i].props.data);
   assert.equal(layers[i].props.mesh,original[i].props.mesh);
   assert.deepEqual(layers[i].props.getTransformMatrix(instance),original[i].props.getTransformMatrix(instance));
   assert.deepEqual(layers[i].props.getColor(instance),original[i].props.getColor(instance));
  }
 }
 layer.dispose();
});

test('decorative coordinates repeat exactly across distant and negative world origins',()=>{
 for(const x of [-1e12,-65536,-256,-.25,0,.25,256,65536,1e12]){
  assert.equal(cartographicPhase(x),cartographicPhase(x+CARTOGRAPHIC_PERIOD));
  assert(Math.abs(cartographicPhase(x))<=CARTOGRAPHIC_PERIOD/2);
 }
 assert.equal(cartographicPhase(-256)+256,cartographicPhase(0));
});

test('roads and streams fade monotonically without moving their canonical width threshold',()=>{
 for(const kind of ['road','river'])for(const minor of [false,true]){
  let prior=1;
  for(let mpp=.1;mpp<1000;mpp*=1.03){const opacity=mapLineOpacity(kind,8,mpp,minor);assert(opacity<=prior);assert(opacity>=0&&opacity<=1);prior=opacity;}
  assert.equal(prior,0);
 }
});

test('large preload margins never reduce visible texture detail',()=>{
 const box={x:-960,y:-540,width:1920,height:1080},plan=atlasTilePlan(box,1,{maxTiles:32});
 const before=structuredClone(plan);
 for(const padding of [1,2,8,128]){
  const preload=atlasPrefetchTiles(plan,{x:box.x*padding,y:box.y*padding,width:box.width*padding,height:box.height*padding});
  assert(preload.length<=8);assert.deepEqual(plan,before);
 }
 assert(plan.detail.every(tile=>2**tile.lod<=2));
});

// Exercise luma's real block parser: same-line declarations are valid GLSL but
// are not accepted by this renderer's uniform-layout contract.
test('custom cartographic uniform blocks satisfy the renderer layout contract',()=>{
 for(const Layer of [AtlasVegetationLayer,AtlasPublicForestLayer,AtlasTerrainMaterialLayer]){
  const layer=new Layer({id:'uniform-contract',data:[]});layer.context={defaultShaderModules:[]};
  const modules=layer.getShaders().modules.filter(m=>m.name.startsWith('atlas'));
  assert.equal(modules.length,1);
  for(const module of modules)for(const stage of ['vertex','fragment'])assert.equal(validateShaderModuleUniformLayout(module,stage).matches,true);
 }
});

test('a readable bridge retains its physical height and canonical width',()=>{
 const points=[{x:0,y:0},{x:100,y:0}],record={id:'bridge',kind:'road',points,width:2,route:{...routeSpec('road',points),sections:['bridge'],nodes:points.map(p=>({...p,z:24,structure:'bridge'}))}};
 const before=structuredClone(record),render=mpp=>atlasRouteGeometry(record,()=>10,{x:0,y:0,z:0},1,10,false,undefined,undefined,mpp)[0].positions;
 const narrow=render(.25),wide=render(4);
 const values=(a,axis)=>Array.from(a).filter((_,i)=>i%3===axis);
 assert(Math.max(...values(wide,1))>Math.max(...values(narrow,1)));
 assert.deepEqual([...new Set(values(wide,2))],[...new Set(values(narrow,2))]);
 assert.deepEqual(record,before);
});

test('disposable prefetch cannot turn a valid edge viewport into a world-boundary failure',()=>{
 const box={x:999999998000,y:0,width:256,height:256},plan=atlasTilePlan(box,1,{maxTiles:32});
 const padded={x:box.x-4000,y:-4000,width:10000,height:10000};
 const tiles=atlasPrefetchTiles(plan,padded);
 for(const t of tiles){const size=256*2**t.lod;assert((t.x+1)*size<=1e12);}
 assert.deepEqual(atlasPrefetchTiles(plan,{...padded,width:NaN}),[]);
});
