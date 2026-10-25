import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import {CampaignStore} from '../../../src/app/storage/store';

test('a confirmed deactivation reconciles combat once under the party command receipt',()=>{
  const root=mkdtempSync(join(tmpdir(),'mask-reconciliation-')),filename=join(root,'campaign.sqlite'),store=new CampaignStore(filename,'test');
  try{
    const campaign=store.create('Maskentest'),workspace=store.activate(campaign.id),token=workspace.token;
    const created=store.executeLive({commandId:'create-hero',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!;
    const initialized=store.executeLive({commandId:'initialize',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:1}}),scene=initialized.scene!;
    const activated=store.executeLive({commandId:'activate-hero',campaignId:campaign.id,token,action:{kind:'membership',characterId:created.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}}).character!;
    const combat=store.executeCombat({commandId:'create-combat',campaignId:campaign.id,token,combatId:null,expectedRevision:null,action:{kind:'create',sceneId:scene.id,title:'Torwache',includeParty:true,expectedMembershipRevision:1}}).combat!;
    const command={commandId:'deactivate-hero',campaignId:campaign.id,token,action:{kind:'membership' as const,characterId:created.id,expectedRevision:activated.membershipRevision,expectedRosterRevision:2,active:false,targetSceneId:null,expectedFocusRevision:0}};
    const first=store.executeLive(command),replay=store.executeLive(command);assert.deepEqual(replay,first);
    store.close();const db=new Database(filename,{readonly:true});try{
      const state=JSON.parse(db.prepare('SELECT payload FROM combat WHERE campaign_id=? AND id=?').get(campaign.id,combat.id).payload);assert.equal(state.revision,2);assert.deepEqual(state.participants,[]);
      const rows=db.prepare('SELECT payload FROM mask_reconciliation_receipt WHERE command_id=?').all(command.commandId);assert.equal(rows.length,1);assert.deepEqual(JSON.parse(rows[0].payload).removedCharacterIds,[created.id]);
      assert.equal(db.prepare('SELECT count(*) n FROM progress_event WHERE campaign_id=? AND kind=?').get(campaign.id,'combat-exit').n,1);
    }finally{db.close();}
  }finally{try{store.close();}catch{}rmSync(root,{recursive:true,force:true});}
});

test('a split that retires its source archives combat and chase without completing them',()=>{
  const root=mkdtempSync(join(tmpdir(),'mask-retirement-')),filename=join(root,'campaign.sqlite'),store=new CampaignStore(filename,'test');
  try{
    const campaign=store.create('Retirement'),token=store.activate(campaign.id).token;
    const one=store.executeLive({commandId:'create-one',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!,two=store.executeLive({commandId:'create-two',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Borin'}}}).character!;
    const scene=store.executeLive({commandId:'initialize',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:2}}).scene!;
    store.executeLive({commandId:'activate-one',campaignId:campaign.id,token,action:{kind:'membership',characterId:one.id,expectedRevision:0,expectedRosterRevision:2,active:true,targetSceneId:scene.id,expectedFocusRevision:0}});
    store.executeLive({commandId:'activate-two',campaignId:campaign.id,token,action:{kind:'membership',characterId:two.id,expectedRevision:0,expectedRosterRevision:3,active:true,targetSceneId:scene.id,expectedFocusRevision:0}});
    const combat=store.executeCombat({commandId:'combat',campaignId:campaign.id,token,combatId:null,expectedRevision:null,action:{kind:'create',sceneId:scene.id,title:'Torwache',includeParty:true,expectedMembershipRevision:2}}).combat!;
    const chase=store.executeChase({commandId:'chase',campaignId:campaign.id,token,sceneId:scene.id,chaseId:null,expectedRevision:null,action:{kind:'create',title:'Flucht',goal:'Tor'}}).chase!;
    const command={commandId:'split-all',campaignId:campaign.id,token,action:{kind:'move' as const,sceneId:scene.id,expectedRosterRevision:4,expectedFocusRevision:0,expectedClockRevision:0,expectedSceneMembershipRevision:2,memberIds:[one.id,two.id],target:{kind:'new' as const,title:'Zielgruppe',expectedContentRevision:0}}};
    const ack=store.executeLive(command);assert.deepEqual(ack.session?.retired.map((item:{id:string})=>item.id),[scene.id]);
    assert.deepEqual(store.liveArchives(token,null).items.map((item:{id:string})=>item.id),[scene.id]);
    assert.equal(store.combat(token,scene.id,combat.id).combat?.phase,'retired');assert.equal(store.chase(token,scene.id,chase.id).chase?.status,'retired');
    store.close();const db=new Database(filename,{readonly:true});try{
      const combatState=JSON.parse(db.prepare('SELECT payload FROM combat WHERE campaign_id=? AND id=?').get(campaign.id,combat.id).payload),chaseState=JSON.parse(db.prepare('SELECT payload FROM chase WHERE campaign_id=? AND id=?').get(campaign.id,chase.id).payload);
      assert.equal(combatState.phase,'retired');assert.equal(combatState.outcome,'');assert.equal(chaseState.status,'retired');assert.equal(chaseState.outcome,'');assert.equal(db.prepare('SELECT count(*) n FROM mask_reconciliation_receipt WHERE command_id=?').get(command.commandId).n,2);
    }finally{db.close();}
  }finally{try{store.close();}catch{}rmSync(root,{recursive:true,force:true});}
});
