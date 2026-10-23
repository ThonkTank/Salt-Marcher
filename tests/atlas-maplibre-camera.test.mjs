import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
buildSync({entryPoints:['src/app/atlas-maplibre-camera.ts'],outfile:'.build/atlas-maplibre-camera-test.mjs',bundle:true,platform:'node',format:'esm'});
const {applyAtlasMapLibreCamera,readAtlasMapLibreCamera}=await import('../.build/atlas-maplibre-camera-test.mjs');
class Camera {
  calls=[];state={center:[0,0],zoom:0,bearing:0,pitch:0,elevation:0};
  setCenterClampedToGround(value){this.calls.push(['clamp',value]);}
  jumpTo(value){this.calls.push(['jump',value]);this.state={...this.state,...value};}
  getCenter(){return {lng:this.state.center[0],lat:this.state.center[1]};}
  getZoom(){return this.state.zoom;}
  getBearing(){return this.state.bearing;}
  getPitch(){return this.state.pitch;}
  getCenterElevation(){return this.state.elevation;}
}
const root={x:-33554432,y:-33554432,size:67108864};
const pose={focus:{x:24,y:24},focusHeightM:145,metersPerPixel:.02,rotation:37,tilt:75};
test('elevated room camera disables DEM clamp before applying metres, not root-normalized Z',()=>{
  const map=new Camera();applyAtlasMapLibreCamera(map,root,pose);
  assert.deepEqual(map.calls[0],['clamp',false]);assert.equal(map.state.elevation,145);
  const restored=readAtlasMapLibreCamera(map,root);assert.equal(restored.focusHeightM,145);
  assert.deepEqual(restored.focus,pose.focus);assert(Math.abs(restored.metersPerPixel-.02)<1e-12);
});
test('physical focus height survives root replacement and vertical exaggeration',()=>{
  const map=new Camera(),grown={x:-root.size,y:-root.size,size:root.size*4};
  for(const domain of [root,grown])for(const exaggeration of [.25,1,8]){
    applyAtlasMapLibreCamera(map,domain,pose,exaggeration);
    assert.equal(map.state.elevation,145*exaggeration);
    const restored=readAtlasMapLibreCamera(map,domain,exaggeration);
    assert.equal(restored.focusHeightM,145);assert.deepEqual(restored.focus,pose.focus);
  }
});
test('invalid altitude, scale and exaggeration fail before touching the map',()=>{
  const map=new Camera();
  for(const bad of [NaN,Infinity,-Infinity])assert.throws(()=>applyAtlasMapLibreCamera(map,root,{...pose,focusHeightM:bad}));
  for(const bad of [0,-1,Infinity,NaN])assert.throws(()=>applyAtlasMapLibreCamera(map,root,pose,bad));
  assert.throws(()=>applyAtlasMapLibreCamera(map,root,{...pose,focusHeightM:1e308},8));
  assert.deepEqual(map.calls,[]);
});
