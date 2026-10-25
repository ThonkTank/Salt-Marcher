import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {buildSync} from 'esbuild';
import {parseHTML} from './helpers/dom.mjs';
for(const [name,entry] of [['store','storage/store'],['ui','key-ui'],['graph-ui','graph-ui'],['camera','room-camera'],['key-model','key-model'],['key-contracts','key-contracts']])buildSync({entryPoints:['src/app/'+entry+'.ts'],outfile:'.build/room-authoring-'+name+'.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const require=createRequire(import.meta.url),{CampaignStore}=require('../.build/room-authoring-store.cjs');
const tick=()=>new Promise(r=>setImmediate(r));
async function until(check){for(let i=0;i<120;i++){if(check())return;await tick();}assert.ok(check(),'UI state did not arrive');}
function setup(t,rooms=[]){const dir=mkdtempSync(path.join(tmpdir(),'room-authoring-')),filename=path.join(dir,'store.sqlite'),store=new CampaignStore(filename),campaign=store.create('Fährkeller',rooms);let workspace=store.activate(campaign.id);t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});return{store,campaign,filename,get workspace(){return workspace;},set workspace(w){workspace=w;}};}
const bounds=r=>({left:Math.min(...r.polygons.flatMap(p=>p.outer.map(v=>v.x))),right:Math.max(...r.polygons.flatMap(p=>p.outer.map(v=>v.x))),bottom:Math.min(...r.polygons.flatMap(p=>p.outer.map(v=>v.y))),top:Math.max(...r.polygons.flatMap(p=>p.outer.map(v=>v.y)))});
const room=(id,x,y,floorId='upper',scopeId='vault')=>({id,scopeId,floorId,name:id,number:id,revision:0,polygons:[{outer:[{x,y},{x:x+6.096,y},{x:x+6.096,y:y+4.572},{x,y:y+4.572}],holes:[]}],sections:[{id:randomUUID(),kind:'markdown',markdown:'Existing prose'}]});
test('additional rooms stay on the selected dungeon floor, avoid occupied geometry and preserve prior rooms on restart',t=>{
 const existing=[room('anchor',-20,-12),room('blocker',-12,-12),room('other-floor',0,0,'lower')],x=setup(t,existing);x.store.select(x.workspace.token,'anchor');const before=structuredClone(x.store.workspace().rooms);const w=x.store.addRoom(x.workspace.token),created=w.rooms.find(r=>r.id===w.selectedId);assert.equal(created.scopeId,'vault');assert.equal(created.floorId,'upper');const b=bounds(created);for(const r of existing.filter(r=>r.floorId==='upper')){const o=bounds(r);assert.ok(b.left>=o.right+1.524-1e-8||b.right<=o.left-1.524+1e-8||b.bottom>=o.top+1.524-1e-8||b.top<=o.bottom-1.524+1e-8);}assert.deepEqual(w.rooms.filter(r=>r.id!==created.id),before);const reopened=new CampaignStore(x.filename);try{assert.deepEqual(reopened.activate(x.campaign.id).rooms,w.rooms);}finally{reopened.close();}
});
test('three default rooms are separate usable rectangles instead of a stack at the origin',t=>{const x=setup(t);let w=x.workspace;for(let i=0;i<3;i++)w=x.store.addRoom(w.token);assert.equal(w.rooms.length,3);const bs=w.rooms.map(bounds).sort((a,b)=>a.left-b.left);assert.equal(bs[0].left,0);assert.equal(bs[0].bottom,0);for(let i=1;i<3;i++)assert.ok(bs[i].left>=bs[i-1].right+1.524-1e-8);});
async function editor(t,seed,withNotes=false){const x=setup(t);x.workspace=x.store.addRoom(x.workspace.token);if(seed){const{emptyKey}=require('../.build/room-authoring-key-contracts.cjs'),content=emptyKey(x.workspace.rooms[0]);seed(content);x.store.executeDrawing({commandId:randomUUID(),campaignId:x.campaign.id,token:x.workspace.token,action:{kind:'key-content',content,expectedRevision:null}});x.workspace=x.store.workspace();}const prior={document:globalThis.document,window:globalThis.window,Event:globalThis.Event,CustomEvent:globalThis.CustomEvent};const{document,window}=parseHTML(readFileSync('src/app/index.html','utf8'));Object.assign(globalThis,{document,window,Event:window.Event,CustomEvent:window.CustomEvent});for(const d of document.querySelectorAll('dialog')){d.open=false;d.showModal=()=>{d.open=true;};d.close=()=>{d.open=false;};}Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value??this.querySelector('option')?.value??'';},set(value){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.value===String(value));}});for(const c of document.querySelectorAll('input[type=checkbox]'))c.checked=false;for(const c of document.querySelectorAll('input'))c.select=()=>{};const ok=fn=>{try{return{ok:true,value:fn()};}catch(e){return{ok:false,error:e.message};}};let hold,release,creates=0;const noteOpens=[];
 window.campaign={dungeonAuthoring:async()=>ok(()=>x.store.dungeonAuthoring(x.workspace.token)),preparation:async()=>ok(()=>x.store.preparation(x.workspace.token)),executeDrawing:async c=>ok(()=>x.store.executeDrawing(c)),addRoom:async token=>{creates++;if(hold){hold=false;await new Promise(r=>release=r);}return ok(()=>x.store.addRoom(token));}};
 window.campaign.atlasDrawingCommit=async c=>ok(()=>x.store.atlasDrawingCommit(c));
 window.campaign.executeAtlas=async c=>{if(c.action.kind==='room-default'){creates++;if(hold){hold=false;await new Promise(r=>release=r);}}return ok(()=>x.store.executeAtlas(c));};
 if(withNotes){
  window.HTMLElement.prototype.focus=function(){};window.HTMLElement.prototype.scrollIntoView=function(){};window.HTMLElement.prototype.select=function(){};window.HTMLElement.prototype.showModal=function(){this.open=true;};window.HTMLElement.prototype.close=function(){this.open=false;};window.HTMLElement.prototype.reportValidity=()=>true;
  for(const method of ['keyNoteChoices','captureKeyNote','keyNoteCaptureStatus','noteRoomUses'])window.campaign[method]=async(...args)=>ok(()=>x.store[method](...args));
 }
 const navigation=withNotes?{open:async(id,current)=>{if(!current())return false;const row=x.store.preparation(x.workspace.token).notes.find(r=>r.note.id===id);if(!row)return false;noteOpens.push(id);document.getElementById('note-editor').hidden=false;document.getElementById('note-title').value=row.note.title;document.getElementById('note-gm').value=row.note.gmNotes;return true;},flush:async()=>true}:undefined;
 const file=require.resolve('../.build/room-authoring-ui.cjs');delete require.cache[file];const ui=require(file);ui.initKeys(()=>{},()=>x.workspace,()=>x.workspace.rooms.find(r=>r.id===x.workspace.selectedId),async()=>true,async w=>{x.workspace=w;},async id=>{x.store.select(x.workspace.token,id);x.workspace=x.store.workspace();},navigation);ui.activateKeys();document.getElementById('key-open').onclick();await until(()=>document.getElementById('key-dialog').open||document.getElementById('key-save-status').dataset.state==='error');assert.equal(document.getElementById('key-dialog').open,true,document.getElementById('key-save-status').textContent);t.after(()=>{ui.activateKeys();Object.assign(globalThis,prior);});
 return{...x,ui,document,window,noteOpens,get current(){return x.workspace;},get creates(){return creates;},hold:()=>{hold=true;},hasReply:()=>!!release,release:()=>release(),enter:(id,value)=>{const e=document.getElementById(id);e.value=value;e.dispatchEvent(new window.Event('input',{bubbles:true}));}};
}
test('reference search links the chosen original once, survives room changes, and rejects retired results',async t=>{
 const x=await editor(t,undefined,true),el=id=>x.document.getElementById(id),first=x.current.selectedId,ids=[];
 for(let i=0;i<12;i++){const note={version:1,id:randomUUID(),revision:1,kind:'note',title:'Gemeinsame Quelle '+i,readAloud:'',gmNotes:'Originaltext '+i,relations:[],creatureId:null,deleted:false};ids.push(note.id);x.store.changePreparation({commandId:randomUUID(),token:x.current.token,campaignId:x.campaign.id,change:{kind:'note',expectedRevision:null,note}});}
 el('key-open').onclick();x.enter('key-reference-query','Gemeinsame');await until(()=>el('key-reference-matches').querySelectorAll('button').length===8);assert.equal(el('key-reference-matches').querySelectorAll('button').length,8);assert.match(el('key-reference-search-status').textContent,/genauer/);
 x.enter('key-reference-query','Quelle 11');const old=el('key-reference-matches').querySelector('button');assert.equal(old.dataset.referenceId,ids[11]);
 const composing=new x.window.Event('keydown',{cancelable:true});Object.assign(composing,{key:'Enter',isComposing:true});el('key-reference-query').onkeydown(composing);assert.equal(x.store.drawing(x.current.token).keyContent.length,0);
 old.click();assert.equal(await x.ui.flushKeys(),true);assert.deepEqual(x.store.drawing(x.current.token).keyContent.find(k=>k.id===first).references,[{kind:'note',id:ids[11],label:'Gemeinsame Quelle 11'}]);assert.equal(el('key-reference-matches').querySelectorAll('button').length,0);
 el('key-add-room').onclick();await until(()=>x.current.rooms.length===2&&!el('key-add-room').disabled);const second=x.current.rooms.find(r=>r.id!==first).id;assert.equal(el('key-reference-query').value,'Quelle 11');old.onclick();assert.equal(x.store.drawing(x.current.token).keyContent.find(k=>k.id===second),undefined);
 const enter=new x.window.Event('keydown',{cancelable:true});Object.assign(enter,{key:'Enter',isComposing:false});el('key-reference-query').onkeydown(enter);assert.equal(await x.ui.flushKeys(),true);assert.equal(x.store.drawing(x.current.token).keyContent.find(k=>k.id===second).references[0].id,ids[11]);
 x.enter('key-reference-query','Quelle 10');const closed=el('key-reference-matches').querySelector('button');el('key-dialog').close();closed.onclick();assert.equal(await x.ui.flushKeys(),true);assert.equal(x.store.drawing(x.current.token).keyContent.find(k=>k.id===second).references.length,1);
 x.ui.activateKeys();old.onclick();assert.equal(el('key-reference-query').value,'');assert.equal(x.store.preparation(x.current.token).notes.length,12);
});

