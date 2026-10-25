import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../../src/app/storage/store';
import type {AtlasCell,AtlasMap} from '../../../src/app/runtime/world-contracts';
const focus=(store:CampaignStore,token:string)=>{const view=store.playerView(token);return{expectedFocusId:view.focusId,expectedFocusRevision:view.focusRevision,expectedFocusMembershipRevision:view.focusMembershipRevision,expectedFocusLocationId:view.focusLocationId};};

const cell=(q:number):AtlasCell=>({q,r:0,level:0,terrain:q===2?'forest':'plains',elevationM:0,climate:null,road:false,river:false,label:'',faction:'',interrupt:''});

test('deactivation hides a character from the player display without deleting remembered hexes',()=>{
  const root=mkdtempSync(join(tmpdir(),'player-membership-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
  try{
    const campaign=store.create('Spielerwissen'),token=store.activate(campaign.id).token;
    const character=store.executeLive({commandId:'character',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!;
    const scene=store.executeLive({commandId:'scene',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:1}}).scene!;
    const active=store.executeLive({commandId:'activate',campaignId:campaign.id,token,action:{kind:'membership',characterId:character.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}}).character!;
    const current=store.world(token).maps[0]!;
    const map:AtlasMap={...current,name:'Grenzland',cells:[cell(0),cell(2)]};
    store.executeWorld({commandId:'map',campaignId:campaign.id,token,action:{kind:'map',map,expectedRevision:current.revision}});
    store.executeWorld({commandId:'place',campaignId:campaign.id,token,action:{kind:'place-scene',sceneId:scene.id,position:{mapId:map.id,q:0,r:0,locationId:null,dungeon:null},expectedSceneRevision:0,expectedPositionRevision:0}});
    let player=store.executePlayer({...focus(store,token),commandId:'show',campaignId:campaign.id,token,expectedRevision:0,action:{kind:'settings',settings:{blank:false,mode:'follow',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}}});
    player=store.executePlayer({...focus(store,token),commandId:'observer',campaignId:campaign.id,token,expectedRevision:player.settings.revision,action:{kind:'observer',observer:{characterId:character.id,enabled:true,rangeMeters:0,darkvisionMeters:0,eyeHeightMeters:1.7}}});
    player=store.executePlayer({...focus(store,token),commandId:'remember',campaignId:campaign.id,token,expectedRevision:player.settings.revision,action:{kind:'discover',characterIds:[character.id],mapId:map.id,q:2,r:0,locationId:null,publicLabel:''}});
    assert.equal(player.frame.mode,'map');
    assert.equal(player.frame.map?.cells.find((hex:{q:number;r:number;terrain:string})=>hex.q===2&&hex.r===0)?.terrain,'forest');

    const staleObserver={...focus(store,token),commandId:'stale-observer',campaignId:campaign.id,token,expectedRevision:player.settings.revision,action:{kind:'observer' as const,observer:{characterId:character.id,enabled:true,rangeMeters:10,darkvisionMeters:0,eyeHeightMeters:1.7}}};
    const inactive=store.executeLive({commandId:'deactivate',campaignId:campaign.id,token,action:{kind:'membership',characterId:character.id,expectedRevision:active.membershipRevision,expectedRosterRevision:2,active:false,targetSceneId:null,expectedFocusRevision:0}}).character!;
    assert.throws(()=>store.executePlayer(staleObserver),/Fokussierte Gruppe geändert/);
    assert.deepEqual(store.playerView(token).observers,[]);
    assert.equal(store.currentPlayerFrame().mode,'blank');

    store.executeLive({commandId:'reactivate',campaignId:campaign.id,token,action:{kind:'membership',characterId:character.id,expectedRevision:inactive.membershipRevision,expectedRosterRevision:3,active:true,targetSceneId:scene.id,expectedFocusRevision:0}});
    const restored=store.playerView(token);
    assert.deepEqual(restored.observers.map(observer=>observer.characterId),[character.id]);
    assert.equal(restored.frame.mode,'map');
    assert.equal(restored.frame.map?.cells.find((hex:{q:number;r:number;terrain:string})=>hex.q===2&&hex.r===0)?.terrain,'forest');
  }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
