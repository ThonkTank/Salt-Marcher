import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {parseHTML} from './helpers/dom.mjs';
import {emptyMaterialChannels} from './helpers/atlas-material-channels.mjs';

await build({entryPoints:['src/app/atlas-raster-presentation.ts'],outfile:'.build/atlas-presentation-retry.cjs',bundle:true,platform:'node',format:'cjs',plugins:[{name:'controlled-gpu',setup(b){
 b.onResolve({filter:/^\.\/atlas-terrain-prepared-session$/},()=>({path:'prepared-session',namespace:'gpu'}));
 b.onLoad({filter:/^prepared-session$/,namespace:'gpu'},()=>({contents:`// Surface recovery is isolated here; the real A/C/Screen chain runs in terrain-commit-display.test.mjs.
 export class AtlasTerrainPreparedSession {
  constructor(surface,tiles,style,options,changed){this.surface=surface;this.options=options;this.changed=changed;this.disposed=false;this.author={journal:{size:0},canonicalSource:options.source};this.queue={failed:false,pending:0,async finish(){}};this.client={epoch:0};Object.defineProperty(surface,'preparedInputUsable',{configurable:true,get:()=>surface.frameUsable});}
  get source(){return this.options.source;}
  canonical(){this.surface.publish(false);void this.surface.waitForFrame().then(()=>{if(!this.disposed)this.changed({endFrame:true,alpha:1,content:1});}).catch(()=>{});}
  matchesSource(s){return s.token===this.source.token&&s.fence===this.source.fence&&s.revision===this.source.revision;}
  async dispose(){this.disposed=true;}
 }` }));
 b.onResolve({filter:/^\.\/atlas-deck-runtime$/},()=>({path:'runtime',namespace:'gpu'}));
 b.onLoad({filter:/^runtime$/,namespace:'gpu'},()=>({resolveDir:process.cwd(),contents:"import {AtlasDeckSurface as Surface} from './src/app/atlas-deck-surface';export {AtlasDeckDrawing} from './src/app/atlas-deck-drawing';export {AtlasDeckVegetation} from './src/app/atlas-deck-vegetation';export const AtlasDeckSurface={create:options=>Surface.create({...options,createDeck:globalThis.createRetryDeck})};"}));
}}]});
const {AtlasRasterPresentation}=createRequire(import.meta.url)('../.build/atlas-presentation-retry.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const box={x:0,y:0,width:256,height:256};
const fmt=color=>({colorAttachments:[{texture:{format:color}}],depthStencilAttachment:{texture:{format:'depth24plus'}},destroy(){}});
function fixture(t){
 const {window,document}=parseHTML('<html><body><div id="atlas-view-popup"></div><input id="atlas-perception"><section><canvas id="atlas"></canvas></section></body></html>');
 const prior={window:globalThis.window,document:globalThis.document,ResizeObserver:globalThis.ResizeObserver,createRetryDeck:globalThis.createRetryDeck},errors=[],decks=[],observers=[],reads=[];
 Object.assign(globalThis,{window,document,ResizeObserver:class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}},createRetryDeck:props=>{
  const deck={props,finalized:0,deckPicker:{_resizeBuffer(){},device:{isTextureFormatSupported:()=>true,isTextureFormatRenderable:()=>true},pickingFBO:fmt('rgba8unorm'),depthFBO:fmt('rgba32float')},setProps(next){this.props={...this.props,...next};},redraw(){},finalize(){this.finalized++;},load(){this.props.onLoad();},render(){this.props.onBeforeRender();for(const layer of this.props.layers??[])Object.defineProperty(layer,'isLoaded',{value:true,configurable:true});this.props.onAfterRender();},fail(){this.props.onError(Error('GPU initialization failed'));}};
  decks.push(deck);return deck;
 }});
 const input=document.getElementById('atlas');Object.defineProperties(input,{clientWidth:{value:256},clientHeight:{value:256}});input.getBoundingClientRect=()=>({left:0,top:0});
 Object.defineProperties(window.HTMLElement.prototype,{clientWidth:{configurable:true,get:()=>256},clientHeight:{configurable:true,get:()=>256}});
 const channels=emptyMaterialChannels(256*256);
 window.campaign={atlasCancelRead:async()=>{},atlasTerrainTile:async(token,q)=>{
  reads.push({token,...q});const size=256*2**q.tile.lod,view={box:{x:q.tile.x*size,y:q.tile.y*size,width:size,height:size},frame:{x:q.tile.x*size,y:q.tile.y*size,width:size,height:size},columns:65,rows:65,focusM:0,tilt:0,rotation:0,exaggeration:1};
  return{ok:true,value:{tile:q.tile,revision:q.revision,fence:token,projection:{heightOnly:true,source:token,fence:token,revision:q.revision,draft:false,generation:0,width:0,height:0,pixels:new Uint8Array(),grid:{view,heights:new Float32Array(65*65),seaLevelM:0,editing:{ground:new Float32Array(4225),water:new Float32Array(4225)}}}}};
 },atlasMaterialTile:async(token,q)=>({ok:true,value:{tile:q.tile,revision:q.revision,fence:token,width:256,height:256,channels}})};
 let navigationCalls=0,redraws=0;
 const ui=new AtlasRasterPresentation(input,{draft:()=>null,live:()=>false,hasDraft:()=>false,writing:()=>false,cancel(){},tool:()=> 'height',navigation:()=>{navigationCalls++;return false;},panning:()=>false,redraw:()=>redraws++,selection:()=>null,error:e=>errors.push(e)});
 ui.bindAuthorWriter(async()=>{throw Error('Surface recovery fixture never writes terrain');});
 const priorError=console.error;console.error=()=>{};
 t.after(()=>{ui.setActive(false);for(const deck of decks)if(!deck.finalized)deck.fail();console.error=priorError;Object.assign(globalThis,prior);});
 const open=(token='a',frame=box)=>ui.openSurface(token,frame,1,0,token);
 const finish=async deck=>{deck.load();deck.render();await settle();deck.render();await settle();};
 return{ui,input,document,window,decks,errors,observers,reads,open,finish,get navigationCalls(){return navigationCalls;},get redraws(){return redraws;}};
}

