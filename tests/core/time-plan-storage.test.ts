import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../src/app/storage/store';

function fixture(){
 const root=mkdtempSync(join(tmpdir(),'time-plan-storage-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test'),campaign=store.create('Zeitplan'),workspace=store.activate(campaign.id),scene=store.executeLive({commandId:'initialize',campaignId:campaign.id,token:workspace.token,action:{kind:'initialize',expectedRosterRevision:0}}).scene!;
 return{root,store,campaign,workspace,scene};
}

test('time preview rejects an unknown duration unit at the storage boundary',()=>{
 const f=fixture();
 try{assert.throws(()=>f.store.previewTime(f.workspace.token,{sceneId:f.scene.id,kind:'duration',amount:'1',unit:'fortnight' as any,reason:'Ungültige Einheit'}),/Zeiteinheit ist ungültig/);}
 finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('time preview includes every repeated event occurrence crossed by the jump',()=>{
 const f=fixture();
 try{
  f.store.executeWorld({commandId:'event',campaignId:f.campaign.id,token:f.workspace.token,action:{kind:'calendar-event',expectedRevision:null,event:{id:'watch',revision:0,name:'Wachwechsel',startMs:'3600000',durationMs:'60000',repeatMs:'3600000',locationId:null,notes:'',trashed:false}}});
  const preview=f.store.previewTime(f.workspace.token,{sceneId:f.scene.id,kind:'duration',amount:'4',unit:'hour',reason:'Vier Stunden warten'});
  assert.deepEqual(preview.events,[1,2,3,4].map(hour=>({name:'Wachwechsel',instantMs:String(hour*3600000)})));
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});
