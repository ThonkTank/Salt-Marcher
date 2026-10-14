import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../src/app/storage/store';

test('the player display publishes only the focused scene read-aloud text',()=>{
 const root=mkdtempSync(join(tmpdir(),'player-scene-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Vorleseanzeige'),token=store.activate(campaign.id).token;
  const character=store.executeLive({commandId:'character',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!;
  const scene=store.executeLive({commandId:'scene',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:1}}).scene!;
  store.executeLive({commandId:'activate',campaignId:campaign.id,token,action:{kind:'membership',characterId:character.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}});
  const current=store.live(token).scene!;
  store.executeLive({commandId:'content',campaignId:campaign.id,token,action:{kind:'scene-content',sceneId:current.id,expectedRevision:current.revision,title:'Das Basalttor',readAloud:'Der schwarze Torbogen glüht im Abendlicht.\nEin Horn erklingt.',notes:'Hinterhalt der Wachen bei drei Fehltritten.',locationId:null}});
  let player=store.executePlayer({commandId:'show-scene',campaignId:campaign.id,token,expectedRevision:0,action:{kind:'settings',settings:{blank:false,mode:'scene',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}}});
  assert.equal(player.frame.mode,'scene');assert.equal(player.frame.title,'Das Basalttor');assert.equal(player.frame.scene?.text,'Der schwarze Torbogen glüht im Abendlicht.\nEin Horn erklingt.');assert.doesNotMatch(JSON.stringify(player.frame),/Hinterhalt|Fehltritten/);
  const updated=store.live(token).scene!;store.executeLive({commandId:'clear-text',campaignId:campaign.id,token,action:{kind:'scene-content',sceneId:updated.id,expectedRevision:updated.revision,title:updated.title,readAloud:'',notes:updated.notes,locationId:null}});
  player=store.playerView(token);assert.equal(player.frame.mode,'blank');assert.match(player.frame.reason??'',/kein Vorlesetext/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
