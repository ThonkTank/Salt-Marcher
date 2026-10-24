import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({stdin:{resolveDir:process.cwd(),contents:`export * from './src/app/atlas-drawing-geometry';export * from './src/app/atlas-deck-drawing';export * from './src/app/atlas-paint';export * from './src/app/atlas-metric-camera';`},bundle:true,platform:'node',format:'cjs',outfile:'.build/atlas-drawing-geometry.cjs'});
const {atlasDrawingGeometry,AtlasDeckDrawing,atlasPaint,atlasMetricFrame}=createRequire(import.meta.url)('../.build/atlas-drawing-geometry.cjs');
const flat={origin:{x:0,y:0},focusM:0,exaggeration:1,segment:10,height:()=>0};
const command=(node,extra={})=>({node,matrix:{a:1,b:0,c:0,d:1,e:0,f:0},style:{fill:'#d8c59d',stroke:null,...node.style},alpha:1,pointer:true,hud:false,title:'',ancestry:[node],...extra});
const frame={ray:p=>[[p.x,p.y,100],[p.x,p.y,-100]]};
const triangleZ=meshes=>meshes.flatMap(m=>Array.from(m.positions).filter((_,i)=>i%3===2));
test('shared drawing buffers preserve holes, transparent grips, ancestry and terrain occlusion',()=>{
 const room=atlasPaint('polygons',{polygons:[{outer:[{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}],holes:[[{x:8,y:8},{x:12,y:8},{x:12,y:12},{x:8,y:12}]]}],data:{atlasObject:'true',id:'room'}});
 const grip=atlasPaint('circle',{x:2,y:2,radius:1,style:{fill:'transparent'},data:{atlasVertex:'7'}});
 const drawing=new AtlasDeckDrawing({commands:[command(room),command(grip)]},{x:0,y:0},new Map(),flat);
 assert.equal(drawing.hit(frame,{x:3,y:3},['atlasObject']).data.id,'room');
 assert.equal(drawing.hit(frame,{x:10,y:10},['atlasObject']),null);
 assert.equal(drawing.hit(frame,{x:2,y:2},['atlasVertex']).data.atlasVertex,'7');
 assert.equal(drawing.hit(frame,{x:3,y:3},['atlasObject'],50),null);drawing.dispose();
 assert.equal(drawing.hit(frame,{x:3,y:3},['atlasObject']),null);
});
test('far-world geometry retains rotated centimetres before conversion to Float32',()=>{
 const origin={x:1e10,y:-1e10},node=atlasPaint('rect',{width:.02,height:.03});
 const meshes=atlasDrawingGeometry({commands:[command(node,{matrix:{a:0,b:1,c:-1,d:0,e:2,f:3}})]},origin,new Map(),{...flat,origin,height:()=>12,focusM:10});
 const xs=Array.from(meshes[0].positions).filter((_,i)=>i%3===0);
 assert(Math.max(...xs)-Math.min(...xs)>.029);assert(xs.every(x=>x>=1.9699&&x<=2.0001));assert(triangleZ(meshes).every(z=>z===2));
});
test('draped surfaces sample interior heights while floors and grips remain horizontal',()=>{
 const face=atlasPaint('rect',{width:100,height:100});
 const terrain=atlasDrawingGeometry({commands:[command(face)]},{x:0,y:0},new Map(),{...flat,segment:5,height:p=>Math.max(0,30-Math.hypot(p.x-50,p.y-50))});
 assert(triangleZ(terrain).some(z=>z>25));
 const floor=atlasPaint('group',{data:{spatialScope:'house',spatialFloor:'6',spatialAnchorX:'10',spatialAnchorY:'20'}});
 for(const bases of [new Map([['house',15]]),new Map()]){
  const meshes=atlasDrawingGeometry({commands:[command(face,{ancestry:[face,floor]})]},{x:0,y:0},new Map(),{...flat,height:p=>p.x+p.y,scopeBases:bases});
  assert(triangleZ(meshes).every(z=>z===(bases.size?21:36)));
 }
});
test('terrain-owned rasters and HUD stay out of GPU map buffers; dense object imagery stays draped',()=>{
 const image=atlasPaint('image',{width:20,height:20,source:'objects'}),rect=atlasPaint('rect',{width:20,height:20});
 const meshes=atlasDrawingGeometry({commands:[command(rect,{hud:true}),command(rect,{ancestry:[{data:{landscapeRaster:'true'}}]}),command(image)]},{x:0,y:0},new Map([['objects',{width:16,height:16}]]),{...flat,height:p=>p.x/2});
 assert.equal(meshes.length,1);assert.equal(meshes[0].texture.width,16);assert(meshes[0].positions.length>18);assert(triangleZ(meshes).some(z=>z>0));
});
test('billboard labels stay screen-aligned at high tilt and rotated cameras',t=>{
 const old=globalThis.document;globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({measureText:()=>({width:80}),fillText(){},strokeText(){}})})};t.after(()=>globalThis.document=old);
 const text=atlasPaint('text',{x:0,y:0,style:{fontSize:2,fill:'white'}},'Label');
 const drawing=new AtlasDeckDrawing({commands:[command(text)]},{x:0,y:0},new Map(),flat);
 for(const tilt of [0,55,75])for(const rotation of [0,90]){
  const f=atlasMetricFrame({focus:{x:0,y:0},focusHeightM:0,metersPerPixel:.1,tilt,rotation,exaggeration:3},800,600);
  const positions=drawing.layers(f,'test')[0].props.mesh.attributes.POSITION.value;
  const project=i=>f.project({x:positions[i],y:positions[i+1],heightM:positions[i+2]});
  const a=project(0),b=project(3),c=project(6);
  assert(Math.abs(a.y-b.y)<1e-4);assert(Math.abs(a.x-c.x)<1e-4);assert(b.x>a.x&&c.y>a.y);
 }
 drawing.dispose();
});
test('transparent mask pixels never become selectable rectangles',()=>{
 const mesh={positions:new Float32Array([0,0,0,10,0,0,0,10,0,10,0,0,10,10,0,0,10,0]),indices:new Uint32Array([0,1,2,3,4,5]),uv:new Float32Array([0,0,1,0,0,1,1,0,1,1,0,1]),color:[255,255,255,255],target:{atlasObject:'true',id:'masked'},hitAlpha:{pixels:new Uint8ClampedArray([0,0,0,0,0,0,0,255,0,0,0,255,0,0,0,255]),width:2,height:2}};
 const drawing=new AtlasDeckDrawing({commands:[]},{x:0,y:0},new Map(),flat,[mesh]);
 assert.equal(drawing.hit(frame,{x:2,y:2},['atlasObject']),null);assert.equal(drawing.hit(frame,{x:8,y:2},['atlasObject']).data.id,'masked');drawing.dispose();
});

