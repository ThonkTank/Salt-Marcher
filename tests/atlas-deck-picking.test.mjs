import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';

buildSync({entryPoints:['src/app/atlas-deck-picking.ts'],outfile:'.build/atlas-deck-picking-test.mjs',bundle:true,platform:'node',format:'esm'});
const {ensureAtlasDeckPickingDepth}=await import('../.build/atlas-deck-picking-test.mjs');
function buffer(format='depth16unorm',color='rgba8unorm',width=1,height=1){
  const texture={format:color,destroyed:false,destroy(){this.destroyed=true;}};
  return {width,height,depthStencilAttachment:{texture:{format}},colorAttachments:[{texture}],destroyed:false,
    destroy(){this.destroyed=true;}};
}
function fixture(){
  const created=[],device={isTextureFormatSupported:()=>true,isTextureFormatRenderable:()=>true,createFramebuffer(props){
    const value=buffer(props.depthStencilAttachment,props.colorAttachments[0],props.width,props.height);value.props=props;created.push(value);return value;
  }};
  const picker={device,_resizeBuffer(){},pickingFBO:buffer(),depthFBO:buffer('depth16unorm','rgba32float')};
  return {deck:{deckPicker:picker},picker,device,created};
}

test('upgrades both picking passes atomically and releases old external color textures',()=>{
  const f=fixture(),old=[f.picker.pickingFBO,f.picker.depthFBO];ensureAtlasDeckPickingDepth(f.deck);
  assert.equal(f.created.length,2);
  assert.deepEqual(f.created.map(b=>b.props.colorAttachments),[['rgba8unorm'],['rgba32float']]);
  assert(f.created.every(b=>b.props.depthStencilAttachment==='depth24plus'));
  assert(old.every(b=>b.destroyed&&b.colorAttachments[0].texture.destroyed));
  assert.equal(f.picker.pickingFBO,f.created[0]);assert.equal(f.picker.depthFBO,f.created[1]);
  ensureAtlasDeckPickingDepth(f.deck);assert.equal(f.created.length,2);
});

test('allocates before the first Deck pick and does not alter global device methods',()=>{
  const f=fixture(),factory=f.device.createFramebuffer;delete f.picker.pickingFBO;delete f.picker.depthFBO;
  ensureAtlasDeckPickingDepth(f.deck);assert.equal(f.created.length,2);assert.equal(f.device.createFramebuffer,factory);
});

test('failed allocation preserves usable original buffers and releases only the candidate',()=>{
  const f=fixture(),old=[f.picker.pickingFBO,f.picker.depthFBO],create=f.device.createFramebuffer;
  f.device.createFramebuffer=props=>{if(f.created.length===1)throw Error('out of GPU memory');return create(props);};
  assert.throws(()=>ensureAtlasDeckPickingDepth(f.deck),/out of GPU memory/);
  assert.equal(f.picker.pickingFBO,old[0]);assert.equal(f.picker.depthFBO,old[1]);
  assert(old.every(b=>!b.destroyed));assert.equal(f.created[0].destroyed,true);
});

test('missing capabilities and unknown private contracts fail before resource replacement',()=>{
  assert.throws(()=>ensureAtlasDeckPickingDepth({}),/contract/);
  const f=fixture();f.device.isTextureFormatRenderable=()=>false;
  assert.throws(()=>ensureAtlasDeckPickingDepth(f.deck),/requires 24-bit/);assert.equal(f.created.length,0);
  f.device.isTextureFormatRenderable=()=>true;f.picker.pickingFBO=buffer('unknown');
  assert.throws(()=>ensureAtlasDeckPickingDepth(f.deck),/framebuffer format/);assert.equal(f.created.length,0);
});

test('resizes both picker passes before Deck can clone attachments and releases the old pair',()=>{
  const f=fixture(),size=[100,50],canvas={getDrawingBufferSize:()=>size},reservations=[],deckResize=[];
  f.device.getDefaultCanvasContext=()=>canvas;
  f.picker._resizeBuffer=()=>{deckResize.push([f.picker.pickingFBO.width,f.picker.pickingFBO.height,f.picker.depthFBO.width,f.picker.depthFBO.height]);};
  ensureAtlasDeckPickingDepth(f.deck,value=>reservations.push(value));
  assert.deepEqual(deckResize,[]);assert.deepEqual(f.created.map(b=>[b.width,b.height]),[[100,50],[100,50]]);
  const old=[f.picker.pickingFBO,f.picker.depthFBO];
  size.splice(0,2,200,90);f.picker._resizeBuffer(canvas);
  assert.deepEqual(reservations.at(-1),{oldColor:[100,50],oldDepth:[100,50],next:[200,90]});
  assert.deepEqual(deckResize,[[200,90,200,90]]);
  assert(old.every(b=>b.destroyed&&b.colorAttachments[0].texture.destroyed===false),
    'managed string attachments belong to their framebuffer, not the external color cleanup');
  assert.deepEqual(f.created.map(b=>[b.width,b.height]),[[100,50],[100,50],[200,90],[200,90]]);
  f.picker._resizeBuffer(canvas);assert.equal(f.created.length,4);
});

test('failed resize leaves the old 24-bit pair published and disposes only the candidate',()=>{
  const f=fixture(),size=[100,50],canvas={getDrawingBufferSize:()=>size},create=f.device.createFramebuffer;
  f.device.getDefaultCanvasContext=()=>canvas;ensureAtlasDeckPickingDepth(f.deck);
  const old=[f.picker.pickingFBO,f.picker.depthFBO];size.splice(0,2,200,90);
  f.device.createFramebuffer=props=>{if(props.colorAttachments[0]==='rgba32float')throw Error('resize allocation failed');return create(props);};
  assert.throws(()=>f.picker._resizeBuffer(canvas),/resize allocation failed/);
  assert.deepEqual([f.picker.pickingFBO,f.picker.depthFBO],old);
  assert(old.every(b=>!b.destroyed));assert.equal(f.created.at(-1).destroyed,true);
  f.device.createFramebuffer=create;f.picker._resizeBuffer(canvas);
  assert(old.every(b=>b.destroyed));
});

test('does not destroy a foreign 24-bit framebuffer on a size mismatch',()=>{
  const f=fixture(),canvas={getDrawingBufferSize:()=>[200,90]};
  f.device.getDefaultCanvasContext=()=>canvas;
  const external=[buffer('depth24plus','rgba8unorm',100,50),buffer('depth24plus','rgba32float',100,50)];
  [f.picker.pickingFBO,f.picker.depthFBO]=external;
  assert.throws(()=>ensureAtlasDeckPickingDepth(f.deck),/ownership/);
  assert(external.every(b=>!b.destroyed));assert.equal(f.created.length,0);
});
