import {test} from 'node:test';import assert from 'node:assert/strict';import {buildSync} from 'esbuild';import {createRequire} from 'node:module';import {parseHTML} from 'linkedom';
buildSync({stdin:{contents:"export {LandscapeWorkbench} from './src/app/atlas-landscape-ui';export {AtlasPaint} from './src/app/atlas-paint';export {HEX_METERS,contains} from './src/app/atlas-landscape';",resolveDir:process.cwd()},outfile:'.build/atlas-frame-loading.cjs',bundle:true,platform:'node',format:'cjs'});const {LandscapeWorkbench,AtlasPaint,HEX_METERS,contains}=createRequire(import.meta.url)('../.build/atlas-frame-loading.cjs');
function fixture(t){const {window,document}=parseHTML('<html><body><div id="atlas-tool-fields"></div><select id="atlas-hex-level"><option value="0">0</option></select><canvas></canvas></body></html>'),previous={window:global.window,document:global.document,Option:global.Option};Object.assign(global,{window,document,Option:function(text,value){const o=document.createElement('option');o.textContent=text;o.value=value;return o;}});t.after(()=>Object.assign(global,previous));Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.getAttribute('data-value')??this.querySelector('option')?.value??'';},set(v){this.setAttribute('data-value',v);}});window.HTMLSelectElement.prototype.add=function(o){this.append(o);};let data;const errors=[],host={point:e=>({x:e.clientX,y:e.clientY}),box:()=>({x:0,y:0,width:10,height:10}),redraw(){},write:async()=>{},error:e=>errors.push(e),data:()=>data},ui=new LandscapeWorkbench(document.querySelector('canvas'),host);ui.context('token');return{ui,scene:new AtlasPaint('group'),window,document,errors,host,set(r){data={revision:0,region:{fence:'source',landscape:{state:'ready',records:r,tiles:[],coverage:{complete:true,mode:'detail',objects:r.length,references:r.filter(x=>x.kind==='reference').length}}}};}};}
const ref=id=>({id,revision:0,kind:'reference',name:id,points:[{x:0,y:0}],polygons:[],resolution:1,width:1,assetId:id,imageWidth:1,imageHeight:1,values:{}});
test('selecting an exact object does not cancel pending frame images; a different region at the same source replaces its layer',async t=>{
 const f=fixture(t);let release;const requested=[];f.window.campaign={referenceAssetPreview:async(token,id)=>{requested.push(id);if(id==='a')await new Promise(r=>release=r);return{ok:true,value:'image:'+id};},atlasLandscapeObject:async()=>({ok:true,value:{...ref('selected'),kind:'road',assetId:undefined,points:[{x:0,y:0},{x:1,y:1}],values:{privateValue:'preserved'}}})};f.set([ref('a'),ref('b')]);const load=f.ui.load();await f.ui.selectId('selected');release();await load;assert.deepEqual(requested,['a','b']);assert.equal(f.ui.assets.get('b'),'image:b');assert.equal(f.document.querySelector('#land-name').value,'selected');f.set([ref('c')]);await f.ui.load();assert.deepEqual(f.ui.records.map(x=>x.id),['c']);assert.equal(f.ui.assets.get('c'),'image:c');assert.equal(f.errors.length,0);
});
test('drawing an already published frame never starts a landscape read',t=>{const f=fixture(t);f.window.campaign=new Proxy({},{get(){throw Error('draw must not read');}});f.ui.draw(f.scene,{x:0,y:0,width:10,height:10},.1);assert.equal(f.errors.length,0);});

test('repeated exact image selections keep the renderer preview cache bounded',async t=>{const f=fixture(t);f.set([]);f.window.campaign={referenceAssetPreview:async()=>({ok:true,value:'x'.repeat(600000)}),atlasLandscapeObject:async(token,id)=>({ok:true,value:ref(id)})};for(let i=0;i<20;i++)await f.ui.selectId('ref'+i);assert([...f.ui.assets.values()].reduce((n,v)=>n+v.length*2,0)<=8*1024*1024);assert(f.ui.assets.has('ref19'));assert(!f.ui.assets.has('ref0'));});

test('reference import refreshes the source frame before starting calibration on its newly registered asset',async()=>{
 const prior={window:global.window,document:global.document,Option:global.Option};let cleanup;const f=fixture({after:run=>cleanup=run});try{f.set([]);let refreshed=false;f.host.refresh=async()=>{refreshed=true;};f.window.campaign={referenceImage:async()=>({ok:true,value:{id:'new-image',width:1600,height:1000}}),referenceAssetPreview:async()=>{assert(refreshed,'registration changes source fence, so calibration must use its refreshed frame');return{ok:true,value:'image'};}};f.document.querySelector('#land-reference').click();await new Promise(r=>setImmediate(r));assert(refreshed);assert(f.ui.assets.has('new-image'));assert.match(f.document.querySelector('#land-status').textContent,/Zwei Bildpunkte/);assert.equal(f.errors.length,0);}finally{cleanup();Object.assign(global,prior);}
});