test('a key-first author creates the next room without closing, saves public/GM prose, and clears filters hiding the new room',async t=>{
 const x=await editor(t),first=x.current.selectedId;x.enter('key-name','Treppenraum');x.enter('key-read-aloud','Feuchte Stufen.');x.enter('key-gm-notes','Schlüssel unter Stufe3.');x.enter('key-search','Treppenraum');x.document.getElementById('key-add-room').onclick();await until(()=>x.creates===1&&x.current.rooms.length===2&&x.document.getElementById('key-name').value==='Neuer Raum'&&!x.document.getElementById('key-add-room').disabled);assert.equal(x.document.getElementById('key-dialog').open,true);assert.equal(x.document.getElementById('key-search').value,'');assert.equal(x.document.getElementById('key-read-aloud').value,'');assert.equal(x.document.getElementById('key-gm-notes').value,'');const saved=x.store.dungeon(x.current.token).drawing.keyContent.find(k=>k.id===first);assert.equal(saved.name,'Treppenraum');assert.ok(saved.blocks.some(b=>b.visibility==='public'&&b.text==='Feuchte Stufen.'));assert.ok(saved.blocks.some(b=>b.visibility==='gm'&&b.text==='Schlüssel unter Stufe3.'));x.enter('key-name','Archiv');assert.equal(await x.ui.flushKeys(),true);assert.ok(x.store.workspace().rooms.some(r=>r.name==='Archiv'));
});
test('a rejected key draft cannot create an extra room',async t=>{const x=await editor(t);x.enter('key-attributes','missing equals');x.document.getElementById('key-add-room').onclick();await until(()=>x.document.getElementById('key-save-status').dataset.state==='error');assert.equal(x.creates,0);assert.equal(x.current.rooms.length,1);assert.equal(x.document.getElementById('key-attributes').value,'missing equals');});