test('output text textures grow with pixel density without changing their metric size',t=>{
 const old=globalThis.document;globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({font:'',measureText(){return{width:parseFloat(this.font.split(' ').find(v=>v.endsWith('px')))*2};},fillText(){},strokeText(){}})})};t.after(()=>globalThis.document=old);
 const text=atlasPaint('text',{x:0,y:0,style:{fontSize:2,fill:'white'}},'Name');
 const render=density=>atlasDrawingGeometry({commands:[command(text)]},{x:0,y:0},new Map(),{...flat,textPixelsPerMeter:density})[0];
 const small=render(24),large=render(48);assert.equal(large.texture.width,small.texture.width*2);assert.equal(large.texture.height,small.texture.height*2);assert.deepEqual(large.billboard.offsets,small.billboard.offsets);
});

test('public forest ink remains clipped to disclosed geometry and separate from ordinary polygons',()=>{
 const forest=atlasPaint('polygons',{polygons:[{outer:[{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}],holes:[[{x:8,y:8},{x:12,y:8},{x:12,y:12},{x:8,y:12}]]}],data:{publicForestScale:'48',knownCell:'0,0'}});
 const plain=atlasPaint('rect',{x:30,y:0,width:20,height:20,data:{knownCell:'1,0'}});
 const drawing=new AtlasDeckDrawing({commands:[command(forest),command(plain)]},{x:0,y:0},new Map(),flat);
 const camera=atlasMetricFrame({focus:{x:20,y:10},focusHeightM:0,metersPerPixel:1,rotation:0,tilt:0,exaggeration:1},800,600);
 const layers=drawing.layers(camera,'player');
 assert.equal(layers.length,2);
 assert.equal(layers[0].constructor.layerName,'AtlasPublicForestLayer');
 assert.equal(layers[0].props.forestScale,48);
 assert.equal(layers[1].constructor.layerName,'SimpleMeshLayer');
 assert.equal(drawing.hit(frame,{x:3,y:3},['knownCell']).data.knownCell,'0,0');
 assert.equal(drawing.hit(frame,{x:10,y:10},['knownCell']),null);
 assert.equal(drawing.hit(frame,{x:25,y:10},['knownCell']),null);
 drawing.dispose();
});
