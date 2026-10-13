import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import {applyChaseAction,type ChaseState} from "../../src/app/chase-contracts";
import {readChase} from "../../src/app/storage/chase";

const running=():ChaseState=>({id:"chase-1",revision:1,sceneId:"scene-1",title:"Flucht",status:"running",round:0,goal:"Tor",complication:"",outcome:"",participants:[{id:"p-1",name:"Flüchtende",side:"quarry",distance:0,speed:9,exhaustion:0,notes:""},{id:"p-2",name:"Wache",side:"pursuer",distance:12,speed:9,exhaustion:0,notes:""}]});

test("chase rounds require one bounded update for every participant",()=>{
  const state=running();
  assert.throws(()=>applyChaseAction(state,{kind:"round",changes:[{participantId:"p-1",distance:9,exhaustion:0}],complication:""}),/vollständig/);
  assert.throws(()=>applyChaseAction(state,{kind:"round",changes:[{participantId:"p-1",distance:9,exhaustion:0},{participantId:"p-1",distance:18,exhaustion:1}],complication:""}),/eindeutig/);
  const next=applyChaseAction(state,{kind:"round",changes:[{participantId:"p-1",distance:9,exhaustion:0},{participantId:"p-2",distance:21,exhaustion:1}],complication:"Markt"});
  assert.equal(next.round,1);assert.equal(next.revision,2);assert.equal(next.participants[1]!.exhaustion,1);
});

test("finished chases are terminal",()=>{
  const finished=applyChaseAction(running(),{kind:"finish",outcome:"Entkommen"});
  assert.equal(finished.status,"finished");
  assert.throws(()=>applyChaseAction(finished,{kind:"remove",participantId:"p-1"}),/abgeschlossen/);
});

test("recent chase summaries verify the stored envelope",()=>{
  const state=running(),payload=JSON.stringify(state),row={campaign_id:"campaign-1",id:state.id,scene_id:state.sceneId,revision:state.revision,status:state.status,payload,checksum:createHash("sha256").update(payload).digest("hex")};
  const db={prepare:(sql:string)=>({get:()=>sql.includes("status='running'")?row:undefined,all:()=>sql.includes("ORDER BY rowid DESC LIMIT 30")?[{...row,checksum:"broken"}]:[]})};
  assert.throws(()=>readChase(db,"campaign-1","scene-1"),/nicht verfügbar/);
});
