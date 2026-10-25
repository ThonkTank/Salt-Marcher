import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import {applyChaseAction,chaseActionControls,type ChaseState} from "../../../src/app/runtime/chase-contracts";
import {readChase,reconcileChaseParticipants} from "../../../src/app/storage/chase";

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

test("scene participants keep stable character references and cannot be imported twice",()=>{
  const participant={id:"p-3",characterId:"character-1",name:"Heldin",side:"quarry" as const,distance:0,speed:9,exhaustion:0,notes:""};
  const next=applyChaseAction(running(),{kind:"participants",participants:[participant]});
  assert.equal(next.participants[2]!.characterId,"character-1");
  assert.throws(()=>applyChaseAction(next,{kind:"participants",participants:[{...participant,id:"p-4"}]}),/bereits/);
});

test("only non-party chase participants can be hidden from the player display",()=>{
  const hidden=applyChaseAction(running(),{kind:"visibility",participantId:"p-2",hidden:true});
  assert.equal(hidden.participants[1]!.hiddenFromPlayers,true);
  assert.equal(applyChaseAction(hidden,{kind:"visibility",participantId:"p-2",hidden:false}).participants[1]!.hiddenFromPlayers,undefined);
  const withParty=applyChaseAction(running(),{kind:"participants",participants:[{id:"pc",characterId:"character-1",name:"Ada",side:"pursuer",distance:0,speed:9,exhaustion:0,notes:""}]});
  assert.throws(()=>applyChaseAction(withParty,{kind:"visibility",participantId:"pc",hidden:true}),/Spielersichtbarkeit/);
});

test("party movement removes linked characters from every running chase and records the owner result",()=>{
  const state=applyChaseAction(running(),{kind:"participants",participants:[{id:"p-3",characterId:"character-1",name:"Heldin",side:"quarry",distance:0,speed:9,exhaustion:0,notes:""}]}),payload=JSON.stringify(state),row={campaign_id:"campaign-1",id:state.id,scene_id:state.sceneId,revision:state.revision,status:state.status,payload,checksum:createHash("sha256").update(payload).digest("hex")};let saved:any[]=[],receipt:any[]=[];
  const db={prepare:(sql:string)=>sql.startsWith("SELECT")?{all:()=>[row]}:{run:(...values:any[])=>{if(sql.startsWith("INSERT INTO chase"))saved=values;else receipt=values;}}};
  reconcileChaseParticipants(db,"campaign-1",["character-1"],"move-1");
  const after=JSON.parse(saved[5]),proof=JSON.parse(receipt[5]);assert.equal(after.revision,state.revision+1);assert.equal(after.participants.some((p:any)=>p.characterId==="character-1"),false);assert.deepEqual(proof.removedCharacterIds,["character-1"]);assert.equal(proof.commandId,"move-1");
});

test("retiring a scene archives its chase without inventing an outcome",()=>{
  const state=running(),payload=JSON.stringify(state),row={campaign_id:"campaign-1",id:state.id,scene_id:state.sceneId,revision:state.revision,status:state.status,payload,checksum:createHash("sha256").update(payload).digest("hex")};let saved:any[]=[],receipt:any[]=[];
  const db={prepare:(sql:string)=>sql.startsWith("SELECT")?{all:()=>[row]}:{run:(...values:any[])=>{if(sql.startsWith("INSERT INTO chase"))saved=values;else receipt=values;}}};
  reconcileChaseParticipants(db,"campaign-1",[],"move-1",new Set(["scene-1"]));
  const after=JSON.parse(saved[5]),proof=JSON.parse(receipt[5]);assert.equal(after.status,"retired");assert.equal(after.outcome,"");assert.deepEqual(after.participants,state.participants);assert.equal(proof.retired,true);assert.deepEqual(proof.removedCharacterIds,[]);assert.throws(()=>applyChaseAction(after,{kind:"finish",outcome:"Erfunden"}),/archivierten/);
});

test("unknown chase actions cannot masquerade as completion",()=>{
  const forged={kind:"complete",outcome:"Entkommen"} as unknown as Parameters<typeof applyChaseAction>[1];
  assert.throws(()=>applyChaseAction(running(),forged),/Unbekannte Verfolgungsaktion/);
});

test("chase actions require the input they can affect",()=>{
  assert.deepEqual(chaseActionControls({title:" ",participantName:"",participantCount:0,outcome:"  "}),{start:false,addParticipant:false,advanceRound:false,finish:false});
  assert.deepEqual(chaseActionControls({title:"Flucht",participantName:"Wache",participantCount:1,outcome:"Entkommen"}),{start:true,addParticipant:true,advanceRound:true,finish:true});
});

test("recent chase summaries verify the stored envelope",()=>{
  const state=running(),payload=JSON.stringify(state),row={campaign_id:"campaign-1",id:state.id,scene_id:state.sceneId,revision:state.revision,status:state.status,payload,checksum:createHash("sha256").update(payload).digest("hex")};
  const db={prepare:(sql:string)=>({get:()=>sql.includes("status='running'")?row:undefined,all:()=>sql.includes("ORDER BY rowid DESC LIMIT 30")?[{...row,checksum:"broken"}]:[]})};
  assert.throws(()=>readChase(db,"campaign-1","scene-1"),/nicht verfügbar/);
});
