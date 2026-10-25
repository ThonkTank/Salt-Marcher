import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../../src/app/storage/store';

const digest=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const extensionBytes=(version='1.0.0')=>Buffer.from(JSON.stringify({format:'Kampagnenwerkstatt Extension',version:1,manifest:{id:'own.way-note',name:'Wegnotiz',version,hostApi:1,unitCodec:'way-note:1',rights:['ownedUnits.read','ownedUnits.write']},renderer:{html:'<p>Wegnotiz</p>',script:'throw new Error("wird nicht ausgeführt")',styles:''}}));
const install=(store:CampaignStore,version:string,expectedRevision:number|null)=>{const preview=store.extensionPreview(extensionBytes(version));return store.executeExtension({commandId:randomUUID(),action:{kind:'install',ticket:preview.ticket,hash:preview.hash,expectedRevision,rights:preview.manifest.rights}});};

test('remove, missing installation and restore retain opaque campaign capability bytes',async()=>{
 const root=mkdtempSync(join(tmpdir(),'extension-lifecycle-')),source=new CampaignStore(join(root,'source.sqlite'),'test'),destination=new CampaignStore(join(root,'destination.sqlite'),'test');
 try{
  const campaign=source.create('Extensiondaten'),token=source.activate(campaign.id).token,db=(source as unknown as {db:any}).db,body=Buffer.from([0,255,17,34,51]),references='[]';
  let extension=install(source,'1.0.0',null);db.prepare('INSERT INTO campaign_capability VALUES(?,?,?,?,?,?,?)').run(campaign.id,'way-note-a','own.way-note:way-note',1,references,body,digest(body));
  extension=source.executeExtension({commandId:randomUUID(),action:{kind:'revoke',id:extension.id,expectedRevision:extension.revision}});assert.equal(extension.state,'installed');assert.deepEqual(extension.grants,[]);
  extension=source.executeExtension({commandId:randomUUID(),action:{kind:'remove',id:extension.id,expectedRevision:extension.revision}});assert.equal(extension.state,'removed');assert.deepEqual(extension.grants,[]);assert.deepEqual(db.prepare('SELECT body FROM campaign_capability WHERE campaign_id=?').get(campaign.id).body,body);
  const snapshot=join(root,'campaign.sqlite');await source.campaignSnapshot(token,snapshot);const imported=destination.acceptCampaignSnapshot(snapshot,'Ohne Extension',{},'extension-import'),destinationDb=(destination as unknown as {db:any}).db,row=destinationDb.prepare('SELECT capability,version,references_json,body,checksum FROM campaign_capability WHERE campaign_id=?').get(imported.id);
  assert.equal(destination.extensions(null).items.length,0);assert.equal(row.capability,'own.way-note:way-note');assert.equal(row.version,1);assert.equal(row.references_json,references);assert.deepEqual(row.body,body);assert.equal(row.checksum,digest(body));
  extension=install(source,'2.0.0',extension.revision);assert.equal(extension.state,'installed');assert.equal(extension.manifest.version,'2.0.0');assert.deepEqual(db.prepare('SELECT body FROM campaign_capability WHERE campaign_id=?').get(campaign.id).body,body);
 }finally{destination.close();source.close();rmSync(root,{recursive:true,force:true});}
});

test('damaged installation metadata is isolated from campaign export and malformed commands fail closed',async()=>{
 const root=mkdtempSync(join(tmpdir(),'extension-isolation-')),store=new CampaignStore(join(root,'source.sqlite'),'test');
 try{
  const campaign=store.create('Isolierte Kampagne'),token=store.activate(campaign.id).token,installed=install(store,'1.0.0',null),db=(store as unknown as {db:any}).db,before=db.serialize();
  for(const command of [{commandId:'bad-id',action:{kind:'remove',id:'not an id',expectedRevision:installed.revision}},{commandId:'bad-revision',action:{kind:'revoke',id:installed.id,expectedRevision:0}},{commandId:'bad-install',action:{kind:'install',ticket:'missing',hash:'bad',expectedRevision:null,rights:[]}},{commandId:'extra',action:{kind:'remove',id:installed.id,expectedRevision:installed.revision},extra:true}]){assert.throws(()=>store.executeExtension(command as any),/Installations/);assert.throws(()=>store.extensionOutcome(command as any),/Installations/);}
  assert.ok(db.serialize().equals(before));db.prepare('INSERT INTO settings VALUES(?,?)').run('extension:installed:damaged','{broken');assert.equal(store.extensions(null).problems[0]?.id,'damaged');assert.equal(store.list().campaigns[0]?.id,campaign.id);
  const safe=join(root,'safe.sqlite');writeFileSync(safe,'bestehende sichere Kopie');await assert.rejects(store.backup(safe));assert.equal(readFileSync(safe,'utf8'),'bestehende sichere Kopie');
  const snapshot=join(root,'campaign.sqlite');await store.campaignSnapshot(token,snapshot);assert.ok(readFileSync(snapshot).length>0);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
