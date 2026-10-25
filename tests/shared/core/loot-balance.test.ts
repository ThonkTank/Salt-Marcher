import assert from "node:assert/strict";
import test from "node:test";
import {lootBalanceSuggestions} from "../../../src/app/runtime/progression";

const character=(characterId:string,copper:string,active=true)=>({characterId,name:characterId,active,copper,unknownEntries:0,gapCopper:"0"});

test("loot guidance stays neutral at the lead and includes every tied laggard",()=>{
  assert.deepEqual(lootBalanceSuggestions([character("solo","500")],"500"),[]);
  assert.deepEqual(lootBalanceSuggestions([character("a","100"),character("b","100")],"100"),[]);
  assert.deepEqual(lootBalanceSuggestions([character("a","100"),character("b","100"),character("lead","500",false)],"500"),["a","b"]);
});

test("unknown reward values leave the comparison open",()=>{
  assert.deepEqual(lootBalanceSuggestions([{...character("unknown","0"),unknownEntries:1},character("known","100")],"100"),[]);
});
