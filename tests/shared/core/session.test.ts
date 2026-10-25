import assert from "node:assert/strict";
import { test } from "node:test";
import { createDoor, createRoom } from "../../../src/commands";
import { NATIVE_OBJECT_PALETTE } from "../../../src/features/objekte/rgba-picker";
import { parseDocument } from "../../../src/model";
import { MapRepository } from "../../../src/persistence";
import { Session } from "../../../src/session";
import { MemoryStore, fixture, mapPath, newDocument } from "./fixtures";

test("native Object palette falls back on old maps and persists ARGB duplicates without Undo", async () => {
  const store = new MemoryStore(),
    path = "QA/Objektpalette.dungeon",
    repo = new MapRepository(store, path),
    session = new Session(newDocument("Palette", 8, 8));
  assert.equal(session.settings.objectPalette, undefined);
  const defaults = NATIVE_OBJECT_PALETTE.map(
    (color) => "ff" + color.toString(16).padStart(6, "0"),
  );
  assert.equal(defaults.length, 30);
  const before = session.settings;
  session.execute({
    label: "Kartenname ändern",
    settings: {
      before,
      after: { ...before, name: "Neuer Name" },
    },
  });
  const history = session.historySize;
  const colors = [...defaults, "8012ab34", "8012ab34"];
  session.setObjectPalette(colors);
  assert.equal(session.historySize, history);
  assert.equal(session.dirty, true);
  assert.deepEqual(session.settings.objectPalette, colors);
  session.undo();
  assert.equal(session.settings.name, "Palette");
  assert.deepEqual(session.settings.objectPalette, colors);
  session.redo();
  assert.equal(session.settings.name, "Neuer Name");
  assert.deepEqual(session.settings.objectPalette, colors);
  await repo.save(session);
  assert.equal(session.dirty, false);
  const reopened = await new MapRepository(store, path).open();
  assert.deepEqual(reopened.settings.objectPalette, colors);
  assert.equal(reopened.settings.name, "Neuer Name");
  assert.throws(
    () =>
      parseDocument(
        JSON.stringify({
          ...reopened.document(),
          settings: { ...reopened.settings, objectPalette: ["12ab34"] },
        }),
      ),
    /Karteneinstellungen/,
  );
});

test("V2 map and pending draft migrate to V3 without changing linked content or Markdown", async () => {
  const store = new MemoryStore(),
    repo = new MapRepository(store, mapPath),
    { s, room } = fixture();
  await repo.save(s);
  const noteBefore = await store.read(room.note!.path);
  const door = createDoor(s, room, 0, 0.5);
  await repo.persistDraft(s);
  const v3Map = JSON.parse((await store.read(mapPath))!);
  const v2Map = JSON.stringify({ ...v3Map, version: 2 }, null, 2) + "\n";
  const v3Draft = JSON.parse((await store.read(repo.draftPath))!);
  const v2Draft = JSON.stringify({
    ...v3Draft,
    baseline: v2Map,
    draft: {
      ...v3Draft.draft,
      document: { ...v3Draft.draft.document, version: 2 },
    },
  });
  store.files.set(mapPath, v2Map);
  store.files.set(repo.draftPath, v2Draft);

  const reopened = new MapRepository(store, mapPath);
  const restored = await reopened.open();
  assert.equal(restored.document().version, 3);
  assert.deepEqual(restored.document().entities, s.document().entities);
  assert.deepEqual(restored.document().content, s.document().content);
  assert.ok(restored.entities.has(door.id));
  assert.equal(await store.read(mapPath), v2Map);
  assert.equal(await store.read(room.note!.path), noteBefore);
  assert.equal(restored.note(room.note!.path), s.note(room.note!.path));
  await reopened.save(restored);
  assert.equal(parseDocument((await store.read(mapPath))!).version, 3);
  assert.equal(await store.read(room.note!.path), s.note(room.note!.path));
  // An interrupted draft cleanup after a committed V3 save must not turn a
  // completed V2 migration into a false external-edit conflict on next open.
  store.files.set(repo.draftPath, v2Draft);
  const afterInterruptedCleanup = await new MapRepository(
    store,
    mapPath,
  ).open();
  assert.equal(afterInterruptedCleanup.dirty, false);
  assert.equal(await store.read(repo.draftPath), null);
});

test("rejects malformed and legacy maps and escaping note paths", () => {
  assert.throws(() => parseDocument("<svg/>"));
  assert.throws(() =>
    parseDocument(JSON.stringify({ ...newDocument("A", 20, 20), version: 1 })),
  );
  const { s, floor } = fixture();
  assert.throws(() =>
    createRoom(
      s,
      floor,
      [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
      ],
      "../outside",
    ),
  );
});
