import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import Database from 'better-sqlite3';
import {buildSync} from './helpers/build.mjs';
const require=createRequire(import.meta.url);
function bundle(entry,name){buildSync({entryPoints:[entry],outfile:'.build/transfer-'+name+'.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});return require('../.build/transfer-'+name+'.cjs');}
const {CampaignStore}=bundle('src/app/storage/store.ts','store');
const {transferTables,transferRow,transferContext,assertTransferCoverage}=bundle('src/app/transfer/registry.ts','registry');
const {transferModel}=bundle('src/app/transfer/codec.ts','codec');
const {newElement}=bundle('src/app/drawing-model.ts','element');
const {vegetationSpec}=bundle('src/app/vegetation.ts','vegetation');
const hash=s=>createHash('sha256').update(s).digest('hex');
function fixture(t){const root=mkdtempSync(path.join(tmpdir(),'transfer-contract-')),file=path.join(root,'workbench.sqlite'),store=new CampaignStore(file);t.after(()=>{store.close();rmSync(root,{recursive:true,force:true});});return{root,file,store};}
const context=()=>transferContext((value,role)=>(role==='shared'||role==='definition'?'shared:':'local:')+value);

test('all canonical tables and columns have contracts; schema additions fail closed',t=>{
 const {store}=fixture(t);assertTransferCoverage(store.db);
 const format=JSON.parse(readFileSync('src/app/data-format.json','utf8'));
 assert.deepEqual(Object.keys(transferTables).sort(),[...format.tables].sort());
 store.db.exec('CREATE TABLE undeclared_transfer_owner(id TEXT)');assert.throws(()=>assertTransferCoverage(store.db),/Datenbanktabellen/);
 store.db.exec('DROP TABLE undeclared_transfer_owner; CREATE TABLE sqliteExtra(id TEXT)');assert.throws(()=>assertTransferCoverage(store.db),/Datenbanktabellen/);
 store.db.exec('DROP TABLE sqliteExtra; ALTER TABLE scope ADD COLUMN undeclared_reference TEXT');assert.throws(()=>assertTransferCoverage(store.db),/scope Spalten/);
});

test('same spelling has domain-specific meaning: local floor, shared sound and stable vegetation identity',()=>{
 const id='same-spelling',c=context(),element=newElement('stairs',id,id,id,[{x:0,y:0}],id);element.targetFloorId=id;element.name=id;element.notes=id;
 const drawing=transferModel('drawing_element',element,c);assert.equal(drawing.targetFloorId,'local:'+id);assert.equal(drawing.name,id);assert.equal(drawing.notes,id);
 const music=transferModel('music_state',{queue:[{id,assetId:id,mode:'manual'}],favoriteAssets:[id],history:[id]},c);
 assert.equal(music.queue[0].id,'local:'+id);assert.equal(music.queue[0].assetId,'shared:'+id);assert.deepEqual(music.favoriteAssets,['shared:'+id]);assert.deepEqual(music.history,['shared:'+id]);
 const vegetation=vegetationSpec();vegetation.overrides=[{id:'cell:0',x:0,y:0,size:1,angle:0,asset:'oak',locationId:id}];
 const landscape=transferModel('atlas_landscape',{id,vegetation},c);assert.equal(landscape.vegetation.preset.id,vegetation.preset.id);assert.equal(landscape.vegetation.overrides[0].id,'cell:0');assert.equal(landscape.vegetation.overrides[0].locationId,'local:'+id);
});

test('saved SQL rows use the owning codec and refresh their checksum without rewriting prose',()=>{
 const id='identical-id',element=newElement('stairs',id,id,id,[{x:0,y:0}],id);element.targetFloorId=id;element.name=id;
 const payload=JSON.stringify(element),row={campaign_id:id,id,scope_id:id,floor_id:id,room_id:id,kind:'stairs',revision:1,payload,checksum:hash(payload)};
 const history={changes:[{key:{table:'drawing_element',id},before:row,after:row,guard:'old-guard'}]};
 const copied=transferModel('drawing_history',history,context()),saved=copied.changes[0].after,body=JSON.parse(saved.payload);
 assert.equal(saved.id,'local:'+id);assert.equal(saved.campaign_id,'local:'+id);assert.equal(body.targetFloorId,'local:'+id);assert.equal(body.name,id);assert.equal(saved.checksum,hash(saved.payload));
 assert.throws(()=>transferModel('drawing_history',{changes:[{key:{table:'future-table',id},before:row,after:row,guard:''}]},context()),/future-table/);
});

test('dictionary identities and historical item aliases obey their declared domains',()=>{
 const c=transferContext((id,role)=>role+':'+id,id=>'archive:'+id);
 const music=transferModel('scene_music',{moods:{same:3}},c);
 assert.deepEqual({...music.moods},{'shared:same':3});
 const actor=transferModel('autonomy_actor',{jobPriorities:{same:4}},c);
 assert.deepEqual({...actor.jobPriorities},{'local:same':4});
 const item=transferModel('character_ledger',{reference:{kind:'authored',definitionId:'same',revision:1},name:'same'},c);
 assert.equal(item.reference.definitionId,'shared:same');assert.equal(item.reference.historicalDefinitionId,'archive:same');assert.equal(item.name,'same');
 const run=transferModel('session_run',{lootGuidance:{magic:{pool:[{definitionId:'same',revision:1,name:'same',rarity:'Rare'}]}}},c);
 assert.equal(run.lootGuidance.magic.pool[0].definitionId,'shared:same');assert.equal(Object.hasOwn(run.lootGuidance.magic.pool[0],'historicalDefinitionId'),false);
});

test('NPC draft JSON remaps supported schedules but preserves incomplete input without collecting speculative IDs',()=>{
 const seen=[],c=transferContext((id,role)=>{seen.push(id);return role+':'+id;});
 const invalid='[{"id":"uncommitted","futureField":true}]',valid='[{"id":"slot","locationId":"place","notes":"place"}]';
 const draft=transferModel('npc_draft',{fields:{dailyPlan:invalid,dailyOverrides:'[',location:'home',appearance:'home'}},c);
 assert.equal(draft.fields.dailyPlan,invalid);assert.equal(draft.fields.dailyOverrides,'[');assert.equal(draft.fields.location,'local:home');assert.equal(draft.fields.appearance,'home');assert.deepEqual(seen,['home']);
 const mapped=transferModel('npc_draft',{fields:{dailyPlan:valid}},c);
 assert.deepEqual(JSON.parse(mapped.fields.dailyPlan),[{id:'local:slot',locationId:'local:place',notes:'place'}]);
});

test('canonical room IDs containing colons take precedence over composite room keys',()=>{
 const ids=new Map([['generated:room','new-room'],['room','new-suffix']]),c=transferContext(id=>ids.get(id)??id);
 assert.equal(transferRow('drawing_element',{room_id:'generated:room'},c).room_id,'new-room');
 assert.equal(transferRow('drawing_element',{room_id:'prefix:room'},c).room_id,'prefix:new-suffix');
});

test('copy and preflight reject undeclared payload fields and variants instead of guessing from an ID suffix',()=>{
 const element=newElement('object','scope','floor',null,[{x:0,y:0}]);
 assert.throws(()=>transferModel('drawing_element',{...element,newOwnerId:'unclassified'},context()),/newOwnerId/);
 assert.throws(()=>transferModel('drawing_element',{...element,kind:'future-variant'},context()),/kind/);
 assert.throws(()=>transferRow('world_record',{kind:'future-owner',payload:'{}'},context()),/Variante/);
 assert.throws(()=>transferModel('drawing_element',JSON.parse('{"__proto__":{"id":"unsafe"}}'),context()),/__proto__/);
});

for(const corruption of ['field','variant','table'])test(`unsupported ${corruption} leaves import input and destination unchanged`,async t=>{
 const {root,store}=fixture(t),cam=store.create('Source'),w=store.activate(cam.id),file=path.join(root,'source.sqlite');await store.campaignSnapshot(w.token,file);
 const db=new Database(file);
 if(corruption==='table')db.exec('CREATE TABLE unknown_domain(id TEXT)');
 else if(corruption==='variant')db.prepare('INSERT INTO world_record VALUES(?,?,?,?,?,?)').run(cam.id,'future-owner',randomUUID(),1,'{}',hash('{}'));
 else {const row=db.prepare("SELECT * FROM world_record WHERE kind='map'").get(),value={...JSON.parse(row.payload),newOwnerId:randomUUID()},payload=JSON.stringify(value);db.prepare('UPDATE world_record SET payload=?,checksum=? WHERE campaign_id=? AND kind=? AND id=?').run(payload,hash(payload),cam.id,'map',row.id);}
 db.close();const original=readFileSync(file),before=store.db.serialize();
 assert.throws(()=>store.acceptCampaignSnapshot(file,'Rejected',{}),/Transfer|transfer|Datenbanktabellen/);
 assert.deepEqual(readFileSync(file),original);assert.deepEqual(store.db.serialize(),before);
});
