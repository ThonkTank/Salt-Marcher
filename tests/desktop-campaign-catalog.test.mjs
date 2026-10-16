import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';import {createRequire} from 'node:module';import {buildSync} from 'esbuild';
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/campaign-catalog-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});const {CampaignStore}=createRequire(import.meta.url)('../.build/campaign-catalog-store.cjs');
function fixture(t){const root=mkdtempSync(path.join(tmpdir(),'campaign-catalog-')),file=path.join(root,'work.sqlite'),x={root,file,store:new CampaignStore(file)};t.after(()=>{x.store.close();rmSync(root,{recursive:true,force:true});});x.execute=a=>x.store.campaignCatalog({commandId:randomUUID(),...a});x.row=id=>x.store.campaignOverview().find(c=>c.id===id);return x;}
test('creation trims names, allows duplicate displays and replays the exact opening receipt without usage changes',t=>{const x=fixture(t),c={commandId:randomUUID(),kind:'create',name:'  Nordmark  '},a=x.store.campaignCatalog(c),b=x.execute({kind:'create',name:'Nordmark'});assert.notEqual(a.campaignId,b.campaignId);assert.equal(a.name,'Nordmark');assert.match(a.createdAt,/Z$/);assert.match(a.lastOpenedAt,/Z$/);const bytes=x.store.db.serialize();assert.deepEqual(x.store.campaignCatalog(c),a);assert.ok(x.store.db.serialize().equals(bytes));assert.equal(x.store.list().activeId,b.campaignId,'replay cannot reopen an old identity');assert.throws(()=>x.store.campaignCatalog({...c,name:'Andere'}),/anders/);assert.throws(()=>x.execute({kind:'create',name:' '.repeat(3)}),/1–100/);assert.throws(()=>x.execute({kind:'create',name:'x'.repeat(101)}),/1–100/);});
test('reads and restart preserve opening time; loading an accepted entry retries only the workspace',t=>{const x=fixture(t),a=x.execute({kind:'create',name:'A'}),before=x.store.db.serialize();x.store.list();x.store.campaignOverview();x.store.campaignInstallationSettings();x.store.campaignCatalogWorkspace(a.commandId);assert.ok(x.store.db.serialize().equals(before));x.store.close();x.store=new CampaignStore(x.file);const bytes=x.store.db.serialize();const workspace=x.store.campaignCatalogWorkspace(a.commandId);assert.equal(workspace.campaign.id,a.campaignId);assert.equal(x.row(a.campaignId).lastOpenedAt,a.lastOpenedAt);assert.ok(x.store.db.serialize().equals(bytes));});
test('inactive rename, active trash and restore preserve identity without choosing another campaign',t=>{const x=fixture(t),a=x.execute({kind:'create',name:'A'}),b=x.execute({kind:'create',name:'B'});x.execute({kind:'rename',id:a.campaignId,expectedRevision:0,name:'  Ein neuer Name  '});assert.equal(x.row(a.campaignId).name,'Ein neuer Name');assert.equal(x.row(a.campaignId).lastOpenedAt,a.lastOpenedAt);assert.equal(x.store.list().activeId,b.campaignId);x.execute({kind:'trash',id:b.campaignId,expectedRevision:x.row(b.campaignId).trashRevision,trashed:true});assert.equal(x.store.list().activeId,null);assert.equal(x.store.list().campaigns.length,1);x.execute({kind:'trash',id:b.campaignId,expectedRevision:x.row(b.campaignId).trashRevision,trashed:false});assert.equal(x.store.list().activeId,null);assert.equal(x.row(b.campaignId).lastOpenedAt,b.lastOpenedAt);assert.equal(x.row(b.campaignId).id,b.campaignId);});
test('permanent deletion requires exact display confirmation and its successful command is replayable',t=>{const x=fixture(t),a=x.execute({kind:'create',name:'Nordmark'});x.execute({kind:'trash',id:a.campaignId,expectedRevision:0,trashed:true});const c={commandId:randomUUID(),kind:'erase',id:a.campaignId,expectedRevision:1,confirmName:'nordmark'},before=x.store.db.serialize();assert.throws(()=>x.store.campaignCatalog(c),/exakten Namen/);assert.ok(x.store.db.serialize().equals(before));c.confirmName='Nordmark';const receipt=x.store.campaignCatalog(c);assert.equal(x.row(a.campaignId),undefined);assert.equal(x.store.list().activeId,null);const bytes=x.store.db.serialize();assert.deepEqual(x.store.campaignCatalog(c),receipt);assert.ok(x.store.db.serialize().equals(bytes));assert.deepEqual(x.store.db.pragma('foreign_key_check'),[]);});
test('catalog sorting uses last opening, creation and identity, leaving unknown historical usage honest',t=>{const x=fixture(t),a=x.execute({kind:'create',name:'Z'}),b=x.execute({kind:'create',name:'A'}),c=x.store.create('Historisch');x.store.db.prepare('DELETE FROM campaign_usage WHERE campaign_id=?').run(c.id);x.store.db.prepare('UPDATE campaign_usage SET last_opened_at=? WHERE campaign_id=?').run('2026-10-01T12:00:00.000Z',a.campaignId);x.store.db.prepare('UPDATE campaign_usage SET last_opened_at=? WHERE campaign_id=?').run('2026-10-02T12:00:00.000Z',b.campaignId);const list=x.store.campaignOverview();assert.deepEqual(list.map(c=>c.id),[b.campaignId,a.campaignId,c.id]);assert.equal(list[2].createdAt,null);assert.equal(list[2].lastOpenedAt,null);});
test('campaign archives exclude installation usage and identity receipts while keeping the source unchanged',async t=>{const x=fixture(t),a=x.execute({kind:'create',name:'A'});x.execute({kind:'create',name:'Private andere Kampagne'});const open=x.execute({kind:'open',id:a.campaignId}),w=x.store.campaignCatalogWorkspace(open.commandId),file=path.join(x.root,'packet.sqlite');await x.store.campaignSnapshot(w.token,file);const bytes=x.store.db.serialize(),Database=createRequire(import.meta.url)('better-sqlite3'),db=new Database(file,{readonly:true});try{assert.equal(db.prepare('SELECT count(*) n FROM campaign_catalog_receipt').get().n,0);assert.equal(db.prepare('SELECT count(*) n FROM campaign_usage').get().n,0);assert.equal(db.prepare('SELECT count(*) n FROM campaign').get().n,1);}finally{db.close();}assert.ok(x.store.db.serialize().equals(bytes));});

