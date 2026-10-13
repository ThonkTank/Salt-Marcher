import assert from "node:assert/strict";
import test from "node:test";
import {readLootBalance} from "../../src/app/storage/progression";
import {lootBalanceSuggestions} from "../../src/app/progression";

const character=(characterId:string,copper:string,active=true)=>({characterId,name:characterId,active,copper,unknownEntries:0,gapCopper:"0"});

test("loot guidance stays neutral at the lead and includes every tied laggard",()=>{
  assert.deepEqual(lootBalanceSuggestions([character("solo","500")],"500"),[]);
  assert.deepEqual(lootBalanceSuggestions([character("a","100"),character("b","100")],"100"),[]);
  assert.deepEqual(lootBalanceSuggestions([character("a","100"),character("b","100"),character("lead","500",false)],"500"),["a","b"]);
});

test("loot balance does not display a profile whose envelope is damaged",()=>{
  const db={transaction:(run:()=>unknown)=>run,prepare:(sql:string)=>({all:()=>sql.includes("character_profile")?[{id:"character-1",active:1,payload:JSON.stringify({name:"Falscher Name"}),checksum:"broken"}]:[],iterate:()=>[]})};
  assert.throws(()=>readLootBalance(db,"campaign-1"),/Beutebilanz beschädigt/);
});
