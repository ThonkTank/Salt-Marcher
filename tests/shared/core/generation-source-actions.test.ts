import assert from "node:assert/strict";
import test from "node:test";
import {sourceActionAvailability} from "../../../src/app/campaign/generation-ui";
import {currentGenerationLoot,type LootTable} from "../../../src/app/campaign/generation-contracts";

const sources=[{id:"active",trashed:false},{id:"trashed",trashed:true}];

test("source actions require a current selection and trashed loot cannot be rolled",()=>{
  assert.deepEqual(sourceActionAvailability("",sources),{selected:false,usable:false});
  assert.deepEqual(sourceActionAvailability("missing",sources),{selected:false,usable:false});
  assert.deepEqual(sourceActionAvailability("active",sources),{selected:true,usable:true});
  assert.deepEqual(sourceActionAvailability("trashed",sources),{selected:true,usable:false});
});

test("generated encounters only roll their pinned loot-table revision",()=>{
  const table={id:"loot-1",revision:2,trashed:false} as LootTable;
  assert.equal(currentGenerationLoot([{id:"loot-1",revision:2}],[table]),table);
  assert.equal(currentGenerationLoot([{id:"loot-1",revision:1}],[table]),null);
  assert.equal(currentGenerationLoot([{id:"loot-1",revision:2}],[{...table,trashed:true}]),null);
  assert.equal(currentGenerationLoot(undefined,[table]),null);
});
