import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../../src/app/storage/store';
import {campaignLocalId} from '../../../src/features/campaign/campaign-contracts';
import type {MusicCommand} from '../../../src/app/runtime/music-contracts';

function addAudio(f:ReturnType<typeof fixture>,name:string){
 const bytes=Buffer.from(name),sha256=checksum(name);mkdirSync(join(f.root,'audio'),{recursive:true});
 writeFileSync(join(f.root,'audio',sha256+'.wav'),bytes);
 return f.store.ingestAudio(f.token,{sha256,extension:'.wav',bytes:bytes.length,mime:'audio/wav',originalName:name+'.wav'});
}

const checksum=(payload:string)=>createHash('sha256').update(payload).digest('hex');
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'music-record-integrity-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test'),campaign=store.create('Musikzeilen'),token=store.activate(campaign.id).token;
 store.executeLive({commandId:'character',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}});
 const scene=store.executeLive({commandId:'initialize',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:1}}).scene!;
 store.executeMusic({commandId:'registry',campaignId:campaign.id,token,action:{kind:'registry',expectedRevision:0,axes:[{id:'tension',name:'Spannung',lowLabel:'Ruhig',highLabel:'Gefahr'}]}});
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
  const locationId=randomUUID(),noteId=campaignLocalId(randomUUID());
  f.store.changePreparation({commandId:'music-location',campaignId:f.campaignId,token:f.token,change:{kind:'location',expectedRevision:null,document:{kind:'location',version:1,id:locationId,name:'Tor',type:'poi',sections:[],detailMaps:[],keyLinks:[]}}});
  f.store.changePreparation({commandId:'music-note',campaignId:f.campaignId,token:f.token,change:{kind:'note',expectedRevision:null,note:{version:1,id:noteId,revision:1,kind:'rule',title:'Musikregel',readAloud:'  Original\r\n',gmNotes:'',relations:[],creatureId:null,deleted:false}}});
  for(const [kind,id]of [['location',locationId],['note',noteId]] as const)f.store.executeMusic({commandId:'music-'+kind,campaignId:f.campaignId,token:f.token,action:{kind:'subject',expectedRevision:null,subject:{id,kind,revision:0,name:kind,vibes:['Regen'],genres:[],vibeMode:'add',genreMode:'add'}}});
  await f.store.campaignSnapshot(f.token,snapshot);const bytes=readFileSync(snapshot);
  const imported=destination.acceptCampaignSnapshot(snapshot,'Importierte Musik',{},'music-import'),opened=destination.activate(imported.id),music=destination.music(opened.token),subject=destination.musicSubject(opened.token,'creature','fixture-creature');
  assert.equal(music.sceneSettings?.revision,1);
  assert.deepEqual(music.sceneSettings?.vibes,['Gewitter']);
  assert.deepEqual(music.registry.axes.map((axis:{id:string})=>axis.id),['tension']);
  assert.equal(subject.revision,1);
  assert.equal(subject.genreMode,'replace');
  const db=(destination as unknown as {db:any}).db;
  for(const row of db.prepare("SELECT kind,id FROM music_subject WHERE campaign_id=? AND kind!='creature'").all(imported.id)){
   assert.notEqual(row.id,row.kind==='location'?locationId:noteId);assert.deepEqual(destination.musicSubject(opened.token,row.kind,row.id).vibes,['Regen']);
  }
  assert.equal(db.prepare("SELECT count(*) n FROM music_subject WHERE campaign_id=? AND kind!='creature'").get(imported.id).n,2);assert.ok(bytes.equals(readFileSync(snapshot)));assert.equal(destination.preparation(opened.token).notes[0]!.note.readAloud,'  Original\r\n');

 }finally{destination.close();f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('music backup rejects an invalid persisted playback position',async()=>{
 const f=fixture();
 try{
  f.db.prepare('INSERT INTO music_position VALUES(?,?,?)').run(f.campaignId,'stale-playback',-1);
  await assert.rejects(f.store.backup(join(f.root,'invalid-position.sqlite')),/Musikwiedergabeposition/);
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('audio pages isolate damaged rows without moving the cursor and recheck media for export',()=>{
 const f=fixture();
 try{
  const assets=Array.from({length:53},(_,i)=>addAudio(f,'Titel '+i)),query={search:'',kind:'' as const,includeTrashed:false,after:null as string|null};
  const saved=f.db.prepare('SELECT * FROM audio_asset WHERE id=?'),corrupt=saved.get(assets[10]!.id),wrong=saved.get(assets[20]!.id);
  f.db.prepare('UPDATE audio_asset SET checksum=? WHERE id=?').run('damaged',corrupt.id);
  const payload=JSON.stringify({...JSON.parse(wrong.payload),id:'foreign-asset'});
  f.db.prepare('UPDATE audio_asset SET payload=?,checksum=? WHERE id=?').run(payload,checksum(payload),wrong.id);
  const missing=assets[30]!,file=join(f.root,'audio',missing.media.sha256+'.wav');rmSync(file);
  const first=f.store.audioAssets(query),second=f.store.audioAssets({...query,after:first.next});
  assert.deepEqual(first.items.map(a=>a.id),assets.slice(0,50).filter((_,i)=>i!==10&&i!==20).map(a=>a.id));
  assert.equal(first.problems.length,2);assert.ok(first.problems.some(p=>p.startsWith(corrupt.id+':')));assert.ok(first.problems.some(p=>p.startsWith(wrong.id+':')));
  assert.equal(first.items.find(a=>a.id===missing.id)!.available,false);
  assert.deepEqual(second.items.map(a=>a.id),assets.slice(50).map(a=>a.id));assert.equal(second.next,null);
  assert.throws(()=>f.store.audioLibrary(f.token),/beschädigt/);
  for(const row of [corrupt,wrong])f.db.prepare('UPDATE audio_asset SET payload=?,checksum=? WHERE id=?').run(row.payload,row.checksum,row.id);
  let library=f.store.audioLibrary(f.token);assert.deepEqual(library.assets,assets.map(a=>f.store.audioAsset(a.id)));assert.equal(library.assets[30]!.available,false);
  writeFileSync(file,Buffer.from(missing.name));assert.equal(f.store.audioAssets(query).items.find(a=>a.id===missing.id)!.available,true);
  writeFileSync(file,'changed size');library=f.store.audioLibrary(f.token);assert.equal(library.assets[30]!.available,false);
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('automatic song and ambience scans skip invalid, failed and missing media rows',()=>{
 const f=fixture();
 try{
  const song=addAudio(f,'Song'),rain=addAudio(f,'Nacht'),brokenSong=addAudio(f,'Defekter Song'),brokenLayer=addAudio(f,'Defekte Nacht'),missing=addAudio(f,'Fehlender Song'),failed=addAudio(f,'Fehlgeschlagener Song');
  for(const asset of [rain,brokenLayer])f.store.executeMusic({commandId:randomUUID(),campaignId:f.campaignId,token:f.token,action:{kind:'asset',asset:{...asset,kind:'ambience',vibes:['Nacht']},expectedRevision:asset.revision}});
  f.store.executeMusic({commandId:randomUUID(),campaignId:f.campaignId,token:f.token,action:{kind:'asset',asset:{...failed,problem:'Decoderfehler'},expectedRevision:failed.revision}});
  f.db.prepare('UPDATE audio_asset SET checksum=? WHERE id IN (?,?)').run('damaged',brokenSong.id,brokenLayer.id);
  rmSync(join(f.root,'audio',missing.media.sha256+'.wav'));
  const view=f.store.executeMusic({commandId:randomUUID(),campaignId:f.campaignId,token:f.token,action:{kind:'settings',expectedRevision:f.store.music(f.token).state.revision,autoplay:true,autoAmbience:true,volume:.7,ambienceVolume:.3,fadeSeconds:2,loop:'none'}});
  assert.equal(view.state.current?.assetId,song.id);assert.deepEqual(view.state.queue,[]);
  assert.deepEqual(view.layers.map(l=>l.assetId),[rain.id]);assert.deepEqual(view.state.automaticAmbience,[rain.id]);
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});