// These controls redraw themselves before the edit reaches the dialog listener.
// Check real autosave, with no flush, close, navigation or later input to hide a missed edit.
for(const action of ['remove block','reorder blocks','change block kind','remove reference'])test(`key autosaves ${action} after its control is replaced`,async t=>{
 const x=await editor(t,key=>{
  const text=(visibility,text)=>({...key.blocks[0],id:randomUUID(),kind:'text',visibility,text});
  key.blocks.push(text('public','  Vorlesetext\r\n'),text('gm','Private GM-Notiz'),text('secret','Geheimer Inhalt'));
  key.references=[{kind:'npc',id:'ferryman',label:'Fährmann'},{kind:'location',id:'pier',label:'Alter Steg'}];
 });
 const stored=()=>x.store.dungeon(x.current.token).drawing.keyContent[0],before=stored(),expected=structuredClone(before),rooms=structuredClone(x.current.rooms);
 const card=x.document.querySelector('#key-blocks fieldset'),button=label=>[...card.querySelectorAll('button')].find(b=>b.textContent===label);
 if(action==='remove block'){expected.blocks.shift();button('Block entfernen').click();}
 if(action==='reorder blocks'){[expected.blocks[0],expected.blocks[1]]=[expected.blocks[1],expected.blocks[0]];button('Nach unten').click();}
 if(action==='change block kind'){expected.blocks[0].kind='attributes';const kind=card.querySelector('select');kind.value='attributes';kind.dispatchEvent(new x.window.Event('change',{bubbles:true}));}
 if(action==='remove reference'){expected.references.shift();x.document.querySelector('#key-references button').click();}
 for(let i=0;i<60&&stored().revision===before.revision;i++)await new Promise(r=>setTimeout(r,25));
 const saved=stored();assert.ok(saved.revision>before.revision,'the completed action must autosave without another edit');expected.revision=saved.revision;assert.deepEqual(saved,expected);assert.deepEqual(x.current.rooms.map(r=>r.polygons),rooms.map(r=>r.polygons));
 x.ui.activateKeys();const reopened=new CampaignStore(x.filename);try{const w=reopened.activate(x.campaign.id);assert.deepEqual(reopened.dungeon(w.token).drawing.keyContent[0],expected);}finally{reopened.close();}
});

