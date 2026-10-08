import { test } from "node:test";
import assert from "node:assert/strict";
import type { AssetDefinition } from "../../src/assets";
import { ObjectTagStore } from "../../src/features/objekte/object-tag-store";
import {
  addObjectSet, addObjectTag, assignObjectTag, assignTagToSet,
  parseObjectTags, parsePackageObjectTags, removeObjectTag, serializeObjectTags,
} from "../../src/features/objekte/object-tags";
import {
  applyObjectSearch, chooseObjectSet, chooseObjectTag, clearObjectSearchText, enterObjectLibraryTab,
  newObjectLibraryState, resetObjectSearch,
  sortedObjectAssetEntries, visibleObjectAssets, visibleObjectEntries,
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

test("prepared object list keeps native-first order and full package identity", () => {
  const entries = sortedObjectAssetEntries([...assets].reverse());
  assert.deepEqual(entries.map((entry) => entry.asset.id), [
    assets[0]!.id, assets[1]!.id, assets[2]!.id, assets[3]!.id,
  ]);
  assert.deepEqual(visibleObjectEntries(entries, empty, newObjectLibraryState())
    .map((entry) => entry.asset.id), entries.map((entry) => entry.asset.id));
  assert.equal(entries[3]!.path,
    "res://packs/pack-a/textures/objects/atlas_globe_01.png");
});

test("All orders native folders before sibling files and dots before underscores", () => {
  const sample = [
    builtIn("Bird Nest", "creatures/bird_nest_01"),
    builtIn("Bottle 01", "dining/bottle_01"),
    builtIn("Cat", "creatures/domesticated/cat_01"),
    builtIn("Bottle", "dining/bottle"),
  ];
  assert.deepEqual(sortedObjectAssetEntries(sample).map((entry) => entry.asset.id), [
    sample[2]!.id, sample[0]!.id, sample[3]!.id, sample[1]!.id,
  ]);
});

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

test("native tag and set choices replace or extend checked tags", () => {
  const document = { tags: {
    Administration: [assets[0]!.files.image!],
    Alchemy: [assets[1]!.files.image!],
    Armor: [assets[2]!.files.image!],
  }, sets: { Crafts: ["Administration", "Alchemy"], Combat: ["Armor"] } };
  let state = enterObjectLibraryTab(newObjectLibraryState(), "tags");
  state = chooseObjectTag(state, "Administration", false);
  state = chooseObjectTag(state, "Administration", false);
  assert.deepEqual([...state.tags], ["Administration"], "plain repeat stays selected");
  state = chooseObjectTag(state, "Alchemy", false);
  assert.deepEqual([...state.tags], ["Alchemy"], "plain click replaces choice");
  state = chooseObjectTag(state, "Administration", true);
  assert.deepEqual([...state.tags], ["Alchemy", "Administration"]);
  assert.deepEqual(visibleObjectAssets(assets, document, state).map((item) => item.id),
    [assets[0]!.id, assets[1]!.id]);
  state = chooseObjectTag(state, "Administration", true);
  assert.deepEqual([...state.tags], ["Alchemy"], "Ctrl-click removes an additional tag");
  state = chooseObjectSet(state, "Crafts", document);
  assert.equal(state.set, "Crafts");
  assert.deepEqual([...state.tags], ["Administration", "Alchemy"]);
  state = chooseObjectTag(state, "Armor", true);
  assert.equal(state.set, "", "manual choice displays Custom Set");
  assert.deepEqual([...state.tags], ["Administration", "Alchemy", "Armor"]);
  state = chooseObjectSet(state, "Combat", document);
  assert.deepEqual([...state.tags], ["Armor"], "set choice replaces previous tags");
  state = chooseObjectSet(state, "---", document);
  assert.equal(state.set, "---");
  assert.equal(state.tags.size, 0);
  assert.equal(visibleObjectAssets(assets, document, state).length, 0);
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