buildSync({entryPoints:['src/app/campaign-screen-ui.ts'],outfile:'.build/campaign-screen-ui.cjs',bundle:true,platform:'node',format:'cjs'});
test('campaign screen waits for explicit selection and keeps pending creation single until workspace retry',async t=>{
 const {parseHTML}=await import('linkedom'),{readFileSync}=await import('node:fs'),{window,document}=parseHTML(readFileSync('src/app/index.html','utf8')),previous={window:globalThis.window,document:globalThis.document};Object.assign(globalThis,{window,document});const memory=new Map();window.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};}const calls=[];let release,entries=0;window.campaign={campaignOverview:async()=>({ok:true,value:[{id:'active',name:'Bekannt',revision:0,trashed:false,trashRevision:0,rooms:0,locations:0,characters:0,maps:0,audio:0,lastOpenedAt:null,createdAt:null}]}),list:async()=>({ok:true,value:{activeId:'active',campaigns:[{id:'active',name:'Bekannt',revision:0}]}}),campaignCatalog:c=>{calls.push(c);return new Promise(r=>release=r);},campaignCatalogOutcome:async()=>({ok:true,value:null})};
 const req=createRequire(import.meta.url);delete req.cache[req.resolve('../.build/campaign-screen-ui.cjs')];const ui=req('../.build/campaign-screen-ui.cjs');t.after(()=>Object.assign(globalThis,previous));ui.initCampaignScreen({before:async()=>true,changed:async()=>{},enter:async()=>++entries>1});await ui.openCampaignScreen(true);assert.equal(calls.length,0);assert.equal(entries,0);assert.match(document.getElementById('campaign-screen-list').textContent,/nicht bekannt/);
 document.getElementById('campaign-screen-create').onclick();document.getElementById('campaign-identity-name').value='  Neue Kampagne  ';const submit=document.getElementById('campaign-identity-form').onsubmit;submit({preventDefault(){}});submit({preventDefault(){}});assert.equal(calls.length,1);assert.equal(calls[0].name,'Neue Kampagne');assert.equal(document.getElementById('campaign-identity-name').disabled,true);document.getElementById('campaign-identity-dialog').oncancel({preventDefault(){}});assert.equal(document.getElementById('campaign-identity-dialog').open,true);
 release({ok:true,value:{commandId:calls[0].commandId,kind:'create',campaignId:'new',name:'Neue Kampagne',lastOpenedAt:'2026-10-15T12:00:00.000Z',createdAt:'2026-10-15T12:00:00.000Z'}});for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));assert.equal(entries,1);assert.equal(document.getElementById('campaign-load-retry').hidden,false);document.getElementById('campaign-load-retry').onclick();for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));assert.equal(entries,2);assert.equal(calls.length,1);assert.equal(document.body.classList.contains('campaign-screen-open'),false);assert.equal(memory.size,0);
});

