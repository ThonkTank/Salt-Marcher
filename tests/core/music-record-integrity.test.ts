import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../src/app/storage/store';
import type {MusicCommand} from '../../src/app/music-contracts';

const checksum=(payload:string)=>createHash('sha256').update(payload).digest('hex');
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'music-record-integrity-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test'),campaign=store.create('Musikzeilen'),token=store.activate(campaign.id).token;
 store.executeLive({commandId:'character',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}});
 const scene=store.executeLive({commandId:'initialize',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:1}}).scene!;
 const sceneCommand:MusicCommand={commandId:'scene-music',campaignId:campaign.id,token,action:{kind:'scene-settings',expectedRevision:0,settings:{sceneId:scene.id,revision:0,moods:{tension:60},intensity:70,vibes:['Gewitter'],genres:['Orchestral']}}};
 const subjectCommand:MusicCommand={commandId:'subject-music',campaignId:campaign.id,token,action:{kind:'subject',expectedRevision:null,subject:{id:'fixture-creature',kind:'creature',revision:0,name:'Fixture-Kreatur',vibes:['Höhle'],genres:['Drone'],vibeMode:'add',genreMode:'replace'}}};
 store.executeMusic(sceneCommand);store.executeMusic(subjectCommand);
 return{root,store,campaignId:campaign.id,token,sceneId:scene.id,sceneCommand,subjectCommand,db:(store as unknown as {db:any}).db};
}

test('scene and subject music rows bind their payload identities',async()=>{
 const f=fixture();
 try{
  const sceneRow=f.db.prepare('SELECT payload FROM scene_music WHERE campaign_id=? AND scene_id=?').get(f.campaignId,f.sceneId),scene=JSON.parse(sceneRow.payload);scene.sceneId='foreign-scene';let payload=JSON.stringify(scene);
  f.db.prepare('UPDATE scene_music SET payload=?,checksum=? WHERE campaign_id=? AND scene_id=?').run(payload,checksum(payload),f.campaignId,f.sceneId);
  assert.throws(()=>f.store.music(f.token),/Szenenmusikidentität/);
  scene.sceneId=f.sceneId;payload=JSON.stringify(scene);f.db.prepare('UPDATE scene_music SET payload=?,checksum=? WHERE campaign_id=? AND scene_id=?').run(payload,checksum(payload),f.campaignId,f.sceneId);

  const subjectRow=f.db.prepare("SELECT payload FROM music_subject WHERE campaign_id=? AND kind='creature' AND id='fixture-creature'").get(f.campaignId),subject=JSON.parse(subjectRow.payload);subject.genreMode='ignore';payload=JSON.stringify(subject);
  f.db.prepare("UPDATE music_subject SET payload=?,checksum=? WHERE campaign_id=? AND kind='creature' AND id='fixture-creature'").run(payload,checksum(payload),f.campaignId);
  assert.throws(()=>f.store.musicSubject(f.token,'creature','fixture-creature'),/Musikquellenidentität/);
  const backup=join(f.root,'safe.sqlite');writeFileSync(backup,'bestehende sichere Kopie');await assert.rejects(f.store.backup(backup),/Musikquellenidentität/);assert.equal(readFileSync(backup,'utf8'),'bestehende sichere Kopie');
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('music command replay rejects a checksummed negative receipt',()=>{
 const f=fixture();
 try{
  assert.throws(()=>f.store.executeMusic({commandId:'invalid-subject',campaignId:f.campaignId,token:f.token,action:{kind:'subject',expectedRevision:null,subject:{id:'invalid-creature',kind:'creature',revision:0,name:'',vibes:[],genres:[],vibeMode:'add',genreMode:'add'}}}),/Musikquellenidentität/);
  assert.equal(f.db.prepare("SELECT count(*) n FROM music_subject WHERE id='invalid-creature'").get().n,0);
  const payload=JSON.stringify({applied:false});f.db.prepare('UPDATE music_receipt SET payload=?,checksum=? WHERE command_id=?').run(payload,checksum(payload),f.subjectCommand.commandId);
  assert.throws(()=>f.store.executeMusic(f.subjectCommand),/Musikbestätigung/);
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('music row identities remain valid after campaign remapping',async()=>{
 const f=fixture(),snapshot=join(f.root,'music-campaign.sqlite'),destination=new CampaignStore(join(f.root,'destination.sqlite'),'test');
 try{
  await f.store.campaignSnapshot(f.token,snapshot);
  const imported=destination.acceptCampaignSnapshot(snapshot,'Importierte Musik',{},'music-import'),opened=destination.activate(imported.id),music=destination.music(opened.token),subject=destination.musicSubject(opened.token,'creature','fixture-creature');
  assert.equal(music.sceneSettings?.revision,1);
  assert.deepEqual(music.sceneSettings?.vibes,['Gewitter']);
  assert.equal(subject.revision,1);
  assert.equal(subject.genreMode,'replace');
 }finally{destination.close();f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('music backup rejects an invalid persisted playback position',async()=>{
 const f=fixture();
 try{
  f.db.prepare('INSERT INTO music_position VALUES(?,?,?)').run(f.campaignId,'stale-playback',-1);
  await assert.rejects(f.store.backup(join(f.root,'invalid-position.sqlite')),/Musikwiedergabeposition/);
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});
