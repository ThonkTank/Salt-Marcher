import assert from "node:assert/strict";
import test from "node:test";
import {sourceActionAvailability} from "../../src/app/generation-ui";

const sources=[{id:"active",trashed:false},{id:"trashed",trashed:true}];

test("source actions require a current selection and trashed loot cannot be rolled",()=>{
  assert.deepEqual(sourceActionAvailability("",sources),{selected:false,usable:false});
  assert.deepEqual(sourceActionAvailability("missing",sources),{selected:false,usable:false});
  assert.deepEqual(sourceActionAvailability("active",sources),{selected:true,usable:true});
  assert.deepEqual(sourceActionAvailability("trashed",sources),{selected:true,usable:false});
});
