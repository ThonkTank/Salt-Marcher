import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import test,{type TestContext} from 'node:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CampaignStore} from '../../../src/app/storage/store';
import type {ChronicleCategory} from '../../../src/app/runtime/chronicle-contracts';
import {readChronicle,chronicleMarkdown} from '../../../src/app/storage/chronicle';
const row=(id:string,kind:string,value:object,character_id:string|null=null)=>{const payload=JSON.stringify(value);return{id,kind,character_id,payload,checksum:createHash('sha256').update(payload).digest('hex')};};
const xp=(i:number,reason='Routine')=>row('xp-'+i,'xp',{recordedAt:new Date(i).toISOString(),before:{xp:0},after:{xp:1},reason});
function database(t:TestContext,progress:any[],world:any[]=[],profiles:any[]=[]){
 const root=mkdtempSync(join(tmpdir(),'chronicle-filter-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test'),campaign=store.create('Küstenkampagne'),w=store.activate(campaign.id),db=(store as unknown as {db:any}).db,people=new Map<string,string>();
 t.after(()=>{store.close();rmSync(root,{recursive:true,force:true});});
 for(const profile of profiles){const character=store.executeLive({commandId:profile.id,campaignId:campaign.id,token:w.token,action:{kind:'create-character',profile:{name:JSON.parse(profile.payload).name}}}).character!;people.set(profile.id,character.id);}
 db.transaction(()=>{
  const event=db.prepare('INSERT INTO progress_event VALUES(?,?,?,?,?,?)'),history=db.prepare('INSERT INTO world_history VALUES(?,?,?,?,?)');
  // Event cursors follow insertion order; insert oldest first, as the real writers do.
  for(const r of [...progress].reverse())event.run(campaign.id,r.id,people.get(r.character_id)??r.character_id,r.kind,r.payload,r.checksum);
  for(const r of [...world].reverse())history.run(campaign.id,r.id,null,r.payload,r.checksum);
 })();
 return(category:ChronicleCategory|'all'='all',search='')=>readChronicle(db,campaign.id,category,search);
}
test('a rare older match is found before applying the display limit',t=>{
 const db=database(t,[...Array.from({length:2003},(_,i)=>xp(3000-i)),xp(1,'Bronzeschlüssel')]);
 const view=db('party','Bronzeschlüssel');assert.equal(view.entries.length,1);assert.match(view.entries[0]!.summary,/Bronzeschlüssel/);assert.equal(view.truncated,false);
});
test('an older category is not hidden by 2000 newer events of a different category',t=>{
 const db=database(t,[...Array.from({length:2003},(_,i)=>xp(3000-i)),row('quest','narrative-award',{recordedAt:new Date(1).toISOString(),title:'Verschwundene Fischer',outcome:'Gefunden'})]);
 const view=db('narrative');assert.deepEqual(view.entries.map(e=>e.title),['Quest abgeschlossen: Verschwundene Fischer']);assert.equal(view.truncated,false);
});
test('rare travel history can be found behind many newer world events',t=>{
 const world=[...Array.from({length:2003},(_,i)=>row('w-'+i,'world',{recordedAt:new Date(3000-i).toISOString(),text:'Wetter aktualisiert'})),row('arrival','world',{recordedAt:new Date(1).toISOString(),text:'Ort besucht: Hafen'})];
 const view=database(t,[],world)('travel','Hafen');assert.equal(view.entries.length,1);assert.equal(view.entries[0]!.category,'travel');assert.equal(view.truncated,false);
});
test('combat searches match full grouped awards and preserve every participant',t=>{
 const profiles=[row('iri','profile',{name:'Iri'}),row('aran','profile',{name:'Aran'})];
 const awards=[row('a-2','combat-award',{recordedAt:new Date(2).toISOString(),awardId:'shared',xp:10},'iri'),row('a-1','combat-award',{recordedAt:new Date(1).toISOString(),awardId:'shared',xp:10},'aran')];
 for(const query of ['Aran','Iri, Aran']){const view=database(t,awards,[],profiles)('combat',query);assert.equal(view.entries.length,1);assert.deepEqual(view.entries[0]!.people,['Iri','Aran']);assert.match(view.entries[0]!.summary,/Iri, Aran/);}
});
test('bounded combat groups stay ordered by event time rather than award id',t=>{
 const awards=Array.from({length:2003},(_,i)=>row('a-'+i,'combat-award',{recordedAt:new Date(2003-i).toISOString(),awardId:String(i).padStart(4,'0'),xp:0}));
 const view=database(t,awards)('combat');assert.equal(view.entries.length,2000);assert.equal(view.entries[0]!.id,'progress:a-0');assert.equal(view.entries.at(-1)!.id,'progress:a-1999');assert.equal(view.truncated,true);
});
test('Markdown exports disclose omitted matching history and precise exports do not claim truncation',t=>{
 const view=database(t,Array.from({length:2003},(_,i)=>xp(3000-i)))();const output=chronicleMarkdown(view,'all','');assert.match(output,/ältere passende Einträge fehlen/);assert.equal((output.match(/^## /gm)||[]).length,2000);
 const precise=database(t,[xp(1,'Bronzeschlüssel')])('party','Bronzeschlüssel');const text=chronicleMarkdown(precise,'party','Bronzeschlüssel');assert.match(text,/Bronzeschlüssel/);assert.doesNotMatch(text,/ältere passende Einträge fehlen/);
});
test('invalid filters cannot silently turn into an empty successful chronicle',t=>{
 assert.throws(()=>database(t,[])('invalid' as any,''),/Chronikfilter/);assert.throws(()=>database(t,[])('all','a'.repeat(1001)),/Chronikfilter/);
});