test('failed initial open settles and one explicit retry creates a usable current-source surface',async t=>{
 const f=fixture(t);const opening=f.open();await settle();assert.equal(f.decks.length,1);
 f.decks[0].fail();assert.equal(await opening,false);await settle();
 assert.equal(f.ui.surface,null);assert.equal(f.ui.firstSurface.size,0);assert.equal(f.errors.length,1,'onError plus rejected creation reports one incident');assert.equal(f.decks[0].finalized,1);
 const retry=f.document.getElementById('atlas-camera-retry');assert.equal(retry.hidden,false);
 f.ui.reframe({...box,x:512});retry.click();retry.click();await settle();assert.equal(f.decks.length,2,'a double retry press owns one initialization');
 assert.equal(f.document.querySelectorAll('#atlas-terrain-spatial').length,1);assert.equal(f.decks[1].props.views[0].props.frame.camera.focus.x,640);
 await f.finish(f.decks[1]);assert.equal(f.ui.ready,true);assert.equal(retry.hidden,true);assert.equal(retry.disabled,false);assert.equal(f.ui.firstSurface.size,0);
 assert(f.reads.length>0);assert(f.reads.every(r=>r.token==='a'&&r.revision===1));
 assert.equal(await f.open('a',{...box,x:512}),true,'a new open observes the recovered source');
 const e=new f.window.Event('pointerdown',{bubbles:true,cancelable:true});Object.assign(e,{clientX:128,clientY:128,button:0});f.input.dispatchEvent(e);assert.equal(f.navigationCalls,1,'retry does not install duplicate input listeners');
 assert.equal(f.observers.filter(o=>!o.disconnected).length,2,'one presentation observer and one live Surface observer');
});

for(const late of ['success','failure'])test(`deactivation settles an opening before its late ${late} and releases the old GPU owner`,async t=>{
 const f=fixture(t),opening=f.open();await settle();const old=f.decks[0];f.ui.setActive(false);
 assert.equal(await opening,false);assert.equal(f.ui.firstSurface.size,0);assert.equal(f.document.querySelectorAll('#atlas-terrain-spatial').length,0);
 if(late==='success')await f.finish(old);else{old.fail();await settle();}
 assert.equal(old.finalized,1);assert.equal(f.ui.surface,null);assert.equal(f.ui.ready,false);assert.equal(f.errors.length,0);assert.equal(f.reads.length,0);
});

