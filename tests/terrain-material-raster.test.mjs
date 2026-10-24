import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';

buildSync({
  stdin:{
    contents:"export * from './src/app/terrain-material';export * from './src/app/terrain-relief';export * from './src/app/landscape-raster';export * from './src/app/terrain-height';export * from './src/app/vegetation';",
    resolveDir:process.cwd(),
  },
  outfile:'.build/terrain-material-raster-test.cjs',bundle:true,platform:'node',format:'cjs',
});
const {CHANNEL_NAMES,DEFAULT_TERRAIN_STYLE,LandscapeRasterizer,settingsRecord,vegetationSpec}=createRequire(import.meta.url)('../.build/terrain-material-raster-test.cjs');

const box={x:-16,y:-12,width:32,height:24};
const rect=(x,y,w,h)=>({outer:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],holes:[]});
const patch=(id,polygon,terrain='forest')=>({id,kind:'patch',revision:0,name:'',points:[],polygons:[polygon],resolution:1,width:0,values:{terrain}});
const cover=()=>({id:'woods',kind:'vegetation',revision:0,name:'Wald',points:[],polygons:[rect(-15,-11,30,22)],resolution:1,width:0,values:{terrain:'forest'},vegetation:vegetationSpec('deciduous')});
const pigment=()=>({id:'pigment',kind:'patch',revision:0,name:'Pigment',points:[],polygons:[rect(1,-6,12,12)],resolution:1,width:0,values:{},paint:{version:2,operation:'paint',target:'ground',color:'#c04030',opacity:.8,flow:1,tip:'round',radius:4,seed:7,fill:true}});

function runSteps(steps){for(;;){const next=steps.next();if(next.done)return next.value;}}
function raster({area=box,width=32,height=24,style={},contours=0,forest=true,records=true,includePigment=true}={}){
  const settings=settingsRecord(0);settings.terrainSettings.style={...DEFAULT_TERRAIN_STYLE,land:'#789b57',snowlineM:1950,...style};
  const image=new LandscapeRasterizer(area,width,height,contours,area.width/width,forest),lattice=image.sampleLattice(),heights=new Float32Array(lattice.columns*lattice.rows),water=new Uint8Array(heights.length);
  for(let y=0;y<lattice.rows;y++)for(let x=0;x<lattice.columns;x++){
    const i=y*lattice.columns+x,wx=lattice.x+x*lattice.dx;
    heights[i]=1950+wx*.8;
    water[i]=wx< -4.3?1:0;
  }
  image.setTerrainField({heights,water});
  image.paint(settings);
  if(records){
    image.paint(patch('ground',rect(area.x-2,area.y-2,area.width+4,area.height+4)));
    runSteps(image.paintCoverSteps(cover(),function*(){}));
    if(includePigment)runSteps(image.paintColorSteps(pigment(),function*(){}));
  }
  return image;
}
function channels(image,requested){return runSteps(image.materialChannelsSteps(function*(){},requested));}

test('captures independent raw channels with height, water, forest and ground pigment coverage',()=>{
  const image=raster(),value=channels(image);
  assert.deepEqual(Object.keys(value).filter(name=>CHANNEL_NAMES.includes(name)),CHANNEL_NAMES);
  assert.equal(value.baseColor.length,32*24*4);
  for(const name of ['water','forest','rock','snow'])assert.equal(value[name].length,32*24);
  const at=(x,y)=>(y-box.y)*32+x-box.x;
  assert.equal(value.water[at(-12,0)],255);assert.equal(value.water[at(12,0)],0);
  assert.equal(value.water[at(-5,0)],128,'water coverage is the area-weighted mean of the four samples');
  assert.equal(value.waterTopology[at(-5,0)],0b0101,'topology uses TL, TR, BL, BR bits');
  assert.equal(value.forest[at(-12,0)],0,'forest under water is cleared');
  assert(value.forest[at(0,0)]>0,'vegetation contributes semantic forest coverage');
  const withoutPigment=channels(raster({includePigment:false}));
  assert(value.baseColor[at(8,0)*4]>withoutPigment.baseColor[at(8,0)*4],'ground pigment is captured in the unlit base colour');
  assert(value.rock[at(12,0)]>0);assert(value.snow.some(v=>v>0));
  assert.equal(value.rock[at(-12,0)],0);assert.equal(value.snow[at(-12,0)],0);
});

test('light, contour, ink, strength and relief mode do not change material bytes',()=>{
  const baseline=channels(raster());
  const altered=channels(raster({style:{mode:'shaded',lightDegrees:117,ink:'#e010e0',strength:.12},contours:50}));
  assert.deepEqual(altered,baseline);
});

test('moving the snowline changes only snow; disabling mountains clears only material weights',()=>{
  const low=channels(raster({style:{snowlineM:1900}}));
  const high=channels(raster({style:{snowlineM:2100}}));
  for(const name of ['baseColor','water','forest','rock'])assert.deepEqual(high[name],low[name],`${name} is independent of snowline`);
  assert.notDeepEqual(high.snow,low.snow);
  const disabled=channels(raster({style:{mountains:false}}));
  for(const name of ['baseColor','water','forest'])assert.deepEqual(disabled[name],low[name]);
  assert(disabled.rock.every(v=>v===0));assert(disabled.snow.every(v=>v===0));
});

test('requested channel set avoids unrelated allocation and requires forest tracking only when requested',()=>{
  const value=channels(raster({forest:false}),new Set(['rock','snow']));
  assert.deepEqual(Object.keys(value),['rock','snow']);
  assert.throws(()=>channels(raster({forest:false}),new Set(['forest'])),/Walderfassung/);
});

test('capturing channels leaves legacy finish pixels byte-identical and cannot run after display composition',()=>{
  const plain=raster(),captured=raster();
  channels(captured);
  assert.deepEqual(captured.finish(),plain.finish());
  const prepared=raster();runSteps(prepared.prepareSurfaceSteps(function*(){}));
  assert.throws(()=>channels(prepared),/vor Oberflächenbeleuchtung/);
  const finished=raster();finished.finish();assert.throws(()=>channels(finished),/vor Oberflächenbeleuchtung/);
  const changed=raster();channels(changed);assert.throws(()=>changed.paint(patch('late',rect(-1,-1,2,2))),/nach Materialkanalerfassung/);
});

test('same-LOD neighboring crops match the corresponding complete-raster channel bytes',()=>{
  const whole=channels(raster()),left=channels(raster({area:{...box,width:16},width:16})),right=channels(raster({area:{...box,x:0,width:16},width:16}));
  for(const name of CHANNEL_NAMES){
    const components=name==='baseColor'?4:1;
    for(let y=0;y<24;y++){
      assert.deepEqual(left[name].subarray(y*16*components,(y+1)*16*components),whole[name].subarray(y*32*components,y*32*components+16*components),`${name} left row ${y}`);
      assert.deepEqual(right[name].subarray(y*16*components,(y+1)*16*components),whole[name].subarray(y*32*components+16*components,(y+1)*32*components),`${name} right row ${y}`);
    }
  }
});
