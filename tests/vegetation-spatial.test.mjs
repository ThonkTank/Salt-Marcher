import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
buildSync({stdin:{contents:"export {AtlasDeckVegetation} from './src/app/atlas-deck-vegetation';export {atlasMetricFrame} from './src/app/atlas-metric-camera';",resolveDir:process.cwd()},outfile:'.build/vegetation-picking-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {AtlasDeckVegetation,atlasMetricFrame}=createRequire(import.meta.url)('../.build/vegetation-picking-test.cjs');
const instance=(id,asset,size,z=40)=>({id,areaId:'wood',asset,size,x:0,y:0,z,angle:0,normal:{x:0,y:0,z:1}});
const drawing=instances=>new AtlasDeckVegetation([{id:'wood',vegetationView:{mode:'individual',instances}}]);
const frame=(tilt=0,rotation=0)=>atlasMetricFrame({focus:{x:0,y:0},focusHeightM:40,metersPerPixel:.2,tilt,rotation,exaggeration:1},1000,800);
const pick=(v,f,filter='all',distance=Infinity)=>v.hit(f,{x:500,y:400},[filter==='all'?'vegetationInstance':'vegetation-'+filter],distance)?.data;
test('a type filter reaches rocks and undergrowth below a tree canopy',()=>{
 const v=drawing([instance('tree','oak',25),instance('rock','rock',5),instance('shrub','shrub',2)]),f=frame();
 assert.equal(pick(v,f)?.vegetationInstance,'tree');assert.equal(pick(v,f,'trees')?.vegetationInstance,'tree');assert.equal(pick(v,f,'rocks')?.vegetationInstance,'rock');assert.equal(pick(v,f,'undergrowth')?.vegetationInstance,'shrub');v.dispose();
});
test('filtering never selects through terrain or substitutes another type',()=>{
 const v=drawing([instance('tree','pine',25),instance('buried','rock',2,20)]),f=frame(),ray=f.ray({x:500,y:400}),distance=ray[0][2]-40;
 assert.equal(pick(v,f,'all',distance)?.vegetationInstance,'tree');assert.equal(pick(v,f,'rocks',distance),undefined);assert.equal(pick(v,f,'undergrowth',distance),undefined);v.dispose();
});
test('rotated vegetation preserves canonical identities and shared mesh buffers across camera movement',()=>{
 const v=drawing([instance('rock','rock',5)]),initial=v.layers(frame(),'test')[0].props.mesh;
 for(const tilt of [0,45,65])for(const rotation of [-90,0,90]){
  const f=frame(tilt,rotation);assert.equal(pick(v,f,'rocks')?.vegetationInstance,'rock');assert.equal(pick(v,f,'rocks')?.landscapeId,'wood');assert.equal(v.layers(f,'test')[0].props.mesh,initial);
 }
 v.dispose();assert.equal(v.layers(frame(),'test').length,0);
});
