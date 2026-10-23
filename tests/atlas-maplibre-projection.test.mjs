import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

buildSync({entryPoints:['src/app/atlas-maplibre-projection.ts'],outfile:'.build/atlas-maplibre-projection-test.cjs',bundle:true,platform:'node',format:'cjs'});
buildSync({entryPoints:['src/app/atlas-maplibre-projection-worker.ts'],outfile:'.build/atlas-maplibre-projection-worker-test.js',bundle:true,platform:'browser',format:'iife'});
const {atlasMetricCRS,atlasMetricProjection}=createRequire(import.meta.url)('../.build/atlas-maplibre-projection-test.cjs');

test('renderer and worker decode the same metric CRS, including exponent-sized roots',()=>{
  let handler;
  runInNewContext(readFileSync('.build/atlas-maplibre-projection-worker-test.js','utf8'),{setProjectionHandler(value){handler=value;}});
  for(const size of [2**-32,2**26,2**80]){
    const crs=atlasMetricCRS('atlas-test',{x:-size/2,y:-size/2,size});
    const worker=handler(crs.definition);
    for(const point of [[0,0],[64,-64],[-37,21]]){
      const projected=crs.projection.forward(point);
      assert.deepEqual(Array.from(worker.forward(point)),projected);
      assert.deepEqual(Array.from(worker.inverse(projected)),point);
    }
    assert.equal(crs.tileMatrixSet.extentAtZoom0,size);
  }
});

test('unknown, noncanonical and invalid projection scales fail before creating a converter',()=>{
  for(const definition of ['EPSG:3857','saltmarcher-meter-plane-v1:','saltmarcher-meter-plane-v1:0','saltmarcher-meter-plane-v1:-1','saltmarcher-meter-plane-v1:NaN','saltmarcher-meter-plane-v1:Infinity','saltmarcher-meter-plane-v1: 2','saltmarcher-meter-plane-v1:0x20'])
    assert.throws(()=>atlasMetricProjection(definition),/projection/i);
  assert.throws(()=>runInNewContext(readFileSync('.build/atlas-maplibre-projection-worker-test.js','utf8'),{}),/MapLibre worker/);
});
