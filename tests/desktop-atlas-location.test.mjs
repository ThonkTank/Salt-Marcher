import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';import {createRequire} from 'node:module';import {buildSync} from 'esbuild';import {parseHTML} from 'linkedom';
const require=createRequire(import.meta.url),tick=()=>new Promise(r=>setImmediate(r));
for(const[name,entry]of [['store','storage/store'],['composer','atlas-location-composer']])buildSync({entryPoints:['src/app/'+entry+'.ts'],outfile:'.build/atlas-location-'+name+'.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require('../.build/atlas-location-store.cjs'),{AtlasLocationComposer}=require('../.build/atlas-location-composer.cjs');
async function until(fn){for(let i=0;i<150;i++){if(fn())return;await tick();}assert.ok(fn(),'Expected atlas location state did not arrive');}
const documentOf=(id=randomUUID(),name='Waldkapelle')=>({kind:'location',version:1,id,name,type:'poi',sections:[{id:randomUUID(),title:'Beschreibung',markdown:'  Beschreibung\r\n'},{id:randomUUID(),title:'Notizen',markdown:'  GM-Geheimnis\r\n'}],detailMaps:[],keyLinks:[]});
function fixture(t){
 const dir=mkdtempSync(path.join(tmpdir(),'atlas-location-')),store=new CampaignStore(path.join(dir,'db.sqlite')),campaign=store.create('Atlas test'),w=store.activate(campaign.id),map={id:store.world(w.token).maps[0].id,revision:1,name:'Nebelwald',hexMeters:4828.032,climate:'temperate',seed:'test',cells:[]},command=action=>({commandId:randomUUID(),token:w.token,campaignId:campaign.id,action});
 store.executeWorld(command({kind:'map',map,expectedRevision:1}));
 const create=(document=documentOf(),hex={q:2,r:-1})=>command({kind:'place-create',mapId:map.id,expectedMapRevision:2,document,hex});
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});return{store,campaign,w,map,command,create};
}
test('one atlas command creates canonical location sections and marker, survives replay and fresh opening',t=>{
 const x=fixture(t),c=x.create();x.store.executeWorld(c);x.store.executeWorld(c);
 const p=x.store.preparation(x.w.token).locations;assert.equal(p.length,1);assert.deepEqual(p[0].document,c.action.document);assert.equal(x.store.world(x.w.token).places.length,1);assert.deepEqual(x.store.world(x.w.token).places[0].locationId,c.action.document.id);
 const fresh=new CampaignStore(x.store.db.name);try{const w=fresh.activate(x.campaign.id);assert.equal(fresh.world(w.token).places[0].q,2);assert.equal(fresh.preparation(w.token).locations[0].document.sections[1].markdown,'  GM-Geheimnis\r\n');}finally{fresh.close();}
});
test('a late marker write failure rolls location, preparation receipt and world receipt back together',t=>{
 const x=fixture(t),c=x.create();x.store.db.exec("CREATE TRIGGER fail_marker BEFORE INSERT ON atlas_place BEGIN SELECT RAISE(ABORT,'controlled marker failure'); END");assert.throws(()=>x.store.executeWorld(c),/controlled marker failure/);
 assert.equal(x.store.preparation(x.w.token).locations.length,0);assert.equal(x.store.world(x.w.token).places.length,0);assert.equal(x.store.db.prepare('SELECT count(*) n FROM receipt WHERE command_id=?').get(c.commandId+'|atlas-location').n,0);assert.equal(x.store.db.prepare('SELECT count(*) n FROM world_receipt WHERE command_id=?').get(c.commandId).n,0);
});
test('occupied hex, changed map and existing location identity cannot leave or overwrite an orphan',t=>{
 const x=fixture(t),first=x.create();x.store.executeWorld(first);const original=x.store.preparation(x.w.token).locations[0];
 assert.throws(()=>x.store.executeWorld(x.create()),/bereits einen Ortsmarker/);assert.throws(()=>x.store.executeWorld(x.create({...documentOf(first.action.document.id),name:'Overwrite'}, {q:3,r:0})),/Ortskonflikt/);
 const m=x.store.world(x.w.token).maps[0];x.store.executeWorld(x.command({kind:'map',map:{...m,name:'Changed map'},expectedRevision:m.revision}));assert.throws(()=>x.store.executeWorld(x.create(documentOf(),{q:4,r:0})),/Karte.*geändert/);
 assert.deepEqual(x.store.preparation(x.w.token).locations,[original]);assert.equal(x.store.world(x.w.token).places.length,1);
});
async function ui(t){
 const x=fixture(t),saved={window:globalThis.window,document:globalThis.document},{window,document}=parseHTML('<html><body></body></html>');Object.assign(globalThis,{window,document});
 let owner={token:x.w.token,campaignId:x.campaign.id,mapId:x.map.id,mapRevision:2,mapName:'Nebelwald',hex:{q:2,r:-1}},sendMode='normal',savedMode='normal',holdDrain=false,releaseDrain,releaseReply;
 const sent=[],adopted=[],messages=[],response=fn=>{try{return{ok:true,value:fn()};}catch(e){return{ok:false,error:e.message};}};
 window.campaign={executeWorld:async c=>{sent.push(structuredClone(c));if(sendMode==='lost-before'){sendMode='normal';throw new Error('lost before dispatch');}const result=response(()=>x.store.executeWorld(c));if(sendMode==='lost-after'){sendMode='normal';throw new Error('lost after dispatch');}if(sendMode==='hold'){sendMode='normal';return new Promise(r=>releaseReply=()=>r(result));}return result;},reconcileWorld:async(c,token)=>response(()=>x.store.reconcileWorld(c,token))};
 const composer=new AtlasLocationComposer(()=>owner,async()=>{if(holdDrain){holdDrain=false;await new Promise(r=>releaseDrain=r);}return true;},async(ack,id)=>{if(savedMode==='fail'){savedMode='normal';throw new Error('view refresh failed');}adopted.push(id);},s=>messages.push(s));
 for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{value:'',writable:true});
 const dialog=document.getElementById('atlas-location-dialog');dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};for(const input of document.querySelectorAll('input'))input.focus=()=>{};
 const get=id=>document.getElementById('atlas-location-'+id),fill=()=>{get('name').value='Waldkapelle';get('description').value='  Description\r\n';get('notes').value='  Protected GM prose\r\n';},submit=()=>get('form').dispatchEvent(new window.Event('submit',{cancelable:true}));
 t.after(()=>{releaseDrain?.();releaseReply?.();composer.contextChanged();Object.assign(globalThis,saved);});
 await composer.open();fill();return{...x,composer,dialog,get,submit,sent,adopted,fill,mode(v){sendMode=v;},failRefresh(){savedMode='fail';},holdDrain(){holdDrain=true;},hasDrain:()=>!!releaseDrain,releaseDrain:()=>releaseDrain(),hasReply:()=>!!releaseReply,releaseReply:()=>releaseReply(),switchTo(other){owner=other;composer.contextChanged();}};
}
test('composer creates one canonical place and blocks leaving unfinished prose',async t=>{
 const x=await ui(t);assert.equal(x.composer.flush(),false);x.submit();x.submit();await until(()=>!x.dialog.open);assert.equal(x.sent.length,1);assert.equal(x.adopted.length,1);assert.equal(x.store.preparation(x.w.token).locations[0].document.sections[1].markdown,'  Protected GM prose\r\n');assert.equal(x.composer.flush(),true);
});
for(const mode of ['lost-before','lost-after'])test(`uncertain atlas placement ${mode} is checked before any second write`,async t=>{
 const x=await ui(t);x.mode(mode);x.submit();await until(()=>!x.get('check').hidden);assert.equal(x.get('save').disabled,true);assert.equal(x.sent.length,1);x.get('check').click();
 if(mode==='lost-after'){await until(()=>!x.dialog.open);assert.equal(x.sent.length,1);}else{await until(()=>!x.get('save').disabled);assert.equal(x.get('notes').value,'  Protected GM prose\r\n');x.submit();await until(()=>!x.dialog.open);}
 assert.equal(x.store.preparation(x.w.token).locations.length,1);assert.equal(x.store.world(x.w.token).places.length,1);
});
test('a confirmed write whose view refresh fails is reconciled without creating another location',async t=>{
 const x=await ui(t);x.failRefresh();x.submit();await until(()=>!x.get('check').hidden);assert.match(x.get('feedback').textContent,/Ort gespeichert/);x.get('check').click();await until(()=>!x.dialog.open);assert.equal(x.sent.length,1);assert.equal(x.adopted.length,1);
});
test('an old reply cannot publish a location into a newly activated campaign view',async t=>{
 const x=await ui(t);x.mode('hold');x.submit();await until(x.hasReply);const c=x.store.create('Other campaign'),w=x.store.activate(c.id);x.switchTo({token:w.token,campaignId:c.id,mapId:randomUUID(),mapRevision:1,mapName:'Other',hex:{q:0,r:0}});x.releaseReply();await tick();await tick();assert.deepEqual(x.adopted,[]);assert.equal(x.dialog.open,false);assert.equal(x.store.preparation(w.token).locations.length,0);
});
