import assert from "node:assert/strict";
import test from "node:test";
import {executeSceneRule} from "../../src/app/storage/rule-references";

const db={transaction:(run:()=>unknown)=>({immediate:run})};
const base={commandId:"command-1",campaignId:"campaign-1",token:"token-1",sceneId:"scene-1",expectedRevision:0};

test("scene rules reject unknown actions before reading or writing storage",()=>{
  const command={...base,action:{kind:"replace",noteId:"rule-1"}} as unknown as Parameters<typeof executeSceneRule>[1];
  assert.throws(()=>executeSceneRule(db,command,()=>{}),/Ungültiger Regelreferenz-Auftrag/);
});

test("scene rules reject malformed command identities before storage",()=>{
  const command={...base,commandId:7,action:{kind:"pin",noteId:"rule-1"}} as unknown as Parameters<typeof executeSceneRule>[1];
  assert.throws(()=>executeSceneRule(db,command,()=>{}),/Ungültiger Regelreferenz-Auftrag/);
});
