import assert from "node:assert/strict";
import test from "node:test";
import {
  checkedAtlasDraft,
  parseAtlasDraft,
  serializeAtlasDraft,
  type AtlasDraft,
  type LocationAtlasDraft,
} from "../../../src/features/atlas/atlas-draft";
import {
  newOverworld,
  parseOverworld,
  serializeOverworld,
} from "../../../src/features/atlas/overworld";
import { serializeTerrainChunk } from "../../../src/features/atlas/terrain-schema";
import {
  newLocation,
  parseLocationDocument,
  serializeLocationDocument,
} from "../../../src/features/location/location-schema";

const markdown = "# Ödhafen\r\n\r\n  **Text** → 日本語 🐉  \r\n\tEnde\r\n";
const placement = (id: string, x = -40000) => ({
  kind: "location",
  id: `placement-${id}`,
  locationId: id,
  position: { x, y: 123.25 },
});
const a = newLocation("location-a", "Ödhafen", "city", ["a-desc", "a-notes"]);
const b = newLocation("location-b", "Ruine", "poi", ["b-desc", "b-notes"]);
const beforeA =
  JSON.stringify(
    { ...a, sections: [{ ...a.sections[0], markdown }, a.sections[1]] },
    null,
    3,
  ) + "\n";
const afterA = serializeLocationDocument({
  ...parseLocationDocument(beforeA),
  name: "Ödhafen am Meer",
  sections: [
    a.sections[1]!,
    { ...a.sections[0]!, markdown: markdown + "Später  \r\n" },
  ],
});
const ref = {
  level: 0,
  q: -2,
  r: 0,
  file: "terrain/0_-2_0.json",
  cellCount: 1,
  extent: { minQ: -33, maxQ: -33, minR: 0, maxR: 0 },
} as const;
const terrain = serializeTerrainChunk({
  kind: "atlas-terrain",
  version: 1,
  worldId: "world-a",
  level: 0,
  q: -2,
  r: 0,
  cells: [
    { q: -33, r: 0, surface: "land", terrain: "plain", color: "#dbc998" },
  ],
});
function fixture(): LocationAtlasDraft {
  const world = newOverworld("world-a", "Welt", "pointy");
  return {
    kind: "overworld-draft",
    version: 2,
    worldId: world.id,
    baselineWorld: JSON.stringify({ ...world, placements: [placement(a.id)] }),
    currentWorld: JSON.stringify({
      ...world,
      chunks: [ref],
      placements: [placement(a.id, -39999), placement(b.id)],
    }),
    chunks: [{ file: ref.file, before: null, after: terrain }],
    locations: [
      {
        id: a.id,
        path: `Orte/${a.id}.location`,
        before: beforeA,
        after: afterA,
      },
      {
        id: b.id,
        path: `Orte/${b.id}.location`,
        before: null,
        after: serializeLocationDocument(b),
      },
    ],
  };
}
test("V2 draft captures exact Location bytes/Markdown/order together with negative terrain and world placements", () => {
  const raw = serializeAtlasDraft(fixture()),
    fresh = parseAtlasDraft(raw);
  assert.equal(fresh.version, 2);
  if (fresh.version !== 2) throw new Error("Expected V2");
  assert.deepEqual(fresh, fixture());
  assert.equal(fresh.locations[0]!.before, beforeA);
  const doc = parseLocationDocument(fresh.locations[0]!.after!);
  assert.deepEqual(
    doc.sections.map((s) => s.id),
    ["a-notes", "a-desc"],
  );
  assert.equal(doc.sections[1]!.markdown, markdown + "Später  \r\n");
  assert(
    Object.isFrozen(fresh) &&
      Object.isFrozen(fresh.locations) &&
      Object.isFrozen(fresh.locations[0]),
  );
  assert.throws(
    () => parseOverworld(fresh.currentWorld),
    /neueren Editor/,
    "runtime remains unactivated until full repository hookup",
  );
});
test("V2 movement keeps unchanged unloaded owners; create and removal require explicit complete owner deltas", () => {
  const f = fixture(),
    move = {
      ...f,
      chunks: [],
      locations: [],
      currentWorld: JSON.stringify({
        ...JSON.parse(f.baselineWorld),
        placements: [placement(a.id, -1e9)],
      }),
    };
  assert.equal(checkedAtlasDraft(move).version, 2);
  const removal = {
    ...move,
    currentWorld: JSON.stringify({
      ...JSON.parse(f.baselineWorld),
      placements: [],
    }),
    locations: [
      {
        id: a.id,
        path: "Umbenannt/Hafen.location",
        before: beforeA,
        after: null,
      },
    ],
  };
  assert.equal(checkedAtlasDraft(removal).version, 2);
  assert.throws(() => checkedAtlasDraft({ ...removal, locations: [] }));
  assert.throws(() => checkedAtlasDraft({ ...f, locations: [f.locations[0]] }));
});
test("V2 refuses orphan/duplicate/wrong-ID owner deltas, unsafe paths and altered world geometry", () => {
  const f = fixture();
  const invalid: unknown[] = [
    { ...f, locations: [...f.locations, f.locations[0]] },
    {
      ...f,
      locations: [{ ...f.locations[0], id: "not-owned" }, f.locations[1]],
    },
    {
      ...f,
      locations: [
        { ...f.locations[0], after: serializeLocationDocument(b) },
        f.locations[1],
      ],
    },
    {
      ...f,
      locations: [
        f.locations[0],
        { ...f.locations[1], path: "../outside.location" },
      ],
    },
    {
      ...f,
      locations: [
        f.locations[0],
        { ...f.locations[1], path: "Orte/other.location" },
      ],
    },
    { ...f, locations: [{ ...f.locations[0], after: null }, f.locations[1]] },
    {
      ...f,
      locations: [
        f.locations[0],
        { ...f.locations[1], before: serializeLocationDocument(b) },
      ],
    },
    {
      ...f,
      currentWorld: JSON.stringify({
        ...JSON.parse(f.currentWorld),
        origin: { x: 1, y: 0 },
      }),
    },
    {
      ...f,
      currentWorld: JSON.stringify({
        ...JSON.parse(f.currentWorld),
        extra: true,
      }),
    },
    {
      ...f,
      currentWorld: JSON.stringify({
        ...JSON.parse(f.currentWorld),
        placements: [placement(a.id), placement(a.id)],
      }),
    },
    { ...f, chunks: [] },
    {
      ...f,
      chunks: [],
      locations: [],
      baselineWorld: JSON.stringify({
        ...JSON.parse(f.baselineWorld),
        placements: [placement(f.worldId)],
      }),
      currentWorld: JSON.stringify({
        ...JSON.parse(f.baselineWorld),
        placements: [placement(f.worldId, 1)],
      }),
    },
  ];
  for (const value of invalid) assert.throws(() => checkedAtlasDraft(value));
});
test("Draft serializers validate native root/deltas/lists before JSON can discard data or call getters", () => {
  const f = fixture();
  let calls = 0;
  const sparse = [...f.locations];
  delete sparse[0];
  const annotated = [...f.locations];
  Object.defineProperty(annotated, "foreign", { value: true });
  const getter = { ...f };
  Object.defineProperty(getter, "version", {
    enumerable: true,
    get() {
      calls++;
      return 2;
    },
  });
  const row = { ...f.locations[0] };
  Object.defineProperty(row, "after", {
    enumerable: true,
    get() {
      calls++;
      return afterA;
    },
  });
  const invalid = [
    { ...f, version: 3 },
    { ...f, unknown: undefined },
    { ...f, locations: sparse },
    { ...f, locations: annotated },
    getter,
    { ...f, locations: [row, f.locations[1]] },
    { ...f, chunks: [{ ...f.chunks[0], unknown: undefined }] },
    {
      ...f,
      locations: [{ ...f.locations[0], unknown: undefined }, f.locations[1]],
    },
  ];
  for (const value of invalid)
    assert.throws(() => serializeAtlasDraft(value as AtlasDraft));
  assert.equal(calls, 0);
});
test("Current terrain V1 remains separate and strict instead of accepting a Location draft under its old meaning", () => {
  const world = newOverworld("world-a", "Welt", "pointy"),
    baseline = serializeOverworld(world);
  const v1 = {
    kind: "overworld-draft",
    version: 1,
    worldId: world.id,
    baselineWorld: baseline,
    currentWorld: JSON.stringify({ ...world, chunks: [ref] }),
    chunks: [{ file: ref.file, before: null, after: terrain }],
  } as const;
  assert.equal(parseAtlasDraft(serializeAtlasDraft(v1)).version, 1);
  assert.throws(() => checkedAtlasDraft({ ...v1, locations: [] }));
  assert.throws(() => checkedAtlasDraft({ ...fixture(), version: 1 }));
});
