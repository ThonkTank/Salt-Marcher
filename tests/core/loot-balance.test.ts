import assert from "node:assert/strict";
import test from "node:test";
import {readLootBalance} from "../../src/app/storage/progression";

test("loot balance does not display a profile whose envelope is damaged",()=>{
  const db={transaction:(run:()=>unknown)=>run,prepare:(sql:string)=>({all:()=>sql.includes("character_profile")?[{id:"character-1",active:1,payload:JSON.stringify({name:"Falscher Name"}),checksum:"broken"}]:[],iterate:()=>[]})};
  assert.throws(()=>readLootBalance(db,"campaign-1"),/Beutebilanz beschädigt/);
});