async function screenStorageFixture(t,hooks={}){
 const x=fixture(t),{parseHTML}=await import('linkedom'),{readFileSync}=await import('node:fs'),{window,document}=parseHTML(readFileSync('src/app/index.html','utf8')),previous={window:globalThis.window,document:globalThis.document},memory=new Map(),calls=[];Object.assign(globalThis,{window,document});t.after(()=>Object.assign(globalThis,previous));let rejectWrite=false,rejectRemove=false;
 window.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>{if(rejectWrite)throw Object.assign(new Error('Speicherquote erreicht'),{name:'QuotaExceededError'});memory.set(k,v);},removeItem:k=>{if(rejectRemove)throw new Error('Vermerk kann nicht entfernt werden');memory.delete(k);}};
 for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};}
 const response=fn=>{try{return{ok:true,value:fn()};}catch(e){return{ok:false,error:e.message};}};
 window.campaign={campaignOverview:async()=>response(()=>x.store.campaignOverview()),list:async()=>response(()=>x.store.list()),campaignCatalog:async c=>{calls.push(c);return response(()=>x.store.campaignCatalog(c));},campaignCatalogOutcome:async c=>response(()=>x.store.campaignCatalogOutcome(c))};
 const req=createRequire(import.meta.url);let entries=0;
 function init(){delete req.cache[req.resolve('../.build/campaign-screen-ui.cjs')];const ui=req('../.build/campaign-screen-ui.cjs');ui.initCampaignScreen({before:hooks.before??(async()=>true),changed:hooks.changed??(async()=>{}),enter:async r=>{x.store.campaignCatalogWorkspace(r.commandId);entries++;return hooks.enter?hooks.enter(r):true;}});return ui;}
 const ui=init();await ui.openCampaignScreen(true);const tick=async()=>{for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));};
 return{...x,window,document,memory,calls,init,ui,tick,get entries(){return entries;},rejectWrite:v=>rejectWrite=v,rejectRemove:v=>rejectRemove=v,newCampaign(name){document.getElementById('campaign-screen-create').onclick();document.getElementById('campaign-identity-name').value=name;document.getElementById('campaign-identity-form').onsubmit({preventDefault(){}});}};
}
test('an unwritable campaign intent journal reports no dispatch, keeps the name and allows an explicit retry',async t=>{
 const x=await screenStorageFixture(t);x.rejectWrite(true);x.newCampaign('Nur einmal');await x.tick();assert.equal(x.calls.length,0);assert.equal(x.store.list().campaigns.length,0);assert.equal(x.document.getElementById('campaign-identity-name').value,'Nur einmal');assert.equal(x.document.getElementById('campaign-identity-name').disabled,false);assert.match(x.document.getElementById('campaign-identity-status').textContent,/nicht gestartet.*Speicher.*voll/i);x.rejectWrite(false);x.document.getElementById('campaign-identity-form').onsubmit({preventDefault(){}});await x.tick();assert.equal(x.calls.length,1);assert.equal(x.store.list().campaigns.length,1);assert.equal(x.entries,1);assert.equal(x.memory.size,0);
});
test('a cleanup failure cannot hide a confirmed campaign and its retained intent resumes by reading the receipt',async t=>{
 const x=await screenStorageFixture(t);x.rejectRemove(true);x.newCampaign('Bestätigt');await x.tick();assert.equal(x.calls.length,1);assert.equal(x.entries,1);assert.equal(x.document.body.classList.contains('campaign-screen-open'),false);assert.equal(x.store.list().campaigns.length,1);assert.equal(x.memory.size,1);await x.ui.openCampaignScreen();assert.match(x.document.getElementById('campaign-screen-status').textContent,/Vermerk.*entfernt/i);x.rejectRemove(false);x.init();await x.tick();const before=x.store.db.serialize();const check=x.document.querySelector('[data-catalog-check]');check.onclick();await x.tick();assert.equal(x.calls.length,1,'recovery must read the existing receipt, never repeat creation');assert.equal(x.entries,2);assert.equal(x.memory.size,0);assert.equal(x.store.list().campaigns.length,1);assert.ok(x.store.db.serialize().equals(before),'receipt lookup/workspace retry must not create usage or campaign mutations');
});