test('floor overview includes separate room extents and large sparse contours without changing source geometry',()=>{const{roomCameraBox}=require('../.build/room-authoring-camera.cjs');const rooms=[room('a',0,0),room('b',15,0)],before=structuredClone(rooms);const[x,y,w,h]=roomCameraBox(rooms).split(' ').map(Number);assert.ok(x<0&&x+w>21&&y<0&&y+h>4.572);assert.deepEqual(rooms,before);assert.equal(roomCameraBox([]),null);const large={polygons:[{outer:Array.from({length:150000},(_,i)=>({x:i,y:i%3})),holes:[]}]};assert.ok(roomCameraBox([large]).split(' ').every(n=>Number.isFinite(Number(n))));});

test('a new empty room contributes no invented GM heading to the live key',t=>{const x=setup(t),w=x.store.addRoom(x.workspace.token),r=w.rooms.find(r=>r.id===w.selectedId),{renderDungeonKey}=require('../.build/room-authoring-key-model.cjs');assert.equal(r.sections[0].markdown,'');const text=renderDungeonKey(r,[],x.store.dungeon(w.token),{audience:'gm',discovered:new Set()}).text;assert.doesNotMatch(text,/## Beschreibung/);});

test('ordinary new rooms retain free contours through undo, redo and fresh open without implicit voxels',t=>{
 const x=setup(t),w=x.store.addRoom(x.workspace.token),id=w.selectedId,polygons=w.rooms.find(r=>r.id===id).polygons;
 assert.equal(x.store.drawing(w.token).volumes.length,0);
 const undone=x.store.history(w.token,'undo');assert.equal(undone.rooms.length,0);assert.equal(x.store.drawing(w.token).volumes.length,0);
 x.store.history(w.token,'redo');assert.equal(x.store.workspace().rooms[0].id,id);assert.deepEqual(x.store.workspace().rooms[0].polygons,polygons);assert.equal(x.store.drawing(w.token).volumes.length,0);
 const reopened=new CampaignStore(x.filename);try{const fresh=reopened.activate(x.campaign.id);assert.equal(fresh.rooms[0].id,id);assert.deepEqual(fresh.rooms[0].polygons,polygons);assert.equal(reopened.drawing(fresh.token).volumes.length,0);}finally{reopened.close();}
});
test('connecting existing contours previews complete rooms and a route without changing confirmed truth',t=>{
 const a=room('a',0,0),b=room('b',12.192,0),x=setup(t,[a,b]),token=x.workspace.token;
 const run=action=>{const state=x.store.workspaceShell().graphPreview;return x.store.executeGraph({commandId:randomUUID(),token,campaignId:x.campaign.id,scopeId:'vault',target:{kind:'graph-preview',previewId:state?.id??randomUUID(),scopeId:'vault',revision:state?.revision??0},action});};
 const connect=()=>run({kind:'connect',intent:{id:randomUUID(),fromRoomId:'a',toRoomId:'b',fromGroupId:null,toGroupId:null,form:'corridor',name:'Fährkeller-Verbindung',problem:''}});
 let result=connect();assert.equal(result.view.layout.intents.length,0);assert.equal(result.view.geometry.drawing.paths.length,1);
 assert.ok(['a','b'].every(id=>result.view.geometry.drawing.volumes.some(v=>v.roomId===id)));
 assert.equal(x.store.db.prepare('SELECT count(*) n FROM dungeon_volume').get().n,0);
 assert.deepEqual(result.workspace.rooms.filter(r=>['a','b'].includes(r.id)).map(r=>r.sections),[a.sections,b.sections]);
 run({kind:'restore'});assert.equal(x.store.drawing(token).volumes.length,0);assert.deepEqual(x.store.workspace().rooms,[a,b]);
 result=connect();run({kind:'raster'});run({kind:'accept'});
 assert.equal(x.store.drawing(token).paths.length,1);assert.equal(x.store.drawing(token).volumes.length,3);
 x.store.history(token,'undo');assert.equal(x.store.drawing(token).volumes.length,0);assert.deepEqual(x.store.workspace().rooms.map(r=>({...r,revision:0})),[a,b]);
 x.store.history(token,'redo');assert.equal(x.store.drawing(token).paths.length,1);
});
test('a rejected self connection leaves no partially initialized room in its preview',t=>{
 const a=room('a',0,0),x=setup(t,[a]),token=x.workspace.token;
 const result=x.store.executeGraph({commandId:randomUUID(),token,campaignId:x.campaign.id,scopeId:'vault',target:{kind:'graph-preview',previewId:randomUUID(),scopeId:'vault',revision:0},action:{kind:'connect',intent:{id:randomUUID(),fromRoomId:'a',toRoomId:'a',fromGroupId:null,toGroupId:null,form:'corridor',name:'Rejected',problem:''}}});
 assert.ok(result.view.layout.intents[0].problem);assert.equal(result.view.geometry.drawing.volumes.length,0);assert.deepEqual(result.workspace.rooms,[a]);
});
test('connection feedback distinguishes translated, changed and rejected endpoints beside the action',async t=>{
 const a=room('a',0,0),b=room('b',12.192,0),x=setup(t,[a,b]),prior={document:globalThis.document,window:globalThis.window,Event:globalThis.Event,CustomEvent:globalThis.CustomEvent};
 const{document,window}=parseHTML(readFileSync('src/app/index.html','utf8'));Object.assign(globalThis,{document,window,Event:window.Event,CustomEvent:window.CustomEvent});
 for(const d of document.querySelectorAll('dialog')){d.open=false;d.showModal=()=>{d.open=true;};d.close=()=>{d.open=false;};}
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value??this.querySelector('option')?.value??'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.value===String(v));}});
 const el=id=>document.getElementById(id),ok=fn=>{try{return{ok:true,value:fn()};}catch(e){return{ok:false,error:e.message};}};
 window.campaign={graph:async(token,scope)=>ok(()=>x.store.graph(token,scope)),executeGraph:async c=>ok(()=>x.store.executeGraph(c))};
 const file=require.resolve('../.build/room-authoring-graph-ui.cjs');delete require.cache[file];const ui=require(file);
 ui.initGraph(()=>{},()=>x.workspace,()=>x.workspace.rooms.find(r=>r.id===x.workspace.selectedId),async()=>true,async w=>{x.workspace=w;},()=>{},async()=>{});
 t.after(()=>{ui.activateGraph();Object.assign(globalThis,prior);});
 ui.activateGraph();el('graph-open').onclick();await until(()=>el('graph-dialog').open);
 el('graph-from').value='a';el('graph-to').value='b';el('graph-connect').onclick();assert.equal(await ui.flushGraph(),true);
 assert.equal(el('graph-connection-result').hidden,false);assert.match(el('graph-connection-result').textContent,/a.*b.*Vorschau verbunden/);
 assert.equal(x.store.db.prepare('SELECT count(*) n FROM dungeon_path').get().n,0);
 el('graph-to').dispatchEvent(new window.Event('input'));assert.equal(el('graph-connection-result').hidden,true);
 el('graph-to').value='a';el('graph-connect').onclick();assert.equal(await ui.flushGraph(),true);
 assert.match(el('graph-connection-result').textContent,/Zwei unterschiedliche/);
 assert.equal(x.store.graph(x.workspace.token,'vault').geometry.drawing.paths.length,1);
 ui.activateGraph();
});
test('map room numbers remain in reading order once connections reach two digits',t=>{
 const seeds=['10','2','1'].map((number,i)=>({...room('room-'+number,i*12.192,0),number})),x=setup(t,seeds);
 assert.deepEqual(x.workspace.rooms.map(r=>r.number),['1','2','10']);
});

for(const reuse of [false,true])test(`captured general note returns to its room after the capture command retires (reuse ${reuse})`,async t=>{
 const x=await editor(t,undefined,true),el=id=>x.document.getElementById(id),title='Abmachung am Schrank';let existing;
 if(reuse){existing={version:1,id:randomUUID(),revision:1,kind:'note',title,readAloud:'Vorlesetext',gmNotes:'Bestehende Entscheidung',relations:[],creatureId:null,deleted:false};x.store.changePreparation({commandId:randomUUID(),campaignId:x.campaign.id,token:x.current.token,change:{kind:'note',expectedRevision:null,note:existing}});}
 el('key-note-create').click();await until(()=>el('key-note-capture-dialog').open);x.enter('key-note-title',title);await until(()=>el('key-note-choices-status').textContent.includes(reuse?'Vorhandene Notiz':'Keine passende'));
 if(reuse){el('key-note-existing').querySelector('button').click();el('key-note-gm').value='';}else el('key-note-gm').value='Neue Entscheidung';
 el('key-note-capture-dialog').querySelector('form').onsubmit({preventDefault(){}});await until(()=>x.noteOpens.length===1&&!el('key-note-capture-dialog').open);await tick();
 assert.equal(el('key-dialog').open,true);assert.equal(el('key-reference-panel').hidden,false);assert.equal(el('note-title').value,title);el('key-reference-return').click();await until(()=>el('key-reference-panel').hidden);assert.equal(el('key-dialog').open,true);assert.equal(x.store.preparation(x.current.token).notes.length,1);if(reuse)assert.equal(x.noteOpens[0],existing.id);
});

test('a selected-only map does not turn other authored rooms into missing geometry or block their map action',async t=>{
 const x=await editor(t),first=x.current.rooms[0],next=x.store.addRoom(x.current.token).rooms.find(r=>r.id!==first.id);
 x.current.rooms.splice(0,x.current.rooms.length,first);x.current.geometryCoverage='selected';
 x.document.getElementById('key-reload').onclick();await until(()=>x.document.getElementById('key-room-list').querySelectorAll('button').length===2);
 const row=[...x.document.getElementById('key-room-list').querySelectorAll('button')].find(b=>b.textContent.includes(next.name));assert.doesNotMatch(row.textContent,/Ohne Geometrie|Archiviert/);
 row.onclick();await until(()=>x.document.getElementById('key-name').value===next.name&&!x.document.getElementById('key-map').disabled);assert.equal(x.document.getElementById('key-dialog').open,true);
});

test('a failed authoring refresh never invents absent geometry, retains saved text, and reload restores map navigation',async t=>{
 const x=await editor(t),read=x.window.campaign.dungeonAuthoring;let fail=true;
 x.window.campaign.dungeonAuthoring=async()=>fail?{ok:false,error:'Autorenstand derzeit nicht verfügbar'}:read();
 x.enter('key-gm-notes','Gespeicherte Spur');assert.equal(await x.ui.flushKeys(),true);
 assert.equal(x.document.getElementById('key-gm-notes').value,'Gespeicherte Spur');assert.equal(x.document.getElementById('key-map').disabled,true);
 assert.match(x.document.getElementById('key-room-list').textContent,/Geometrie nicht geladen/);assert.doesNotMatch(x.document.getElementById('key-room-list').textContent,/Ohne Geometrie|Archiviert/);
 fail=false;x.document.getElementById('key-reload').onclick();await until(()=>!x.document.getElementById('key-map').disabled);assert.equal(x.document.getElementById('key-gm-notes').value,'Gespeicherte Spur');
});
