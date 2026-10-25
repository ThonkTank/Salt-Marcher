import assert from "node:assert/strict";
import test from "node:test";
import {
  checkedNarrativeAward,
  checkedNarrativeState,
  validateNarrativeBackup,
} from "../../../src/app/storage/narrative";
import type {
  NarrativeAward,
  NarrativeState,
} from "../../../src/app/runtime/narrative-contracts";

const state: NarrativeState = {
  noteId: "quest-1",
  revision: 2,
  status: "open",
  locationId: null,
  contributors: ["hero-1"],
  poolXp: 300,
  items: [
    {
      name: "Heiltrank",
      quantity: 2,
      valueGold: "50",
      category: "magic",
    },
  ],
  awardId: null,
};
const award: NarrativeAward = {
  id: "award-1",
  noteId: state.noteId,
  title: "Die verschwundene Karawane",
  sceneId: null,
  poolXp: 301,
  shareXp: 151,
  recipientIds: ["hero-1", "hero-2"],
  treasureId: "treasure-1",
  outcome: "Die Karawane wurde gefunden.",
  recordedAt: "2026-10-13T12:00:00.000Z",
};

test("narrative storage accepts bounded state and a consistent award receipt", () => {
  assert.equal(checkedNarrativeState(structuredClone(state)).noteId, state.noteId);
  assert.equal(checkedNarrativeAward(structuredClone(award)).shareXp, 151);
});

test("narrative storage rejects state that can be saved but never awarded safely", () => {
  for (const invalid of [
    {...state, contributors: ["hero-1", "hero-1"]},
    {...state, items: [{...state.items[0]!, name: "x".repeat(1001)}]},
    {...state, items: [{...state.items[0]!, quantity: 1000001}]},
    {...state, items: [{...state.items[0]!, valueGold: "unbegrenzt"}]},
    {...state, items: [{...state.items[0]!, category: "unknown"}]},
  ]) assert.throws(() => checkedNarrativeState(invalid as NarrativeState));
});

test("narrative storage rejects contradictory or malformed award receipts", () => {
  for (const invalid of [
    {...award, shareXp: 150},
    {...award, recipientIds: ["hero-1", "hero-1"]},
    {...award, outcome: ""},
    {...award, recordedAt: "never"},
  ]) assert.throws(() => checkedNarrativeAward(invalid as NarrativeAward));
});

test("backup validation keeps the supported pre-narrative schema readable but requires both tables in schema 35", () => {
  const database = (schema:number) => ({
    pragma: () => schema,
    prepare: (sql:string) => {
      assert.match(sql, /sqlite_schema/);
      return {all: () => []};
    },
  });
  assert.doesNotThrow(() => validateNarrativeBackup(database(34)));
  assert.throws(() => validateNarrativeBackup(database(35)), /unvollständig/);
});