test('returning to campaign selection removes stale opening and trash actions until the current catalog is known',async t=>{
 const x=await screenStorageFixture(t),get=id=>x.document.getElementById(id);
 x.newCampaign('Freitag');await x.tick();await x.ui.openCampaignScreen();
 const first=x.store.list().activeId;
 x.newCampaign('Sonntag');await x.tick();const current=x.store.list().activeId;
 assert.notEqual(current,first);assert.match(get('campaign-screen-list').textContent,/Freitag.*aktiv/);
 const read=x.window.campaign.campaignOverview;let reply;
 x.window.campaign.campaignOverview=()=>new Promise(resolve=>{reply=resolve;});
 const opening=x.ui.openCampaignScreen();await x.tick();
 assert.equal(get('campaign-screen-list').querySelectorAll('button').length,0,'old Fortsetzen must not remain actionable while the newly active campaign is loading');
 assert.equal(get('campaign-trash-list').querySelectorAll('button').length,0);assert.equal(get('campaign-screen-list').getAttribute('aria-busy'),'true');
 reply({ok:false,error:'Katalog derzeit nicht lesbar'});await opening;
 assert.equal(get('campaign-screen-list').querySelectorAll('button').length,0);assert.match(get('campaign-screen-list').textContent,/nicht geladen/);assert.match(get('campaign-screen-status').textContent,/nicht lesbar/);
 assert.equal(get('campaign-screen-list').getAttribute('aria-busy'),'false');assert.equal(get('campaign-screen-refresh').disabled,false);
 x.window.campaign.campaignOverview=async()=>({ok:false,error:'Katalog weiterhin nicht lesbar'});get('rename-campaign').onclick();await x.tick();
 assert.equal(get('campaign-identity-dialog').open,false,'Name ändern must not open a stale identity after a failed catalog read');
 x.window.campaign.campaignOverview=read;get('campaign-screen-refresh').onclick();await x.tick();
 assert.match(get('campaign-screen-status').textContent,/Kampagne wählen/);
 const card=get('campaign-screen-list').querySelector('[data-campaign-id="'+current+'"]');assert.match(card.textContent,/Sonntag.*aktiv/);
 const before=x.calls.length;card.querySelector('button').onclick();await x.tick();assert.equal(x.calls.length,before+1);assert.equal(x.calls.at(-1).id,current);assert.equal(x.store.list().activeId,current);
});

test('an older catalog completion cannot replace the latest failed read with old actions or success feedback',async t=>{
 const x=await screenStorageFixture(t),get=id=>x.document.getElementById(id),replies=[];
 x.window.campaign.campaignOverview=()=>new Promise(resolve=>replies.push(resolve));
 const old=x.ui.openCampaignScreen();await x.tick();const latest=x.ui.openCampaignScreen();await x.tick();
 replies[1]({ok:false,error:'Aktueller Katalog nicht lesbar'});await latest;
 replies[0]({ok:true,value:[]});await old;
 assert.match(get('campaign-screen-status').textContent,/Aktueller Katalog nicht lesbar/);assert.equal(get('campaign-screen-list').querySelectorAll('button').length,0);
 assert.equal(get('campaign-screen-list').getAttribute('aria-busy'),'false');
});

