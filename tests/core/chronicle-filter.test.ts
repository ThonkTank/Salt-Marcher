import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readChronicle,chronicleMarkdown} from '../../src/app/storage/chronicle';
const row=(id:string,kind:string,value:object,character_id:string|null=null)=>{const payload=JSON.stringify(value);return{id,kind,character_id,payload,checksum:createHash('sha256').update(payload).digest('hex')};};
const xp=(i:number,reason='Routine')=>row('xp-'+i,'xp',{recordedAt:new Date(i).toISOString(),before:{xp:0},after:{xp:1},reason});
function database(progress:any[],world:any[]=[],profiles:any[]=[]) {return{transaction:(fn:()=>unknown)=>fn,prepare:(sql:string)=>({get:()=>({name:'Küstenkampagne'}),all:()=>sql.includes('character_profile')?profiles:[],iterate:()=>sql.includes('world_history')?world:sql.includes("kind='combat-award'")?progress.filter(r=>r.kind==='combat-award').sort((a,b)=>JSON.parse(a.payload).awardId.localeCompare(JSON.parse(b.payload).awardId)):progress.filter(r=>r.kind!=='combat-award')})};}
test('a rare older match is found before applying the display limit',()=>{
 const db=database([...Array.from({length:2003},(_,i)=>xp(3000-i)),xp(1,'Bronzeschlüssel')]);
 const view=readChronicle(db,'cam','party','Bronzeschlüssel');assert.equal(view.entries.length,1);assert.match(view.entries[0]!.summary,/Bronzeschlüssel/);assert.equal(view.truncated,false);
});
test('an older category is not hidden by 2000 newer events of a different category',()=>{
 const db=database([...Array.from({length:2003},(_,i)=>xp(3000-i)),row('quest','narrative-award',{recordedAt:new Date(1).toISOString(),title:'Verschwundene Fischer',outcome:'Gefunden'})]);
 const view=readChronicle(db,'cam','narrative');assert.deepEqual(view.entries.map(e=>e.title),['Quest abgeschlossen: Verschwundene Fischer']);assert.equal(view.truncated,false);
});
test('rare travel history can be found behind many newer world events',()=>{
 const world=[...Array.from({length:2003},(_,i)=>row('w-'+i,'world',{recordedAt:new Date(3000-i).toISOString(),text:'Wetter aktualisiert'})),row('arrival','world',{recordedAt:new Date(1).toISOString(),text:'Ort besucht: Hafen'})];
 const view=readChronicle(database([],world),'cam','travel','Hafen');assert.equal(view.entries.length,1);assert.equal(view.entries[0]!.category,'travel');assert.equal(view.truncated,false);
});
test('combat searches match full grouped awards and preserve every participant',()=>{
 const profiles=[row('iri','profile',{name:'Iri'}),row('aran','profile',{name:'Aran'})];
 const awards=[row('a-2','combat-award',{recordedAt:new Date(2).toISOString(),awardId:'shared',xp:10},'iri'),row('a-1','combat-award',{recordedAt:new Date(1).toISOString(),awardId:'shared',xp:10},'aran')];
 for(const query of ['Aran','Iri, Aran']){const view=readChronicle(database(awards,[],profiles),'cam','combat',query);assert.equal(view.entries.length,1);assert.deepEqual(view.entries[0]!.people,['Iri','Aran']);assert.match(view.entries[0]!.summary,/Iri, Aran/);}
});
test('bounded combat groups stay ordered by event time rather than award id',()=>{
 const awards=Array.from({length:2003},(_,i)=>row('a-'+i,'combat-award',{recordedAt:new Date(2003-i).toISOString(),awardId:String(i).padStart(4,'0'),xp:0}));
 const view=readChronicle(database(awards),'cam','combat');assert.equal(view.entries.length,2000);assert.equal(view.entries[0]!.id,'progress:a-0');assert.equal(view.entries.at(-1)!.id,'progress:a-1999');assert.equal(view.truncated,true);
});
test('Markdown exports disclose omitted matching history and precise exports do not claim truncation',()=>{
 const view=readChronicle(database(Array.from({length:2003},(_,i)=>xp(3000-i))),'cam');const output=chronicleMarkdown(view,'all','');assert.match(output,/ältere passende Einträge fehlen/);assert.equal((output.match(/^## /gm)||[]).length,2000);
 const precise=readChronicle(database([xp(1,'Bronzeschlüssel')]),'cam','party','Bronzeschlüssel');const text=chronicleMarkdown(precise,'party','Bronzeschlüssel');assert.match(text,/Bronzeschlüssel/);assert.doesNotMatch(text,/ältere passende Einträge fehlen/);
});
test('invalid filters cannot silently turn into an empty successful chronicle',()=>{
 assert.throws(()=>readChronicle(database([]),'cam','invalid' as any,''),/Chronikfilter/);assert.throws(()=>readChronicle(database([]),'cam','all','a'.repeat(1001)),/Chronikfilter/);
});
