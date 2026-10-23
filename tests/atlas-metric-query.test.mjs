import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';

buildSync({entryPoints:['src/app/atlas-metric-query.ts'],outfile:'.build/atlas-metric-query-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {MAPLIBRE_METRIC_QUERY_VERSION,queryRenderedFeaturesMetricSafe,safeMetricQueryScale}=createRequire(import.meta.url)('../.build/atlas-metric-query-test.cjs');
const supportedVersion='6.15.0';

function descriptorOf(transform){return Object.getOwnPropertyDescriptor(transform,'maxPitchScaleFactor');}
function assertSameDescriptor(actual,expected){
  if(!expected){assert.equal(actual,undefined);return;}
  assert.ok(actual);
  for(const key of ['configurable','enumerable','writable','value','get','set'])assert.equal(actual[key],expected[key],`descriptor ${key}`);
}
function makeMap({rawScale=-4,query,descriptor='inherited'}={}){
  const prototype={maxPitchScaleFactor(){return rawScale;}};
  const transform=Object.create(prototype);
  Object.defineProperties(transform,{
    farZ:{configurable:true,enumerable:true,value:12000},
    cameraToCenterDistance:{configurable:true,enumerable:true,value:1200}
  });
  if(descriptor==='configurable-data')Object.defineProperty(transform,'maxPitchScaleFactor',{
    configurable:true,enumerable:true,writable:false,value:function(){return rawScale;}
  });
  if(descriptor==='configurable-accessor'){
    const method=function(){return rawScale;};
    Object.defineProperty(transform,'maxPitchScaleFactor',{configurable:true,enumerable:false,get(){return method;}});
  }
  if(descriptor==='nonconfig-writable')Object.defineProperty(transform,'maxPitchScaleFactor',{
    configurable:false,enumerable:true,writable:true,value:function(){return rawScale;}
  });
  if(descriptor==='immutable')Object.defineProperty(transform,'maxPitchScaleFactor',{
    configurable:false,enumerable:true,writable:false,value:function(){return rawScale;}
  });
  if(descriptor==='nonconfig-accessor')Object.defineProperty(transform,'maxPitchScaleFactor',{
    configurable:false,enumerable:true,get(){return function(){return rawScale;};}
  });
  const map={_camera:{transform},queryRenderedFeatures(geometry,options){return query?query.call(this,geometry,options):{geometry,options};}};
  return {map,transform};
}

test('ordinary query padding is preserved and cannot shrink candidate bounds',()=>{
  for(const scale of [1,2.366025418080343,8])assert.equal(safeMetricQueryScale(scale,12000,1200),scale);
  assert.equal(safeMetricQueryScale(.5,12000,1200),1);
});

test('above-horizon corner uses the positive visible clipping bound',()=>{
  for(const raw of [-4.098076211104931,0,NaN,Infinity,-Infinity]){
    const scale=safeMetricQueryScale(raw,12000,1200);
    assert.equal(scale,10);
    for(const visibleDepth of [17,1200,6000,12000])assert(scale>=visibleDepth/1200);
  }
  assert.equal(safeMetricQueryScale(-1,1,2),1);
});

test('invalid clipping ranges fail explicitly instead of masking broken projection state',()=>{
  for(const [far,distance] of [[0,1],[-1,1],[1,0],[1,-1],[NaN,1],[1,NaN],[Infinity,1],[1,Infinity],[Number.MAX_VALUE,Number.MIN_VALUE]])
    assert.throws(()=>safeMetricQueryScale(-1,far,distance),/metric query/i);
});

test('inherited MapLibre method gets a synchronous exact query and is removed afterward',()=>{
  assert.equal(MAPLIBRE_METRIC_QUERY_VERSION,supportedVersion);
  const geometry=[[17.25,31.5]],options={layers:['marker'],filter:['==','id','m1']},features=[{id:'m1'}];
  let receivedGeometry,receivedOptions,methodDuringQuery;
  const {map,transform}=makeMap({query(g,o){receivedGeometry=g;receivedOptions=o;methodDuringQuery=transform.maxPitchScaleFactor;assert.equal(methodDuringQuery.call(transform),10);return features;}});
  const originalMethod=transform.maxPitchScaleFactor,originalDescriptor=descriptorOf(transform);
  const result=queryRenderedFeaturesMetricSafe(map,geometry,options,supportedVersion);
  assert.strictEqual(receivedGeometry,geometry);assert.strictEqual(receivedOptions,options);
  assert.strictEqual(result.features,features);assert.equal(result.rawScale,-4);assert.equal(result.adaptedScale,10);
  assert.equal(result.farZ,12000);assert.equal(result.cameraDistance,1200);assert.equal(result.restored,true);
  assert.notStrictEqual(methodDuringQuery,originalMethod);assertSameDescriptor(descriptorOf(transform),originalDescriptor);
  assert.strictEqual(transform.maxPitchScaleFactor,originalMethod);
});

test('configurable own data and accessor descriptors are restored exactly',()=>{
  for(const descriptor of ['configurable-data','configurable-accessor']){
    const {map,transform}=makeMap({descriptor});const before=descriptorOf(transform);let observed=false;
    map.queryRenderedFeatures=function(geometry,options){observed=transform.maxPitchScaleFactor.call(transform)===10;return {geometry,options};};
    const result=queryRenderedFeaturesMetricSafe(map,[],{},supportedVersion);
    assert.equal(observed,true);assert.equal(result.restored,true);assertSameDescriptor(descriptorOf(transform),before);
  }
});

test('nonconfigurable writable data method is temporarily replaced and restored exactly',()=>{
  const {map,transform}=makeMap({descriptor:'nonconfig-writable'}),before=descriptorOf(transform);
  let during;
  map.queryRenderedFeatures=function(geometry,options){during=descriptorOf(transform);assert.equal(transform.maxPitchScaleFactor(),10);return 42;};
  const result=queryRenderedFeaturesMetricSafe(map,'same-geometry','same-options',supportedVersion);
  assert.equal(result.features,42);assert.equal(result.restored,true);
  assert.equal(during.configurable,false);assert.equal(during.writable,true);assert.notStrictEqual(during.value,before.value);
  assertSameDescriptor(descriptorOf(transform),before);
});

test('immutable overrides and wrong versions reject before query or mutation',()=>{
  for(const descriptor of ['immutable','nonconfig-accessor']){
    const {map,transform}=makeMap({descriptor});const before=descriptorOf(transform);let called=false;
    map.queryRenderedFeatures=()=>{called=true;};
    assert.throws(()=>queryRenderedFeaturesMetricSafe(map,[],{},supportedVersion),/immutable/i);
    assert.equal(called,false);assertSameDescriptor(descriptorOf(transform),before);
  }
  const {map,transform}=makeMap();const before=descriptorOf(transform);let called=false;
  map.queryRenderedFeatures=()=>{called=true;};
  assert.throws(()=>queryRenderedFeaturesMetricSafe(map,[],{},'6.16.0'),/unsupported MapLibre/i);
  assert.equal(called,false);assertSameDescriptor(descriptorOf(transform),before);
});

test('private-contract and invalid clip-range failures do not mutate the transform',()=>{
  const map={queryRenderedFeatures(){assert.fail('query should not run');}};
  assert.throws(()=>queryRenderedFeaturesMetricSafe(map,[],{},supportedVersion),/private transform contract/i);
  const {map:badMap,transform}=makeMap();Object.defineProperty(transform,'farZ',{configurable:true,value:0});const before=descriptorOf(transform);
  assert.throws(()=>queryRenderedFeaturesMetricSafe(badMap,[],{},supportedVersion),/metric query clipping range/i);
  assertSameDescriptor(descriptorOf(transform),before);
  const {map:fixedMap,transform:fixedTransform}=makeMap();Object.preventExtensions(fixedTransform);
  assert.throws(()=>queryRenderedFeaturesMetricSafe(fixedMap,[],{},supportedVersion),/non-extensible transform/i);
  assert.equal(Object.hasOwn(fixedTransform,'maxPitchScaleFactor'),false);
});

test('query exceptions restore inherited and own descriptors in finally',()=>{
  for(const descriptor of ['inherited','configurable-data','nonconfig-writable']){
    const {map,transform}=makeMap({descriptor}),before=descriptorOf(transform);
    map.queryRenderedFeatures=function(){assert.equal(transform.maxPitchScaleFactor(),10);throw new Error('query failure');};
    assert.throws(()=>queryRenderedFeaturesMetricSafe(map,{}, {},supportedVersion),/query failure/);
    assertSameDescriptor(descriptorOf(transform),before);
  }
});

test('thenable query results are rejected as asynchronous and restore the method',()=>{
  const {map,transform}=makeMap(),before=descriptorOf(transform);
  map.queryRenderedFeatures=async()=>[];
  assert.throws(()=>queryRenderedFeaturesMetricSafe(map,{}, {},supportedVersion),/synchronous query result/i);
  assertSameDescriptor(descriptorOf(transform),before);
});

test('nested queries restore the outer temporary override before the outer call restores its descriptor',()=>{
  const {map,transform}=makeMap();let nested=false,outerTemporary;
  map.queryRenderedFeatures=function(geometry,options){
    if(!nested){
      nested=true;outerTemporary=transform.maxPitchScaleFactor;
      const inner=queryRenderedFeaturesMetricSafe(map,geometry,options,supportedVersion);
      assert.equal(inner.restored,true);assert.strictEqual(transform.maxPitchScaleFactor,outerTemporary);
      nested=false;return inner.features;
    }
    assert.equal(transform.maxPitchScaleFactor(),10);return {geometry,options};
  };
  const before=descriptorOf(transform),result=queryRenderedFeaturesMetricSafe(map,'g','o',supportedVersion);
  assert.deepEqual(result.features,{geometry:'g',options:'o'});assert.equal(result.restored,true);
  assertSameDescriptor(descriptorOf(transform),before);
});

test('separate map transforms do not share overrides and geometry/options are never widened',()=>{
  const geometry={point:[3,4]},options={layers:['marker'],radius:0};
  const first=makeMap({rawScale:-2}),second=makeMap({rawScale:3});let calls=0;
  first.map.queryRenderedFeatures=function(g,o){calls++;assert.strictEqual(g,geometry);assert.strictEqual(o,options);assert.equal(first.transform.maxPitchScaleFactor(),10);return 'first';};
  second.map.queryRenderedFeatures=function(g,o){calls++;assert.strictEqual(g,geometry);assert.strictEqual(o,options);assert.equal(second.transform.maxPitchScaleFactor(),3);return 'second';};
  const a=queryRenderedFeaturesMetricSafe(first.map,geometry,options,supportedVersion);
  const b=queryRenderedFeaturesMetricSafe(second.map,geometry,options,supportedVersion);
  assert.equal(a.features,'first');assert.equal(a.adaptedScale,10);assert.equal(b.features,'second');assert.equal(b.adaptedScale,3);
  assert.equal(calls,2);assert.equal(a.restored&&b.restored,true);
});