test('an unavailable frame image keeps the layer usable and exposes a working local retry',async t=>{const f=fixture(t);f.set([ref('a')]);let failed=true;f.window.campaign={referenceAssetPreview:async()=>failed?{ok:false,error:'unavailable'}:{ok:true,value:'image:a'}};await f.ui.load();assert.equal(f.ui.records.length,1);assert.equal(f.document.querySelector('#land-reload').hidden,false);failed=false;f.host.refresh=()=>f.ui.load(true);f.document.querySelector('#land-reload').click();await new Promise(r=>setImmediate(r));assert.equal(f.ui.assets.get('a'),'image:a');assert.equal(f.document.querySelector('#land-reload').hidden,true);assert.equal(f.errors.length,0);});

test('a rejected reference preview leaves a local outline and does not stop other references or retry',async t=>{
 const f=fixture(t);let broken=true;const requests=[];
 f.window.campaign={referenceAssetPreview:async(token,id)=>{requests.push(id);if(id==='bad'&&broken)throw Error('controlled preview transport failure');return{ok:true,value:'image:'+id};}};
 f.set([ref('bad'),ref('good')]);await f.ui.load();assert.deepEqual(requests,['bad','good']);assert(f.ui.assets.has('good'));assert.equal(f.ui.assets.has('bad'),false);assert.match(f.document.querySelector('#land-status').textContent,/nicht verfügbar/);
 f.ui.draw(f.scene,{x:0,y:0,width:10,height:10},.1);assert.equal(descendants(f.scene).find(n=>n.data.referenceState==='unavailable')?.data.referenceId,'bad');
 broken=false;await f.ui.load(true);assert(f.ui.assets.has('bad'));assert.equal(f.errors.length,0);
});

test('reference previews reuse the same source but cannot survive a new source fence under the same asset ID',async t=>{
 const f=fixture(t);let calls=0;f.window.campaign={referenceAssetPreview:async()=>({ok:true,value:'preview:'+ ++calls})};f.set([ref('same')]);await f.ui.load();assert.equal(f.ui.assets.get('same'),'preview:1');f.set([ref('same')]);await f.ui.load();assert.equal(calls,1);f.host.data().region.fence='new-source';await f.ui.load();assert.equal(calls,2);assert.equal(f.ui.assets.get('same'),'preview:2');
});

const descendants=n=>[n,...n.children.flatMap(descendants)];
test('landscape background reuses geometry across draft paints and buffered pan, while new source images invalidate it',async t=>{
 const f=fixture(t);f.set([ref('a')]);f.window.campaign={referenceAssetPreview:async()=>({ok:true,value:'image:a'})};await f.ui.load();
 const scene=()=>new AtlasPaint('group'),box={x:0,y:0,width:10,height:10};let root=scene();f.ui.draw(root,box,.1);const base=root.children.find(n=>n.data.atlasLandscapeBase==='true').children[0];
 f.ui.points=[{x:1,y:2},{x:3,y:4}];root=scene();f.ui.draw(root,{...box,x:2,y:-3},.1);const retained=root.children.find(n=>n.data.atlasLandscapeBase==='true');assert.equal(retained.children[0],base);assert.deepEqual(retained.geometry.matrix,[1,0,0,1,-2,3]);assert(descendants(root).some(n=>n.data.editorOnly==='true'));
 f.ui.assets.set('a','replacement');root=scene();f.ui.draw(root,box,.1);assert.notEqual(root.children.find(n=>n.data.atlasLandscapeBase==='true').children[0],base,'new decoded source must not keep old reference geometry');
});

test('a selected reference keeps its original slot below terrain and updates without rebuilding other paths',async t=>{
 const f=fixture(t),reference=ref('a'),road={...ref('road'),kind:'road',points:[{x:0,y:0},{x:10,y:10}],assetId:undefined};f.set([reference,road]);f.window.campaign={referenceAssetPreview:async()=>({ok:true,value:'image:a'})};await f.ui.load();f.ui.selected=structuredClone(reference);
 const draw=()=>{const r=new AtlasPaint('group');f.ui.draw(r,{x:0,y:0,width:10,height:10},.1);return r.children.find(n=>n.data.atlasLandscapeBase==='true').children[0];};
 const first=draw();f.ui.selected.width=2;const next=draw();assert.equal(first.children[1],next.children[1]);assert.equal(next.children[0].data.landscapeId,'a');assert.equal(next.children[1].data.landscapeId,'road');assert.equal(next.children[0].children[0].geometry.width,2);
});

