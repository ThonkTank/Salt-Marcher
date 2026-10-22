import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({stdin:{contents:"export {forestPatternLevels} from './src/app/terrain-forest-pattern';export {uploadTerrainTexture} from './src/app/terrain-texture-upload';export {DataTexture,RedFormat,UnsignedByteType} from 'three';",resolveDir:process.cwd()},outfile:'.build/terrain-forest-pattern-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {forestPatternLevels,uploadTerrainTexture,DataTexture,RedFormat,UnsignedByteType}=createRequire(import.meta.url)('../.build/terrain-forest-pattern-test.cjs');
test('semantic zoom crossfades adjacent world levels and reaches zero at the existing near detail range',()=>{
 const origin={x:1e12-100,y:-1e12+37};
 for(let k=4;k<28;k++){
  const mpp=2**k/8,a=forestPatternLevels(origin,mpp*(1-1e-7)),b=forestPatternLevels(origin,mpp*(1+1e-7));
  assert.deepEqual(a.b,b.a);assert(a.mix>1-1e-10);assert(b.mix<1e-10);
  for(const level of [a.a,a.b,b.a,b.b]){assert(level[0]>=0&&level[0]<1);assert(level[1]>=0&&level[1]<1);}
 }
 let last=-1;for(let mpp=0.1;mpp<100;mpp+=.1){const p=forestPatternLevels(origin,mpp);assert(p.opacity>=last);last=p.opacity;if(mpp<=2)assert.equal(p.opacity,0);if(mpp>=8)assert.equal(p.opacity,1);}
});
test('single-channel partial texture uploads preserve format, rectangle and row stride',()=>{
 const pixels=new Uint8Array(64),texture=new DataTexture(pixels,8,8,RedFormat),rect={x:2,y:3,width:4,height:2};
 uploadTerrainTexture(texture,[rect],undefined,1);assert.deepEqual(texture.updateRanges,[{start:26,count:4},{start:34,count:4}]);
 const calls=[];const renderer={copyTextureToTexture(source,target,box,position){calls.push({source,target,box,position});assert.equal(source.format,RedFormat);assert.equal(source.type,UnsignedByteType);assert.equal(source.image.data,pixels);assert.notEqual(source,target);}};
 uploadTerrainTexture(texture,[rect],renderer,1);assert.equal(calls.length,1);assert.deepEqual(calls[0].box.min.toArray(),[2,3]);assert.deepEqual(calls[0].box.max.toArray(),[6,5]);assert.deepEqual(calls[0].position.toArray(),[2,3]);
 uploadTerrainTexture(texture,[],renderer,1);assert.equal(calls.length,1);texture.dispose();
});
