import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../src/app/storage/store';
import {campaignLocalId} from '../../src/features/campaign/campaign-contracts';

const hash=(payload:string)=>createHash('sha256').update(payload).digest('hex');

test('campaign connections reject a checksum-valid note with a forged identity',()=>{
 const root=mkdtempSync(join(tmpdir(),'world-links-storage-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Zusammenhänge'),workspace=store.activate(campaign.id),id=campaignLocalId('00000000-0000-4000-8000-000000000601');
  store.changePreparation({commandId:'note',campaignId:campaign.id,token:workspace.token,change:{kind:'note',expectedRevision:null,note:{version:1,id,revision:1,kind:'npc',title:'Hafenwache',readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false}}});
  const forged=campaignLocalId('00000000-0000-4000-8000-000000000602'),payload=JSON.stringify({version:1,id:forged,revision:1,kind:'npc',title:'Hafenwache',readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false});
  store.db.prepare('UPDATE world_note SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(payload,hash(payload),campaign.id,id);
  assert.throws(()=>store.worldLinks(workspace.token,{text:'',kind:'world',offset:0,focus:null}),/widerspricht ihrer Identität/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
