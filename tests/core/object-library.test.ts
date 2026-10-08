import { test } from "node:test";
import assert from "node:assert/strict";
import type { AssetDefinition } from "../../src/assets";
import { ObjectTagStore } from "../../src/features/objekte/object-tag-store";
import {
  addObjectSet, addObjectTag, assignObjectTag, assignTagToSet,
  parseObjectTags, parsePackageObjectTags, removeObjectTag, serializeObjectTags,
} from "../../src/features/objekte/object-tags";
import {
  applyObjectSearch, clearObjectSearchText, enterObjectLibraryTab,
  newObjectLibraryState, resetObjectSearch, visibleObjectAssets,
} from "../../src/features/objekte/object-library";

const builtIn = (name: string, suffix: string): AssetDefinition => ({
  id: `built-in:${suffix}`, packId: "built-in", kind: "object", name,
  files: { image: `res://textures/objects/activities/${suffix}.png` },
});
const assets: AssetDefinition[] = [
  builtIn("Atlas Globe 01", "atlas_globe_01"),
  builtIn("Glass Case 01", "glass_case_01"),
  builtIn("Stone Chair", "stone_chair"),
  { id: "pack-a:object:atlas", packId: "pack-a", kind: "object",
    name: "Atlas Globe 01", files: { image: "textures/objects/atlas_globe_01.png" } },
];
const empty = { tags: {}, sets: {} };

test("Fuzzy search, Exact search, search X and trash have separate observed effects", () => {
  let state = { ...newObjectLibraryState(assets[0]!.id), text: "atlas" };
  state = applyObjectSearch(state);
  assert.deepEqual(visibleObjectAssets(assets, empty, state).map((asset) => asset.id),
    [assets[0]!.id, assets[1]!.id, assets[3]!.id]);
  state = clearObjectSearchText(state);
  assert.equal(state.text, "");
  assert.equal(visibleObjectAssets(assets, empty, state).length, 3);
  state = resetObjectSearch(state);
  assert.equal(state.text, "");
  assert.equal(state.selectedId, "");
  assert.equal(visibleObjectAssets(assets, empty, state).length, 4);
  state = applyObjectSearch({ ...state, text: "atla", strictness: 1 });
  assert.equal(visibleObjectAssets(assets, empty, state).length, 0);
  assert.equal(visibleObjectAssets(assets, empty, { ...state, strictness: 0.5 }).length, 0,
    "moving the slider alone does not resubmit the search");
});

test("Used is captured on tab entry and refreshed only on re-entry", () => {
  let state = enterObjectLibraryTab(newObjectLibraryState(), "used", [assets[0]!.id]);
  assert.deepEqual(visibleObjectAssets(assets, empty, state).map((asset) => asset.id),
    [assets[0]!.id]);
  state = enterObjectLibraryTab(state, "used", []);
  assert.equal(visibleObjectAssets(assets, empty, state).length, 1);
  state = enterObjectLibraryTab(state, "all");
  state = enterObjectLibraryTab(state, "used", []);
  assert.equal(visibleObjectAssets(assets, empty, state).length, 0);
});

test("tag filtering resolves full source paths, including package namespace", () => {
  const packageTags = parsePackageObjectTags(JSON.stringify({
    tags: { Globe: ["textures/objects/atlas_globe_01.png"] },
    sets: { Objects: ["Globe"] },
  }), "pack-a");
  const state = { ...enterObjectLibraryTab(newObjectLibraryState(), "tags"),
    tags: new Set(["Globe"]) };
  assert.deepEqual(visibleObjectAssets(assets, packageTags, state).map((asset) => asset.id),
    [assets[3]!.id]);
});

test("tag and set editing retains membership, rejects duplicates and cleans removed tag", () => {
  let doc = addObjectTag(empty, "QA Tag");
  doc = addObjectSet(doc, "QA Set");
  doc = assignObjectTag(doc, "QA Tag", assets[0]!.files.image!, true);
  doc = assignTagToSet(doc, "QA Set", "QA Tag", true);
  assert.deepEqual(JSON.parse(serializeObjectTags(doc)), JSON.parse(JSON.stringify(doc)));
  assert.throws(() => addObjectTag(doc, "QA Tag"));
  doc = removeObjectTag(doc, "QA Tag");
  assert.deepEqual(doc.sets["QA Set"], []);
});

test("override Save is separate, persistent, and detects concurrent edits", async () => {
  let text: string | null = null;
  const storage = {
    async read() { return text; },
    async compareAndWrite(before: string | null, after: string) {
      if (text !== before) throw new Error("conflict");
      text = after;
    },
  };
  const store = new ObjectTagStore(storage);
  assert.equal(await store.load(), null);
  const draft = addObjectTag(empty, "Unsaved");
  assert.equal(text, null, "draft edits do not write before Save");
  await store.save(draft);
  assert.deepEqual(JSON.parse(JSON.stringify(store.current())), draft);
  assert.deepEqual(JSON.parse(JSON.stringify(await new ObjectTagStore(storage).load())), draft);
  text = serializeObjectTags(addObjectTag(empty, "External"));
  await assert.rejects(store.save(addObjectTag(draft, "Second")), /conflict/);
  assert.deepEqual(JSON.parse(JSON.stringify(store.current())), draft);
  assert.equal(Object.hasOwn(parseObjectTags(text).tags, "External"), true);
});
