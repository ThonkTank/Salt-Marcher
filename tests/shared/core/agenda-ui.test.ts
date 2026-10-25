import assert from 'node:assert/strict';
import test,{type TestContext} from 'node:test';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {parseHTML} from 'linkedom';
import {CampaignAgenda} from '../../../src/app/runtime/agenda-ui';
import type {CalendarEvent} from '../../../src/app/runtime/world-contracts';
import {activateWorld,initWorld} from '../../../src/app/runtime/world-ui';
import {CampaignStore} from '../../../src/app/storage/store';
import {newLocation} from '../../../src/features/location/location-schema';
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
async function until(check:()=>boolean){for(let i=0;i<40;i++){if(check())return;await tick();}assert.ok(check(),'expected agenda UI state');}
async function fixture(t:TestContext,worldDrain=async()=>true){
 const root=mkdtempSync(join(tmpdir(),'agenda-ui-')),store=new CampaignStore(join(root,'campaign.sqlite'));
 const campaign=store.create('Kalenderprobe'),workspace=store.activate(campaign.id),command=(action:any)=>({commandId:randomUUID(),campaignId:campaign.id,token:workspace.token,action});
 const {document,window}=parseHTML(readFileSync('src/app/workspace/index.html','utf8')),prior={document:globalThis.document,window:globalThis.window,HTMLInputElement:globalThis.HTMLInputElement,HTMLSelectElement:globalThis.HTMLSelectElement,HTMLTextAreaElement:globalThis.HTMLTextAreaElement,Option:globalThis.Option,Event:globalThis.Event};
 function Option(text='',value=''){const o=document.createElement('option');o.textContent=text;o.value=value;return o;}
 window.HTMLSelectElement.prototype.add=function(o:HTMLOptionElement){this.append(o);};
 const values=new WeakMap<object,string>();Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return values.get(this)??this.querySelector('option')?.value??'';},set(v:string){values.set(this,v);}});
 Object.assign(globalThis,{document,window,HTMLInputElement:window.HTMLInputElement,HTMLSelectElement:window.HTMLSelectElement,HTMLTextAreaElement:window.HTMLTextAreaElement,Option,Event:window.Event});
 store.executeLive(command({kind:'initialize',expectedRosterRevision:0}));
 const location=newLocation('north','Nordtor','poi',['description','notes']);store.changePreparation({...command(null),change:{kind:'location',expectedRevision:null,document:location}});
 const wrap=(f:()=>any)=>{try{return{ok:true,value:f()};}catch(e){return{ok:false,error:(e as Error).message};}};
 window.campaign={preparation:async(...a:any[])=>wrap(()=>store.preparation(a[0],a[1])),agenda:async(token,query)=>wrap(()=>store.agenda(token,query)),reconcileWorld:async(c,token)=>wrap(()=>store.reconcileWorld(c,token)),executeWorld:async c=>wrap(()=>store.executeWorld(c))} as typeof window.campaign;
 const messages:string[]=[];initWorld(s=>messages.push(s),worldDrain,async()=>{},async()=>{},async()=>{});activateWorld(workspace);
 const agenda=new CampaignAgenda(()=>workspace,async()=>true,s=>messages.push(s),async()=>{},async()=>{}),dialog=document.getElementById('campaign-agenda') as HTMLDialogElement;
 Object.defineProperty(dialog,'open',{value:false,writable:true});dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
 const el=(id:string)=>document.getElementById(id) as HTMLInputElement,click=(label:string)=>{const b=[...dialog.querySelectorAll('button')].find(b=>b.textContent===label) as HTMLButtonElement;assert.ok(b,label);b.onclick?.(new window.Event('click') as any);};
 t.after(()=>{agenda.reset();Object.assign(globalThis,prior);store.close();rmSync(root,{recursive:true,force:true});});
 const event={id:'market',revision:0,name:'Markt schließt',startMs:'3600012',durationMs:'60000',repeatMs:null,locationId:null,notes:'  Original\r\n',trashed:false};
 store.executeWorld(command({kind:'calendar-event',event,expectedRevision:null}));
 const open=async()=>{el('world-agenda-open').click();await until(()=>dialog.open&&el('agenda-status').textContent?.includes('Countdowns')===true);};await open();
 return{store,workspace,command,location,agenda,dialog,el,click,open,messages,event};
}
test('one calendar event editor preserves exact dates and notes, any location, trash and restoration',async t=>{
 const x=await fixture(t);assert.ok(!x.el('calendar-event-editor'));assert.ok(!x.el('event-new'));
 x.click('Ereignis bearbeiten');const select=x.el('agenda-location') as unknown as HTMLSelectElement;assert.ok([...select.options].some(o=>o.value===x.location.id));select.value=x.location.id;
 x.el('agenda-event-form').dispatchEvent(new Event('input'));x.el('agenda-event-form').dispatchEvent(new Event('submit',{cancelable:true}));await until(()=>x.store.world(x.workspace.token).events[0]?.revision===2);
 const saved=x.store.world(x.workspace.token).events[0]!;assert.equal(saved.startMs,x.event.startMs);assert.equal(saved.notes,x.event.notes);assert.equal(saved.locationId,x.location.id);
 await until(()=>x.el('agenda-status').textContent==='Ereignis gespeichert. Gruppenzeit und Position bleiben unverändert.');x.click('Ereignis bearbeiten');x.click('Ereignis in den Papierkorb');await until(()=>x.store.world(x.workspace.token).events[0]?.trashed===true);await until(()=>x.el('agenda-status').textContent==='Ereignis gespeichert. Gruppenzeit und Position bleiben unverändert.');
 x.el('agenda-trash').checked=true;x.el('agenda-trash').dispatchEvent(new Event('change'));await until(()=>!!x.el('agenda-list').querySelector('[data-event-id="market"]'));
 x.click('Ereignis bearbeiten');x.click('Ereignis wiederherstellen');await until(()=>x.store.world(x.workspace.token).events[0]?.trashed===false);
 const restored=x.store.world(x.workspace.token).events[0]!;assert.equal(restored.notes,x.event.notes);assert.equal(restored.startMs,x.event.startMs);assert.equal(restored.locationId,x.location.id);
});
test('a new agenda draft offers no inert trash action and cannot be discarded by reopening',async t=>{
 const x=await fixture(t);x.click('Neue Frist / Ereignis');const trash=[...x.dialog.querySelectorAll('button')].find(b=>b.textContent==='Ereignis in den Papierkorb')!;assert.equal(trash.hidden,true);
 x.el('agenda-name').value='Noch nicht gespeichert';x.el('world-agenda-open').click();await tick();assert.equal(x.el('agenda-name').value,'Noch nicht gespeichert');assert.match(x.el('agenda-status').textContent!,/zuerst speichern/);
 x.click('Eingaben verwerfen');x.click('Ereignis bearbeiten');assert.equal(trash.hidden,false);
});
test('closing during a pending open cancels its read without reopening the editor',async t=>{
 const x=await fixture(t);x.agenda.reset();let release!:(value:any)=>void;window.campaign.preparation=()=>new Promise(r=>release=r);
 x.el('world-agenda-open').click();await until(()=>!!release);x.agenda.reset();release({ok:true,value:x.store.preparation(x.workspace.token)});await tick();assert.equal(x.dialog.open,false);
});
test('refresh removes the clean editor before a delayed page can replace new input',async t=>{
 const x=await fixture(t);x.click('Ereignis bearbeiten');const read=window.campaign.agenda;let release!:(value:any)=>void;
 window.campaign.agenda=()=>new Promise(r=>release=r);x.click('Zeit und Agenda aktualisieren');await until(()=>!!release);
 assert.ok(!x.el('agenda-event-form'));assert.equal(x.el('agenda-list').children.length,0);
 release(await read(x.workspace.token,{sceneId:null,search:'',location:'all',horizonDays:5,includePast:false,after:null}));await tick();
});
test('a detached event row cannot replace the current document in a reopened agenda',async t=>{
 const x=await fixture(t),old=x.el('agenda-list').querySelector('button')!;x.agenda.reset();const current=x.store.world(x.workspace.token).events[0]!;
 x.store.executeWorld(x.command({kind:'calendar-event',event:{...current,name:'Neu bestätigter Titel'},expectedRevision:current.revision}));await x.open();
 old.onclick?.(new Event('click') as any);assert.match(x.el('agenda-document').textContent!,/Neu bestätigter Titel/);
});
test('an old save acknowledgement cannot replace the reopened editor draft',async t=>{
 const x=await fixture(t),execute=window.campaign.executeWorld;let release!:()=>void,seen=false;const held=new Promise<void>(r=>release=r);
 window.campaign.executeWorld=async c=>{const result=await execute(c);seen=true;await held;return result;};
 x.click('Ereignis bearbeiten');x.el('agenda-name').value='Gespeicherter Auftrag';x.el('agenda-event-form').dispatchEvent(new Event('submit',{cancelable:true}));await until(()=>seen);
 x.agenda.reset();await x.open();x.click('Neue Frist / Ereignis');x.el('agenda-name').value='Neuer Rohentwurf';release();for(let i=0;i<12;i++)await tick();
 assert.equal(x.el('agenda-name')?.value,'Neuer Rohentwurf');assert.equal(x.el('agenda-name').disabled,false);
});

