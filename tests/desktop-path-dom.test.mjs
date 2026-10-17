import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {parseHTML} from 'linkedom';
for(const[name,entry]of [['store','storage/store'],['ui','path-ui']])buildSync({entryPoints:[`src/app/${entry}.ts`],outfile:`.build/path-dom-${name}.cjs`,bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const require=createRequire(import.meta.url),{CampaignStore}=require('../.build/path-dom-store.cjs'),tick=()=>new Promise(r=>setImmediate(r));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await tick();}assert.ok(fn(),'Expected path state did not arrive');}
async function fixture(){
 const dir=mkdtempSync(path.join(tmpdir(),'path-dom-')),store=new CampaignStore(path.join(dir,'campaign.sqlite')),saved={window:globalThis.window,document:globalThis.document,Event:globalThis.Event,CustomEvent:globalThis.CustomEvent};
 const {window,document}=parseHTML(readFileSync('src/app/index.html','utf8'));Object.assign(globalThis,{window,document,Event:window.Event,CustomEvent:window.CustomEvent});
 const patched=new WeakSet();const patchSelect=select=>{if(patched.has(select))return;patched.add(select);let chosen='';Object.defineProperty(select,'value',{get(){const options=[...select.querySelectorAll('option')];return options.find(o=>o.value===chosen)?.value??options[0]?.value??'';},set(v){chosen=String(v);}});};
 for(const select of document.querySelectorAll('select'))patchSelect(select);const create=document.createElement.bind(document);document.createElement=tag=>{const element=create(tag);if(tag==='select')patchSelect(element);return element;};
 for(const input of document.querySelectorAll('input[type=checkbox]'))input.checked=input.hasAttribute('checked');
 const dialog=document.getElementById('path-dialog');dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>dialog.removeAttribute('open');
 const ids={},roomIds={};for(const name of ['Alpha','Beta']){const rooms=[0,1].map(i=>({id:randomUUID(),scopeId:'local',floorId:'ground',number:String(i+1),name:name+' '+i,revision:0,polygons:[{outer:[{x:i*7.62,y:0},{x:i*7.62+3.048,y:0},{x:i*7.62+3.048,y:3.048},{x:i*7.62,y:3.048}],holes:[]}],sections:[{id:randomUUID(),kind:'markdown',markdown:''}]})),campaign=store.create(name,rooms),w=store.activate(campaign.id);ids[name]=campaign.id;roomIds[name]=rooms[0].id;for(const room of rooms)store.executeDrawing({commandId:randomUUID(),token:w.token,campaignId:campaign.id,action:{kind:'volume-initialize',roomId:room.id,expectedRoomRevision:0,expectedVolumeRevision:null,heightSteps:2}});}
 let current=store.activate(ids.Alpha),hold=false,releaseBefore,publishHook;const statuses=[],sent=[],requests=[],changed=[],reads=[];const reply=fn=>{try{return{ok:true,value:fn()};}catch(e){return{ok:false,error:e.message};}};
 window.campaign={preparation:async token=>reply(()=>store.preparation(token,'')),drawing:async token=>{reads.push(token);return reply(()=>store.drawing(token));},previewPath:async(token,p)=>{requests.push(structuredClone(p));return reply(()=>store.previewPath(token,structuredClone(p)));},executeDrawing:async command=>{sent.push(structuredClone(command));const r=reply(()=>store.executeAtlas({...command,action:{kind:'drawing',command}}));return r.ok?{ok:true,value:{workspace:r.value.atlas.workspace,view:r.value.atlas.geometry.drawing,atlasAck:r.value}}:r;}};
 // Keep fault injection at the drawing hop, backed by the actual canonical Atlas command and its captured atomic acknowledgement.
 window.campaign.executeAtlas=async command=>{assert.equal(command.action.kind,'drawing');const r=await window.campaign.executeDrawing(command.action.command);return r.ok?{ok:true,value:r.value.atlasAck}:r;};
 delete require.cache[require.resolve('../.build/path-dom-ui.cjs')];const ui=require('../.build/path-dom-ui.cjs');ui.initPaths(text=>statuses.push(text),()=>current,()=>current.rooms.find(r=>r.id===roomIds[current.campaign.id===ids.Alpha?'Alpha':'Beta']),async()=>{if(hold){hold=false;await new Promise(r=>releaseBefore=r);}return true;},async w=>{changed.push(w);current=w;await publishHook?.(w);});ui.activatePaths();
 const click=id=>document.getElementById(id).click(),enter=(id,v)=>{const input=document.getElementById(id);input.value=v;input.dispatchEvent(new window.Event('input',{bubbles:true}));};
 click('path-open');await until(()=>dialog.hasAttribute('open')).catch(error=>{error.message+=' '+JSON.stringify(statuses);throw error;});await tick();
 return{store,ui,window,document,dialog,sent,requests,changed,statuses,reads,click,enter,current:()=>current,onPublish(fn){publishHook=fn;},holdBefore(){hold=true;},hasBefore:()=>!!releaseBefore,releaseBefore:()=>releaseBefore(),async preview(){click('path-preview');await until(()=>!document.getElementById('path-commit').disabled);await tick();},async publish(){await this.preview();click('path-commit');await until(()=>sent.some(c=>c.action.kind==='path-publish'));await ui.flushPaths();},async switchTo(name){current=store.activate(ids[name]);ui.activatePaths();},async cleanup(){releaseBefore?.();await tick();await tick();await ui.flushPaths();store.close();Object.assign(globalThis,saved);rmSync(dir,{recursive:true,force:true});}};
}
test('changed path input cannot be replaced by a delayed preview',async()=>{const x=await fixture();let release;try{const send=x.window.campaign.previewPath;x.window.campaign.previewPath=async(...args)=>{const result=await send(...args);return new Promise(r=>release=()=>r(result));};x.click('path-preview');await until(()=>!!release);x.enter('path-notes','  New prose\r\n');release();await x.ui.flushPaths();assert.equal(x.document.getElementById('path-notes').value,'  New prose\r\n');assert.equal(x.document.getElementById('path-commit').disabled,true);}finally{release?.();await x.cleanup();}});
test('changed width invalidates a displayed path preview',async()=>{const x=await fixture();try{await x.preview();x.enter('path-widths','2');assert.equal(x.document.getElementById('path-commit').disabled,true);assert.equal(await x.ui.flushPaths(),false);}finally{await x.cleanup();}});
test('path preview captures its parameters before another editor prepares',async()=>{const x=await fixture();try{x.holdBefore();x.click('path-preview');await until(x.hasBefore);x.enter('path-widths','2');x.releaseBefore();await x.ui.flushPaths();assert.deepEqual(x.requests,[]);assert.equal(x.document.getElementById('path-widths').value,'2');assert.equal(x.document.getElementById('path-commit').disabled,true);}finally{await x.cleanup();}});
test('pending publish cannot recapture another campaign after preparation',async()=>{const x=await fixture();try{await x.preview();x.holdBefore();x.click('path-commit');await until(x.hasBefore);await x.switchTo('Beta');x.releaseBefore();await tick();await tick();assert.deepEqual(x.sent,[]);}finally{await x.cleanup();}});
test('closing during a read cancels its response without reopening the dialog',async()=>{const x=await fixture();let release;try{x.click('path-close');x.window.campaign.drawing=async token=>{const result={ok:true,value:x.store.drawing(token)};return new Promise(r=>release=()=>r(result));};x.click('path-open');await until(()=>!!release);x.click('path-close');release();await tick();await tick();assert.equal(x.dialog.hasAttribute('open'),false);}finally{release?.();await x.cleanup();}});
test('failed pending publication fails its concurrent flush and retains the candidate',async()=>{const x=await fixture();let release;try{await x.preview();x.window.campaign.executeDrawing=async()=>new Promise(r=>release=()=>r({ok:false,error:'No publish'}));x.click('path-commit');await until(()=>!!release);const flush=x.ui.flushPaths();release();assert.equal(await flush,false);assert.equal(x.document.getElementById('path-commit').disabled,false);}finally{release?.();await x.cleanup();}});
test('new notes typed during publication survive and publish against the confirmed own revision',async()=>{const x=await fixture();let release;try{await x.preview();const send=x.window.campaign.executeDrawing;let first=true;x.window.campaign.executeDrawing=async c=>{const result=await send(c);if(first){first=false;return new Promise(r=>release=()=>r(result));}return result;};x.click('path-commit');await until(()=>!!release);x.enter('path-notes','  Further protected prose\r\n');release();assert.equal(await x.ui.flushPaths(),false);assert.equal(x.document.getElementById('path-notes').value,'  Further protected prose\r\n');const ownRevision=x.store.drawing(x.current().token).paths[0].revision;await x.preview();x.click('path-commit');assert.equal(await x.ui.flushPaths(),true);assert.equal(x.sent[1].action.expectedRevision,ownRevision);assert.equal(x.store.drawing(x.current().token).paths[0].notes,'  Further protected prose\r\n');}finally{release?.();await x.cleanup();}});
test('opposite passage drafts and later description survive the first side acknowledgement',async()=>{
 const x=await fixture();let release;try{
  await x.publish();const passageId=x.document.querySelector('fieldset[data-side="outbound"]').dataset.passageId;const section=(key)=>x.document.querySelector(`fieldset[data-side="${key}"][data-passage-id="${passageId}"]`),write=(key,text)=>{const input=section(key).querySelector('textarea');input.value=text;input.dispatchEvent(new x.window.Event('input',{bubbles:true}));};
  write('outbound','First outgoing');write('inbound','Pending return');const id=section('outbound').dataset.passageId;
  const send=x.window.campaign.executeDrawing;let first=true;x.window.campaign.executeDrawing=async c=>{const result=await send(c);if(first){first=false;return new Promise(r=>release=()=>r(result));}return result;};
  section('outbound').querySelector('button').click();await until(()=>!!release);write('outbound','Second outgoing');release();assert.equal(await x.ui.flushPaths(),false);
  assert.equal(section('outbound').querySelector('textarea').value,'Second outgoing');assert.equal(section('inbound').querySelector('textarea').value,'Pending return');
  section('inbound').querySelector('button').click();assert.equal(await x.ui.flushPaths(),false);
  section('outbound').querySelector('button').click();assert.equal(await x.ui.flushPaths(),true);
  const p=x.store.drawing(x.current().token).passages.find(p=>p.id===id);assert.equal(p.outbound.description,'Second outgoing');assert.equal(p.inbound.description,'Pending return');
 }finally{release?.();await x.cleanup();}
});
test('an unrelated newer read cannot rebase a conflicting passage draft',async()=>{
 const x=await fixture();try{
  await x.publish();const passageId=x.document.querySelector('fieldset[data-side="outbound"]').dataset.passageId;const section=()=>x.document.querySelector(`fieldset[data-side="outbound"][data-passage-id="${passageId}"]`),input=section().querySelector('textarea');input.value='Local prose';input.dispatchEvent(new x.window.Event('input',{bubbles:true}));
  const w=x.current(),p=x.store.drawing(w.token).passages.find(p=>p.id===section().dataset.passageId),other={...p,outbound:{...p.outbound,description:'Other confirmed prose'}};
  x.store.executeDrawing({commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,action:{kind:'passage',passage:other,expectedRevision:p.revision}});
  await x.ui.openPaths();assert.equal(section().querySelector('textarea').value,'Local prose');section().querySelector('button').click();assert.equal(await x.ui.flushPaths(),false);
  assert.equal(x.sent.at(-1).action.expectedRevision,p.revision);assert.equal(x.store.drawing(w.token).passages.find(q=>q.id===p.id).outbound.description,'Other confirmed prose');
  x.click('path-discard');assert.equal(section().querySelector('textarea').value,'Other confirmed prose');assert.equal(await x.ui.flushPaths(),true);
 }finally{await x.cleanup();}
});
test('Escape and new-path selection preserve open notes until explicit discard',async()=>{const x=await fixture();try{x.enter('path-notes','Protected draft');x.click('path-new');assert.equal(x.document.getElementById('path-notes').value,'Protected draft');const cancel=new x.window.Event('cancel',{cancelable:true});x.dialog.dispatchEvent(cancel);assert.equal(cancel.defaultPrevented,true);assert.equal(x.dialog.hasAttribute('open'),true);x.click('path-discard');assert.equal(await x.ui.flushPaths(),true);x.click('path-close');assert.equal(x.dialog.hasAttribute('open'),false);}finally{await x.cleanup();}});
test('a partial anchor is rejected before dispatch and remains correctable',async()=>{const x=await fixture();try{x.enter('path-from-x','1');x.click('path-preview');await tick();assert.deepEqual(x.requests,[]);assert.ok(x.statuses.some(s=>s.includes('X, Y und Höhe')));x.enter('path-from-y','0');x.enter('path-from-z','0');await x.preview();assert.equal(x.requests.length,1);}finally{await x.cleanup();}});
test('standalone passage creation consumes its anchor inputs and provides readable location targets',async()=>{
 const x=await fixture();try{
  const w=x.current(),location={kind:'location',version:1,id:randomUUID(),name:'Readable destination',type:'poi',sections:[],detailMaps:[],keyLinks:[]};
  x.store.changePreparation({commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,change:{kind:'location',expectedRevision:null,document:location}});await x.ui.openPaths();
  for(const[id,v]of [['path-from-x','1'],['path-from-y','0'],['path-from-z','0']])x.enter(id,v);
  x.click('passage-create');assert.equal(await x.ui.flushPaths(),true);const p=x.store.drawing(w.token).passages[0];assert.ok(p);assert.equal(p.pathId,null);
  const section=x.document.querySelector('fieldset[data-side="outbound"]'),target=section.querySelector('select[aria-label="Aus dem Endraum Ziel"]');assert.ok([...target.querySelectorAll('option')].some(o=>o.textContent===location.name&&o.value===location.id));target.value=location.id;target.dispatchEvent(new x.window.Event('change'));section.querySelector('button').click();assert.equal(await x.ui.flushPaths(),true);assert.equal(x.store.drawing(w.token).passages[0].outbound.target.id,location.id);
 }finally{await x.cleanup();}
});
test('a later own save of the other side cannot rebase an already conflicting passage draft',async()=>{
 const x=await fixture();try{
  await x.publish();const id=x.document.querySelector('fieldset[data-side="outbound"]').dataset.passageId,section=key=>x.document.querySelector(`fieldset[data-side="${key}"][data-passage-id="${id}"]`);
  const edit=(key,text)=>{const input=section(key).querySelector('textarea');input.value=text;input.dispatchEvent(new x.window.Event('input',{bubbles:true}));};
  edit('outbound','Local outgoing');const w=x.current(),p=x.store.drawing(w.token).passages.find(p=>p.id===id);
  x.store.executeDrawing({commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,action:{kind:'passage',passage:{...p,outbound:{...p.outbound,description:'Remote outgoing'}},expectedRevision:p.revision}});
  await x.ui.openPaths();edit('inbound','Own return');section('inbound').querySelector('button').click();assert.equal(await x.ui.flushPaths(),false);
  section('outbound').querySelector('button').click();assert.equal(await x.ui.flushPaths(),false);assert.equal(x.sent.at(-1).action.expectedRevision,p.revision);
  const saved=x.store.drawing(w.token).passages.find(p=>p.id===id);assert.equal(saved.outbound.description,'Remote outgoing');assert.equal(saved.inbound.description,'Own return');assert.equal(section('outbound').querySelector('textarea').value,'Local outgoing');
 }finally{await x.cleanup();}
});
test('refresh waiting for preparation cannot start a read in the new campaign',async()=>{const x=await fixture();try{x.holdBefore();x.click('path-refresh');await until(x.hasBefore);await x.switchTo('Beta');const count=x.reads.length;x.releaseBefore();await tick();await tick();assert.equal(x.reads.length,count);}finally{await x.cleanup();}});
test('old acknowledgement cannot publish into a new campaign or unlock its pending preview',async()=>{
 const x=await fixture();let releaseOld,releaseNew;try{
  await x.preview();const send=x.window.campaign.executeDrawing;x.window.campaign.executeDrawing=async command=>{const result=await send(command);return new Promise(r=>releaseOld=()=>r(result));};x.click('path-commit');await until(()=>!!releaseOld);
  await x.switchTo('Beta');x.click('path-open');await until(()=>x.document.getElementById('path-from').value===x.current().rooms[0].id);await tick();const preview=x.window.campaign.previewPath;
  x.window.campaign.previewPath=async(...args)=>{const result=await preview(...args);return new Promise(r=>releaseNew=()=>r(result));};x.click('path-preview');await until(()=>!!releaseNew);
  releaseOld();await tick();await tick();x.click('path-preview');await tick();assert.equal(x.requests.length,2);assert.deepEqual(x.changed,[]);
  releaseNew();await x.ui.flushPaths();assert.equal(x.dialog.hasAttribute('open'),true);
 }finally{releaseOld?.();releaseNew?.();await x.cleanup();}
});
test('passage cards keep their order and expansion when another side is saved',async()=>{
 const x=await fixture();try{await x.publish();const cards=()=>[...x.document.querySelectorAll('#path-passages details')],ids=cards().map(c=>c.dataset.passageId);assert.equal(ids.length,2);cards()[1].setAttribute('open','');const side=cards()[0].querySelector('fieldset'),text=side.querySelector('textarea');text.value='Updated';text.dispatchEvent(new x.window.Event('input',{bubbles:true}));side.querySelector('button').click();assert.equal(await x.ui.flushPaths(),true);assert.deepEqual(cards().map(c=>c.dataset.passageId),ids);assert.equal(cards()[1].hasAttribute('open'),true);}finally{await x.cleanup();}
});
test('a read started during publication cannot restore the precommit list after its acknowledgement',async()=>{
 const x=await fixture();let releaseWrite,releaseRead;try{
  await x.preview();const send=x.window.campaign.executeDrawing,read=x.window.campaign.drawing;
  x.window.campaign.executeDrawing=async command=>{await new Promise(r=>releaseWrite=r);return send(command);};x.click('path-commit');await until(()=>!!releaseWrite);
  x.window.campaign.drawing=async token=>{const result=await read(token);return new Promise(r=>releaseRead=()=>r(result));};const old=x.ui.openPaths();await until(()=>!!releaseRead);
  releaseWrite();assert.equal(await x.ui.flushPaths(),true);assert.equal(x.document.getElementById('path-list').querySelectorAll('article').length,1);
  releaseRead();await old;assert.equal(x.document.getElementById('path-list').querySelectorAll('article').length,1);
 }finally{releaseWrite?.();releaseRead?.();await x.cleanup();}
});
test('a newer foreign read during parent publication cannot become the own path acknowledgement base',async()=>{
 const x=await fixture();let release;try{
  await x.publish();x.enter('path-notes','Own confirmed prose');await x.preview();x.onPublish(async()=>await new Promise(r=>release=r));x.click('path-commit');await until(()=>!!release);
  const w=x.current(),own=x.store.drawing(w.token).paths[0];x.enter('path-notes','New local prose');
  const foreign=x.store.previewPath(w.token,{...own,notes:'Foreign confirmed prose'});x.store.executeDrawing({commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,action:{kind:'path-publish',preview:foreign,expectedRevision:own.revision}});
  await x.ui.openPaths();release();assert.equal(await x.ui.flushPaths(),false);x.onPublish(null);assert.equal(x.document.getElementById('path-notes').value,'New local prose');
  await x.preview();x.click('path-commit');assert.equal(await x.ui.flushPaths(),false);assert.equal(x.sent.at(-1).action.expectedRevision,own.revision);assert.equal(x.store.drawing(w.token).paths[0].notes,'Foreign confirmed prose');
 }finally{release?.();await x.cleanup();}
});

