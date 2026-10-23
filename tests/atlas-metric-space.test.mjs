import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({entryPoints:['src/app/atlas-metric-space.ts'],outfile:'.build/atlas-metric-space-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {createMetricRoot,expandMetricRoot,metricRootContains,metricLngLat,metricPoint,
  metricProjectionParameters,metricMapCamera,metricCameraPose,translateMetricTile} = createRequire(import.meta.url)('../.build/atlas-metric-space-test.cjs');
const close = (actual,expected,tolerance=1e-8) => assert(Math.abs(actual-expected)<=tolerance,`${actual} ≠ ${expected}`);

test('all five scales retain sub-centimetre metric coordinates without geographic latitude limits',()=>{
  const root=createMetricRoot({x:-20_000_000,y:-12_500_000,width:40_000_000,height:25_000_000});
  const projection=metricProjectionParameters(root);
  for(const span of [40_000_000,16_000_000,4_000_000,3000,20])for(const sign of [-1,1]){
    const point={x:sign*span*.37,y:sign*span*.21},encoded=metricLngLat(root,point),decoded=metricPoint(root,encoded);
    assert(Math.abs(encoded[1])<=64);close(decoded.x,point.x);close(decoded.y,point.y);
    // Check the CRS parameter formula against raw bounds (no MapLibre runtime here).
    close((encoded[0]*projection.unitsPerCoordinate-projection.tileMatrixSet.origin[0])/root.size,(point.x-root.x)/root.size);
    close((projection.tileMatrixSet.origin[1]-encoded[1]*projection.unitsPerCoordinate)/root.size,(point.y-root.y)/root.size);
  }
});

test('root expansion preserves world pose and tile extents in every direction including beyond the original root',()=>{
  const initial=createMetricRoot({x:-100,y:-100,width:200,height:200});
  for(const direction of [[1,1],[-1,1],[1,-1],[-1,-1]]){
    const focus={x:direction[0]*initial.size*2+.125,y:direction[1]*initial.size*3+.375};
    const expanded=expandMetricRoot(initial,{...focus,width:20,height:20});
    assert(metricRootContains(expanded,{...focus,width:20,height:20}));
    assert.equal(initial.size,2**26,'input root must remain available until replacement is ready');
    for(const mpp of [40_000,16_000,4000,3,.02]){
      const pose={focus,metersPerPixel:mpp,rotation:497,tilt:75};
      const oldCamera=metricMapCamera(initial,pose),newCamera=metricMapCamera(expanded,pose);
      const restored=metricCameraPose(expanded,newCamera);
      assert(Math.abs(newCamera.center[1])<=64);
      close(newCamera.zoom-oldCamera.zoom,Math.log2(expanded.size/initial.size));
      close(restored.focus.x,focus.x);close(restored.focus.y,focus.y);close(restored.metersPerPixel,mpp,1e-9);
      assert.equal(restored.rotation,497);assert.equal(restored.tilt,75);
    }
    for(const tile of [{z:0,x:0,y:0},{z:16,x:12345,y:54321},{z:24,x:0,y:2**24-1}]){
      const translated=translateMetricTile(tile,initial,expanded);
      const oldSize=initial.size/2**tile.z,newSize=expanded.size/2**translated.z;
      assert.equal(oldSize,newSize);
      assert.equal(initial.x+tile.x*oldSize,expanded.x+translated.x*newSize);
      assert.equal(initial.y+tile.y*oldSize,expanded.y+translated.y*newSize);
    }
  }
});

test('negative bounds, repeated growth and unchanged views keep valid roots without modifying authored coordinates',()=>{
  let root=createMetricRoot({x:-200,y:-100,width:400,height:200},256);
  assert(metricRootContains(root,{x:-200,y:-100,width:400,height:200}));
  assert.equal(expandMetricRoot(root,{x:0,y:0,width:1,height:1}),root);
  const authored={x:-1e12+.25,y:1e12+.75},saved={...authored};
  root=expandMetricRoot(root,{...authored,width:3,height:3});
  assert.deepEqual(authored,saved);
  const result=metricPoint(root,metricLngLat(root,authored));
  close(result.x,authored.x,.001);close(result.y,authored.y,.001);
});

test('invalid, overflowing and incompatible display domains fail instead of clipping world data',()=>{
  const root={x:-8,y:-8,size:16};
  assert.throws(()=>expandMetricRoot(root,{x:Infinity,y:0,width:1,height:1}));
  assert.throws(()=>createMetricRoot({x:0,y:0,width:-1,height:1}));
  assert.throws(()=>expandMetricRoot(root,{x:-Number.MAX_VALUE,y:0,width:Number.MAX_VALUE,height:1}));
  assert.throws(()=>metricMapCamera(root,{focus:{x:0,y:0},metersPerPixel:0,rotation:0,tilt:0}));
  assert.throws(()=>metricMapCamera(root,{focus:{x:0,y:0},metersPerPixel:1,rotation:0,tilt:76}));
  assert.throws(()=>translateMetricTile({z:2,x:1,y:1},root,{x:-9,y:-8,size:32}));
  assert.throws(()=>translateMetricTile({z:2,x:4,y:0},root,root));
});

test('finite inputs cannot leak singular CRS scales or infinite output coordinates',()=>{
  assert.throws(()=>createMetricRoot({x:0,y:0,width:0,height:0},Number.MIN_VALUE));
  assert.throws(()=>metricLngLat({x:-1.7e308,y:-1.7e308,size:2**1023},{x:1.7e308,y:1.7e308}));
  assert.throws(()=>metricPoint({x:0,y:0,size:2**1023},[Number.MAX_VALUE,Number.MAX_VALUE]));
  const root={x:-8,y:-8,size:16};
  const extreme=metricMapCamera(root,{focus:{x:0,y:0},metersPerPixel:Number.MIN_VALUE,rotation:0,tilt:0});
  assert(Number.isFinite(extreme.zoom),'logarithmic scale conversion must not overflow');
  assert.equal(metricCameraPose(root,extreme).metersPerPixel,Number.MIN_VALUE);
  assert.throws(()=>metricCameraPose(root,{center:[0,0],zoom:-Number.MAX_VALUE,bearing:0,pitch:0}));
  const outside={x:1000,y:-1000};
  assert(Math.abs(metricLngLat(root,outside)[1])>90,'outside points are not silently clamped');
  const grown=expandMetricRoot(root,{...outside,width:0,height:0});
  assert(Math.abs(metricLngLat(grown,outside)[1])<=64);
});
