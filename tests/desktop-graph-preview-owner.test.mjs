import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {buildSync,build} from 'esbuild';
import {attachAtlasAuthorRecovery} from './helpers/atlas-author-recovery.mjs';
import {parseHTML} from './helpers/dom.mjs';
const output=`.build/A0.17-${process.pid}`;
const names=['graph','drawing','key','path','volume','trigger','dungeon-content'];
buildSync({stdin:{contents:names.map((name,i)=>`export * as ui${i} from './src/app/${name}-ui';`).join('\n')+"\nexport * as author from './src/app/campaign-atlas-author';export {CampaignAtlasWorkbench} from './src/app/campaign-atlas-ui';",resolveDir:process.cwd(),loader:'ts'},outfile:output+'/ui.cjs',bundle:true,platform:'node',format:'cjs'});
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:output+'/store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
// Exercise the actual renderer module and its DOM handlers. Unrelated desk/GPU
// neighbors are idle; the room loading, draft, dispatcher and author bridge are real.
const rendererPath=path.resolve('src/app/renderer.ts'),rendererSource=readFileSync(rendererPath,'utf8');
const imports=new Map();
for(const m of rendererSource.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/g))imports.set(m[2],[...new Set([...(imports.get(m[2])??[]),...m[1].split(',').map(n=>n.trim()).filter(n=>!n.startsWith('type ')).map(n=>n.split(/\s+as\s+/)[0])])]);
const live=new Set(['./campaign-atlas-author','./editor-session','./contracts','./atlas-units','./atlas-render-view']);
await build({entryPoints:[rendererPath],outfile:output+'/renderer.cjs',bundle:true,platform:'node',format:'cjs',plugins:[{name:'renderer-owner-harness',setup(b){
 b.onLoad({filter:/[\/]renderer\.ts$/},()=>({contents:rendererSource+`\nexport const rendererHarness={async load(w){workspace=geometryOnly(w);await setDraft();},get workspace(){return workspace;},get draft(){return draft;},get failedEdit(){return failedEditState.value;},get draftStatus(){return editorSession.status;},get pendingAtlas(){return pendingAtlasWrite(workspace?.token??'');},recoverAtlas:()=>recoverAtlasCommit(workspace.token),atlasUpdated:(w,options)=>campaignAtlas.opts.updated(w,options),flush,history};`,loader:'ts'}));
 b.onResolve({filter:/^\.\//},a=>a.importer===rendererPath&&!live.has(a.path)?{path:a.path,namespace:'idle-renderer'}:undefined);
 b.onLoad({filter:/.*/,namespace:'idle-renderer'},a=>({contents:(imports.get(a.path)??[]).map(name=>name==='CampaignAtlasWorkbench'?`export function CampaignAtlasWorkbench(opts){return new Proxy({opts},{get:(o,k)=>k==='then'?undefined:k in o?o[k]:()=>undefined});}`:name==='workspaceTabs'?`export const workspaceTabs=[];`:name==='createWorkspaceEditors'?`export function createWorkspaceEditors(){return{before:async()=>true,flush:async()=>true,activate:async()=>{},deactivate(){},changed(){}};}`:name==='openCampaignScreen'?`export async function openCampaignScreen(){return true;}`:name==='flushDrawing'?`export async function flushDrawing(){return true;}`:`export function ${name}(){return new Proxy({view:{x:0,y:0,width:24,height:18}},{get:(o,k)=>k==='then'?undefined:k in o?o[k]:()=>undefined});}`).join('\n'),loader:'js'}));
}}]});
const require=createRequire(import.meta.url),{CampaignStore}=require('../'+output+'/store.cjs'),tick=()=>new Promise(r=>setImmediate(r));
async function until(check,label='expected UI state'){for(let i=0;i<120&&!check();i++)await tick();assert.ok(check(),label);}
const room=(id,x)=>({id,scopeId:'vault',floorId:'ground',name:id,number:id,revision:0,polygons:[{outer:[{x,y:0},{x:x+6.096,y:0},{x:x+6.096,y:4.572},{x,y:4.572}],holes:[]}],sections:[]});
const target=w=>w.graphPreview?{kind:'graph-preview',previewId:w.graphPreview.id,scopeId:w.graphPreview.scopeId,revision:w.graphPreview.revision}:undefined;
function fixture(t,{preview=true}={}){
 const dir=mkdtempSync(path.join(tmpdir(),'A0.17-owner-')),store=new CampaignStore(path.join(dir,'campaign.sqlite')),campaign=store.create('Owner',[room('a',0),room('b',12.192)]);let w=store.activate(campaign.id);
 if(preview){const result=store.executeGraph({commandId:randomUUID(),token:w.token,campaignId:campaign.id,scopeId:'vault',target:{kind:'graph-preview',previewId:randomUUID(),scopeId:'vault',revision:0},action:{kind:'connect',intent:{id:randomUUID(),fromRoomId:'a',toRoomId:'b',fromGroupId:null,toGroupId:null,form:'corridor',name:'Verbindung',problem:''}}});w={...result.workspace,selectedId:'a'};}
 const {document,window}=parseHTML(readFileSync('src/app/index.html','utf8')),previous={document:globalThis.document,window:globalThis.window,Event:globalThis.Event,CustomEvent:globalThis.CustomEvent,ResizeObserver:globalThis.ResizeObserver};Object.assign(globalThis,{document,window,Event:window.Event,CustomEvent:window.CustomEvent,ResizeObserver:class{observe(){} disconnect(){}}});
 for(const d of document.querySelectorAll('dialog')){d.open=false;d.showModal=()=>{d.open=true;};d.close=()=>{d.open=false;};}
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value??this.querySelector('option')?.value??'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.value===String(v));}});
 for(const c of document.querySelectorAll('input[type=checkbox]'))c.checked=false;
 window.HTMLElement.prototype.focus=function(){};window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.select=function(){};
 for(const c of document.querySelectorAll('canvas'))c.getContext=()=>new Proxy({},{get:()=>()=>{}});
 const file=require.resolve('../'+output+'/ui.cjs');delete require.cache[file];const bundle=require(file),uis=names.map((_,i)=>bundle['ui'+i]);
 const writes=[],messages=[],published=[],invalidations=[];let before=async()=>true,hold=null;const cleanup=[];
 const ok=fn=>{try{return{ok:true,value:fn()};}catch(e){return{ok:false,error:e.message};}};
 const write=async(method,c)=>{writes.push({method,command:structuredClone(c)});let result;try{result={ok:true,value:store[method](c)};}catch(e){result={ok:false,error:e.message};writeFileSync(output+'/rejected-'+c.action.kind+'.json',JSON.stringify({method,command:c,error:e.message,stack:e.stack},null,2));}if(hold)await hold(result);return result;};
 window.campaign={};for(const method of ['graph','drawing','drawingMap','drawingElement','dungeon','dungeonAuthoring','preparation','workspaceInitial','workspaceGeometry','atlasRoom','previewPath','reconcile'])window.campaign[method]=async(...args)=>ok(()=>store[method](...args));
 for(const method of ['executeGraph','atlasDrawingCommit','atlasRoomCommit','executeAtlas','executeAtlasCommit'])window.campaign[method]=c=>write(method,c);
 window.campaign.reconcileAtlasCommit=async c=>ok(()=>store.reconcileAtlasCommit(c));
 attachAtlasAuthorRecovery(window.campaign,store,dir);
 const el=id=>document.getElementById(id),current=()=>w,selected=()=>w.rooms.find(r=>r.id===w.selectedId),drain=()=>before(),publish=async next=>{published.push(next);w=next;},status=(...args)=>messages.push(args);
 document.addEventListener('atlas-invalidated',e=>invalidations.push(e.detail));
 t.after(()=>{for(const clean of cleanup)clean();uis[0].editorSession.deactivate();uis[1].editorSession.deactivate();uis[2].activateKeys();uis[3].activatePaths();uis[4].activateVolume();uis[5].activateTriggers();uis[6].activateDungeonContent();store.close();rmSync(dir,{recursive:true,force:true});Object.assign(globalThis,previous);});
 return{store,campaign,bundle,uis,el,window,cleanup,writes,messages,published,invalidations,current,selected,drain,publish,status,setBefore:fn=>before=fn,setHold:fn=>hold=fn,switchPreview(){w={...w,graphPreview:{...w.graphPreview,id:randomUUID(),revision:1}};},setWorkspace:next=>w=next,enter(id,value){el(id).value=value;el(id).dispatchEvent(new window.Event('input',{bubbles:true}));}};
}
async function graphUI(x){const ui=x.uis[0];ui.initGraph(x.status,x.current,x.selected,x.drain,x.publish,()=>{},async()=>{});ui.activateGraph();x.el('graph-open').click();await until(()=>x.el('graph-dialog').open,JSON.stringify(x.messages));return ui;}
async function authorUI(x,family){const args=[x.status,x.current,x.selected,x.drain,x.publish],el=x.el;let dispatch;
 if(family==='drawing'){const ui=x.uis[1];ui.initDrawing(...args,()=>{});await ui.activateDrawing(x.current());el('drawing-dx').value='1.524';dispatch=()=>el('drawing-transform').click();}
 if(family==='key'){const ui=x.uis[2];ui.initKeys(...args,async()=>{});ui.activateKeys();el('key-open').click();await until(()=>el('key-dialog').open,JSON.stringify(x.messages));dispatch=()=>{x.enter('key-name','Preview key');void ui.flushKeys();};}
 if(family==='volume'){const ui=x.uis[4];ui.initVolume(...args);el('volume-open').click();await until(()=>el('volume-status').textContent!=='Volumen wird geladen …',JSON.stringify(x.messages));await tick();dispatch=()=>el('volume-initialize').click();}
 if(family==='path'){const ui=x.uis[3];ui.initPaths(...args);el('path-open').click();await until(()=>el('path-from').options.length>0,JSON.stringify(x.messages));await tick();el('path-from-x').value='0';el('path-from-y').value='0';el('path-from-z').value='0';el('path-from-face').value='west';dispatch=()=>el('passage-create').click();}
 if(family==='content'||family==='trigger'){
  const ui=x.uis[6];ui.initDungeonContent(...args,async()=>{});el('dungeon-content-open').click();await until(()=>el('content-dialog').open,JSON.stringify(x.messages));
  if(family==='content'){dispatch=()=>el('content-save').click();}
  else{el('content-kind').value='trap';el('content-save').click();await until(()=>x.published.length===1,JSON.stringify(x.messages));await tick();x.writes.length=0;x.published.length=0;
   const triggers=x.uis[5];triggers.initTriggers(...args);el('trigger-fields-open').click();await until(()=>el('trigger-dialog').open,JSON.stringify(x.messages));dispatch=()=>el('trigger-save').click();}
 }
 return dispatch;
}
for(const family of ['drawing','key','path','volume','content','trigger']){
 test(`${family} dispatch carries its real workspace preview and publishes the returned local revision`,async t=>{
  const x=fixture(t),dispatch=await authorUI(x,family),source=target(x.current()),canonical=x.store.atlasRegionSource(x.current().token).revision;
  dispatch();await until(()=>x.writes.length===1,JSON.stringify(x.messages));await until(()=>x.published.length===1,JSON.stringify(x.messages));
  assert.deepEqual(x.writes[0].command.target,source);assert.equal(x.current().graphPreview.id,source.previewId);assert.equal(x.current().graphPreview.revision,source.revision+1);assert.equal(x.invalidations.at(-1).revision,canonical);assert.equal(x.invalidations.at(-1).preview.revision,source.revision+1);
 });
 for(const boundary of ['before','response'])test(`${family} does not dispatch or adopt across a preview switch during ${boundary}`,async t=>{
  const x=fixture(t),dispatch=await authorUI(x,family);let release,entered=false;const gate=new Promise(r=>release=r);
  if(boundary==='before')x.setBefore(async()=>{entered=true;await gate;return true;});else x.setHold(async()=>{entered=true;await gate;});
  dispatch();await until(()=>entered,JSON.stringify(x.messages));const source=structuredClone(x.current());x.switchPreview();const replacement=x.current();release();for(let i=0;i<8;i++)await tick();
  assert.equal(x.writes.length,boundary==='before'?0:1);assert.equal(x.published.length,0);assert.equal(x.current(),replacement);if(x.writes.length)assert.deepEqual(x.writes[0].command.target,target(source));
 });
}
test('first Graph mutation owns its ID before dispatch and later Graph actions use the returned local revision',async t=>{
 const x=fixture(t,{preview:false}),ui=await graphUI(x);x.el('graph-from').value='a';x.el('graph-to').value='b';x.el('graph-connect').click();assert.equal(await ui.flushGraph(),true,JSON.stringify(x.messages));
 const first=x.writes[0].command;assert.equal(first.target.revision,0);assert.equal(first.target.previewId,x.current().graphPreview.id);assert.equal(x.current().graphPreview.revision,1);
 x.el('graph-reroute').click();assert.equal(await ui.flushGraph(),true);assert.deepEqual(x.writes[1].command.target,{...first.target,revision:1});assert.equal(x.current().graphPreview.revision,2);
});
function invalidFirstGraphCreate(x){
 x.el('graph-width').value='0';x.el('graph-depth').value='4';x.el('graph-height').value='2';x.el('graph-room-name').value='Invalid then corrected';x.el('graph-create').click();
}
test('definitively rejected first Graph action rebinds only its persistent owner before an explicit correction',async t=>{
 const x=fixture(t,{preview:false}),ui=await graphUI(x),canonical=()=>x.store.db.prepare('SELECT * FROM room ORDER BY id').all(),rooms=structuredClone(x.current().rooms),before=canonical(),revision=x.store.atlasRegionSource(x.current().token).revision;
 invalidFirstGraphCreate(x);assert.equal(await ui.flushGraph(),false);
 const first=x.writes[0].command;
 assert.equal(x.writes.length,1);assert.equal(x.messages.at(-1)[0],'Raumname, Rasterposition und Raumgröße prüfen.');assert.equal(x.messages.at(-1)[1],true);
 assert.deepEqual(target(x.current()),first.target);assert.equal(x.el('graph-preview-banner').hidden,false);assert.equal(x.el('graph-accept').disabled,true);
 assert.equal(x.current().graphPreview.protected,true);assert.equal(x.current().graphPreview.revision,0);
 const rejected=x.store.reconcileAtlasCommit({commandId:first.commandId,token:first.token,campaignId:first.campaignId,target:first.target,action:{kind:'graph-preview',command:first}});
 assert.equal(rejected.outcome,'not-applied');
 assert.deepEqual(canonical(),before);assert.equal(x.store.atlasRegionSource(first.token).revision,revision);
 assert.deepEqual(x.current().rooms.map(r=>r.id),rooms.map(r=>r.id));
 x.el('graph-width').value='4';x.el('graph-create').click();assert.equal(await ui.flushGraph(),true,JSON.stringify(x.messages));
 assert.equal(x.writes.length,2);assert.notEqual(x.writes[1].command.commandId,first.commandId);assert.deepEqual(x.writes[1].command.target,first.target);
 assert.equal(x.current().graphPreview.id,first.target.previewId);assert.equal(x.current().graphPreview.revision,1);
 assert.equal(x.current().rooms.length,rooms.length+1);assert.deepEqual(canonical(),before);assert.equal(x.store.atlasRegionSource(first.token).revision,revision);
});
for(const reader of ['workspaceGeometry','graph']){
 for(const mismatch of ['id','scope','revision','read-error'])test(`first Graph rejection does not rebind ${reader} with ${mismatch}`,async t=>{
  const x=fixture(t,{preview:false}),ui=await graphUI(x),read=x.window.campaign[reader];
  x.window.campaign[reader]=async(...args)=>{
   if(mismatch==='read-error')throw Error('reader unavailable');
   const result=structuredClone(await read(...args)),state=reader==='graph'?result.value.preview:result.value.graphPreview;
   if(mismatch==='id')state.id=randomUUID();else if(mismatch==='scope')state.scopeId='other-scope';else state.revision++;
   return result;
  };
  invalidFirstGraphCreate(x);assert.equal(await ui.flushGraph(),false);
  assert.equal(x.writes.length,1);assert.equal(x.published.length,0);assert.equal(x.current().graphPreview,undefined);
  assert.equal(x.el('graph-preview-banner').hidden,true);assert.equal(x.messages.at(-1)[0],'Raumname, Rasterposition und Raumgröße prüfen.');
 });
 for(const change of ['preview','workspace'])test(`first Graph rejection discards ${reader} after a ${change} switch`,async t=>{
  const x=fixture(t,{preview:false}),ui=await graphUI(x),read=x.window.campaign[reader];let release,entered=false;
  const gate=new Promise(r=>release=r);x.window.campaign[reader]=async(...args)=>{const result=await read(...args);entered=true;await gate;return result;};
  invalidFirstGraphCreate(x);await until(()=>entered);
  if(change==='preview')x.switchPreview();else{x.setWorkspace({...x.current(),token:randomUUID()});ui.activateGraph();}
  const replacement=x.current();release();for(let i=0;i<8;i++)await tick();
  assert.equal(x.writes.length,1);assert.equal(x.published.length,0);assert.equal(x.current(),replacement);assert.equal(x.messages.length,0);
 });
}
for(const boundary of ['before','response'])test(`Graph first mutation stays bound across ${boundary} preview switches`,async t=>{
 const x=fixture(t,{preview:false}),ui=await graphUI(x);let release,entered=false;const gate=new Promise(r=>release=r);
 if(boundary==='before')x.setBefore(async()=>{entered=true;await gate;return true;});else x.setHold(async()=>{entered=true;await gate;});
 x.el('graph-from').value='a';x.el('graph-to').value='b';x.el('graph-connect').click();await until(()=>entered);x.switchPreview();release();assert.equal(await ui.flushGraph(),false);assert.equal(x.writes.length,boundary==='before'?0:1);assert.equal(x.published.length,0);
});
test('structured unknown first Graph result never enters definitive rejection readback',async t=>{
 const x=fixture(t,{preview:false}),ui=await graphUI(x);let reads=0;
 for(const reader of ['workspaceGeometry','graph']){const read=x.window.campaign[reader];x.window.campaign[reader]=async(...args)=>{reads++;return read(...args);};}
 x.setHold(async result=>{result.ok=false;delete result.value;result.error='Speicherbestätigung ungeklärt';result.errorKind='store-outcome-unknown';});
 invalidFirstGraphCreate(x);assert.equal(await ui.flushGraph(),false);
 assert.equal(reads,0);assert.equal(x.published.length,0);assert.equal(x.writes.length,1);
 assert.equal(x.current().graphPreview,undefined);assert.equal(x.messages.at(-1)[0],'Speicherbestätigung ungeklärt');
});
test('lost first Graph reply retains exact command and preassigned preview ID for read-only receipt resolution',async t=>{
 const x=fixture(t,{preview:false}),ui=await graphUI(x);let readbacks=0;for(const reader of ['workspaceGeometry','graph']){const read=x.window.campaign[reader];x.window.campaign[reader]=async(...args)=>{readbacks++;return read(...args);};}x.setHold(async()=>{throw Error('reply lost after commit');});x.el('graph-from').value='a';x.el('graph-to').value='b';x.el('graph-connect').click();assert.equal(await ui.flushGraph(),false);
 assert.equal(readbacks,0);const sent=x.writes[0].command,pending=x.bundle.author.pendingAtlasWrite(sent.token);assert.equal(sent.target.revision,0);assert.deepEqual(pending.action.command,sent);assert.deepEqual(pending.target,sent.target);assert.equal(pending.action.kind,'graph-preview');assert.equal(x.current().graphPreview,undefined);
 const resolved=await x.bundle.author.recoverAtlasCommit(sent.token);assert.equal(resolved.ok,true);assert.equal(resolved.value.outcome,'applied');assert.equal(x.writes.length,1);
});
test('Graph select without a preview stays navigation; restore and recreation use distinct preview IDs',async t=>{
 const x=fixture(t,{preview:false}),ui=await graphUI(x),initial=x.current();
 const svg=x.el('graph-map');svg.createSVGPoint=()=>({});svg.getScreenCTM=()=>null;svg.setPointerCapture=()=>{};
 const down=new x.window.Event('pointerdown');Object.assign(down,{clientX:0,clientY:0,pointerId:1,shiftKey:false});svg.querySelector('[data-node="b"]').dispatchEvent(down);svg.onpointerup(down);assert.equal(await ui.flushGraph(),true);
 assert.equal(x.writes[0].command.action.kind,'select');assert.equal(x.writes[0].command.target,undefined);assert.equal(x.current().graphPreview,undefined);assert.equal(x.store.workspace().graphPreview,undefined);
 x.el('graph-from').value='a';x.el('graph-to').value='b';x.el('graph-connect').click();await ui.flushGraph();const first=x.current().graphPreview.id;
 x.el('graph-restore').click();assert.equal(await ui.flushGraph(),true,JSON.stringify(x.messages));assert.equal(x.current().graphPreview,undefined);
 x.el('graph-open').click();await until(()=>x.el('graph-dialog').open);x.el('graph-from').value='a';x.el('graph-to').value='b';x.el('graph-connect').click();assert.equal(await ui.flushGraph(),true);assert.notEqual(x.current().graphPreview.id,first);
});
test('Graph accept rejection preserves its target, banner and local workspace',async t=>{
 const x=fixture(t),ui=await graphUI(x),source=x.current();x.el('graph-accept').onclick();assert.equal(await ui.flushGraph(),false);assert.equal(x.current(),source);assert.equal(x.el('graph-preview-banner').hidden,false);const c=x.writes[0].command;assert.deepEqual(c.target,target(source));assert.deepEqual(c.action.command.target,c.target);assert.match(x.messages.at(-1)[0],/Rastervorschau/);
});
function atlasWriter(x){
 // Keep the production writer/history methods; replace only rendering/viewport hosts.
 const ui=Object.create(x.bundle.CampaignAtlasWorkbench.prototype),owner=x.current();
 const status=document.createElement('p');status.id='atlas-save-status';document.body.append(status);
 Object.assign(ui,{owner,writing:false,cityId:null,root:{hidden:false},journey:{busy:false,invalidatePreview(){}},author:{selection:null},landscape:{livePainting:false,routeHistory:()=>false},opts:{status:x.status,updated:x.publish,flush:x.drain},render(){},error(e){x.status(e.message,true);}});
 ui.regions={data:x.store.atlasRenderView(owner.token),acceptCommit(ack){this.data.revision=ack.revision;this.data.canUndo=ack.canUndo;this.data.canRedo=ack.canRedo;},async refresh(){this.data=x.store.atlasRenderView(owner.token);return true;}};
 return ui;
}
test('Atlas writer binds nested room edits, keeps canonical ack revision and drives grouped preview Undo/Redo',async t=>{
 const x=fixture(t),ui=atlasWriter(x),w=x.current(),r=x.store.atlasRoom(w.token,'a'),source=target(w),canonical=ui.regions.data.revision;
 const edit={commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,roomId:r.id,expectedRevision:r.revision,name:'Local room',polygons:r.polygons,sections:r.sections};
 const result=await ui.write({kind:'room-edit',edit},true);assert.ok(result,JSON.stringify(x.messages));assert.deepEqual(x.writes[0].command.target,source);assert.deepEqual(x.writes[0].command.action.edit.target,source);assert.equal(result.ack.revision,canonical);assert.equal(x.current().graphPreview.revision,source.revision+1);assert.equal(ui.regions.data.revision,canonical);
 await ui.history('undo');assert.deepEqual(x.writes.at(-1).command.target,{...source,revision:source.revision+1});assert.equal(x.store.atlasRoom(w.token,'a').name,r.name);
 await ui.history('redo');assert.equal(x.store.atlasRoom(w.token,'a').name,'Local room');assert.equal(x.current().graphPreview.revision,source.revision+3);
 // The original connected Graph operation, including its room volumes and path,
 // remains a single earlier preview history step.
 await ui.history('undo');await ui.history('undo');assert.equal(x.store.drawing(w.token).paths.length,0);assert.equal(x.store.drawing(w.token).volumes.length,0);
 await ui.history('redo');assert.equal(x.store.drawing(w.token).paths.length,1);assert.equal(x.store.drawing(w.token).volumes.length,3);
 assert.equal(x.store.db.prepare('SELECT count(*) n FROM dungeon_volume').get().n,0);
});
test('Atlas history cannot retarget after prerequisite flushing changes the preview',async t=>{
 const x=fixture(t),ui=atlasWriter(x);let release,entered=false;const gate=new Promise(r=>release=r);x.setBefore(async()=>{entered=true;await gate;return true;});const job=ui.history('undo');await until(()=>entered);ui.regions.data.workspace={...ui.regions.data.workspace,graphPreview:{...ui.regions.data.workspace.graphPreview,id:randomUUID()}};release();await job;assert.equal(x.writes.length,0);
});
test('Atlas refuses a late response for a replaced preview while preserving the source command',async t=>{
 const x=fixture(t),ui=atlasWriter(x),source=target(x.current());let release,entered=false;const gate=new Promise(r=>release=r);x.setHold(async()=>{entered=true;await gate;});const job=ui.write({kind:'room-default'},true);await until(()=>entered);ui.regions.data.workspace={...ui.regions.data.workspace,graphPreview:{...ui.regions.data.workspace.graphPreview,id:randomUUID()}};release();assert.equal(await job,null);assert.deepEqual(x.writes[0].command.target,source);assert.equal(x.published.length,0);
});
for(const family of ['drawing','key','path','volume','content','trigger'])test(`${family} refuses stale displayed input after the preview was replaced before the click`,async t=>{
 const x=fixture(t),dispatch=await authorUI(x,family);x.switchPreview();dispatch();for(let i=0;i<8;i++)await tick();assert.equal(x.writes.length,0);assert.equal(x.published.length,0);
});
async function rendererUI(x){
 const file=require.resolve('../'+output+'/renderer.cjs');delete require.cache[file];
 for(const id of ['narrative-journal-open','catalog-day-plan'])if(!x.el(id)){const node=document.createElement('button');node.id=id;document.body.append(node);}
 x.window.campaign.onClose=()=>{};x.window.campaign.roomDraft=async()=>({ok:true,value:null});x.window.campaign.keepRoomDraft=async()=>({ok:true,value:undefined});
 x.window.localStorage={getItem:()=>null,setItem(){}};
 const interval=globalThis.setInterval;globalThis.setInterval=()=>0;let ui;try{ui=require(file).rendererHarness;}finally{globalThis.setInterval=interval;}
 await ui.load(x.current());x.cleanup.push(()=>require(file).editorSession.deactivate());return ui;
}
test('real renderer room form dispatches its preview and adopts RoomCommit local revision',async t=>{
 const x=fixture(t),ui=await rendererUI(x),source=target(ui.workspace),r=x.store.atlasRoom(ui.workspace.token,'a');
 x.enter('room-name','Renderer preview');x.el('apply').click();await until(()=>x.writes.length===1);await until(()=>ui.workspace.graphPreview?.revision===source.revision+1,x.el('status').textContent);
 assert.equal(x.writes[0].method,'atlasRoomCommit');assert.deepEqual(x.writes[0].command.target,source);assert.equal(x.store.atlasRoom(ui.workspace.token,'a').name,'Renderer preview');assert.equal(x.store.db.prepare('SELECT payload FROM room WHERE id=?').get('a').payload.includes('Renderer preview'),false);
 assert.equal(await ui.flush(),true);assert.notEqual(x.store.atlasRoom(ui.workspace.token,'a').revision,r.revision);
});
for(const kind of ['add','undo','redo'])test(`real renderer ${kind} uses the captured preview target`,async t=>{
 const x=fixture(t);
 if(kind==='redo')x.setWorkspace((await x.bundle.author.atlasHistoryWrite(x.current().token,x.current().campaign.id,'undo',target(x.current()))).value);
 const ui=await rendererUI(x),source=target(ui.workspace);x.writes.length=0;x.el(kind==='add'?'add-room':kind).click();await until(()=>x.writes.length===1);await until(()=>ui.workspace.graphPreview?.revision===source.revision+1,x.el('status').textContent);
 assert.deepEqual(x.writes[0].command.target,source);assert.equal(x.writes[0].command.action.kind,kind==='add'?'room-default':kind);
});
test('real renderer late room receipt cannot replace a newly loaded preview',async t=>{
 const x=fixture(t),ui=await rendererUI(x),source=target(ui.workspace);let release,entered=false;const gate=new Promise(r=>release=r);x.setHold(async()=>{entered=true;await gate;});
 x.enter('room-name','Old source draft');x.el('apply').click();await until(()=>entered);x.switchPreview();await ui.load(x.current());const replacement=ui.workspace;release();for(let i=0;i<8;i++)await tick();assert.equal(ui.workspace,replacement);assert.deepEqual(x.writes[0].command.target,source);
});
for(const family of ['drawing','key','path','volume','content','trigger'])test(`${family} rejects a response with a foreign preview ID`,async t=>{
 const x=fixture(t),dispatch=await authorUI(x,family),source=x.current();x.setHold(async result=>{if(result.ok)result.value.workspace.graphPreview.id=randomUUID();});dispatch();await until(()=>x.writes.length===1);for(let i=0;i<8;i++)await tick();assert.equal(x.published.length,0);assert.equal(x.current(),source);
});
test('Graph raster and explicit accept clear the protected preview only after the matching response',async t=>{
 const x=fixture(t),ui=await graphUI(x);x.el('graph-raster').click();assert.equal(await ui.flushGraph(),true);assert.equal(x.current().graphPreview.phase,'raster');const source=target(x.current());x.el('graph-accept').click();assert.equal(await ui.flushGraph(),true,JSON.stringify(x.messages));assert.equal(x.current().graphPreview,undefined);assert.equal(x.el('graph-preview-banner').hidden,true);assert.deepEqual(x.writes.at(-1).command.target,source);assert.equal(x.store.db.prepare('SELECT count(*) n FROM dungeon_path').get().n,1);
});
for(const family of ['room','drawing'])test(`${family} lost reply retains both explicit target copies and resolves without replay`,async t=>{
 const x=fixture(t),w=x.current(),r=x.store.atlasRoom(w.token,'a'),source=target(w),c={commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,target:source};
 if(family==='room')Object.assign(c,{roomId:r.id,expectedRevision:r.revision,name:'Pending room',polygons:r.polygons,sections:r.sections});else c.action={kind:'room-hide',roomId:r.id,hidden:true};
 x.setHold(async()=>{throw Error('response lost');});const result=await(family==='room'?x.bundle.author.atlasRoomWrite(c):x.bundle.author.atlasDrawingWrite(c));assert.equal(result.ok,false);
 const pending=x.bundle.author.pendingAtlasWrite(w.token),snapshot=structuredClone(c);assert.deepEqual(pending.target,source);assert.deepEqual(family==='room'?pending.action.edit:pending.action.command,snapshot);
 c.target.revision=999;assert.equal(pending.target.revision,snapshot.target.revision);const result2=await x.bundle.author.recoverAtlasCommit(w.token);assert.equal(result2.ok,true);assert.equal(result2.value.outcome,'applied');assert.equal(x.store.workspace().graphPreview.id,snapshot.target.previewId);assert.equal(x.store.workspace().graphPreview.revision,snapshot.target.revision+1);assert.equal(x.writes.length,1);
});
test('Graph lifecycle banner uses current workspace revision after another preview author edits',async t=>{
 const x=fixture(t),ui=await graphUI(x),w=x.current(),r=x.store.atlasRoom(w.token,'a');
 const result=await x.bundle.author.atlasRoomWrite({commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,target:target(w),roomId:r.id,expectedRevision:r.revision,name:'Outside graph panel',polygons:r.polygons,sections:r.sections});assert.equal(result.ok,true);x.setWorkspace(x.store.workspace());const expected=target(x.current());
 x.el('graph-restore').click();assert.equal(await ui.flushGraph(),true,JSON.stringify(x.messages));assert.deepEqual(x.writes.at(-1).command.target,expected);assert.equal(x.current().graphPreview,undefined);
});
test('canonical renderer history remains canonical without an active preview',async t=>{
 const x=fixture(t,{preview:false});x.setWorkspace(x.store.addRoom(x.current().token));const ui=await rendererUI(x),count=ui.workspace.rooms.length;x.el('undo').click();await until(()=>x.writes.length===1);await until(()=>ui.workspace.rooms.length===count-1);assert.equal(x.writes[0].command.target,undefined);assert.equal(ui.workspace.graphPreview,undefined);
 x.el('redo').click();await until(()=>x.writes.length===2);await until(()=>ui.workspace.rooms.length===count);assert.equal(x.writes[1].command.target,undefined);
});
test('Atlas nested drawing preserves its explicit source and rejects an already foreign target instead of rebinding it',async t=>{
 const x=fixture(t),ui=atlasWriter(x),w=x.current(),source=target(w),command={commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,target:{...source,previewId:randomUUID()},action:{kind:'room-hide',roomId:'a',hidden:true}};
 assert.equal(await ui.write({kind:'drawing',command},true),null);assert.equal(x.writes.length,0);assert.match(x.messages.at(-1)[0],/andere.*Vorschauquelle/);
 command.target=source;const result=await ui.write({kind:'drawing',command},true);assert.ok(result,JSON.stringify(x.messages));assert.deepEqual(x.writes[0].command.target,source);assert.deepEqual(x.writes[0].command.action.command.target,source);assert.equal(x.current().graphPreview.revision,source.revision+1);
});
test('Key next-room control uses the preview target and publishes its local revision',async t=>{
 const x=fixture(t);await authorUI(x,'key');const source=target(x.current());x.el('key-add-room').click();await until(()=>x.writes.length===1);await until(()=>x.published.length===1);assert.equal(x.writes[0].command.action.kind,'room-default');assert.deepEqual(x.writes[0].command.target,source);assert.equal(x.current().graphPreview.revision,source.revision+1);
});
test('Drawing refresh preserves the source of an unfinished stroke across a preview replacement',async t=>{
 const x=fixture(t);await authorUI(x,'drawing');const ui=x.uis[1];x.el('drawing-tool').value='room-polygon';await ui.atlasDrawingPoint({x:0,y:0});await ui.atlasDrawingPoint({x:5,y:0});await ui.atlasDrawingPoint({x:5,y:5});const draft=ui.atlasDrawingDraft();x.switchPreview();await ui.reloadDrawing();x.el('drawing-finish').click();for(let i=0;i<8;i++)await tick();assert.equal(x.writes.length,0);assert.deepEqual(ui.atlasDrawingDraft().path,draft.path);
});

test('applied recovery keeps projection failure separate and retries only reads while inputs remain blocked',async t=>{
 const x=fixture(t,{preview:false}),ui=atlasWriter(x);let cancelled=0,recovered=0,initialReads=0;
 ui.author.completeRectangleRecovery=()=>{};ui.journey.playback={stop(){},async settled(){}};ui.author.draft=[{x:1,y:2},{x:3,y:4}];ui.cancel=()=>{cancelled++;ui.author.draft=[];};ui.landscape.recovered=discard=>{assert.equal(discard,false);recovered++;};
 x.setHold(async()=>{throw Error('response lost');});assert.equal(await ui.write({kind:'room-default'},true),null);assert.equal(x.writes.length,1);
 const read=x.window.campaign.workspaceInitial;x.window.campaign.workspaceInitial=async(...args)=>{initialReads++;return initialReads===1?{ok:false,error:'view failed'}:read(...args);};
 await ui.recoverWrite();assert.equal(x.bundle.author.pendingAtlasWrite(x.current().token),null);assert.equal(cancelled,0);assert.equal(recovered,0);assert.equal(ui.author.draft.length,2);assert.equal(await ui.flush(),false);assert.equal(await ui.write({kind:'room-default'},true),null);assert.equal(x.writes.length,1);
 await ui.recoverWrite();assert.equal(initialReads,2);assert.equal(cancelled,0);assert.equal(ui.author.draft.length,2);assert.equal(recovered,1);assert.equal(x.writes.length,1);assert.equal(ui.recoveryProjection,null);
});

test('Graph selection inside an existing preview bypasses receipt persistence and preserves the owner lock',async t=>{
 const x=fixture(t),w=x.current();let keeps=0;const keep=x.window.campaign.keepAtlasWriteReference;x.window.campaign.keepAtlasWriteReference=async(...args)=>{keeps++;return keep(...args);};
 const c={commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,scopeId:'vault',target:target(w),action:{kind:'select',roomId:'a'}};
 assert.equal((await x.bundle.author.atlasGraphWrite(c)).ok,true);assert.equal(keeps,0);assert.equal(x.bundle.author.pendingAtlasWrite(w.token),null);
 x.setHold(async()=>{throw Error('lost');});assert.equal((await x.bundle.author.atlasGraphWrite({...c,commandId:randomUUID(),action:{kind:'raster'}})).ok,false);const pending=x.bundle.author.pendingAtlasWrite(w.token);
 assert.equal((await x.bundle.author.atlasGraphWrite(c)).ok,false);assert.equal(x.bundle.author.pendingAtlasWrite(w.token),pending);assert.equal(keeps,1);
});

async function lostRendererRoom(t){
 const x=fixture(t,{preview:false}),ui=await rendererUI(x);x.setHold(async()=>{throw Error('reply lost after room commit');});x.enter('room-name','Confirmed first name');x.el('apply').click();await until(()=>!!ui.failedEdit,x.el('status').textContent);return{x,ui};
}
test('actual Atlas recovery callback preserves later Room inputs and failedEdit, then Room reconcile releases only its matching draft',async t=>{
 const {x,ui}=await lostRendererRoom(t),failed=ui.failedEdit;assert.ok(ui.pendingAtlas);x.enter('room-name','Later unsaved name');x.enter('points','  invalid raw contour\nsecond line  ');const raw=x.el('points').value,before=x.store.db.serialize();
 assert.equal((await ui.recoverAtlas()).value.outcome,'applied');assert.equal(ui.pendingAtlas,null);await ui.atlasUpdated(x.store.workspace(),{preserveDraft:true});
 assert.equal(ui.failedEdit,failed);assert.equal(x.el('room-name').value,'Later unsaved name');assert.equal(x.el('points').value,raw);assert.equal(x.writes.length,1);
 x.el('reconcile').click();await until(()=>!ui.failedEdit,x.el('status').textContent);assert.equal(x.el('room-name').value,'Later unsaved name');assert.equal(x.el('points').value,raw);assert.equal(x.writes.length,1);assert.deepEqual(x.store.db.serialize(),before);assert.equal(x.store.atlasRoom(ui.workspace.token,'a').name,'Confirmed first name');
});
test('Room reconcile retains confirmed status across view failure and never repeats the writer',async t=>{
 const {x,ui}=await lostRendererRoom(t);x.enter('room-name','Later room text');const read=x.window.campaign.reconcile;let reads=0;x.window.campaign.reconcile=async(...args)=>++reads===1?{ok:false,error:'Room projection failed'}:read(...args);
 x.el('reconcile').click();await until(()=>x.el('status').textContent.includes('Status bleibt ungeklärt'));assert.ok(ui.failedEdit);assert.equal(ui.pendingAtlas,null);assert.equal(x.el('room-name').value,'Later room text');
 x.el('reconcile').click();await until(()=>!ui.failedEdit);assert.equal(reads,2);assert.equal(x.writes.length,1);assert.equal(x.el('room-name').value,'Later room text');
});
test('explicit Room discard clears only the addressed settled draft; later typing during read cancels that discard',async t=>{
 const {x,ui}=await lostRendererRoom(t),read=x.window.campaign.reconcile;let release,entered=false;const gate=new Promise(r=>release=r);x.window.campaign.reconcile=async(...args)=>{entered=true;await gate;return read(...args);};
 x.el('discard').click();await until(()=>entered);x.enter('room-name','Typed after discard started');release();for(let i=0;i<12;i++)await tick();assert.ok(ui.failedEdit);assert.equal(x.el('room-name').value,'Typed after discard started');assert.equal(x.writes.length,1);
 x.window.campaign.reconcile=read;x.el('discard').click();await until(()=>!ui.failedEdit);await until(()=>x.el('room-name').value==='Confirmed first name');assert.equal(x.writes.length,1);assert.equal(ui.pendingAtlas,null);
});
test('Room reconcile keeps conflict protection after its receipt is resolved',async t=>{
 const {x,ui}=await lostRendererRoom(t),r=x.store.atlasRoom(ui.workspace.token,'a');x.enter('room-name','Unpublished conflict text');x.store.atlasRoomCommit({commandId:randomUUID(),token:ui.workspace.token,campaignId:x.campaign.id,roomId:r.id,expectedRevision:r.revision,name:'Another author',polygons:r.polygons,sections:r.sections});
 x.el('status').textContent='';x.el('reconcile').click();await until(()=>x.el('status').textContent.includes('Entwurf bleibt offen'));assert.ok(ui.failedEdit);assert.equal(x.el('room-name').value,'Unpublished conflict text');assert.equal(ui.pendingAtlas,null);assert.equal(x.writes.length,1);
});

test('Workbench activation assigns the new owner before journey activation and reserves writes until references finish loading',async t=>{
 const x=fixture(t,{preview:false}),ui=Object.create(x.bundle.CampaignAtlasWorkbench.prototype),w=x.current();let release,entered=false;const gate=new Promise(r=>release=r),read=x.window.campaign.atlasWriteReferences;
 x.window.campaign.atlasWriteReferences=async(...args)=>{entered=true;await gate;return read(...args);};
 Object.assign(ui,{regions:{resetContext(){}},hitVersion:0,hitDialog:{close(){}},root:{dataset:{}},canvas:{setAttribute(){}},author:{resetContext(){}},output:{reset(){}},reference:{close(){}},landscape:{context(){}},drawing:{},camera:{context(){},set(){}},scheduleRender(){},error:e=>x.messages.push([e.message,true]),journey:{activate(){assert.equal(ui.owner,w);}}});
 const search=document.createElement('div');search.id='atlas-search-results';document.body.append(search);
 const activation=ui.activate(w);await until(()=>entered);assert.ok(x.bundle.author.pendingAtlasWrite(w.token));assert.equal((await x.bundle.author.writeAtlasCommit({commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,action:{kind:'room-default'}})).ok,false);assert.equal(x.writes.length,0);
 release();await activation;assert.equal(x.bundle.author.pendingAtlasWrite(w.token),null);assert.equal(x.messages.length,0);
});

for(const laterInput of [false,true])test(`rectangle Unknown → applied recovery ${laterInput?'retains later room-name input':'completes its unchanged corners and permits the next room'}`,async t=>{
 const x=fixture(t,{preview:false}),ui=atlasWriter(x),drawing=x.uis[1],w=x.current();drawing.initDrawing(x.status,x.current,x.selected,x.drain,x.publish,()=>{});await drawing.activateDrawing(w);
 for(const id of ['atlas-room-draw','atlas-draft-cancel']){const button=document.createElement('button');button.id=id;document.body.append(button);}
 ui.author=ui.createAtlasAuthor();ui.scopeId='vault';ui.floorId='ground';ui.family='interior';ui.output={exportOpen:false};ui.root=document.createElement('section');ui.root.dataset.roomDraw='true';ui.canvas=document.createElement('canvas');ui.camera={ready:true,hitAt:()=>null,stopZoom(){}};ui.frame=()=>({x:0,y:0,angle:0});ui.point=e=>({x:e.clientX,y:e.clientY});ui.regions.geometryCurrent=()=>true;ui.journey.playback={stop(){},async settled(){}};ui.landscape.recovered=discard=>assert.equal(discard,false);
 ui.cancel=()=>{ui.author.cancelGesture();ui.root.dataset.roomDraw='false';};ui.opts.selectRoom=async id=>{x.store.select(w.token,id);await x.publish(x.store.workspace());};x.el('atlas-room-draw').onclick=()=>{ui.root.dataset.roomDraw='true';};x.el('drawing-tool').value='room-rectangle';x.el('drawing-room-name').value='First saved rectangle';x.el('drawing-append').checked=false;
 ui.author.draft=[{x:30,y:0},{x:36,y:6}];x.setHold(async()=>{throw Error('lost rectangle response');});await assert.rejects(()=>ui.author.createRoomRectangle(),/ungeklärt/);assert.equal(ui.author.draft.length,2);assert.equal(x.writes.length,1);const firstId=x.store.workspace().selectedId;assert.equal(x.store.atlasRoom(w.token,firstId).name,'First saved rectangle');
 if(laterInput)x.el('drawing-room-name').value='Later unpublished rectangle name';
 x.setHold(null);await ui.recoverWrite();if(laterInput){assert.equal(ui.author.draft.length,2);assert.equal(x.el('drawing-room-name').value,'Later unpublished rectangle name');assert.equal(x.writes.length,1);return;}assert.equal(ui.author.draft.length,0);assert.equal(ui.root.dataset.roomDraw,'true');assert.equal(x.writes.length,1);assert.equal(x.el('drawing-tool').value,'room-rectangle');
 x.el('drawing-room-name').value='Second rectangle';await ui.author.click({button:0,altKey:false,clientX:40,clientY:0});assert.equal(ui.author.draft.length,1);await ui.author.click({button:0,altKey:false,clientX:46,clientY:6});assert.equal(x.writes.length,2);assert.equal(ui.author.draft.length,0);assert.equal(x.store.workspace().rooms.length,4);assert.equal(ui.root.dataset.roomDraw,'true');
});

test('Atlas preserve callback keeps Room A draft selection after another room B was created, so invalid raw text still blocks flush',async t=>{
 const x=fixture(t,{preview:false}),ui=await rendererUI(x),source=ui.workspace.selectedId;x.enter('room-name','Unpublished text in A');x.enter('points','  unparseable original contour bytes  ');const raw=x.el('points').value;
 x.store.executeAtlasCommit({commandId:randomUUID(),token:ui.workspace.token,campaignId:x.campaign.id,action:{kind:'room-default'}});const next=x.store.workspace();assert.notEqual(next.selectedId,source);
 await ui.atlasUpdated(next,{preserveDraft:true});assert.equal(ui.workspace.selectedId,source);assert.equal(ui.draft.id,source);assert.equal(x.el('room-name').value,'Unpublished text in A');assert.equal(x.el('points').value,raw);assert.equal(ui.draftStatus.openInput,true);assert.equal(await ui.flush(),false);assert.equal(x.writes.length,0);
});