test('a campaign prepared only with world knowledge shows its retained content before and after trash',async t=>{
 const x=await screenStorageFixture(t);x.newCampaign('Wissensrunde');await x.tick();
 const w=x.store.campaignCatalogWorkspace(x.calls.at(-1).commandId),id=randomUUID(),note={version:1,id,revision:1,kind:'npc',title:'Fährfrau Ilse',readAloud:'',gmNotes:'Kennt den Schmugglerpfad.',relations:[],creatureId:null,deleted:false};
 x.store.changePreparation({commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,change:{kind:'note',note,expectedRevision:null}});
 const before=x.store.db.serialize(),row=x.row(w.campaign.id);assert.equal(row.notes,1);assert.equal(row.rooms+row.locations+row.characters,0);assert.ok(x.store.db.serialize().equals(before));
 await x.ui.openCampaignScreen();assert.match(x.document.getElementById('campaign-screen-list').textContent,/1 Wissenseintrag/);
 x.store.changePreparation({commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,change:{kind:'note-trash',id,expectedRevision:1,trashed:true}});
 assert.equal(x.row(w.campaign.id).notes,1,'archived authored data still belongs to the campaign');
 x.execute({kind:'trash',id:w.campaign.id,expectedRevision:0,trashed:true});await x.ui.openCampaignScreen();assert.match(x.document.getElementById('campaign-trash-list').textContent,/Wissensrunde.*1 Wissenseintrag/);
 x.execute({kind:'trash',id:w.campaign.id,expectedRevision:1,trashed:false});assert.equal(x.row(w.campaign.id).notes,1);
});

for(const recovery of [false,true])test(`accepted campaign ${recovery?'receipt recovery':'creation'} stays exclusive through shell and workspace loading`,async t=>{
 let releaseShell,releaseWorkspace;
 const x=await screenStorageFixture(t,{changed:()=>new Promise(r=>releaseShell=r),enter:()=>new Promise(r=>releaseWorkspace=r)}),get=id=>x.document.getElementById(id);let ui=x.ui;
 if(recovery){const command={commandId:randomUUID(),kind:'create',name:'Einmal'};x.store.campaignCatalog(command);x.memory.set('campaign-catalog-pending',JSON.stringify(command));ui=x.init();get('campaign-screen').querySelector('[data-catalog-check]').onclick();}
 else x.newCampaign('Einmal');
 await x.tick();const bytes=x.store.db.serialize(),commits=x.calls.length;
 assert.equal(get('campaign-identity-dialog').open,false,'confirmed identity editor closes even while the remaining transition is busy');
 assert.match(get('campaign-screen-status').textContent,/Öffnung bestätigt.*wird geladen/);
 assert.equal(await ui.openCampaignScreen(),false,'campaign navigation cannot reopen the catalog while the confirmed shell is still loading');
 get('campaign-screen-create').onclick();assert.equal(get('campaign-identity-dialog').open,false);assert.equal(get('campaign-screen-create').disabled,true);
 releaseShell();await x.tick();assert.equal(x.entries,1);
 assert.equal(await ui.openCampaignScreen(),false,'accepted workspace loading retains the same lock');
 assert.equal(get('campaign-load-retry').disabled,true);get('campaign-load-retry').onclick();await x.tick();assert.equal(x.entries,1);
 releaseWorkspace(false);await x.tick();assert.equal(get('campaign-load-retry').disabled,false);assert.match(get('campaign-screen-status').textContent,/Öffnung bestätigt/);
 get('campaign-load-retry').onclick();await x.tick();assert.equal(x.entries,2);assert.equal(await ui.openCampaignScreen(),false);
 releaseWorkspace(true);await x.tick();assert.equal(get('campaign-screen').hidden,true);assert.equal(x.calls.length,commits);assert.equal(x.store.list().campaigns.length,1);assert.ok(x.store.db.serialize().equals(bytes),'loading and retry cannot replay creation or update usage');
});
test('navigation waiting for draft flush cannot overtake a campaign command that started meanwhile',async t=>{
 let releaseBefore,releaseWorkspace;
 const x=await screenStorageFixture(t,{before:()=>new Promise(r=>releaseBefore=r),enter:()=>new Promise(r=>releaseWorkspace=r)});
 const navigation=x.ui.openCampaignScreen();x.newCampaign('Neue Runde');await x.tick();assert.equal(x.entries,1);
 releaseBefore(true);assert.equal(await navigation,false,'recheck busy after the asynchronous draft flush');
 assert.equal(x.document.getElementById('campaign-screen-create').disabled,true);
 releaseWorkspace(true);await x.tick();assert.equal(x.calls.length,1);assert.equal(x.document.getElementById('campaign-screen').hidden,true);
});
