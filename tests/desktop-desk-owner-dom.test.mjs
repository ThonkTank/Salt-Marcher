import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {parseHTML} from 'linkedom';
await build({entryPoints:['src/app/scene-desk-ui.ts'],outfile:'.build/desk-owner-dom.cjs',bundle:true,platform:'node',format:'cjs',plugins:[{name:'idle-neighbors',setup(build){build.onResolve({filter:/^\.\/(narrative-ui|catalog-ui)$/},a=>({path:a.path,namespace:'idle'}));build.onLoad({filter:/.*/,namespace:'idle'},()=>({contents:'export async function showNarrative(){};export async function flushNarrative(){return true};export function renderCreatureDetail(){}',loader:'js'}));}}]});
const require=createRequire(import.meta.url),ok=value=>({ok:true,value}),tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function until(check){for(let i=0;i<80&&!check();i++)await tick();assert.ok(check(),'Expected desk state did not arrive.');}
function fixture(t){
 const {window}=parseHTML(readFileSync('src/app/index.html','utf8')),previous={};
 for(const key of ['window','document','setTimeout','clearTimeout'])previous[key]=globalThis[key];
 const timers=new Map();let timerId=0;
 globalThis.window=window;globalThis.document=window.document;globalThis.setTimeout=fn=>{timers.set(++timerId,fn);return timerId;};globalThis.clearTimeout=id=>timers.delete(id);
 const ids={alpha:randomUUID(),beta:randomUUID()},notes=new Map(Object.entries(ids).map(([key,id])=>[id,{version:1,id,revision:1,kind:'npc',title:key,readAloud:'Original public',gmNotes:key+' GM',relations:[],creatureId:null,deleted:false}])),writes=[],changes=[],errors=[];
 let holding=null;
 window.campaign={
  sceneDesk:async(token,id)=>ok({sceneId:id,revision:0,place:null,pins:[{ref:{kind:'note',id:ids[token]},title:token,label:'NPC'}]}),
  deskContent:async(_token,ref)=>{const note=structuredClone(notes.get(ref.id));return ok({ref,title:note.title,label:'NPC',revision:note.revision,note});},
  preparationDraft:async()=>ok(null),
  keepDeskDraft:async(token,d,expected)=>{writes.push({token,d:structuredClone(d),expected});if(holding){const p=holding;holding=null;return p.promise;}return ok();},
  changePreparation:async c=>{changes.push(structuredClone(c));const note=notes.get(c.change.note.id);if(note){note.revision++;Object.assign(note,c.change.note,{revision:note.revision});}else notes.set(c.change.note.id,structuredClone(c.change.note));return ok();},
  discardPreparationDraft:async()=>ok(),
  pinSceneDesk:async(_token,id,_revision,ref)=>ok({sceneId:id,revision:1,place:null,pins:[{ref,title:notes.get(ref.id)?.title??"Created",label:"NPC"}]}),
 };
 const file=require.resolve('../.build/desk-owner-dom.cjs');delete require.cache[file];const ui=require(file);
 ui.initSceneDesk((text,error)=>errors.push({text,error}),async()=>{},async()=>{});
 const activate=token=>ui.sceneDeskContext({token,campaign:{id:token}},{id:'scene-'+token,locationId:null,members:[]});
 const title=()=>window.document.querySelector('#desk-fields input');
 const edit=text=>{const input=title();input.value=text;input.oninput();};
 t.after(()=>{ui.sceneDeskContext(null,null);for(const [key,value]of Object.entries(previous))globalThis[key]=value;});
 return{ui,ids,writes,changes,errors,timers,activate,title,edit,hold:()=>{const p=deferred();holding=p;return p;},el:id=>window.document.getElementById(id)};
}

test('late desk save cannot block or adopt the new campaign editor',async t=>{
 const x=fixture(t);x.activate('alpha');await until(()=>x.title()?.value==='alpha');
 x.edit('Alpha edit');const pending=x.hold(),flush=x.ui.flushSceneDesk();await until(()=>x.writes.length===1);
 x.activate('beta');await until(()=>x.title()?.value==='beta');x.edit('Beta edit');
 pending.resolve(ok());await flush;
 assert.equal(x.writes.length,1);assert.equal(x.title().value,'Beta edit');
 assert.equal(await x.ui.flushSceneDesk(),true);
 assert.equal(x.writes.at(-1).token,'beta');assert.equal(x.writes.at(-1).expected,null);
 assert.equal(x.changes.at(-1).campaignId,'beta');assert.equal(x.changes.at(-1).change.note.id,x.ids.beta);
});

test('an expired old desk timer cannot write the new campaign fields',async t=>{
 const x=fixture(t);x.activate('alpha');await until(()=>x.title()?.value==='alpha');x.edit('Alpha edit');const callback=[...x.timers.values()][0];
 x.activate('beta');await until(()=>x.title()?.value==='beta');x.edit('Beta edit');callback();await tick();
 assert.equal(x.writes.length,0);assert.equal(x.title().value,'Beta edit');
});

