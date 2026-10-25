import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../../src/app/storage/store';

const checksum=(payload:string)=>createHash('sha256').update(payload).digest('hex');

test('checksummed but impossible music state is rejected by reads and backups',async()=>{
 const root=mkdtempSync(join(tmpdir(),'music-state-integrity-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Musikintegrität'),token=store.activate(campaign.id).token;
  store.executeMusic({commandId:'settings',campaignId:campaign.id,token,action:{kind:'settings',expectedRevision:0,autoplay:false,autoAmbience:false,volume:.7,ambienceVolume:.3,fadeSeconds:2,loop:'none'}});
  const db=(store as unknown as {db:any}).db,row=db.prepare('SELECT * FROM music_state WHERE campaign_id=?').get(campaign.id),state=JSON.parse(row.payload);
  state.volume=2;
  const payload=JSON.stringify(state);
  db.prepare('UPDATE music_state SET payload=?,checksum=? WHERE campaign_id=?').run(payload,checksum(payload),campaign.id);

  assert.throws(()=>store.music(token),/Bereichs|ungültig/);
  assert.throws(()=>store.campaignOverview(),/Bereichs|ungültig/);
  const backup=join(root,'safe.sqlite');writeFileSync(backup,'vorherige sichere Kopie');
  await assert.rejects(store.backup(backup),/Bereichs|ungültig/);
  assert.equal(readFileSync(backup,'utf8'),'vorherige sichere Kopie');
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('checksummed but impossible audio registry is rejected by reads and backups',async()=>{
 const root=mkdtempSync(join(tmpdir(),'music-registry-integrity-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Registerintegrität'),token=store.activate(campaign.id).token;
  store.executeMusic({commandId:'registry',campaignId:campaign.id,token,action:{kind:'registry',expectedRevision:0,axes:[{id:'tension',name:'Spannung',lowLabel:'Ruhig',highLabel:'Gefahr'}]}});
  const db=(store as unknown as {db:any}).db,row=db.prepare("SELECT * FROM audio_registry WHERE id='main'").get(),registry=JSON.parse(row.payload);
  registry.catalogRevision=-1;
  const payload=JSON.stringify(registry);
  db.prepare("UPDATE audio_registry SET payload=?,checksum=? WHERE id='main'").run(payload,checksum(payload));

  assert.throws(()=>store.music(token),/Musikregister/);
  const backup=join(root,'safe.sqlite');writeFileSync(backup,'vorherige sichere Kopie');
  await assert.rejects(store.backup(backup),/Musikregister/);
  assert.equal(readFileSync(backup,'utf8'),'vorherige sichere Kopie');
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('automatic ambience state cannot reference a song',()=>{
 const root=mkdtempSync(join(tmpdir(),'music-ambience-integrity-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Ambienceintegrität'),token=store.activate(campaign.id).token;
  store.executeMusic({commandId:'settings',campaignId:campaign.id,token,action:{kind:'settings',expectedRevision:0,autoplay:false,autoAmbience:false,volume:.7,ambienceVolume:.3,fadeSeconds:2,loop:'none'}});
  const bytes=Buffer.from('song'),sha256=checksum(bytes.toString()),song=store.ingestAudio(token,{sha256,extension:'.ogg',bytes:bytes.length,mime:'audio/ogg',originalName:'song.ogg'});
  const db=(store as unknown as {db:any}).db,row=db.prepare('SELECT * FROM music_state WHERE campaign_id=?').get(campaign.id),state=JSON.parse(row.payload);
  state.automaticAmbience=[song.id];
  const payload=JSON.stringify(state);
  db.prepare('UPDATE music_state SET payload=?,checksum=? WHERE campaign_id=?').run(payload,checksum(payload),campaign.id);

  assert.throws(()=>store.music(token),/Ambience/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
