import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,rmSync,readdirSync,readFileSync,writeFileSync,existsSync,symlinkSync,lstatSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import {buildSync} from './helpers/build.mjs';
const root=path.resolve('.build/A0.16-'+process.pid);mkdirSync(root,{recursive:true});
const build=(contents,outfile)=>buildSync({stdin:{contents,resolveDir:process.cwd()},outfile:path.join(root,outfile),bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
build("export {CampaignStore} from './src/app/storage/store';export {StoreClient} from './desktop/store-client';export {finishCampaignErasure} from './desktop/campaign-erasure';export {AtlasCommitProjectionError} from './src/app/storage/atlas-commit-projection';",'store.cjs');
build("require('./desktop/store-worker');",'store-worker.cjs');
build("require('./desktop/backup-validation-worker');",'backup-validation-worker.cjs');
const {CampaignStore,StoreClient,finishCampaignErasure,AtlasCommitProjectionError}=createRequire(import.meta.url)(path.join(root,'store.cjs'));
const target=s=>({kind:'graph-preview',previewId:s.id,scopeId:s.scopeId,revision:s.revision});
const wrap=c=>({...c,action:{kind:c.action.kind==='accept'?'graph-accept':'graph-preview',command:c}});
const ref=(c,token)=>({...wrap(c),token});
const digest=file=>{const db=new Database(file,{readonly:true,fileMustExist:true});try{return createHash('sha256').update(db.serialize()).digest('hex');}finally{db.close();}};
function fixture(t){
 const dir=mkdtempSync(path.join(tmpdir(),'A016-preview-')),filename=path.join(dir,'workbench.sqlite'),stores=[],clients=[];
 const open=()=>{const store=new CampaignStore(filename);stores.push(store);return store;};
 t.after(async()=>{for(const client of clients)await client.close();for(const store of stores)if(store.db.open)store.close();rmSync(dir,{recursive:true,force:true});});
 const store=open(),room={id:randomUUID(),scopeId:'local',floorId:'ground',number:'1',name:'Original',revision:0,polygons:[{outer:[{x:0,y:0},{x:6,y:0},{x:6,y:6},{x:0,y:6}],holes:[]}],sections:[]},campaign=store.create('Persistent preview',[room]),shell=store.activateShell(campaign.id),owner={campaignId:campaign.id,token:shell.token};
 const graph=(action,state)=>({...owner,commandId:randomUUID(),scopeId:'local',target:state?target(state):{kind:'graph-preview',previewId:randomUUID(),scopeId:'local',revision:0},action});
 const client=async mode=>{const c=new StoreClient(filename,'development',path.join(root,mode?mode+'.cjs':'store-worker.cjs'));clients.push(c);await c.ready;return c;};
 return{dir,filename,store,open,client,room,owner,graph};
}
function fault(mode){
 const before=mode==='local-before',after=mode==='local-after';
 build(`import {CampaignStore} from './src/app/storage/store';import {GraphPreviewCommands} from './src/app/storage/graph-preview-commands';
 const mode=${JSON.stringify(mode)};
 const fs=require('node:fs'),mkdir=fs.mkdirSync;fs.mkdirSync=function(dir,...args){if(mode==='creation-before-file'&&require('node:path').dirname(String(dir)).endsWith('.graph-previews'))process.exit(66);return mkdir.call(this,dir,...args);};
 const remove=fs.rmSync;fs.rmSync=function(file,...args){const value=remove.call(this,file,...args);if(mode==='retirement-mid-cleanup'&&require('node:path').dirname(String(file)).endsWith('.graph-previews')&&require('node:path').basename(String(file)).match(/^[a-f0-9-]{36}$/))process.exit(67);return value;};
 const execute=GraphPreviewCommands.prototype.execute;
 GraphPreviewCommands.prototype.execute=function(...args){if(${before})process.exit(61);const value=execute.apply(this,args);if(${after})process.exit(62);return value;};
 const lifecycle=CampaignStore.prototype.graphLifecycle;
 CampaignStore.prototype.graphLifecycle=function(...args){const value=lifecycle.apply(this,args);if(mode==='retirement-before-commit')process.exit(63);return value;};
 const retire=CampaignStore.prototype.retireGraphPreview;
 CampaignStore.prototype.retireGraphPreview=function(...args){if(mode==='retirement-before-cleanup')process.exit(64);const value=retire.apply(this,args);if(mode==='retirement-after-cleanup')process.exit(65);return value;};
 require('./desktop/store-worker');`,mode+'.cjs');
}
for(const mode of ['creation-before-file','local-before','local-after','retirement-before-commit','retirement-before-cleanup','retirement-mid-cleanup','retirement-after-cleanup'])fault(mode);

test('ordered close reopens the original basis, ID, phase, revision, rows, history and receipts without an ID supplied to the new store',t=>{
 const x=fixture(t),c=x.graph({kind:'graph-move',roomIds:[x.room.id],dxSteps:2,dySteps:0}),canonical=digest(x.filename);
 x.store.executeGraph(c);x.store.executeGraph(x.graph({kind:'raster'},x.store.graphShadow.state()));
 const edit={...x.owner,commandId:randomUUID(),target:target(x.store.graphShadow.state()),roomId:x.room.id,expectedRevision:1,name:'Kept locally',polygons:x.store.atlasRoom(x.owner.token,x.room.id).polygons,sections:[]};x.store.atlasRoomCommit(edit);
 const local=x.store.graphShadow,basis=local.basis,state=local.state(),file=local.db.name,bytes=digest(file),original=x.store.workspace();
 assert.equal(digest(x.filename),canonical);x.store.close();assert(existsSync(file));
 const next=x.open(),w=next.activateShell(x.owner.campaignId);assert.notEqual(w.token,x.owner.token);assert.deepEqual(w.graphPreview,state);assert.equal(next.graphShadow.basis,basis);assert.equal(digest(file),bytes);assert.deepEqual(next.workspace().rooms,original.rooms);
 assert.equal(next.reconcileAtlasCommit(ref(c,w.token)).outcome,'applied');
 assert.equal(next.reconcileAtlasCommit({...edit,token:w.token,action:{kind:'room-edit',edit}}).outcome,'applied');
 next.executeAtlasCommit({campaignId:x.owner.campaignId,token:w.token,commandId:randomUUID(),target:target(next.graphShadow.state()),action:{kind:'undo'}});assert.equal(next.atlasRoom(w.token,x.room.id).name,'Original');
 next.executeAtlasCommit({campaignId:x.owner.campaignId,token:w.token,commandId:randomUUID(),target:target(next.graphShadow.state()),action:{kind:'redo'}});assert.equal(next.atlasRoom(w.token,x.room.id).name,'Kept locally');
});

for(const [mode,code,expected]of [['local-before',61,'not-applied'],['local-after',62,'applied']])test(`real worker ${mode} preserves the first preview and its definitive receipt state on a fresh worker`,async t=>{
 const x=fixture(t);x.store.close();const worker=await x.client(mode),shell=await worker.activateShell(x.owner.campaignId),c={...x.graph({kind:'graph-move',roomIds:[x.room.id],dxSteps:2,dySteps:0}),token:shell.token};
 await assert.rejects(worker.executeGraph(c),/Speicherbestätigung ungeklärt/);assert.deepEqual(await worker.close(),{databaseClosed:false,exitCode:code});
 const fresh=await x.client(),w=await fresh.activateShell(x.owner.campaignId);assert.equal(w.graphPreview.id,c.target.previewId);assert.equal(w.graphPreview.revision,expected==='applied'?1:0);
 assert.equal((await fresh.reconcileAtlasCommit(ref(c,w.token))).outcome,expected);assert.equal((await fresh.reconcileAtlasCommit(ref(c,w.token))).outcome,expected);
 const view=await fresh.dungeonAuthoring(w.token);assert.equal(view.rooms[0].polygons[0].outer[0].x,expected==='applied'?3.048:0);
 assert.deepEqual(await fresh.close(),{databaseClosed:true,exitCode:0});
});

for(const action of ['accept','restore'])for(const [mode,code,committed]of [['retirement-before-commit',63,false],['retirement-before-cleanup',64,true],['retirement-mid-cleanup',67,true],['retirement-after-cleanup',65,true]])test(`${action}: real worker exit ${mode} retains exactly the committed owner and cleanup is restartable`,async t=>{
 const x=fixture(t),start=x.graph({kind:'graph-move',roomIds:[x.room.id],dxSteps:2,dySteps:0});x.store.executeGraph(start);x.store.executeGraph(x.graph({kind:'raster'},x.store.graphShadow.state()));const local=x.store.graphShadow.db.name,state=x.store.graphShadow.state();x.store.close();
 const worker=await x.client(mode),shell=await worker.activateShell(x.owner.campaignId),c={...x.graph({kind:action},shell.graphPreview),token:shell.token};
 await assert.rejects(worker.executeGraph(c),/Speicherbestätigung ungeklärt/);assert.deepEqual(await worker.close(),{databaseClosed:false,exitCode:code});
 const fresh=await x.client(),w=await fresh.activateShell(x.owner.campaignId);
 assert.deepEqual(w.graphPreview,committed?undefined:state);assert.equal(existsSync(local),!committed);
 assert.equal((await fresh.reconcileAtlasCommit(ref(c,w.token))).outcome,committed?'applied':'not-applied');
 assert.equal((await fresh.reconcileAtlasCommit(ref(c,w.token))).outcome,committed?'applied':'not-applied');
 const db=new Database(x.filename,{readonly:true});try{const row=db.prepare('SELECT payload FROM room WHERE id=?').get(x.room.id),root=db.prepare('SELECT revision,cursor FROM campaign_atlas WHERE campaign_id=?').get(x.owner.campaignId);assert.equal(JSON.parse(row.payload).polygons[0].outer[0].x,action==='accept'&&committed?3.048:0);assert.equal(root.revision,action==='accept'&&committed?1:0);assert.equal(root.cursor,action==='accept'&&committed?1:0);}finally{db.close();}
 if(committed){const newCommand={...x.graph({kind:'raster'}),token:w.token};const created=await fresh.executeGraph(newCommand);assert.equal(created.workspace.graphPreview.id,newCommand.target.previewId);assert.notEqual(created.workspace.graphPreview.id,state.id);}
 assert.deepEqual(await fresh.close(),{databaseClosed:true,exitCode:0});
});

for(const corruption of ['missing-file','missing-pointer','missing-meta','wrong-preview','wrong-profile','bad-basis','bad-phase'])test(`reopening ${corruption} never silently creates or replaces a preview`,t=>{
 const x=fixture(t);x.store.executeGraph(x.graph({kind:'raster'}));const file=x.store.graphShadow.db.name,active=path.join(x.filename+'.graph-previews','active.json');x.store.close();
 if(corruption==='missing-file')rmSync(file);
 else if(corruption==='missing-pointer')rmSync(active);
 else if(corruption==='wrong-profile'){const v=JSON.parse(readFileSync(active));v.profileId=randomUUID();writeFileSync(active,JSON.stringify(v));}
 else{const db=new Database(file);if(corruption==='missing-meta')db.exec('DELETE FROM preview_meta');else if(corruption==='wrong-preview')db.prepare('UPDATE preview_meta SET id=?').run(randomUUID());else if(corruption==='bad-basis')db.prepare("UPDATE settings SET value=? WHERE key='graph-preview-basis'").run('bad');else db.exec("UPDATE preview_meta SET phase='invalid'");db.close();}
 const before=existsSync(file)?readFileSync(file):null,entries=readdirSync(x.filename+'.graph-previews');assert.throws(()=>x.open(),/Vorschau|Graph/);assert.deepEqual(existsSync(file)?readFileSync(file):null,before);assert.equal(existsSync(active),corruption!=='missing-pointer');assert.deepEqual(readdirSync(x.filename+'.graph-previews'),entries);
});

test('a changed canonical basis is never adopted as the preview basis; explicit Restore remains available',t=>{
 const x=fixture(t);x.store.executeGraph(x.graph({kind:'raster'}));const original=x.store.graphShadow.basis;x.store.close();
 const db=new Database(x.filename);db.prepare('UPDATE room SET name=? WHERE id=?').run('Changed canonically',x.room.id);db.close();
 const next=x.open(),shell=next.activateShell(x.owner.campaignId);assert.equal(next.graphShadow.basis,original);
 const c={...x.graph({kind:'graph-move',roomIds:[x.room.id],dxSteps:1,dySteps:0},shell.graphPreview),token:shell.token};assert.throws(()=>next.executeGraph(c),/Dungeonquelle/);
 assert.throws(()=>next.executeGraph({...c,commandId:randomUUID(),action:{kind:'accept'}}),/Dungeonquelle/);
 next.executeGraph({...c,commandId:randomUUID(),action:{kind:'restore'}});assert.equal(next.graphShadow,null);assert.equal(next.atlasRoom(shell.token,x.room.id).name,'Changed canonically');
});

test('Restore retirement survives file deletion and a later preview without replay or identity aliasing',t=>{
 const x=fixture(t);x.store.executeGraph(x.graph({kind:'raster'}));const restore=x.graph({kind:'restore'},x.store.graphShadow.state()),file=x.store.graphShadow.db.name;x.store.executeGraph(restore);assert(!existsSync(file));x.store.close();
 const next=x.open(),w=next.activateShell(x.owner.campaignId);assert.equal(next.reconcileAtlasCommit(ref(restore,w.token)).outcome,'applied');
 const newer={...x.graph({kind:'raster'}),token:w.token};next.executeGraph(newer);const state=next.graphShadow.state();assert.equal(next.reconcileAtlasCommit(ref(restore,w.token)).outcome,'applied');assert.deepEqual(next.graphShadow.state(),state);
 assert.throws(()=>next.reconcileAtlasCommit({...ref(restore,w.token),action:{kind:'graph-preview',command:{...restore,action:{kind:'raster'}}}}),/anders verwendet/);
});


test('worker loss after the durable active pointer but before SQLite creation fails closed on restart',async t=>{
 const x=fixture(t);x.store.close();const worker=await x.client('creation-before-file'),shell=await worker.activateShell(x.owner.campaignId),c={...x.graph({kind:'raster'}),token:shell.token};
 await assert.rejects(worker.executeGraph(c),/Speicherbestätigung ungeklärt/);assert.deepEqual(await worker.close(),{databaseClosed:false,exitCode:66});
 const active=path.join(x.filename+'.graph-previews','active.json'),bytes=readFileSync(active);assert.equal(JSON.parse(bytes).previewId,c.target.previewId);
 assert.throws(()=>x.open(),/Graphvorschau fehlt/);assert.deepEqual(readFileSync(active),bytes);assert(!existsSync(path.join(x.filename+'.graph-previews',c.target.previewId,'preview.sqlite')));
});

test('a lifecycle marker without its atomically committed Accept receipt cannot delete a preview',t=>{
 const x=fixture(t);x.store.executeGraph(x.graph({kind:'raster'}));const shadow=x.store.graphShadow,file=shadow.db.name,state=shadow.state(),profile=JSON.parse(readFileSync(path.join(x.filename+'.graph-previews','profile.json')));
 x.store.db.prepare('INSERT INTO settings VALUES(?,?)').run('graph-preview-lifecycle:'+x.owner.campaignId+':'+state.id,JSON.stringify({version:1,profileId:profile.id,campaignId:x.owner.campaignId,previewId:state.id,scopeId:state.scopeId,revision:state.revision,status:'accepted',commandId:randomUUID(),fingerprint:'0'.repeat(64)}));x.store.close();
 const bytes=readFileSync(file);assert.throws(()=>x.open(),/Übernahmebeleg fehlt/);assert.deepEqual(readFileSync(file),bytes);
});

test('full Main backups never reopen or delete another profile; campaign snapshots omit lifecycle markers and local preview paths',async t=>{
 const x=fixture(t);x.store.executeGraph(x.graph({kind:'raster'}));const restore=x.graph({kind:'restore'},x.store.graphShadow.state());x.store.executeGraph(restore);
 x.store.executeGraph(x.graph({kind:'graph-move',roomIds:[x.room.id],dxSteps:2,dySteps:0}));const file=x.store.graphShadow.db.name,state=x.store.graphShadow.state(),before=digest(file),backup=path.join(x.dir,'recovery.sqlite'),snapshot=path.join(x.dir,'campaign.sqlite');
 await x.store.backup(backup);await x.store.campaignSnapshot(x.owner.token,snapshot);
 const foreign=new CampaignStore(backup);try{const w=foreign.activateShell(x.owner.campaignId);assert.equal(w.graphPreview,undefined);assert.equal(foreign.reconcileAtlasCommit(ref(restore,w.token)).outcome,'unknown');assert.equal(foreign.atlasRoom(w.token,x.room.id).polygons[0].outer[0].x,0);}finally{foreign.close();}
 assert.equal(digest(file),before);assert.deepEqual(x.store.graphShadow.state(),state);assert(!existsSync(backup+'.graph-previews'));
 const archive=new Database(snapshot,{readonly:true});try{const settings=archive.prepare('SELECT * FROM settings').all();assert(!settings.some(r=>r.key.startsWith('graph-preview-')));assert(!JSON.stringify(settings).includes(x.filename));assert.equal(JSON.parse(archive.prepare('SELECT payload FROM room WHERE id=?').get(x.room.id).payload).polygons[0].outer[0].x,0);}finally{archive.close();}
});

test('two campaigns keep one protected preview; campaign erasure removes only its own files and retirement markers',async t=>{
 const x=fixture(t),other=x.store.create('Other campaign');x.store.activateShell(x.owner.campaignId);x.owner.token=x.store.workspace().token;
 x.store.executeGraph(x.graph({kind:'raster'}));const restore=x.graph({kind:'restore'},x.store.graphShadow.state());x.store.executeGraph(restore);x.store.executeGraph(x.graph({kind:'raster'}));const file=x.store.graphShadow.db.name,state=x.store.graphShadow.state();
 assert.throws(()=>x.store.activateShell(other.id),/Graphvorschau/);assert.deepEqual(x.store.graphShadow.state(),state);
 x.store.trashCampaign({commandId:randomUUID(),id:other.id,expectedRevision:0,trashed:true});x.store.eraseCampaign({commandId:randomUUID(),id:other.id,expectedRevision:1,confirmName:'Other campaign'});await finishCampaignErasure(x.store,x.dir,other.id);assert(existsSync(file));assert.deepEqual(x.store.graphShadow.state(),state);
 const marker='graph-preview-lifecycle:'+x.owner.campaignId+':'+restore.target.previewId;assert(x.store.db.prepare('SELECT 1 FROM settings WHERE key=?').get(marker));
 x.store.trashCampaign({commandId:randomUUID(),id:x.owner.campaignId,expectedRevision:0,trashed:true});x.store.eraseCampaign({commandId:randomUUID(),id:x.owner.campaignId,expectedRevision:1,confirmName:'Persistent preview'});x.store.close();assert(existsSync(file));
 const reopened=x.open();assert.equal(reopened.graphShadow,null);assert(reopened.pendingCampaignErasures().includes(x.owner.campaignId));await finishCampaignErasure(reopened,x.dir,x.owner.campaignId);await finishCampaignErasure(reopened,x.dir,x.owner.campaignId);
 assert(!existsSync(file));assert(!existsSync(path.join(x.filename+'.graph-previews','active.json')));assert.equal(reopened.db.prepare('SELECT 1 FROM settings WHERE key=?').get(marker),undefined);assert.deepEqual(reopened.pendingCampaignErasures(),[]);
});


test('preview passage locations use live read-only Main existence across close/reopen and acceptance',t=>{
 const x=fixture(t),locations=[randomUUID(),randomUUID()];
 for(const id of locations)x.store.changePreparation({...x.owner,commandId:randomUUID(),change:{kind:'location',expectedRevision:null,document:{kind:'location',version:1,id,name:'Linked place',type:'poi',sections:[],detailMaps:[],keyLinks:[]}}});
 x.store.atlasDrawingCommit({...x.owner,commandId:randomUUID(),action:{kind:'volume-initialize',roomId:x.room.id,expectedRoomRevision:0,expectedVolumeRevision:null,heightSteps:2}});
 const canonical=digest(x.filename),head=x.store.db.prepare('SELECT revision,cursor FROM campaign_atlas WHERE campaign_id=?').get(x.owner.campaignId);
 x.store.executeGraph(x.graph({kind:'raster'}));const volume=x.store.drawing(x.owner.token).volumes[0],passages=[];
 for(const location of [...locations,null]){const side={description:'',passable:true,sight:true,light:true,sound:true,additionalSeconds:0,target:{kind:'location',id:location}},passage={id:randomUUID(),revision:0,scopeId:'local',roomId:x.room.id,volumeId:volume.id,pathId:null,otherRoomId:null,anchor:{roomId:x.room.id,volumeId:volume.id,pinned:true,local:{x:0,y:0,z:0,face:'west'}},widthSteps:1,heightSteps:2,outbound:side,inbound:side,assigned:true};
 x.store.atlasDrawingCommit({...x.owner,commandId:randomUUID(),target:target(x.store.graphShadow.state()),action:{kind:'passage',passage,expectedRevision:null}});passages.push(passage.id);}
 const statuses=store=>new Map(store.drawing(store.workspace().token).passageStatuses.map(row=>[row.id,row.outbound]));
 assert.deepEqual(passages.map(id=>statuses(x.store).get(id)),['Ortslink','Ortslink','Ortsziel fehlt']);assert.equal(digest(x.filename),canonical);assert.equal(x.store.graphShadow.db.prepare("SELECT 1 FROM sqlite_master WHERE name='location'").get(),undefined);
 x.store.db.prepare('UPDATE location SET trashed=1 WHERE id=?').run(locations[0]);x.store.db.prepare('DELETE FROM location WHERE id=?').run(locations[1]);const changed=digest(x.filename),state=x.store.graphShadow.state();
 assert.deepEqual(passages.map(id=>statuses(x.store).get(id)),['Ortsziel fehlt','Ortsziel fehlt','Ortsziel fehlt']);assert.equal(digest(x.filename),changed);x.store.close();
 const next=x.open(),w=next.activateShell(x.owner.campaignId);assert.deepEqual(w.graphPreview,state);assert.deepEqual(passages.map(id=>statuses(next).get(id)),['Ortsziel fehlt','Ortsziel fehlt','Ortsziel fehlt']);
 next.db.prepare('UPDATE location SET trashed=0 WHERE id=?').run(locations[0]);const beforeRead=digest(x.filename);assert.equal(statuses(next).get(passages[0]),'Ortslink');assert.equal(digest(x.filename),beforeRead);assert.deepEqual(next.db.prepare('SELECT revision,cursor FROM campaign_atlas WHERE campaign_id=?').get(x.owner.campaignId),head);
 next.executeGraph({...x.graph({kind:'accept'},next.graphShadow.state()),token:w.token});assert.equal(next.graphShadow,null);assert.deepEqual(passages.map(id=>statuses(next).get(id)),['Ortslink','Ortsziel fehlt','Ortsziel fehlt']);assert.deepEqual(next.db.prepare('SELECT revision,cursor FROM campaign_atlas WHERE campaign_id=?').get(x.owner.campaignId),{revision:head.revision+1,cursor:head.cursor+1});
});


test('a dangling active-pointer symlink is corrupt ownership, never permission for an empty replacement',t=>{
 const x=fixture(t);x.store.executeGraph(x.graph({kind:'raster'}));const file=x.store.graphShadow.db.name,active=path.join(x.filename+'.graph-previews','active.json');x.store.close();const bytes=readFileSync(file);
 rmSync(active);symlinkSync(path.join(x.dir,'absent-authority'),active);assert.throws(()=>x.open(),/Vorschauverwaltung ist keine eigene Datei/);assert(lstatSync(active).isSymbolicLink());assert.deepEqual(readFileSync(file),bytes);
});

for(const failedReader of [false,true])test(`Atlas wrapper accept returns the retired workspace/view on success and replay; postcommit reader failure=${failedReader}`,t=>{
 const x=fixture(t);x.store.executeGraph(x.graph({kind:'graph-move',roomIds:[x.room.id],dxSteps:2,dySteps:0}));x.store.executeGraph(x.graph({kind:'raster'},x.store.graphShadow.state()));
 const c=x.graph({kind:'accept'},x.store.graphShadow.state()),command=wrap(c),read=x.store.graph,head=x.store.db.prepare('SELECT revision,cursor FROM campaign_atlas WHERE campaign_id=?').get(x.owner.campaignId);
 if(failedReader){x.store.graph=()=>{throw Error('Injected accepted Graph read failure');};assert.throws(()=>x.store.executeAtlas(command),e=>e instanceof AtlasCommitProjectionError&&/Injected accepted Graph read failure/.test(String(e.cause)));x.store.graph=read;}
 else {const result=x.store.executeAtlas(command);assert.equal(result.result.workspace.graphPreview,undefined);assert.equal(result.result.view.preview,null);assert.equal(result.result.workspace.rooms.find(r=>r.id===x.room.id).polygons[0].outer[0].x,3.048);}
 assert.equal(x.store.graphShadow,null);assert.equal(x.store.reconcileAtlasCommit(command).outcome,'applied');const saved=digest(x.filename);
 const replay=x.store.executeAtlas(command);assert.equal(replay.result.workspace.graphPreview,undefined);assert.equal(replay.result.view.preview,null);assert.equal(digest(x.filename),saved);assert.deepEqual(x.store.db.prepare('SELECT revision,cursor FROM campaign_atlas WHERE campaign_id=?').get(x.owner.campaignId),{revision:head.revision+1,cursor:head.cursor+1});
});
