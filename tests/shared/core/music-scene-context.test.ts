import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../../src/app/storage/store';
import type {Weather} from '../../../src/app/runtime/world-contracts';

function splitFixture(){
  const root=mkdtempSync(join(tmpdir(),'music-scene-context-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
  const campaign=store.create('Musikkontext'),token=store.activate(campaign.id).token;
  const one=store.executeLive({commandId:'character-one',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!;
  const two=store.executeLive({commandId:'character-two',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Borin'}}}).character!;
  const primary=store.executeLive({commandId:'initialize',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:2}}).scene!;
  store.executeLive({commandId:'activate-one',campaignId:campaign.id,token,action:{kind:'membership',characterId:one.id,expectedRevision:0,expectedRosterRevision:2,active:true,targetSceneId:primary.id,expectedFocusRevision:0}});
  store.executeLive({commandId:'activate-two',campaignId:campaign.id,token,action:{kind:'membership',characterId:two.id,expectedRevision:0,expectedRosterRevision:3,active:true,targetSceneId:primary.id,expectedFocusRevision:0}});
  const split=store.executeLive({commandId:'split',campaignId:campaign.id,token,action:{kind:'move',sceneId:primary.id,expectedRosterRevision:4,expectedFocusRevision:0,expectedClockRevision:0,expectedSceneMembershipRevision:2,memberIds:[two.id],target:{kind:'new',title:'Mittagsgruppe',expectedContentRevision:0}}});
  return{root,store,campaignId:campaign.id,token,characterId:one.id,primaryId:primary.id,secondaryId:split.session!.createdScene!.id};
}

const enableAutomaticMusic=(f:ReturnType<typeof splitFixture>)=>f.store.executeMusic({commandId:'music-settings',campaignId:f.campaignId,token:f.token,action:{kind:'settings',expectedRevision:0,autoplay:true,autoAmbience:true,volume:.7,ambienceVolume:.3,fadeSeconds:2,loop:'none'}});
function addRainAmbience(f:ReturnType<typeof splitFixture>){const bytes=Buffer.from('rain ambience fixture'),sha256=createHash('sha256').update(bytes).digest('hex'),directory=join(f.root,'audio');mkdirSync(directory,{recursive:true});writeFileSync(join(directory,sha256+'.ogg'),bytes);const asset=f.store.ingestAudio(f.token,{sha256,extension:'.ogg',bytes:bytes.length,mime:'audio/ogg',originalName:'regen.ogg'});f.store.executeMusic({commandId:'rain-ambience',campaignId:f.campaignId,token:f.token,action:{kind:'asset',expectedRevision:asset.revision,asset:{...asset,kind:'ambience',vibes:['Regen']}}});return asset.id;}

test('automatic music follows the focused scene clock rather than another scene future',()=>{
  const f=splitFixture();
  try{
    let music=enableAutomaticMusic(f);
    assert.equal(music.context.sceneId,f.primaryId);
    assert.ok(music.context.environment.includes('Nacht'));
    const signature=music.state.contextSignature,revision=music.state.revision;

    f.store.executeLive({commandId:'secondary-noon',campaignId:f.campaignId,token:f.token,action:{kind:'advance-clock',sceneId:f.secondaryId,expectedRevision:0,amount:12,unit:'hours',calendarVersion:'relative-v1',reason:'Andere Gruppe reist'}});
    music=f.store.music(f.token);
    assert.equal(music.context.sceneId,f.primaryId);
    assert.ok(music.context.environment.includes('Nacht'));
    assert.equal(music.state.contextSignature,signature);
    assert.equal(music.state.revision,revision);

    f.store.executeLive({commandId:'focus-noon',campaignId:f.campaignId,token:f.token,action:{kind:'focus',sceneId:f.secondaryId,expectedRevision:0}});
    music=f.store.music(f.token);
    assert.equal(music.context.sceneId,f.secondaryId);
    assert.ok(music.context.environment.includes('Tag'));
    assert.notEqual(music.state.contextSignature,signature);
  }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('damaged focused weather cannot rewrite the last valid automatic music state',()=>{
  const f=splitFixture(),weather:Weather={label:'Regen am Hafen',kind:'rain',intensity:.5,windKmh:20,effects:{visibilityMeters:3500,travelFactor:1.2,perception:'Regen',temperatureC:12,ambience:['Regen'],combatNote:''},source:'GM'};
  try{
    const rainId=addRainAmbience(f);
    f.store.executeWorld({commandId:'weather',campaignId:f.campaignId,token:f.token,action:{kind:'weather-override',sceneId:f.primaryId,expectedClockRevision:0,expectedOverrideRevision:null,weather}});
    const beforeView=enableAutomaticMusic(f),before=beforeView.state;assert.deepEqual(beforeView.layers.map((layer:{assetId:string})=>layer.assetId),[rainId]);
    const db=(f.store as unknown as {db:any}).db,payload=JSON.stringify({weather});
    db.prepare("UPDATE world_record SET payload=?,checksum=? WHERE campaign_id=? AND kind='weather-override' AND id=?").run(payload,createHash('sha256').update(payload+'-damaged').digest('hex'),f.campaignId,f.primaryId);

    const profile=f.store.live(f.token).roster.find(character=>character.id===f.characterId)!;
    f.store.executeLive({commandId:'profile-after-weather-damage',campaignId:f.campaignId,token:f.token,action:{kind:'profile',characterId:f.characterId,expectedRevision:profile.profileRevision,profile:{...profile.profile,name:'Ada Neu'}}});
    const after=f.store.music(f.token);
    assert.equal(f.store.live(f.token).roster.find(character=>character.id===f.characterId)!.profile.name,'Ada Neu');
    assert.ok(after.problems.some((problem:string)=>problem.startsWith('Umgebung:')));
    assert.equal(after.state.revision,before.revision);
    assert.equal(after.state.contextSignature,before.contextSignature);
    assert.deepEqual(after.state.queue,before.queue);
    assert.deepEqual(after.layers.map((layer:{assetId:string})=>layer.assetId),[rainId]);
  }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});
