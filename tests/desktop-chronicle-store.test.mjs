import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
const require=createRequire(import.meta.url);
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/chronicle-store-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
test('SQLite groups award receipts before filtering and retains the newest bounded combat history',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'chronicle-store-')),{CampaignStore}=require('../.build/chronicle-store-test.cjs'),store=new CampaignStore(root+'/workbench.sqlite');
 try{
  const campaign=store.create('SQL-Chronik'),w=store.activate(campaign.id),command=action=>({commandId:randomUUID(),token:w.token,campaignId:campaign.id,action});
  const iri=store.executeLive(command({kind:'create-character',profile:{name:'Iri'}})).character,aran=store.executeLive(command({kind:'create-character',profile:{name:'Aran'}})).character;
  const insert=store.db.prepare('INSERT INTO progress_event(campaign_id,id,character_id,kind,payload,checksum) VALUES(?,?,?,?,?,?)');
  const receipt=(id,character,awardId,time)=>{const payload=JSON.stringify({recordedAt:new Date(time).toISOString(),awardId,xp:10,combatId:'receipt-fixture'});insert.run(campaign.id,id,character,'combat-award',payload,createHash('sha256').update(payload).digest('hex'));};
  // Isolated valid receipt fixtures exercise the SQL reader; no battle acceptance is claimed.
  store.db.transaction(()=>{for(let i=0;i<2003;i++)receipt('event-'+i,iri.id,'award-'+String(i).padStart(4,'0'),5000-i);receipt('old-aran',aran.id,'old-pair',1);receipt('old-iri',iri.id,'old-pair',2);})();
  const original=store.db.prepare('SELECT id,payload,checksum FROM progress_event ORDER BY id').all();
  const all=store.chronicle(w.token,'combat');assert.equal(all.entries.length,2000);assert.equal(all.entries[0].id,'progress:event-0');assert.equal(all.entries.at(-1).id,'progress:event-1999');assert.equal(all.truncated,true);
  for(const query of ['Aran','Iri, Aran']){const view=store.chronicle(w.token,'combat',query);assert.equal(view.entries.length,1);assert.deepEqual(view.entries[0].people,['Iri','Aran']);assert.equal(view.truncated,false);}
  assert.deepEqual(store.db.prepare('SELECT id,payload,checksum FROM progress_event ORDER BY id').all(),original);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
