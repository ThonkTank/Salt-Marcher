import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import path from 'node:path';import {tmpdir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';import {createRequire} from 'node:module';import {buildSync} from 'esbuild';
buildSync({stdin:{contents:"export {CampaignStore} from './src/app/storage/store';export {inspectDungeon} from './src/app/import-dungeon';",resolveDir:process.cwd(),sourcefile:'extension-reference-review.ts',loader:'ts'},outfile:'.build/extension-reference-transfer.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,inspectDungeon}=createRequire(import.meta.url)('../.build/extension-reference-transfer.cjs'),hash=b=>createHash('sha256').update(b).digest('hex');
for(const variant of ['token','payload','checksum','metadata','historical'])test(`missing extension transfer preserves opaque reference ${variant} while remapping the declared room slot`,async t=>{
 const root=mkdtempSync(path.join(tmpdir(),'extension-reference-')),source=new CampaignStore(path.join(root,'source.sqlite'));let target=new CampaignStore(path.join(root,'target.sqlite'));t.after(()=>{source.close();target.close();rmSync(root,{recursive:true,force:true});});
 const campaign=source.create('Original',inspectDungeon(readFileSync('tests/fixtures/atlas/reference-transfer.dungeon','utf8')).rooms),w=source.activate(campaign.id),roomId=w.rooms[0].id,id=randomUUID(),body=Buffer.from([0,255,17,0,42]);
 const payload=JSON.stringify({token:'provider-secret-context',roomId,title:'  Originaltext '+roomId+'\r\n'}),refs={roomId};
 if(variant==='token')refs.token='opaque-provider-token '+roomId;
 else if(variant==='payload')refs.payload=payload;
 else if(variant==='checksum')Object.assign(refs,{payload,checksum:hash(payload)});
 else if(variant==='metadata')Object.assign(refs,{payload:{roomId,token:'opaque'},config:{roomId},media:{assetId:roomId},source:{id:roomId},sources:[{roomId}],sourceId:roomId,creature:{kind:'creature',id:'goblin'}});
 const choices={};
 if(variant==='historical'){
  const definition={id:randomUUID(),revision:0,name:'Quelle',category:'other',magic:false,rarity:'',attunement:'no',unitCopper:'100',weightText:'',properties:[],description:'',source:{kind:'authored',label:'Eigene Quelle',license:null,url:null},trashed:false};
  source.executeItemShop({commandId:randomUUID(),campaignId:campaign.id,token:w.token,action:{kind:'definition',expectedRevision:null,definition}});const other=target.create('Zielvorbestand'),tw=target.activate(other.id);target.executeItemShop({commandId:randomUUID(),campaignId:other.id,token:tw.token,action:{kind:'definition',expectedRevision:null,definition:{...definition,unitCopper:'200'}}});
  choices['item:'+definition.id]='keep-current';refs.payload={definitionId:definition.id,text:'Originalprovider'};
 }
 const references=JSON.stringify(refs);source.db.prepare('INSERT INTO campaign_capability VALUES(?,?,?,?,?,?,?)').run(campaign.id,id,'missing.way-note',0,references,body,hash(body));
 const before=source.db.serialize(),snapshot=path.join(root,'campaign.sqlite');await source.campaignSnapshot(w.token,snapshot);const bytes=readFileSync(snapshot);
 const copy=target.acceptCampaignSnapshot(snapshot,'Unabhängig',choices),row=target.db.prepare('SELECT * FROM campaign_capability WHERE campaign_id=?').get(copy.id),actual=JSON.parse(row.references_json);
 assert.notEqual(actual.roomId,roomId);assert.ok(target.db.prepare('SELECT 1 FROM room WHERE campaign_id=? AND id=?').get(copy.id,actual.roomId));
 for(const [key,value] of Object.entries(refs))if(key!=='roomId')assert.deepEqual(actual[key],value,`${key} is opaque provider metadata`);
 assert.ok(row.body.equals(body));assert.equal(row.checksum,hash(body));assert.ok(source.db.serialize().equals(before));assert.ok(readFileSync(snapshot).equals(bytes));assert.deepEqual(target.extensions(null).items,[]);
 target.close();target=new CampaignStore(path.join(root,'target.sqlite'));target.activate(copy.id);assert.deepEqual(JSON.parse(target.db.prepare('SELECT references_json FROM campaign_capability WHERE campaign_id=?').get(copy.id).references_json),actual);
});
