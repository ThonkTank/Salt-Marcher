import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../src/app/storage/store';
const focus=(store:CampaignStore,token:string)=>{const view=store.playerView(token);return{expectedFocusId:view.focusId,expectedFocusRevision:view.focusRevision,expectedFocusMembershipRevision:view.focusMembershipRevision};};

for(const bound of [false,true])test('legacy scene text settings remain valid but neutral, binding='+bound,async()=>{
 const root=mkdtempSync(join(tmpdir(),'player-scene-legacy-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Alter Vorlesemodus'),token=store.activate(campaign.id).token;
  const character=store.executeLive({commandId:'character',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!;
  const scene=store.executeLive({commandId:'scene',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:1}}).scene!;
  store.executeLive({commandId:'activate',campaignId:campaign.id,token,action:{kind:'membership',characterId:character.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}});
  const authored='  Der Torbogen glüht.\n\nEin Horn erklingt.  ';store.executeLive({commandId:'authored',campaignId:campaign.id,token,action:{kind:'scene-content',sceneId:scene.id,expectedRevision:0,title:'Interner Titel',notes:'Private Notiz',readAloud:authored,locationId:null}});
  store.executePlayer({commandId:'follow',campaignId:campaign.id,token,expectedRevision:0,expectedFocusId:scene.id,expectedFocusRevision:0,action:{kind:'settings',settings:{blank:false,mode:'follow',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}}});
  const row=store.db.prepare("SELECT * FROM player_record WHERE campaign_id=? AND kind='settings'").get(campaign.id),legacy={...JSON.parse(row.payload),mode:'scene'};
  if(bound)legacy.boundSceneId=scene.id;else delete legacy.boundSceneId;
  const payload=JSON.stringify(legacy);store.db.prepare("UPDATE player_record SET payload=?,checksum=? WHERE campaign_id=? AND kind='settings'").run(payload,createHash('sha256').update(payload).digest('hex'),campaign.id);
  const before=store.db.serialize();assert.equal(store.playerView(token).frame.mode,'blank');assert.equal(store.playerView(token).settings.mode,'scene');assert.ok(store.db.serialize().equals(before));await store.backup(join(root,'valid-legacy.sqlite'));
  assert.throws(()=>store.executePlayer({commandId:'text-request',campaignId:campaign.id,token,expectedRevision:1,expectedFocusId:scene.id,expectedFocusRevision:0,action:{kind:'settings',settings:legacy}} as any),/Karten.*Art/);assert.ok(store.db.serialize().equals(before));
  const current=store.executePlayer({commandId:'visual-request',campaignId:campaign.id,token,expectedRevision:1,expectedFocusId:scene.id,expectedFocusRevision:0,action:{kind:'settings',settings:{blank:false,mode:'follow',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}}});assert.equal(current.settings.mode,'follow');assert.equal(current.settings.boundSceneId,null);assert.equal(store.live(token).scene!.readAloud,authored);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