test('an unknown event save is reconciled from its receipt without resending or losing later input',async t=>{
 const x=await fixture(t),execute=window.campaign.executeWorld;let writes=0;
 window.campaign.executeWorld=async c=>{writes++;await execute(c);throw new Error('Antwort verloren');};
 x.click('Ereignis bearbeiten');x.el('agenda-name').value='Bestätigtes Ereignis';x.el('agenda-event-form').dispatchEvent(new Event('submit',{cancelable:true}));
 await until(()=>x.el('agenda-status').textContent?.includes('Eingaben bleiben erhalten')===true);x.el('agenda-name').value='Spätere eigene Eingabe';x.click('Speicherauftrag prüfen');
 await until(()=>x.el('agenda-status').textContent?.includes('Speicherauftrag bestätigt')===true);
 assert.equal(x.el('agenda-name').value,'Spätere eigene Eingabe');assert.equal(writes,1);assert.equal(x.store.world(x.workspace.token).events[0]?.name,'Bestätigtes Ereignis');
});

test('a confirmed save recovery can close directly without saving the same event again',async t=>{
 const x=await fixture(t),execute=window.campaign.executeWorld;let writes=0;
 window.campaign.executeWorld=async c=>{writes++;await execute(c);throw new Error('Antwort verloren');};
 x.click('Ereignis bearbeiten');x.el('agenda-name').value='Bestätigtes Ereignis';x.el('agenda-event-form').dispatchEvent(new Event('submit',{cancelable:true}));
 await until(()=>x.el('agenda-status').textContent?.includes('Eingaben bleiben erhalten')===true);x.click('Speicherauftrag prüfen');
 await until(()=>x.el('agenda-status').textContent?.includes('Speicherauftrag bestätigt')===true);x.click('Schließen');
 assert.equal(x.dialog.open,false);assert.equal(writes,1);
});
test('equivalent duration units do not require a redundant save',async t=>{
 const x=await fixture(t);x.click('Ereignis bearbeiten');x.el('agenda-duration').value='60';x.el('agenda-duration-unit').value='second';x.el('agenda-event-form').dispatchEvent(new Event('input'));x.click('Schließen');assert.equal(x.dialog.open,false);
});
test('equivalent date spelling preserves the exact instant without a redundant save',async t=>{
 const x=await fixture(t);x.click('Ereignis bearbeiten');x.el('agenda-year').value='001';x.el('agenda-hour').value='01';x.el('agenda-event-form').dispatchEvent(new Event('input'));x.click('Schließen');
 assert.equal(x.dialog.open,false);assert.equal(x.store.world(x.workspace.token).events[0]?.startMs,x.event.startMs);
});
test('typing during a save preserves newer raw input and advances only the confirmed event revision',async t=>{
 const x=await fixture(t),execute=window.campaign.executeWorld;let release!:()=>void,seen=false;const held=new Promise<void>(r=>release=r);
 window.campaign.executeWorld=async c=>{const result=await execute(c);seen=true;await held;return result;};
 x.click('Ereignis bearbeiten');x.el('agenda-name').value='Gesendeter Name';x.el('agenda-event-form').dispatchEvent(new Event('submit',{cancelable:true}));await until(()=>seen);
 assert.equal(x.el('agenda-name').disabled,false);x.el('agenda-name').value='Danach eingegeben';release();await until(()=>x.el('agenda-status').textContent?.includes('Spätere Eingaben bleiben offen')===true);
 assert.equal(x.el('agenda-name').value,'Danach eingegeben');assert.equal(x.store.world(x.workspace.token).events[0]?.name,'Gesendeter Name');
 window.campaign.executeWorld=execute;x.el('agenda-event-form').dispatchEvent(new Event('submit',{cancelable:true}));await until(()=>x.store.world(x.workspace.token).events[0]?.revision===3);
 assert.equal(x.store.world(x.workspace.token).events[0]?.name,'Danach eingegeben');
});
test('failed receipt reads can be retried while resending and closing remain blocked',async t=>{
 const x=await fixture(t),execute=window.campaign.executeWorld,reconcile=window.campaign.reconcileWorld;let writes=0,reads=0;
 window.campaign.executeWorld=async c=>{writes++;await execute(c);throw new Error('Antwort verloren');};
 x.click('Ereignis bearbeiten');x.el('agenda-name').value='Ein Originalauftrag';x.el('agenda-event-form').dispatchEvent(new Event('submit',{cancelable:true}));await until(()=>x.el('agenda-status').textContent?.includes('Eingaben bleiben erhalten')===true);
 window.campaign.reconcileWorld=async()=>{reads++;throw new Error('Lesefehler');};x.click('Speicherauftrag prüfen');await until(()=>x.el('agenda-status').textContent?.includes('Speicherauftrag bleibt ungeklärt')===true);assert.ok(x.messages.some(message=>message.includes('Lesefehler')));await tick();
 assert.ok([...x.el('agenda-status').querySelectorAll('button')].some(b=>b.textContent==='Speicherauftrag prüfen'));x.el('agenda-event-form').dispatchEvent(new Event('submit',{cancelable:true}));x.click('Eingaben verwerfen');assert.equal(x.el('agenda-name').value,'Ein Originalauftrag');x.click('Schließen');assert.equal(x.dialog.open,true);assert.equal(writes,1);
 const database=(x.store as unknown as {db:{serialize:()=>Buffer}}).db,before=database.serialize();window.campaign.reconcileWorld=reconcile;x.click('Speicherauftrag prüfen');await until(()=>x.el('agenda-status').textContent?.includes('Speicherauftrag bestätigt')===true);x.click('Schließen');
 assert.equal(x.dialog.open,false);assert.equal(writes,1);assert.equal(reads,1);assert.ok(database.serialize().equals(before));
});
test('time rebase rejects another group and preserves the original relative time basis',async t=>{
 const x=await fixture(t),agenda=window.campaign.agenda,execute=window.campaign.executeWorld,original=x.store.live(x.workspace.token).scene!;
 x.click('Neue Frist / Ereignis');x.el('agenda-name').value='Gruppenfrist';window.campaign.executeWorld=async()=>({ok:false,error:'Zeitkonflikt'});x.el('agenda-event-form').dispatchEvent(new Event('submit',{cancelable:true}));await until(()=>x.el('agenda-status').textContent?.includes('Zeitkonflikt')===true);
 window.campaign.agenda=async(token,query)=>{const result=await agenda(token,query);assert.ok(result.ok);return{ok:true,value:{...result.value,scene:{...result.value.scene!,id:'andere-gruppe',clockRevision:100,instantMs:'90000000'}}};};
 x.click('Nur Zeitbasis und Vorschau aktualisieren');await until(()=>x.el('agenda-status').textContent?.includes('Zeitantwort gehört nicht')===true);await tick();
 let basis:any;window.campaign.executeWorld=async c=>{if(c.action.kind==='calendar-event')basis=c.action.basis;return execute(c);};x.el('agenda-event-form').dispatchEvent(new Event('submit',{cancelable:true}));await until(()=>!!basis);
 assert.equal(basis.sceneId,original.id);assert.equal(basis.clockRevision,original.clock.revision);assert.equal(basis.instantMs,original.clock.instantMs);
});
test('reset during world flush cancels an event write before it reaches SQLite',async t=>{
 let release!:(value:boolean)=>void;const x=await fixture(t,()=>new Promise(r=>release=r)),execute=window.campaign.executeWorld;let writes=0;
 window.campaign.executeWorld=async c=>{writes++;return execute(c);};x.click('Ereignis bearbeiten');x.el('agenda-name').value='Alter Auftrag';x.el('agenda-event-form').dispatchEvent(new Event('submit',{cancelable:true}));await until(()=>!!release);
 x.agenda.reset();await x.open();x.click('Neue Frist / Ereignis');x.el('agenda-name').value='Neuer Entwurf';release(true);for(let i=0;i<12;i++)await tick();
 assert.equal(writes,0);assert.equal(x.el('agenda-name').value,'Neuer Entwurf');assert.equal(x.store.world(x.workspace.token).events[0]?.revision,1);
});

