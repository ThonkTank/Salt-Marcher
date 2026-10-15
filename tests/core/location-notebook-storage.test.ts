import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../src/app/storage/store';
import {newLocation} from '../../src/features/location/location-schema';

test('location notebook rejects a checksum-valid location with a mismatched identity',()=>{
 const root=mkdtempSync(join(tmpdir(),'location-notebook-storage-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Ortsnotizbuch'),workspace=store.activate(campaign.id),location=newLocation('place','Nordtor','poi',['description','notes']);
  store.changePreparation({commandId:'location',campaignId:campaign.id,token:workspace.token,change:{kind:'location',expectedRevision:null,document:location}});
  const forged=JSON.stringify({...location,id:'other-place',name:'Verdeckter Titel'}),checksum=createHash('sha256').update(forged).digest('hex');
  (store as unknown as {db:any}).db.prepare('UPDATE location SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(forged,checksum,campaign.id,location.id);
  assert.throws(()=>store.locationMaterials(workspace.token,{locationId:null,kind:'directory',text:'',offset:0}),/widersprüchlich|beschädigt/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