test('Hex fill previews and commits every cell between sparse pointer samples, with no write before confirmation',async t=>{
 const f=fixture(t);f.set([]);const writes=[];f.host.write=async action=>{writes.push(action);return true;};
 f.ui.setActive(true);const tool=f.document.querySelector('#land-tool');tool.value='hex';tool.dispatchEvent(new f.window.Event('change'));
 f.host.hit=()=>null;f.host.point=e=>({x:e.clientX,y:e.clientY});const canvas=f.document.querySelector('canvas');canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
 const pointer=(type,x)=>{const e=new f.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{button:0,pointerId:1,clientX:x,clientY:0});canvas.dispatchEvent(e);};
 const palette=f.document.createElement('select');palette.id='atlas-terrain';palette.append(new Option('Wald','forest'));f.document.body.append(palette);
 f.document.querySelector('#land-radius').value='1000000';f.document.querySelector('#land-auto-level').checked=false;
 pointer('pointerdown',-4*HEX_METERS);pointer('pointermove',4*HEX_METERS);pointer('pointermove',0);pointer('pointerup',0);
 pointer('pointerdown',10*HEX_METERS);pointer('pointermove',11*HEX_METERS);pointer('pointerup',11*HEX_METERS);
 pointer('pointerdown',10*HEX_METERS);pointer('pointerup',10*HEX_METERS);
 f.ui.draw(f.scene,{x:-5*HEX_METERS,y:-HEX_METERS,width:10*HEX_METERS,height:2*HEX_METERS},10);
 assert.equal(writes.length,0);const preview=f.scene.children.find(n=>n.data.landHexDraft==='true');
 await f.ui.finish();assert.equal(writes.length,1);const patch=writes[0].record;assert.equal(patch.polygons.length,11,'Keep disjoint gestures and deduplicate retracing without connecting them');
 for(const q of [10,11])assert(contains({x:q*HEX_METERS,y:0},patch.polygons));
 assert.equal(patch.values.terrain,'forest');for(let q=-4;q<=4;q++)assert(contains({x:q*HEX_METERS,y:0},patch.polygons),'Missing intermediate hex '+q);
 assert(!contains({x:5*HEX_METERS,y:0},patch.polygons));
 assert(preview,'Show the actual hex footprint, not a thin pointer path');
 const relativePatch=patch.polygons.map(p=>({...p,outer:p.outer.map(v=>({x:v.x+5*HEX_METERS,y:v.y+HEX_METERS}))}));
 assert.deepEqual(preview.geometry.polygons,relativePatch,'Preview and saved geometry must be identical');
});


test('an oversized Hex draft fails visibly without saving or discarding its points',async t=>{
 const f=fixture(t);f.set([]);let writes=0;f.host.write=async()=>{writes++;return true;};f.ui.tool='hex';f.ui.points=[{x:0,y:0},{x:6000*HEX_METERS,y:0}];
 f.document.querySelector('#land-auto-level').checked=false;
 f.ui.draw(f.scene,{x:0,y:0,width:HEX_METERS,height:HEX_METERS},10);
 assert.match(f.document.querySelector('#land-status').textContent,/5.000 Hexes/);
 await assert.rejects(f.ui.finish(),/5.000 Hexes/);assert.equal(writes,0);assert(f.ui.hasDraft());
 f.ui.cancel();assert.equal(f.ui.hasDraft(),false);

});


test('a missing shared landscape frame never starts an independent read and has a local reload',async t=>{
 const f=fixture(t);f.set([]);let calls=0;f.window.campaign=new Proxy({},{get(){calls++;throw Error('No independent landscape reads');}});
 f.host.data().region.landscape=undefined;await f.ui.load();assert.equal(calls,0);assert.equal(f.document.querySelector('#land-reload').hidden,false);assert.match(f.document.querySelector('#land-status').textContent,/Frame|frame/);
 f.host.refresh=async()=>{f.set([]);await f.ui.load();};f.document.querySelector('#land-reload').click();await new Promise(r=>setImmediate(r));assert.equal(f.document.querySelector('#land-reload').hidden,true);assert.equal(f.errors.length,0);
});
test('a confirmed edit revokes pending frame images and waits for a matching map revision',async t=>{
 const f=fixture(t);f.set([ref('old')]);let release,calls=0;f.window.campaign={referenceAssetPreview:async()=>{calls++;await new Promise(r=>release=r);return{ok:false,error:'old image failed'};}};
 const before=f.ui.load();assert.equal(calls,1);f.ui.invalidate(1);release();await before;assert.deepEqual(f.errors,[]);assert.equal(f.ui.assets.size,0);
 await f.ui.load();assert.equal(calls,1,'old map revision must not restart image loading');
 f.set([ref('fresh')]);f.host.data().revision=1;f.host.data().region.fence='updated-source';f.window.campaign.referenceAssetPreview=async()=>{calls++;return{ok:true,value:'fresh-image'};};await f.ui.load();assert.equal(calls,2);assert.deepEqual(f.ui.records.map(r=>r.id),['fresh']);assert.equal(f.ui.assets.get('fresh'),'fresh-image');assert.deepEqual(f.errors,[]);
});