test('location deadlines use the existing editor and cannot discard its open input',async t=>{
 const x=await fixture(t),event=x.store.world(x.workspace.token).events[0]!;
 x.store.executeWorld(x.command({kind:'calendar-event',event:{...event,locationId:x.location.id},expectedRevision:event.revision}));
 await x.agenda.openForLocation(x.location.id,'Nordtor',event.id);assert.match(x.el('agenda-document').textContent!,/Markt schließt/);
 x.click('Ereignis bearbeiten');x.el('agenda-name').value='Offene Änderung';x.el('agenda-event-form').dispatchEvent(new Event('input'));
 await x.agenda.openForLocation(x.location.id,'Nordtor',undefined,true);assert.equal(x.el('agenda-name').value,'Offene Änderung');assert.match(x.el('agenda-status').textContent!,/zuerst speichern/);
 x.click('Eingaben verwerfen');await x.agenda.openForLocation(x.location.id,'Nordtor',undefined,true);assert.equal(x.el('agenda-location').value,x.location.id);
 const clock=x.store.live(x.workspace.token).scene!.clock.instantMs;x.el('agenda-name').value='Wachwechsel';x.el('agenda-event-form').dispatchEvent(new Event('input'));x.el('agenda-event-form').dispatchEvent(new Event('submit',{cancelable:true}));await until(()=>x.store.world(x.workspace.token).events.some((e:CalendarEvent)=>e.name==='Wachwechsel'));
 assert.equal(x.store.live(x.workspace.token).scene!.clock.instantMs,clock);const materials=x.store.locationMaterials(x.workspace.token,{locationId:x.location.id,kind:'event',text:'',offset:0});assert.equal(materials.items.length,2);
});

