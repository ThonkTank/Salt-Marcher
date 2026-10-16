import test from "node:test";
import assert from "node:assert/strict";
import { checkedKeyTarget } from "../../src/features/atlas/key-target";
import { checkedLocationPlacements } from "../../src/features/atlas/location-placement";
import { AtlasHistory } from "../../src/features/atlas/atlas-history";
import {
  newOverworld,
  parseOverworld,
} from "../../src/features/atlas/overworld";
import {
  TerrainSource,
  TerrainStroke,
} from "../../src/features/atlas/terrain-source";
import {
  checkedLocationDocument,
  newLocation,
  parseLocationDocument,
  serializeLocationDocument,
  type LocationDocument,
} from "../../src/features/location/location-schema";
import {
  LocationSource,
  locationDocumentChange,
} from "../../src/features/location/location-source";

const document = () =>
  newLocation("location-a", "Ödhafen", "city", ["description", "notes"]);
const bytes = "# Ödhafen\r\n\r\n**Wörtlich**:  ä → 日本語 🐉  \r\n\tEnde\r\n";
test("Native Location roundtrip keeps exact Markdown, IDs, section order and independent frozen values", () => {
  const original = document(),
    input = { ...original, sections: original.sections.map((s) => ({ ...s })) };
  input.sections[0] = { ...input.sections[0]!, markdown: bytes };
  const doc = checkedLocationDocument(input),
    raw = serializeLocationDocument(doc),
    fresh = parseLocationDocument(raw);
  assert.equal(fresh.sections[0]!.markdown, bytes);
  assert.deepEqual(
    fresh.sections.map((s) => s.id),
    ["description", "notes"],
  );
  assert.deepEqual(fresh, doc);
  input.sections[0] = { ...input.sections[0]!, markdown: "later caller edit" };
  assert.equal(doc.sections[0]!.markdown, bytes);
  assert.ok(
    Object.isFrozen(doc) &&
      Object.isFrozen(doc.sections) &&
      Object.isFrozen(doc.sections[0]),
  );
});
test("Location rejects unknown versions, fields, duplicate sections/maps and invalid stable references", () => {
  const doc = document(),
    variants: unknown[] = [
      { ...doc, version: 2 },
      { ...doc, position: { x: 1, y: 2 } },
      { ...doc, id: "../other" },
      { ...doc, name: " " },
      { ...doc, type: "dungeon" },
      { ...doc, sections: [doc.sections[0], doc.sections[0]] },
      { ...doc, sections: [{ ...doc.sections[0], unexpected: true }] },
      {
        ...doc,
        detailMaps: [
          { kind: "city", documentId: "detail" },
          { kind: "city", documentId: "detail" },
        ],
      },
      { ...doc, detailMaps: [{ kind: "script", documentId: "detail" }] },
      {
        ...doc,
        keyLinks: [
          {
            kind: "location",
            atlasId: "world",
            documentId: "location-a",
            sectionId: null,
            path: "Orte/name.location",
          },
        ],
      },
    ];
  for (const invalid of variants)
    assert.throws(() => parseLocationDocument(JSON.stringify(invalid)));
  assert.throws(() => parseLocationDocument("not json"));
});
test("Native serialization refuses holes, metadata, prototypes and getters before any data loss or getter call", () => {
  const doc = document();
  let getters = 0;
  const getter = { ...doc };
  Object.defineProperty(getter, "sections", {
    enumerable: true,
    get() {
      getters++;
      return doc.sections;
    },
  });
  const sparse = [doc.sections[0], doc.sections[1]];
  delete sparse[0];
  const annotated = [...doc.sections];
  Object.defineProperty(annotated, "unknown", { value: true });
  const calculated = [...doc.sections];
  Object.defineProperty(calculated, "0", {
    enumerable: true,
    get() {
      getters++;
      return doc.sections[0];
    },
  });
  const symbol = { ...doc };
  Object.defineProperty(symbol, Symbol("foreign"), { value: true });
  const unknownUndefined = { ...doc, unknown: undefined };
  const proto = Object.assign(Object.create({ foreign: true }), doc);
  for (const value of [
    getter,
    { ...doc, sections: sparse },
    { ...doc, sections: annotated },
    { ...doc, sections: calculated },
    symbol,
    unknownUndefined,
    proto,
  ]) {
    assert.throws(() => serializeLocationDocument(value as LocationDocument));
  }
  assert.equal(getters, 0);
});
test("Location placement codec keeps signed world meters and rejects duplicate/nonfinite/unrecognized point data without premature World activation", () => {
  const placement = {
    kind: "location",
    id: "placement-a",
    locationId: "location-a",
    position: { x: -40000, y: 123.25 },
  };
  const checked = checkedLocationPlacements([placement]);
  assert.deepEqual(checked[0]!.position, placement.position);
  assert.ok(Object.isFrozen(checked[0]!.position));
  for (const value of [
    [placement, placement],
    [placement, { ...placement, id: "other" }],
    [{ ...placement, position: { x: Infinity, y: 0 } }],
    [{ ...placement, position: { x: 0, y: 0, pixels: 20 } }],
    [{ ...placement, path: "../foreign" }],
  ])
    assert.throws(() => checkedLocationPlacements(value));
  assert.throws(
    () =>
      parseOverworld(
        JSON.stringify({
          ...newOverworld("world", "Welt", "pointy"),
          placements: checked,
        }),
      ),
    /neueren Editor/,
  );
});
test("Unified native Key targets preserve owner/section identity and reject filenames or ambiguous target shapes", () => {
  const location = checkedKeyTarget({
    kind: "location",
    atlasId: "world",
    documentId: "location-a",
    sectionId: "notes",
  });
  const room = checkedKeyTarget({
    kind: "room",
    atlasId: null,
    documentId: "dungeon-a",
    roomId: "room-a",
    sectionId: null,
    anchor: "Türen 🗝",
  });
  assert.equal(location.documentId, "location-a");
  assert.equal(room.kind, "room");
  assert.ok(Object.isFrozen(room));
  for (const bad of [
    { ...location, atlasId: null },
    { ...location, roomId: "room" },
    { ...room, roomId: "" },
    { ...room, kind: "city" },
    { ...location, sectionId: undefined },
  ])
    assert.throws(() => checkedKeyTarget(bad));
});
test("Real Terrain and Location owners share one atomic creation command and exact Undo/Redo, with stale/invalid changes rejected before either mutation", async () => {
  const history = new AtlasHistory(),
    terrain = new TerrainSource(
      newOverworld("world", "Welt", "pointy"),
      history,
      async () => {
        throw new Error("unexpected read");
      },
    ),
    location = new LocationSource("location-a", history);
  await terrain.ensure([
    { q: -1, r: 0 },
    { q: 0, r: 0 },
  ]);
  const stroke = new TerrainStroke(terrain, "land");
  stroke.add({ q: -1, r: 0 });
  const created = document();
  assert.equal(
    history.execute({
      label: "Ort und Gelände anlegen",
      changes: [
        ...stroke.preview(),
        locationDocumentChange(location.id, null, created),
      ],
    }),
    true,
  );
  assert.equal(terrain.cells().length, 1);
  assert.deepEqual(location.read(), created);
  assert.equal(history.undoDepth, 1);
  history.undo();
  assert.equal(terrain.cells().length, 0);
  assert.equal(location.read(), null);
  history.redo();
  assert.equal(terrain.cells().length, 1);
  assert.deepEqual(location.read(), created);
  const next = new TerrainStroke(terrain, "forest");
  next.add({ q: 0, r: 0 });
  const before = structuredClone(location.read());
  await assert.rejects(
    async () =>
      history.execute({
        label: "ungültig",
        changes: [
          ...next.preview(),
          {
            ownerId: location.id,
            target: "document",
            before: JSON.parse(serializeLocationDocument(created)),
            after: {
              ...JSON.parse(serializeLocationDocument(created)),
              id: "foreign",
            },
          },
        ],
      }),
    /Ortskennung/,
  );
  assert.equal(terrain.cells().length, 1);
  assert.deepEqual(location.read(), before);
  assert.equal(history.undoDepth, 1);
  assert.throws(
    () =>
      history.execute({
        label: "stale",
        changes: [
          ...next.preview(),
          locationDocumentChange(location.id, null, created),
        ],
      }),
    /kollidiert/,
  );
  assert.equal(terrain.cells().length, 1);
  assert.deepEqual(location.read(), created);
});
test("Location section edit/reorder preserves IDs and exact text; stale retry retains redo and no-op has no command", () => {
  const history = new AtlasHistory(),
    source = new LocationSource("location-a", history, document()),
    before = source.read()!;
  const after = checkedLocationDocument({
    ...before,
    sections: before.sections.map((s) =>
      s.id === "notes" ? { ...s, markdown: bytes } : s,
    ),
  });
  const change = locationDocumentChange(source.id, before, after);
  assert.ok(Object.isFrozen(change.after));
  history.execute({ label: "Text", changes: [change] });
  history.undo();
  assert.equal(history.canRedo, true);
  assert.throws(
    () =>
      history.execute({
        label: "stale",
        changes: [locationDocumentChange(source.id, after, before)],
      }),
    /kollidiert/,
  );
  assert.equal(history.canRedo, true);
  history.redo();
  const now = source.read()!,
    reordered = checkedLocationDocument({
      ...now,
      sections: [...now.sections].reverse(),
    });
  history.execute({
    label: "Reihenfolge",
    changes: [locationDocumentChange(source.id, now, reordered)],
  });
  assert.deepEqual(
    source.read()!.sections.map((s) => s.id),
    ["notes", "description"],
  );
  assert.equal(source.read()!.sections[0]!.markdown, bytes);
  assert.equal(
    history.execute({
      label: "No-op",
      changes: [locationDocumentChange(source.id, reordered, reordered)],
    }),
    false,
  );
  assert.equal(history.undoDepth, 2);
});
test("Invalid native owner input does not reserve an ID; duplicate registered owner cannot replace live Location or Terrain", () => {
  const history = new AtlasHistory();
  assert.throws(
    () => new LocationSource("location-b", history, document()),
    /Ortskennung/,
  );
  const correct = checkedLocationDocument({ ...document(), id: "location-b" }),
    source = new LocationSource("location-b", history, correct);
  assert.throws(
    () => new LocationSource("location-b", history),
    /bereits registriert/,
  );
  assert.deepEqual(source.read(), correct);
  const terrain = new TerrainSource(
    newOverworld("world", "Welt", "flat"),
    history,
    async () => {
      throw new Error("unexpected");
    },
  );
  assert.throws(
    () => new LocationSource("world", history),
    /bereits registriert/,
  );
  assert.deepEqual(terrain.cells(), []);
});
