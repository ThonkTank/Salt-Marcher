import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../../src/app/storage/store';
import {campaignLocalId} from '../../../src/features/campaign/campaign-contracts';
import {referenceMarkdown} from '../../../src/app/campaign/text-references';

const hash=(payload:string)=>createHash('sha256').update(payload).digest('hex');

test('text references never expose a checksum-valid target with a forged identity',()=>{
 const root=mkdtempSync(join(tmpdir(),'text-references-storage-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Textverweise'),workspace=store.activate(campaign.id),source=campaignLocalId('00000000-0000-4000-8000-000000000701'),target=campaignLocalId('00000000-0000-4000-8000-000000000702');
  for(const [id,title,gmNotes] of [[source,'Auftrag',referenceMarkdown({kind:'note',id:target},'Hafenwache')],[target,'Hafenwache','']] as const)store.changePreparation({commandId:'note-'+id,campaignId:campaign.id,token:workspace.token,change:{kind:'note',expectedRevision:null,note:{version:1,id,revision:1,kind:'npc',title,readAloud:'',gmNotes,relations:[],creatureId:null,deleted:false}}});
  const forged=campaignLocalId('00000000-0000-4000-8000-000000000703'),payload=JSON.stringify({version:1,id:forged,revision:1,kind:'npc',title:'Falscher Name',readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false});
  (store as unknown as {db:any}).db.prepare('UPDATE world_note SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(payload,hash(payload),campaign.id,target);
  const result=store.searchDesk(workspace.token,'reference','Hafenwache',0),link=store.deskContent(workspace.token,{kind:'note',id:source}).links![0]!;
  assert.equal(result.entries[0]?.title,'Ziel nicht verfügbar');assert.equal(result.entries[0]?.unavailable,true);assert.equal(link.entry.title,'Ziel nicht verfügbar');assert.equal(link.entry.unavailable,true);
  (store as unknown as {db:any}).db.prepare('UPDATE world_note SET checksum=? WHERE campaign_id=? AND id=?').run('broken',campaign.id,source);
  const incomplete=store.searchDesk(workspace.token,'reference','Hafenwache',0);assert.deepEqual(incomplete.entries,[]);assert.match(incomplete.notice??'',/unvollständig/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