test('typing a new agenda search immediately revokes its previous event actions',async t=>{
 const x=await fixture(t),old=[...x.dialog.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Ereignis bearbeiten')!;
 assert.ok(old);x.el('agenda-search').value='Neue Suche';x.el('agenda-search').dispatchEvent(new Event('input'));
 assert.equal(x.el('agenda-list').querySelectorAll('button').length,0);assert.equal(x.el('agenda-document').textContent,'');
 old.onclick?.(new Event('click') as any);assert.equal(x.el('agenda-event-form'),null);
});

test('a moment deadline opens raw author text as a draft and cannot replace an existing dirty deadline',async t=>{
 const x=await fixture(t),before=x.store.world(x.workspace.token).events,clock=x.store.live(x.workspace.token).scene!.clock;
 await x.agenda.openMomentDraft({name:'Verstärkung',notes:'  Rohtext\r\n- Morgen  '},{id:x.location.id,title:x.location.name});
 assert.equal(x.el('agenda-name').value,'Verstärkung');assert.equal(x.el('agenda-notes').value,'  Rohtext\r\n- Morgen  ');assert.equal(x.el('agenda-start-mode').value,'relative');
 await x.agenda.openMomentDraft({name:'Späterer Moment',notes:'Nicht überschreiben'});assert.equal(x.el('agenda-name').value,'Verstärkung');
 assert.deepEqual(x.store.world(x.workspace.token).events,before);assert.deepEqual(x.store.live(x.workspace.token).scene!.clock,clock);
});

test('a saved deadline stays selected beyond the old horizon and the first forty rows',async t=>{
 const x=await fixture(t),before=x.store.live(x.workspace.token).scene!.clock;
 for(let i=0;i<41;i++)x.store.executeWorld(x.command({kind:'calendar-event',event:{...x.event,id:'near-'+i,name:'Andere Frist '+i,startMs:String(1000+i),revision:0},expectedRevision:null}));
 const originals=structuredClone(x.store.world(x.workspace.token).events),queries:any[]=[],read=window.campaign.agenda;
 window.campaign.agenda=async(token,q)=>{queries.push(q);return read(token,q);};
 x.click('Neue Frist / Ereignis');x.el('agenda-name').value='Ferne Frist';x.el('agenda-offset').value='6';x.el('agenda-offset-unit').value='day';x.el('agenda-notes').value='Unverändertes Original';
 x.el('agenda-event-form').dispatchEvent(new Event('submit',{cancelable:true}));await until(()=>x.el('agenda-status').textContent?.includes('Ereignis gespeichert.')===true);
 const event=x.store.world(x.workspace.token).events.find((e:CalendarEvent)=>e.name==='Ferne Frist')!;assert.ok(event);
 assert.equal(x.el('agenda-list').querySelectorAll('[data-event-id]').length,1);assert.equal(x.el('agenda-list').querySelector('[aria-pressed=true]')?.getAttribute('data-event-id'),event.id);
 assert.match(x.el('agenda-document').textContent!,/Ferne Frist/);assert.match(x.dialog.textContent!,/Einzelansicht/);
 assert.equal(queries.at(-1).eventId,event.id);assert.equal(queries.at(-1).horizonDays,null);assert.equal(queries.at(-1).search,'');
 assert.deepEqual(x.store.live(x.workspace.token).scene!.clock,before);assert.deepEqual(x.store.world(x.workspace.token).events.filter((e:CalendarEvent)=>e.id!==event.id),originals);
 x.click('Ereignis bearbeiten');assert.equal(x.el('agenda-notes').value,event.notes);x.click('Eingaben verwerfen');
 x.click('Zeit und Agenda aktualisieren');await until(()=>x.el('agenda-list').querySelectorAll('[data-event-id]').length===40);
 assert.equal(queries.at(-1).eventId,undefined);assert.doesNotMatch(x.dialog.textContent!,/Einzelansicht/);
});

test('saving an event moved outside its location keeps the same identity through trash and restore',async t=>{
 const x=await fixture(t),current=x.store.world(x.workspace.token).events[0]!;
 x.store.executeWorld(x.command({kind:'calendar-event',event:{...current,locationId:x.location.id},expectedRevision:current.revision}));
 x.agenda.reset();await x.agenda.openForLocation(x.location.id,'Nordtor',x.event.id);x.click('Ereignis bearbeiten');
 x.el('agenda-location').value='';x.el('agenda-name').value='Umbenannter Termin';x.el('agenda-notes').value='Neue Ortsentscheidung';
 x.el('agenda-event-form').dispatchEvent(new Event('submit',{cancelable:true}));await until(()=>x.el('agenda-status').textContent?.includes('Ereignis gespeichert.')===true);
 assert.equal(x.el('agenda-list').querySelector('[aria-pressed=true]')?.getAttribute('data-event-id'),x.event.id);assert.match(x.el('agenda-document').textContent!,/Umbenannter Termin/);assert.equal(x.el('agenda-location-filter').value,'all');
 x.click('Ereignis bearbeiten');x.click('Ereignis in den Papierkorb');await until(()=>x.store.world(x.workspace.token).events[0]!.trashed);
 await until(()=>x.el('agenda-status').textContent?.includes('Ereignis gespeichert.')===true);assert.equal(x.el('agenda-trash').checked,true);assert.match(x.el('agenda-document').textContent!,/Umbenannter Termin/);
 x.click('Ereignis bearbeiten');x.click('Ereignis wiederherstellen');await until(()=>!x.store.world(x.workspace.token).events[0]!.trashed);
 await until(()=>x.el('agenda-status').textContent?.includes('Ereignis gespeichert.')===true);assert.equal(x.el('agenda-trash').checked,false);
 const saved=x.store.world(x.workspace.token).events[0]!;assert.equal(saved.id,x.event.id);assert.equal(saved.locationId,null);assert.equal(saved.startMs,x.event.startMs);assert.equal(saved.notes,'Neue Ortsentscheidung');
});