test('map corridor shortcut opens the real preview and publication flow',async()=>{
 const x=await fixture();try{
  x.click('path-close');x.click('path-quick-open');await until(()=>x.dialog.hasAttribute('open'));await tick();
  assert.equal(x.document.querySelectorAll('#path-map [data-preview-room]').length,2);
  await x.preview();const footprint=x.document.querySelector('#path-map [data-preview-volume]');
  assert.ok(footprint?.getAttribute('d').includes('Z'),'Preview must show a closed floor area');
  assert.equal(x.document.querySelectorAll('#path-map [data-preview-room]').length,2);
  x.click('path-commit');assert.equal(await x.ui.flushPaths(),true);
  assert.equal(x.store.drawing(x.current().token).paths.length,1);
  assert.match(x.document.getElementById('path-feedback').textContent,/gemeinsam übernommen/);
 }finally{await x.cleanup();}
});
test('path validation errors remain visible inside the modal and preserve the correction draft',async()=>{
 const x=await fixture();try{
  x.enter('path-from-x','1');x.click('path-preview');await tick();
  assert.match(x.document.getElementById('path-feedback').textContent,/X, Y und Höhe/);
  assert.ok(x.document.getElementById('path-feedback').classList.contains('error'));
  assert.equal(x.document.getElementById('path-from-x').value,'1');assert.deepEqual(x.requests,[]);
 }finally{await x.cleanup();}
});

