import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {parseHTML} from 'linkedom';
buildSync({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/landscape-inspector';export * from './src/app/atlas-landscape';export * from './src/app/atlas-cartography';export * from './src/app/terrain-route';"},outfile:'.build/prominence-editor.cjs',bundle:true,platform:'node',format:'cjs'});
const {LandscapeInspector,emptyRecord,landscapeLabels,routeSpec}=createRequire(import.meta.url)('../.build/prominence-editor.cjs');
test('inspector distinguishes prominence-only saves from unsaved names and physical edits',async()=>{
 const {document,window}=parseHTML('<html><body><section id="land-selection"></section></body></html>');
 const keys=['document','window','Option'],saved=Object.fromEntries(keys.map(k=>[k,globalThis[k]])),values=new WeakMap();
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return values.get(this)??'';},set(v){values.set(this,String(v));}});
 window.HTMLSelectElement.prototype.add=function(o){this.append(o);};
 Object.assign(globalThis,{document,window,Option:function(text,value){const o=document.createElement('option');o.textContent=text;o.value=value;return o;}});
 const host={inspectorRoot:document.querySelector('section'),hasDraft:()=>false,token:'a',effects:{data:()=>({}),redraw(){},error(e){throw e;}},say(){},assets:new Map(),objectOptions(){},routes:{openRoute(){}},finish:async()=>{},draftSeed:1};
 const inspector=new LandscapeInspector(host),points=[{x:0,y:0},{x:200000,y:0}],road={...emptyRecord('road'),id:'road',name:'Pass',width:8,points};
 const choose=value=>{const select=document.querySelector('#land-prominence');select.value=value;select.dispatchEvent(new window.Event('change',{bubbles:true}));};
 try{
  await inspector.select(road);choose('5');assert.equal(inspector.prominenceAction().prominence,5);
  const name=document.querySelector('#land-name');name.value='Other';name.dispatchEvent(new window.Event('input',{bubbles:true}));
  assert.equal(inspector.prominenceAction(),undefined);choose('4');assert.equal(inspector.prominenceAction(),undefined,'later prominence must not drop pending name');
  inspector.readInspector();assert.equal(inspector.selected.name,'Other');assert.equal(inspector.selected.prominence,4);
  inspector.clearSelection();await inspector.select({...road,route:routeSpec('road',points),prominence:5});choose('');assert.equal(inspector.prominenceAction().prominence,null);
  inspector.selected.width=20;assert.equal(inspector.prominenceAction(),undefined,'physical draft never uses metadata-only write');
 }finally{Object.assign(globalThis,saved);}
});
test('names inherit prominence while explicit rank and hidden overrides survive',()=>{
 const road={...emptyRecord('road'),name:'Pass',width:8,points:[{x:0,y:0},{x:10000,y:0}],prominence:5};
 assert(landscapeLabels(road).every(l=>l.rank===5&&l.maxMpp===undefined));
 assert(landscapeLabels({...road,label:{rank:1}}).every(l=>l.rank===1&&l.maxMpp===12));
 assert.deepEqual(landscapeLabels({...road,label:{hidden:true}}),[]);
});