test('a pin click keeps its original scene while editor saving is pending',async t=>{
 const x=fixture(t);x.activate('alpha');await until(()=>x.title()?.value==='alpha');x.edit('Alpha edit');const pending=x.hold(),pins=[];
 window.campaign.pinSceneDesk=async(token,id)=>{pins.push({token,id});return ok({sceneId:id,revision:1,pins:[],place:null});};
 const button=x.el('desk-pins').querySelectorAll('button')[1];button.onclick();await until(()=>x.writes.length===1);
 x.activate('beta');pending.resolve(ok());await until(()=>x.title()?.value==='beta');await tick();
 assert.equal(pins.length,0);
});

test('creation captures its original values and retains text entered while saving',async t=>{
 const x=fixture(t);x.activate('alpha');await until(()=>x.title()?.value==='alpha');x.edit('Alpha edit');
 Object.defineProperty(x.el('desk-new-kind'),'value',{value:'npc',writable:true});x.el('desk-new-title').value='First created title';x.el('desk-new-notes').value='  First created notes\r\n';
 const pending=x.hold();x.el('desk-create-form').onsubmit({preventDefault(){}});await until(()=>x.writes.length===1);
 x.el('desk-new-title').value='Later title';x.el('desk-new-notes').value='Later notes';pending.resolve(ok());await until(()=>x.changes.some(c=>c.change.expectedRevision===null));
 const created=x.changes.find(c=>c.change.expectedRevision===null);assert.equal(created.campaignId,'alpha');assert.equal(created.change.note.title,'First created title');assert.equal(created.change.note.gmNotes,'  First created notes\r\n');assert.equal(x.el('desk-new-title').value,'Later title');assert.equal(x.el('desk-new-notes').value,'Later notes');
});

test('creation cannot move to another campaign during its prerequisite save',async t=>{
 const x=fixture(t);x.activate('alpha');await until(()=>x.title()?.value==='alpha');x.edit('Alpha edit');
 Object.defineProperty(x.el('desk-new-kind'),'value',{value:'npc',writable:true});x.el('desk-new-title').value='Alpha creation';const pending=x.hold();
 x.el('desk-create-form').onsubmit({preventDefault(){}});await until(()=>x.writes.length===1);x.activate('beta');await until(()=>x.title()?.value==='beta');pending.resolve(ok());await tick();await tick();
 assert.equal(x.changes.length,0);assert.equal(x.el('desk-new-title').value,'Alpha creation');
});

test('a foreign revision read after confirmed saving does not become the next write basis',async t=>{
 const x=fixture(t);x.activate('alpha');await until(()=>x.title()?.value==='alpha');x.edit('My prose');
 const read=window.campaign.deskContent;window.campaign.deskContent=async(...args)=>{const r=await read(...args);return ok({...r.value,revision:r.value.revision+1,note:{...r.value.note,revision:r.value.revision+1,title:'Foreign prose'}});};
 assert.equal(await x.ui.flushSceneDesk(),false);assert.equal(x.title().value,'My prose');assert.ok(x.errors.some(e=>e.text.includes('erneut geändert')));
});

test('late reload discard cannot clear the new campaign editor',async t=>{
 const x=fixture(t);x.activate('alpha');await until(()=>x.title()?.value==='alpha');x.edit('Alpha edit');const callback=[...x.timers.values()][0];callback();await until(()=>x.writes.length===1);
 const pending=deferred(),started=deferred();window.campaign.discardPreparationDraft=async()=>{started.resolve();return pending.promise;};x.el('desk-reload').onclick();await started.promise;
 x.activate('beta');await until(()=>x.title()?.value==='beta');x.edit('Beta later');pending.resolve(ok());await tick();await tick();
 assert.equal(x.title().value,'Beta later');assert.equal(await x.ui.flushSceneDesk(),true);assert.equal(x.changes.at(-1).change.note.title,'Beta later');
});

test('a pinned NPC is readable before editing and the original fields still save a changed reference',async t=>{
 const x=fixture(t);x.activate('alpha');await until(()=>x.title()?.value==='alpha');const preview=x.el('desk-note-preview'),editing=x.el('desk-editing');
 assert.equal(editing.open,false);assert.equal(preview.hidden,false);assert.match(preview.textContent,/Original public.*alpha GM/);assert.equal(x.writes.length,0);assert.equal(x.changes.length,0);
 editing.open=true;editing.ontoggle();assert.equal(preview.hidden,true);x.edit('Nera');const notes=x.el('desk-fields').querySelectorAll('textarea')[1];notes.value='Hat den Zöllner übergesetzt';notes.oninput();editing.open=false;editing.ontoggle();
 assert.match(preview.textContent,/Hat den Zöllner übergesetzt/);assert.match(preview.textContent,/noch nicht übernommen/);assert.equal(await x.ui.flushSceneDesk(),true);assert.equal(x.changes.length,1);assert.equal(x.changes[0].change.note.title,'Nera');assert.equal(x.changes[0].change.note.gmNotes,'Hat den Zöllner übergesetzt');
});