test('the room connection card reopens the existing path rather than creating another area',async()=>{
 const x=await fixture();try{
  await x.publish();const p=x.store.drawing(x.current().token).paths[0],roomCount=x.current().rooms.length;x.click('path-close');x.ui.renderRoomPaths(x.store.drawing(x.current().token));
  const panel=x.document.getElementById('room-path-context'),button=panel.querySelector('button[data-path-edit]');assert.equal(panel.hidden,false);assert.equal(button.dataset.pathEdit,p.id);button.click();await until(()=>x.document.getElementById('path-name').value===p.name);await tick();
  assert.ok(x.document.querySelector('#path-map [data-saved-volume]'));assert.match(x.document.getElementById('path-preview-status').textContent,/Gespeicherter Gang/);
  x.enter('path-name','Broad watch corridor');x.enter('path-widths','2');await x.publish();
  const saved=x.store.drawing(x.current().token).paths[0];assert.equal(saved.id,p.id);assert.equal(saved.roomId,p.roomId);assert.equal(saved.name,'Broad watch corridor');assert.equal(x.current().rooms.length,roomCount);assert.equal(x.sent.filter(c=>c.action.kind==='path-publish').length,2);assert.equal(x.sent.at(-1).action.expectedRevision,p.revision);
 }finally{await x.cleanup();}
});
test('a contextual path read cannot reopen a previous campaign after switching away',async()=>{
 const x=await fixture();let release;try{
  await x.publish();x.click('path-close');x.ui.renderRoomPaths(x.store.drawing(x.current().token));const read=x.window.campaign.drawing;
  x.window.campaign.drawing=async token=>{const result=await read(token);return new Promise(r=>release=()=>r(result));};
  x.document.querySelector('#room-path-context button').click();await until(()=>!!release);await x.switchTo('Beta');release();await tick();await tick();assert.equal(x.dialog.hasAttribute('open'),false);assert.equal(x.sent.filter(c=>c.action.kind==='path-publish').length,1);
 }finally{release?.();await x.cleanup();}
});
