// Existing atlas-deck-surface.test.mjs Deck/device fixtures, shared with E integration.
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
let AtlasDeckSurface;export function bindPreparedSurfaceClass(value){AtlasDeckSurface=value;}
const camera={focus:{x:0,y:0},focusHeightM:0,metersPerPixel:1,rotation:0,tilt:0,exaggeration:1};
function object(id='floor') {
  const target={kind:'room',id:'room-1',scopeId:'building-1',floorId:'ground'};
  return {id:`room:${id}`,target,origin:{x:0,y:0,heightM:0},
    positions:new Float32Array([-10,-10,0,10,-10,0,0,10,0]),indices:new Uint32Array([0,1,2])};
}
function model(o=object()) {return {objects:[o],targets:new Map([[o.id,o.target]]),coverage:{complete:true,supportedKinds:['terrain','building','room'],unsupported:[]},verticalExaggeration:1};}
const fmt=(color,depth='depth24plus',width=640,height=480)=>({width,height,colorAttachments:[{texture:{format:color}}],depthStencilAttachment:{texture:{format:depth}},destroyed:false,destroy(){this.destroyed=true;}});

class FakeDeck {
  constructor(props) {
    this.props=props;this.setPropsCalls=[];this.redrawCalls=[];this.finalizeCalls=0;this.pickCalls=[];
    this.pickResult=null;
    this.deckPicker={_resizeBuffer(){},device:{isTextureFormatSupported:()=>true,isTextureFormatRenderable:()=>true},
      pickingFBO:fmt('rgba8unorm','depth24plus',props.canvas.width,props.canvas.height),depthFBO:fmt('rgba32float','depth24plus',props.canvas.width,props.canvas.height)};
  }
  setProps(props){this.setPropsCalls.push(props);if(this.setPropsError)throw this.setPropsError;this.props={...this.props,...props};}
  redraw(reason){this.redrawCalls.push(reason);}
  fireLoad(){this.props.onLoad?.();}
  fireRender(){this.props.onBeforeRender?.();for(const layer of this.props.layers??[]){Object.defineProperty(layer,'isLoaded',{value:true,configurable:true});if(layer.props.visible!==false&&!this.suppressFieldDraw)layer.props.onDrawSuccess?.(Math.fround(layer.props.alpha));}this.props.onAfterRender?.();}
  fireError(error=new Error('fake Deck failure')){this.props.onError?.(error);}
  pickObject(args){this.pickCalls.push(args);return this.pickResult;}
  finalize(){this.finalizeCalls++;}
}

function environment(t,{animationFrames=false,onAnimationError}={}) {
  const {window,document}=parseHTML('<html><body><div id="host"></div></body></html>');
  const previous={document:globalThis.document,window:globalThis.window,ResizeObserver:globalThis.ResizeObserver,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
  let observer;
  globalThis.document=document;globalThis.window=window;
  const frames=new Map();let serial=0,requested=0,executed=0,cancelled=0,closed=false;
  const stopFrames=()=>{closed=true;for(const timer of frames.values())clearTimeout(timer);cancelled+=frames.size;frames.clear();};
  if(animationFrames){
    globalThis.requestAnimationFrame=callback=>{if(closed)return 0;const id=++serial;requested++;frames.set(id,setTimeout(()=>{frames.delete(id);if(closed)return;executed++;try{callback(performance.now());}catch(error){if(onAnimationError)onAnimationError(error);else throw error;}},8));return id;};
    globalThis.cancelAnimationFrame=id=>{const timer=frames.get(id);if(timer!==undefined){clearTimeout(timer);frames.delete(id);cancelled++;}};
  }else{globalThis.requestAnimationFrame??=()=>1;globalThis.cancelAnimationFrame??=()=>{};}
  globalThis.ResizeObserver=class {constructor(callback){this.callback=callback;this.disconnected=false;observer=this;}observe(){}disconnect(){this.disconnected=true;}};
  const container=document.getElementById('host');let width=640,height=480;
  Object.defineProperties(container,{clientWidth:{configurable:true,get:()=>width},clientHeight:{configurable:true,get:()=>height}});
  const setSize=(w,h)=>{width=w;height=h;};
  t.after(()=>{stopFrames();Object.assign(globalThis,previous);});
  return {container,document,window,setSize,getObserver:()=>observer,animation:{stop:stopFrames,get statistics(){return{enabled:animationFrames,requested,executed,cancelled,pending:frames.size,closed};}}};
}
export async function readySurface(t,{camera:pose=camera,model:scene=model(),timeoutMs=200,animationFrames=false,...options}={}) {
  const env=environment(t,{animationFrames,onAnimationError:options.onError}),decks=[];
  const createDeck=props=>{const deck=new FakeDeck(props);decks.push(deck);return deck;};
  const pending=AtlasDeckSurface.create({container:env.container,camera:pose,model:scene,timeoutMs,createDeck,...options});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(decks.length,1);
  const deck=decks[0];deck.fireLoad();
  let settled=false;pending.then(()=>{settled=true;},()=>{settled=true;});
  assert.equal(settled,false,'Deck load alone must not publish a ready surface');
  deck.fireRender();
  const surface=await pending;
  assert.equal(surface.frameUsable,true);
  return {surface,deck,decks,env};
}
function picked(objectValue,layerId=`atlas-scene:${objectValue.id}`) {
  return {picked:true,index:0,object:objectValue,layer:{id:layerId}};
}

function fieldSource(id,height=100){
  const box={x:0,y:0,width:256,height:256},view={box,columns:65,rows:65},data=new Uint8Array(256*256*4),texture={width:256,height:256,data};
  return{object:{id,target:{kind:'terrain',id},origin:{x:0,y:0,heightM:0}},grid:{view,heights:new Float32Array(65*65).fill(height)},texture,masks:texture,cover:texture,relief:texture};
}
export function fieldDevice(){
  const textures=[],uploads=[],gl={NO_ERROR:0,TEXTURE_BINDING_2D_ARRAY:1,TEXTURE_BINDING_2D:9,UNPACK_ALIGNMENT:2,UNPACK_ROW_LENGTH:3,TEXTURE_2D_ARRAY:4,TEXTURE_2D:10,RGBA:5,UNSIGNED_BYTE:6,RED:7,FLOAT:8,RED_INTEGER:11,
    lost:false,isContextLost(){return this.lost;},
    getParameter:key=>key===2?4:key===3?0:null,getError:()=>0,bindTexture(_target,value){this.bound=value;},pixelStorei(){},texSubImage3D(_target,_level,_x,_y,slot,_width,_height,_depth,_format,_type,data){if(this.bound?.failCount){this.bound.failCount--;throw Error('injected partial upload');}uploads.push({texture:this.bound?.owner?.props.id,slot,first:data[0]});},texSubImage2D(){}};
  const device={type:'webgl',gl,statsManager:{getStats:()=>({get:()=>({count:0})})},isTextureFormatSupported:()=>true,createTexture:props=>{const texture={props,width:props.width,height:props.height,depth:props.depth??1,samples:1,format:props.format,handle:{},destroyed:false,destroy(){this.destroyed=true;}};texture.handle.owner=texture;textures.push(texture);return texture;}};
  return{device,textures,uploads};
}
