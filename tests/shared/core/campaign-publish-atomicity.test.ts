import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import type {ItemDefinition} from "../../../src/app/catalog/items-contracts";
import {CampaignStore} from "../../../src/app/storage/store";

const checksum=(value:string)=>createHash("sha256").update(value).digest("hex");
const internal=(store:CampaignStore)=>(store as unknown as {db:any}).db;
const definition=(name:string,unitCopper:string):ItemDefinition=>({
  id:"atomic-shared-item",revision:1,name,category:"equipment",magic:false,rarity:"",attunement:"no",
  unitCopper,weightText:"1 lb.",properties:[],description:"Atomarer Importbeleg",
  source:{kind:"authored",label:"Eigener Gegenstand",license:null,url:null},trashed:false,
});
function insertDefinition(store:CampaignStore,value:ItemDefinition){
  const db=internal(store),payload=JSON.stringify(value);
  db.transaction(()=>{
    db.prepare("INSERT INTO authored_item VALUES(?,?,?,?,?)").run(value.id,value.revision,value.name,value.category,value.unitCopper);
    db.prepare("INSERT INTO item_definition VALUES(?,?,?,?)").run(value.id,value.revision,payload,checksum(payload));
    db.prepare("INSERT INTO item_definition_version VALUES(?,?,?,?)").run(value.id,value.revision,payload,checksum(payload));
  }).immediate();
}
function observed(db:any){
  return{
    authoredItems:db.prepare("SELECT * FROM authored_item ORDER BY id").all(),
    campaigns:db.prepare("SELECT count(*) n FROM campaign").get().n,
    authored:db.prepare("SELECT * FROM authored_item ORDER BY id").all(),
    definitions:db.prepare("SELECT count(*) n FROM item_definition").get().n,
    versions:db.prepare("SELECT count(*) n FROM item_definition_version").get().n,
    origins:db.prepare("SELECT count(*) n FROM campaign_origin").get().n,
    receipts:db.prepare("SELECT count(*) n FROM campaign_management_receipt WHERE command_id='atomic-ticket'").get().n,
    generatorRevision:db.prepare("SELECT revision FROM generator_meta WHERE id=1").get().revision,
    shared:db.prepare("SELECT payload FROM item_definition WHERE id='atomic-shared-item'").get().payload,
  };
}

test("campaign publication rolls back a late receipt failure and retries exactly once",async()=>{
  const root=mkdtempSync(join(tmpdir(),"campaign-publish-atomicity-"));
  const destination=new CampaignStore(join(root,"destination.sqlite"),"test");
  const source=new CampaignStore(join(root,"source.sqlite"),"test");
  try{
    destination.create("Bestehend");
    const sourceCampaign=source.create("Quelle"),workspace=source.activate(sourceCampaign.id);
    insertDefinition(destination,definition("Lokaler Stab","100"));
    insertDefinition(source,definition("Importierter Stab","250"));
    const snapshot=join(root,"source-snapshot.sqlite");
    await source.campaignSnapshot(workspace.token,snapshot);

    const db=internal(destination),before=observed(db),choices={"item:atomic-shared-item":"keep-imported" as const};
    db.exec(`CREATE TRIGGER fail_atomic_receipt BEFORE INSERT ON campaign_management_receipt
      WHEN NEW.command_id='atomic-ticket' BEGIN SELECT RAISE(ABORT,'später Receiptfehler'); END;`);
    assert.throws(()=>destination.acceptCampaignSnapshot(snapshot,"Übernommene Quelle",choices,"atomic-ticket"),/später Receiptfehler/);
    assert.deepEqual(observed(db),before);

    db.exec("DROP TRIGGER fail_atomic_receipt");
    const imported=destination.acceptCampaignSnapshot(snapshot,"Übernommene Quelle",choices,"atomic-ticket");
    const after=observed(db),head=JSON.parse(after.shared);
    assert.equal(head.name,"Importierter Stab");
    assert.equal(after.campaigns,before.campaigns+1);
    assert.equal(after.definitions,before.definitions+1);
    assert.equal(after.versions,before.versions+2);
    assert.equal(after.origins,before.origins+1);
    assert.equal(after.receipts,1);
    assert.equal(after.generatorRevision,before.generatorRevision+1);
    const receipt=db.prepare("SELECT subject_id,fingerprint FROM campaign_management_receipt WHERE command_id='atomic-ticket'").get();
    assert.equal(receipt.subject_id,imported.id);
    assert.match(receipt.fingerprint,/^transfer:[0-9a-f]{64}$/);
    const archived=db.prepare("SELECT payload FROM item_definition WHERE id!='atomic-shared-item' AND json_extract(payload,'$.name')='Lokaler Stab'").get();
    assert.ok(archived);
    assert.equal(JSON.parse(archived.payload).trashed,true);

    assert.deepEqual(destination.acceptCampaignSnapshot(snapshot,"Übernommene Quelle",choices,"atomic-ticket"),imported);
    assert.deepEqual(observed(db),after);
  }finally{
    source.close();destination.close();rmSync(root,{recursive:true,force:true});
  }
});

