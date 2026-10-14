import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../src/app/storage/store';
import {newLocation} from '../../src/features/location/location-schema';

test('agenda rejects malformed pagination authority at its storage boundary',()=>{
 const root=mkdtempSync(join(tmpdir(),'agenda-storage-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Agenda'),workspace=store.activate(campaign.id),query={sceneId:null,search:'',location:'all' as const,horizonDays:null,includePast:false,after:null};
  const page=store.agenda(workspace.token,query);
  assert.throws(()=>store.agenda(workspace.token,{...query,after:{sortMs:'not-an-instant',id:'event',instantMs:'0',calendarRevision:page.calendar.revision}}),/Cursor/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('agenda does not display a location label from damaged source bytes',()=>{
 const root=mkdtempSync(join(tmpdir(),'agenda-location-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Agenda'),workspace=store.activate(campaign.id),location=newLocation('place','Nordtor','poi',['description','notes']);
  store.changePreparation({commandId:'location',campaignId:campaign.id,token:workspace.token,change:{kind:'location',expectedRevision:null,document:location}});
  store.executeWorld({commandId:'event',campaignId:campaign.id,token:workspace.token,action:{kind:'calendar-event',expectedRevision:null,event:{id:'event',revision:0,name:'Wache wechselt',startMs:'3600000',durationMs:'60000',repeatMs:null,locationId:location.id,notes:'',trashed:false}}});
  (store as unknown as {db:any}).db.prepare('UPDATE location SET checksum=? WHERE campaign_id=? AND id=?').run('broken',campaign.id,location.id);
  assert.throws(()=>store.agenda(workspace.token,{sceneId:null,search:'',location:'all',horizonDays:null,includePast:false,after:null}),/Agenda-Ort ist beschädigt/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
