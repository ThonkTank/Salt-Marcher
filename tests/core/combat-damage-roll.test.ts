import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../src/app/storage/store';

test('a combat applies a persisted damage roll at the confirmed scale',()=>{
  const root=mkdtempSync(join(tmpdir(),'combat-damage-roll-')),filename=join(root,'campaign.sqlite');let store=new CampaignStore(filename,'test');
  try{
    const campaign=store.create('Schadenswurf'),workspace=store.activate(campaign.id),token=workspace.token;
    const scene=store.executeLive({commandId:'live',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:0}}).scene!;
    let combat=store.executeCombat({commandId:'combat',campaignId:campaign.id,token,combatId:null,expectedRevision:null,action:{kind:'create',sceneId:scene.id,title:'Probe',includeParty:false,expectedMembershipRevision:scene.membershipRevision}}).combat!;
    combat=store.executeCombat({commandId:'target',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'add',name:'Ziel',count:1,grouped:false,maxHp:20,armorClass:10,initiativeBonus:0}}).combat!;
    const checks=store.executeSceneCheck({commandId:'roll',campaignId:campaign.id,token,sceneId:scene.id,expectedRevision:0,action:{kind:'formula',formulaKind:'damage',label:'Klauen · Hiebschaden',actor:'Bestie',formula:'2d6 + 2',dc:null,sourceCreatureId:'beast',sourceActionId:'claws'}}),check=checks.checks[0]!,amount=Math.floor(check.total/2);
    assert.throws(()=>store.executeCombat({commandId:'bad-damage',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'damage',participantId:combat.participants[0]!.id,amount:amount+1,sourceCheckId:check.id,sourceScale:'half'}}),/stimmt nicht/);
    const command={commandId:'damage',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'damage' as const,participantId:combat.participants[0]!.id,amount,sourceCheckId:check.id,sourceScale:'half' as const}};
    const applied=store.executeCombat(command);assert.equal(applied.combat!.participants[0]!.hp,20-amount);assert.deepEqual(store.executeCombat(command),applied);
    store.close();store=new CampaignStore(filename,'test');const reopened=store.activate(campaign.id);
    assert.equal(store.sceneChecks(reopened.token,scene.id).checks[0]!.id,check.id);
    assert.equal(store.combat(reopened.token,scene.id,combat.id).combat!.participants[0]!.hp,20-amount);
  }finally{try{store.close();}catch{}rmSync(root,{recursive:true,force:true});}
});