test("campaign transfer preserves ledger history while remapping its character owner",async()=>{
  const root=mkdtempSync(join(tmpdir(),"campaign-ledger-transfer-"));
  const destination=new CampaignStore(join(root,"destination.sqlite"),"test");
  const source=new CampaignStore(join(root,"source.sqlite"),"test");
  try{
    destination.create("Lokaler Katalog");
    insertDefinition(destination,definition("Lokaler Stab","100"));
    const campaign=source.create("Quellgruppe"),workspace=source.activate(campaign.id);
    insertDefinition(source,definition("Importierter Stab","250"));
    const character=source.executeLive({commandId:"ledger-character",campaignId:campaign.id,token:workspace.token,
      action:{kind:"create-character",profile:{name:"Ada"}}}).character!;
    const awarded=source.executeProgress({commandId:"ledger-item",campaignId:campaign.id,token:workspace.token,
      action:{kind:"manual-item",characterId:character.id,expectedMembershipRevision:character.membershipRevision,origin:"manual",
        item:{name:"Importierter Stab",quantity:2,valueGold:"2.5",category:"equipment",
          reference:{kind:"authored",definitionId:"atomic-shared-item",revision:1}},note:"Fund im Quellarchiv"}});
    const sourceLedgerId=awarded.ledgerIds[0]!;
    const snapshot=join(root,"source-snapshot.sqlite");
    await source.campaignSnapshot(workspace.token,snapshot);

    const imported=destination.acceptCampaignSnapshot(snapshot,"Übernommene Gruppe",{
      "item:atomic-shared-item":"keep-current",
    },"ledger-transfer-ticket");
    const opened=destination.activate(imported.id),characters=destination.progress(opened.token).characters;
    assert.equal(characters.length,1);
    assert.equal(characters[0]!.name,"Ada");
    assert.notEqual(characters[0]!.characterId,character.id);
    const page=destination.ledger(opened.token,{characterId:characters[0]!.characterId,after:null,search:"",status:""});
    assert.equal(page.problems.length,0);
    assert.equal(page.items.length,1);
    const item=page.items[0]!;
    assert.notEqual(item.id,sourceLedgerId);
    assert.equal(item.characterId,characters[0]!.characterId);
    assert.equal(item.reference.definitionId,"atomic-shared-item");
    assert.ok(item.reference.historicalDefinitionId);
    assert.notEqual(item.reference.historicalDefinitionId,item.reference.definitionId);
    assert.equal(item.reference.revision,1);
    assert.equal(item.name,"Importierter Stab");
    assert.equal(item.unitCopper,"250");
    assert.equal(item.currentName,"Lokaler Stab");
    assert.equal(item.currentUnitCopper,"100");
    assert.equal(item.quantity,2);
    assert.equal(item.counterparty,"Fund im Quellarchiv");
    const history=destination.progressHistory(opened.token,characters[0]!.characterId,null);
    const recorded=history.items.find((entry:{kind:string;facts:Record<string,any>})=>entry.kind==="manual-loot")?.facts.entry;
    assert.equal(recorded.characterId,characters[0]!.characterId);
    assert.equal(recorded.reference.historicalDefinitionId,item.reference.historicalDefinitionId);
  }finally{
    source.close();destination.close();rmSync(root,{recursive:true,force:true});
  }
});
