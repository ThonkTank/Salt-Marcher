import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import {ledgerStacksMatch,type LedgerItem} from '../../../src/app/runtime/progression';
import {installItemDefinitions} from '../../../src/app/storage/item-definitions';
import {readLedgerInventory} from '../../../src/app/storage/progression';

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const definition=(id:string,revision:number,name:string,unitCopper:string,trashed=false)=>({id,revision,name,category:'equipment' as const,magic:false,rarity:'',attunement:'no' as const,unitCopper,weightText:'',properties:[],description:'',source:{kind:'authored' as const,label:'Test',license:null,url:null},trashed});
const ledger=(changes:Partial<LedgerItem>={}):LedgerItem=>({id:'ledger-a',characterId:'hero',revision:1,reference:{kind:'authored',definitionId:'shared',revision:1,historicalDefinitionId:'archived'},name:'Importiertes Seil',category:'equipment',quantity:2,unitCopper:'200',origin:'purchase',status:'received',actualSaleCopper:null,counterparty:'Quellshop',counterpartyReference:{shopId:'shop-a',owner:{kind:'npc',id:'npc-a'}},paidCopper:'400',treasureId:null,combatId:null,sceneId:'scene-a',locationId:'place-a',instantMs:'1000',recordedAt:'2026-01-01T00:00:00.000Z',parentId:null,...changes});

test('ledger stack compatibility binds definition revision and full provenance',()=>{
  const a=ledger(),split=ledger({id:'ledger-b',parentId:a.id,recordedAt:'2026-01-02T00:00:00.000Z',paidCopper:'200'});
  assert.equal(ledgerStacksMatch(a,split),true);
  assert.equal(ledgerStacksMatch(a,{...split,reference:{...split.reference,revision:2}}),false);
  assert.equal(ledgerStacksMatch(a,{...split,counterpartyReference:{shopId:'shop-b',owner:{kind:'npc',id:'npc-a'}}}),false);
  assert.equal(ledgerStacksMatch(a,{...split,reference:{...split.reference,historicalDefinitionId:'other'}}),false);
  for(const key of ['rewardCreditId','sourceTreasureId','sourceTreasureItemId'])assert.equal(ledgerStacksMatch(a,{...split,[key]:'different-origin'}),false);
});

test('ledger inventory validates remapped history while projecting the chosen current definition',()=>{
  const db=new Database(':memory:');
  try{
    db.exec("CREATE TABLE authored_item(id TEXT PRIMARY KEY,revision INTEGER,name TEXT,category TEXT,unit_copper TEXT) STRICT; CREATE TABLE roster_member(campaign_id TEXT,id TEXT,PRIMARY KEY(campaign_id,id)) STRICT; CREATE TABLE character_ledger(campaign_id TEXT,id TEXT,character_id TEXT,revision INTEGER,payload TEXT,checksum TEXT,PRIMARY KEY(campaign_id,id)) STRICT;");
    installItemDefinitions(db);
    const put=(d:ReturnType<typeof definition>,version=true)=>{const payload=JSON.stringify(d);db.prepare('INSERT INTO item_definition VALUES(?,?,?,?)').run(d.id,d.revision,payload,hash(payload));db.prepare('INSERT INTO authored_item VALUES(?,?,?,?,?)').run(d.id,d.revision,d.name,d.category,d.unitCopper);if(version)db.prepare('INSERT INTO item_definition_version VALUES(?,?,?,?)').run(d.id,d.revision,payload,hash(payload));};
    put(definition('shared',1,'Lokales Seil','50'));
    const old=definition('archived',1,'Importiertes Seil','200'),head=definition('archived',2,'Importiertes Seil','200',true),oldPayload=JSON.stringify(old),headPayload=JSON.stringify(head);
    db.prepare('INSERT INTO authored_item VALUES(?,?,?,?,?)').run(head.id,head.revision,head.name,head.category,head.unitCopper);db.prepare('INSERT INTO item_definition VALUES(?,?,?,?)').run(head.id,head.revision,headPayload,hash(headPayload));db.prepare('INSERT INTO item_definition_version VALUES(?,?,?,?)').run(old.id,old.revision,oldPayload,hash(oldPayload));db.prepare('INSERT INTO item_definition_version VALUES(?,?,?,?)').run(head.id,head.revision,headPayload,hash(headPayload));
    db.prepare('INSERT INTO roster_member VALUES(?,?)').run('campaign','hero');
    for(const item of [ledger(),ledger({id:'ledger-bad',name:'Manipuliert'})]){const payload=JSON.stringify(item);db.prepare('INSERT INTO character_ledger VALUES(?,?,?,?,?,?)').run('campaign',item.id,item.characterId,item.revision,payload,hash(payload));}
    const page=readLedgerInventory(db,'campaign',{characterId:'hero',after:null});assert.equal(page.items.length,1);assert.equal(page.items[0]!.name,'Importiertes Seil');assert.equal(page.items[0]!.currentName,'Lokales Seil');assert.deepEqual(page.problems.map(p=>p.id),['ledger-bad']);
  }finally{db.close();}
});

test('stack matching preserves reward credits and original treasure portions',()=>{
 const original=ledger({origin:'award',rewardCreditId:'credit-a',sourceTreasureId:'treasure-a',sourceTreasureItemId:'portion-a'});
 for(const change of [{rewardCreditId:'credit-b'},{sourceTreasureId:'treasure-b'},{sourceTreasureItemId:'portion-b'}])assert.equal(ledgerStacksMatch(original,{...original,...change}),false);
 assert.equal(ledgerStacksMatch(original,{...original,id:'another-ledger',quantity:3}),true);
});