for(const late of ['success','failure'])test(`source switch fences old ${late}, retry and readiness callbacks`,async t=>{
 const f=fixture(t),opening=f.open('a');await settle();const old=f.decks[0],next=f.open('b',{...box,x:256});
 assert.equal(await opening,false);await settle();assert.equal(f.decks.length,2);const current=f.decks[1];
 if(late==='success')await f.finish(old);else{old.fail();await settle();}
 assert.equal(f.ui.surface,null);assert.equal(f.ui.ready,false);assert.equal(f.errors.length,0);assert.equal(f.decks[0].finalized,1);
 await f.finish(current);assert.equal(await next,true);assert.equal(f.ui.ready,true);assert.equal(f.ui.firstSurface.size,0);assert.equal(f.document.querySelectorAll('#atlas-terrain-spatial').length,1);
 assert(f.reads.every(r=>r.token==='b'),'retired source never starts tile loading');
 old.props.onError(Error('late old callback'));assert.equal(f.errors.length,0);assert.equal(f.ui.ready,true);
});

test('perception initialization retries without terrain reads and ignores a retired render waiter',async t=>{
 const f=fixture(t);f.document.getElementById('atlas-perception').checked=true;
 f.ui.sync('a',box,1,[],0);await settle();f.decks[0].fail();await settle();
 f.document.getElementById('atlas-camera-retry').click();await settle();const old=f.decks[1];old.load();old.render();await settle();
 assert.equal(f.ui.ready,true,'the empty perception scene uses its already confirmed creation frame');
 f.ui.sync('b',box,1,[],0);await settle();const current=f.decks[2];await f.finish(current);
 assert.equal(f.ui.ready,true);assert.equal(f.errors.length,1,'retired frame rejection does not fail the new source');assert.equal(f.reads.length,0);
});

test('deactivation before dynamic initialization prevents allocating a retired GPU',async t=>{
 const f=fixture(t),opening=f.open();f.ui.setActive(false);assert.equal(await opening,false);await settle();
 assert.equal(f.decks.length,0);assert.equal(f.errors.length,0);assert.equal(f.ui.firstSurface.size,0);
});

test('a failed explicit retry settles its own opener and leaves another explicit attempt possible',async t=>{
 const f=fixture(t),opening=f.open();await settle();f.decks[0].fail();assert.equal(await opening,false);await settle();
 const retry=f.document.getElementById('atlas-camera-retry');retry.click();const second=f.open();await settle();f.decks[1].fail();assert.equal(await second,false);await settle();
 assert.equal(f.errors.length,2);assert.equal(retry.hidden,false);assert.equal(retry.disabled,false);assert.equal(f.ui.firstSurface.size,0);
 retry.click();await settle();await f.finish(f.decks[2]);assert.equal(f.ui.ready,true);assert.equal(f.decks.length,3);assert.equal(f.document.querySelectorAll('#atlas-terrain-spatial').length,1);
});

test('a new source fence in the same campaign retires only the old opening',async t=>{
 const f=fixture(t),old=f.open('a');await settle();const first=f.decks[0];
 const next=f.ui.openSurface('a',box,2,0,'a-new-fence');assert.equal(await old,false);await settle();
 first.fail();await settle();assert.equal(f.errors.length,0);assert.equal(f.ui.firstSurface.size,1,'the new opening remains independently owned');
 f.decks[1].fail();assert.equal(await next,false);assert.equal(f.errors.length,1);assert.equal(f.ui.firstSurface.size,0);
});

test('an explicit retry of an already published Surface retains current source and frame qualification',async t=>{
 const f=fixture(t),opening=f.open();await settle();await f.finish(f.decks[0]);assert.equal(await opening,true);
 f.decks[0].fail();assert.equal(f.ui.ready,false);const retry=f.document.getElementById('atlas-camera-retry');retry.click();await settle();
 assert.equal(f.decks.length,2);assert.equal(f.ui.ready,false);await f.finish(f.decks[1]);
 assert.equal(f.ui.ready,true,'the prepared adapter fixture confirms its own completed recovery frame');
 assert.equal(f.ui.ready,true);assert.equal(retry.hidden,true);assert.equal(retry.disabled,false);assert.equal(f.errors.length,1);assert.equal(f.ui.token,'a');assert.equal(f.ui.fence,'a');
});
