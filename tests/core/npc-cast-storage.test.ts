import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../src/app/storage/store';
import {campaignLocalId} from '../../src/features/campaign/campaign-contracts';
import {newLocation} from '../../src/features/location/location-schema';

const hash=(payload:string)=>createHash('sha256').update(payload).digest('hex');
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'npc-cast-storage-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test'),campaign=store.create('NSC-Dossier'),workspace=store.activate(campaign.id),scene=store.executeLive({commandId:'initialize',campaignId:campaign.id,token:workspace.token,action:{kind:'initialize',expectedRosterRevision:0}}).scene!,npcId=campaignLocalId('00000000-0000-4000-8000-000000000401');
 store.changePreparation({commandId:'npc',campaignId:campaign.id,token:workspace.token,change:{kind:'note',expectedRevision:null,note:{version:1,id:npcId,revision:1,kind:'npc',title:'Hafenwache',readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false}}});
 return{root,db:(store as unknown as {db:any}).db,store,campaign,workspace,scene,npcId};
}

test('npc dossier rejects a checksum-valid malformed location source',()=>{
 const f=fixture();
 try{
  const location=newLocation('place','Nordtor','poi',['description','notes']);
  f.store.changePreparation({commandId:'location',campaignId:f.campaign.id,token:f.workspace.token,change:{kind:'location',expectedRevision:null,document:location}});
  f.db.prepare('INSERT INTO npc_position VALUES(?,?,?,1)').run(f.campaign.id,f.npcId,location.id);
  const payload=JSON.stringify({name:7});f.db.prepare('UPDATE location SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(payload,hash(payload),f.campaign.id,location.id);
  assert.throws(()=>f.store.npcDossier(f.workspace.token,f.scene.id,f.npcId),/native Daten|Ortsdatei|Dossierquelle/);
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('npc dossier limits the combined outgoing and incoming relation excerpt',()=>{
 const f=fixture();
 try{
  const insert=f.db.prepare('INSERT INTO world_note VALUES(?,?,1,0,?,?)');
  for(let i=0;i<41;i++){
   const id=campaignLocalId(`00000000-0000-4000-8000-${String(500+i).padStart(12,'0')}`),payload=JSON.stringify({version:1,id,revision:1,kind:'npc',title:`Kontakt ${String(i).padStart(2,'0')}`,readAloud:'',gmNotes:'',relations:[{targetId:f.npcId,label:'kennt'}],creatureId:null,deleted:false});
   insert.run(f.campaign.id,id,payload,hash(payload));
  }
  const dossier=f.store.npcDossier(f.workspace.token,f.scene.id,f.npcId);
  assert.equal(dossier.relationCount,41);assert.equal(dossier.relations.length,40);assert.ok(dossier.relations.every((relation:{incoming:boolean})=>relation.incoming));
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});
