import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDocument, type MapObject, type Light } from "../../src/model";
import { Session, textPatch } from "../../src/session";
import { createRoom, createDoor, createObject, createLight, editNote, updatePassage } from "../../src/commands";
import { MapRepository, FileConflict } from "../../src/persistence";
import { archiveEntities, createFeatureDefinition, createFeatureOccurrence, updateFeatureDefinition, updateFeatureOccurrence } from "../../src/content";
import { newDocument, MemoryStore, mapPath, fixture } from "./fixtures";
import { NATIVE_OBJECT_PALETTE } from "../../src/features/objekte/rgba-picker";

test("native Object palette falls back on old maps and persists ARGB duplicates without Undo", async () => {
  const store = new MemoryStore(), path = "QA/Objektpalette.dungeon",
    repo = new MapRepository(store, path),
    session = new Session(newDocument("Palette", 8, 8));
  assert.equal(session.settings.objectPalette, undefined);
  const defaults = NATIVE_OBJECT_PALETTE.map((color) =>
    "ff" + color.toString(16).padStart(6, "0"));
  assert.equal(defaults.length, 30);
  const before = session.settings;
  session.execute({ label: "Kartenname ändern", settings: {
    before, after: { ...before, name: "Neuer Name" },
  } });
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
  assert.throws(() => parseDocument(JSON.stringify({
    ...reopened.document(),
    settings: { ...reopened.settings, objectPalette: ["12ab34"] },
  })), /Karteneinstellungen/);
});

test("Object Tool Under prepends on one layer and undo restores exact order", async () => {
  const store = new MemoryStore();
  const path = "QA/Objekt-Sortierung.dungeon";
  const repository = new MapRepository(store, path);
  const session = new Session(newDocument("Sortierung", 8, 8));
  const floor = session.floors.values().next().value!.id;
  const settings = { rotation: 0, width: 87 / 256, height: 88 / 256,
    color: 0x809dab, alpha: 255, label: "", layer: 100,
    shadow: true, blocksLight: true };
  const first = createObject(session, floor, { x: 3, y: 3 }, settings, "over");
  const second = createObject(session, floor, { x: 3, y: 3 }, settings, "under");
  assert.deepEqual([...session.entities.keys()], [second.id, first.id]);
  assert.equal((session.entities.get(first.id) as MapObject).width, 87 / 256);
  assert.equal((session.entities.get(first.id) as MapObject).blocksLight, true);
  session.undo();
  assert.deepEqual([...session.entities.keys()], [first.id]);
  session.redo();
  assert.deepEqual([...session.entities.keys()], [second.id, first.id]);
  await repository.save(session);
  const reopened = await new MapRepository(store, path).open();
  assert.deepEqual([...reopened.entities.keys()], [second.id, first.id]);
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
  const afterInterruptedCleanup = await new MapRepository(store, mapPath).open();
  assert.equal(afterInterruptedCleanup.dirty, false);
  assert.equal(await store.read(repo.draftPath), null);
});

test("locking has no undo step and survives geometry undo, redo and deletion", async () => {
  const store = new MemoryStore(),
    repo = new MapRepository(store, "QA/Sperre.dungeon"),
    s = new Session(newDocument("Sperrprobe", 12, 12)),
    floor = s.floors.values().next().value!.id,
    object = createObject(s, floor, { x: 3, y: 4 });
  s.execute({
    label: "Verschieben",
    entities: [
      { id: object.id, before: object, after: { ...object, x: 6 } },
    ],
  });
  const history = s.historySize;
  s.setLocked(object.id, true);
  assert.equal(s.historySize, history);
  assert.equal((s.entities.get(object.id) as MapObject).locked, true);
  s.undo();
  assert.equal((s.entities.get(object.id) as MapObject).x, 3);
  assert.equal((s.entities.get(object.id) as MapObject).locked, true);
  s.redo();
  assert.equal((s.entities.get(object.id) as MapObject).x, 6);
  assert.equal((s.entities.get(object.id) as MapObject).locked, true);
  const archived = archiveEntities(s, [object.id]);
  assert.equal(archived.entities.length, 1);
  assert.equal(s.entities.has(object.id), false);
  s.undo();
  assert.equal((s.entities.get(object.id) as MapObject).locked, true);
  s.setLocked(object.id, false);
  assert.equal(s.historySize, history);
  s.undo();
  assert.equal((s.entities.get(object.id) as MapObject).x, 3);
  assert.equal((s.entities.get(object.id) as MapObject).locked, false);
  await repo.save(s);
  const reopened = await new MapRepository(store, "QA/Sperre.dungeon").open();
  assert.equal((reopened.entities.get(object.id) as MapObject).locked, false);
});

test("locking a multi-selection publishes one change and adds no undo step", () => {
  const session = new Session(newDocument("Gruppensperre", 12, 12)),
    floor = session.floors.values().next().value!.id,
    first = createObject(session, floor, { x: 2, y: 2 }),
    second = createObject(session, floor, { x: 4, y: 4 }),
    history = session.historySize,
    revision = session.revision,
    events: string[][] = [];
  session.subscribe((event) => events.push([...event.ids]));
  session.setLockedMany([first.id, second.id, first.id], true);
  assert.equal(session.historySize, history);
  assert.equal(session.revision, revision + 1);
  assert.deepEqual(events, [[first.id, second.id]]);
  assert.equal(session.entities.get(first.id)?.locked, true);
  assert.equal(session.entities.get(second.id)?.locked, true);
  session.undo();
  assert.equal(session.entities.has(second.id), false);
  session.redo();
  assert.equal(session.entities.get(second.id)?.locked, true);
  session.setLockedMany([first.id, second.id], false);
  assert.equal(session.historySize, history);
  assert.equal(session.entities.get(first.id)?.locked, false);
  assert.equal(session.entities.get(second.id)?.locked, false);
});

test("editing the shadow of an Alt-selected locked light remains undoable without unlocking it", () => {
  const session = new Session(newDocument("Lichtsperre", 12, 12)),
    floor = session.floors.values().next().value!.id,
    source = createLight(session, floor, { x: 4, y: 5 }, {
      radius: 3,
      intensity: 1,
      color: 0xeccd8b,
      shadows: false,
    });
  session.setLocked(source.id, true);
  const locked = session.entities.get(source.id) as Light,
    history = session.historySize;
  session.execute({
    label: "Schatten ändern",
    entities: [{
      id: source.id,
      before: locked,
      after: { ...locked, shadows: true },
    }],
  });
  assert.equal(session.historySize, history + 1);
  assert.deepEqual(
    [(session.entities.get(source.id) as Light).shadows, session.entities.get(source.id)?.locked],
    [true, true],
  );
  session.undo();
  assert.deepEqual(
    [(session.entities.get(source.id) as Light).shadows, session.entities.get(source.id)?.locked],
    [false, true],
  );
  session.redo();
  assert.deepEqual(
    [(session.entities.get(source.id) as Light).shadows, session.entities.get(source.id)?.locked],
    [true, true],
  );
});

test("room, wall-bound door, object and exact text share undo; save and fresh repository reopen", async () => {
  const store = new MemoryStore(),
    repo = new MapRepository(store, mapPath),
    { s, room, floor } = fixture();
  const original = s.note(room.note!.path)!;
  const door = createDoor(s, room, 0, 0.5),
    doorText = s.note(room.note!.path)!;
  assert.match(doorText, /## Tür/);
  s.undo();
  assert.equal(s.note(room.note!.path), original);
  assert.equal(s.entities.has(door.id), false);
  s.redo();
  assert.equal(s.note(room.note!.path), doorText);
  assert.equal(s.entities.has(door.id), true);
  const obj = createObject(s, floor, { x: 7, y: 7 });
  const moved = { ...obj, x: 9 };
  s.execute({
    label: "Möbel verschieben",
    entities: [{ id: obj.id, before: obj, after: moved }],
  });
  const preserved =
    doorText + "**Absichtlich  doppelt.** [[Anders#Titel|Wortlaut]]\r\n";
  editNote(s, room.note!.path, doorText, preserved);
  s.undo();
  assert.equal(s.note(room.note!.path), doorText);
  s.redo();
  await repo.save(s);
  assert.equal(s.dirty, false);
  assert.equal(await store.read(repo.journalPath), null);
  const freshRepo = new MapRepository(store, mapPath),
    fresh = await freshRepo.open();
  await freshRepo.loadNote(fresh, room.note!.path);
  assert.deepEqual(fresh.document(), s.document());
  assert.equal(fresh.note(room.note!.path), preserved);
  assert.equal((fresh.entities.get(obj.id) as MapObject).x, 9);
  assert.equal(fresh.dirty, false);
});

test("structured passages and encounters render readable key prose and undo atomically", () => {
  const { s, room } = fixture(),
    door = createDoor(s, room, 0, 0.5);
  updatePassage(s, door.id, {
    direction: "north",
    description: "Massive Eichentür",
    state: "locked",
    hidden: true,
    hiddenDC: 15,
    hp: 18,
    ac: 16,
    key: "[[Messingschlüssel]]",
  });
  const passageText = s.note(room.note!.path)!;
  assert.match(
    passageText,
    /Norden: Massive Eichentür\. Verschlossen\. Versteckt \(SG 15\)\. 18 HP, RK 16\. Schlüssel: \[\[Messingschlüssel\]\]\./,
  );
  assert.equal((s.entities.get(door.id) as typeof door).passage?.hiddenDC, 15);
  s.undo();
  assert.doesNotMatch(s.note(room.note!.path)!, /Massive Eichentür/);
  s.redo();

  const definition = createFeatureDefinition(s, {
      name: "Schattenwache",
      kind: "creature",
      xp: 450,
      description: "Bewacht den Nordausgang",
      reference: "[[Schattenwache]]",
      encounter: "Torwachen",
      encounterLink: "[[Encounter Torwachen]]",
    }),
    occurrence = createFeatureOccurrence(
      s,
      definition.id,
      room.id,
      2,
      undefined,
      {
        situation: "wartet reglos",
        reaction: "greift bei Alarm an",
      },
    );
  let key = s.note(room.note!.path)!;
  assert.match(
    key,
    /Bewacht den Nordausgang\. Besetzung: 2× Schattenwache\. Auswertung: 900 XP\. Aktuelle Situation: wartet reglos\. Reaktion: greift bei Alarm an\. Regeln: \[\[Schattenwache\]\]\. Encounter: Torwachen \(\[\[Encounter Torwachen\]\]\)\./,
  );
  updateFeatureOccurrence(s, occurrence.id, {
    quantity: 3,
    situation: "patrouilliert",
    reaction: "schlägt Alarm",
  });
  updateFeatureDefinition(s, definition.id, {
    ...definition,
    name: "Schattenwächter",
    description: "Bewacht den Nordausgang",
  });
  key = s.note(room.note!.path)!;
  assert.match(key, /## SC · Schattenwächter/);
  assert.match(
    key,
    /Besetzung: 3× Schattenwächter\. Auswertung: 1\.350 XP\. Aktuelle Situation: patrouilliert\./,
  );
  assert.equal(
    (key.match(/<!-- dungeon-feature:[^\n]+:start -->/g) ?? []).length,
    1,
  );
});
test("an imported heading anchor gains managed prose without rewriting existing key text", () => {
  const { s, room } = fixture(),
    before = s.note(room.note!.path)!,
    protectedText = before + "## A · Säulen:\n\nAbsichtlich  unverändert.\n";
  editNote(s, room.note!.path, before, protectedText);
  const definition = createFeatureDefinition(s, {
      name: "Säulen",
      kind: "feature",
      description: "Goldverzierte Säulen",
    }),
    occurrence = {
      id: "imported-feature",
      definitionId: definition.id,
      roomId: room.id,
      marker: "A",
      quantity: 6,
      note: { path: room.note!.path, anchor: "A · Säulen:" },
    },
    current = s.content;
  s.execute({
    label: "Bestehendes Feature verknüpfen",
    content: {
      before: current,
      after: { ...current, occurrences: [...current.occurrences, occurrence] },
    },
  });
  updateFeatureOccurrence(s, occurrence.id, {
    quantity: 6,
    situation: "steht unverändert",
  });
  const after = s.note(room.note!.path)!;
  assert.match(after, /^## A · Säulen:$/m);
  assert.match(after, /Absichtlich  unverändert\./);
  assert.match(after, /Menge: 6\. Aktuelle Situation: steht unverändert\./);
  assert.equal(
    (after.match(/<!-- dungeon-feature:imported-feature:start -->/g) ?? [])
      .length,
    1,
  );
});
test("rooms stay numbered while features use letters and creatures use named codes", () => {
  const { s, room } = fixture(),
    column = createFeatureDefinition(s, {
      name: "Säule",
      kind: "feature",
    }),
    guardian = createFeatureDefinition(s, {
      name: "Schattenwache",
      kind: "creature",
    }),
    trap = createFeatureDefinition(s, {
      name: "Falltür",
      kind: "trap",
    }),
    first = createFeatureOccurrence(s, column.id, room.id),
    creature = createFeatureOccurrence(s, guardian.id, room.id),
    second = createFeatureOccurrence(s, trap.id, room.id),
    key = s.note(room.note!.path)!;
  assert.equal(first.marker, "A");
  assert.equal(creature.marker, "SC");
  assert.equal(second.marker, "B");
  assert.match(key, /^# 1 Raum 1$/m);
  assert.match(key, /^## A · Säule /m);
  assert.match(key, /^## SC · Schattenwache /m);
  assert.match(key, /^## B · Falltür /m);
});
test("failure at each write rolls back; committed cleanup failure retains completed result", async () => {
  for (let failAt = 1; failAt <= 5; failAt++) {
    const { s, room } = fixture(),
      store = new MemoryStore(),
      repo = new MapRepository(store, mapPath);
    store.failAt = failAt;
    await assert.rejects(repo.save(s));
    if (failAt < 5) {
      assert.equal(await store.read(mapPath), null);
      assert.equal(await store.read(room.note!.path), null);
      assert.equal(s.dirty, true);
    } else {
      assert.ok(await store.read(mapPath));
      assert.equal(s.dirty, false);
    }
    assert.equal(await store.read(repo.journalPath), null);
  }
});
test("concurrent note modification is preserved and map is not partially saved", async () => {
  const { s, room } = fixture(),
    store = new MemoryStore(),
    repo = new MapRepository(store, mapPath);
  await repo.save(s);
  const savedMap = await store.read(mapPath),
    before = s.note(room.note!.path)!;
  editNote(s, room.note!.path, before, before + "Unser Entwurf\n");
  store.files.set(room.note!.path, before + "Fremde Änderung\n");
  await assert.rejects(repo.save(s), FileConflict);
  assert.equal(await store.read(mapPath), savedMap);
  assert.equal(await store.read(room.note!.path), before + "Fremde Änderung\n");
  assert.equal(s.dirty, true);
});
test("external edit during partial save is not overwritten by rollback; journal survives fresh recovery", async () => {
  const { s, room } = fixture(),
    store = new MemoryStore(),
    repo = new MapRepository(store, mapPath);
  store.hook = (path) => {
    if (path === mapPath) {
      store.files.set(room.note!.path, "Extern!");
      throw new Error("interruption");
    }
  };
  await assert.rejects(repo.save(s), AggregateError);
  assert.equal(await store.read(room.note!.path), "Extern!");
  assert.ok(await store.read(repo.journalPath));
  store.hook = undefined;
  await assert.rejects(new MapRepository(store, mapPath).open(), FileConflict);
  assert.equal(await store.read(room.note!.path), "Extern!");
});
test("prepared transaction recovers in fresh process after a partial write", async () => {
  const store = new MemoryStore();
  store.files.set("QA/Räume/a.md", "neu");
  store.files.set(
    mapPath + ".journal",
    JSON.stringify({
      version: 1,
      mapPath,
      state: "prepared",
      writes: [
        { path: "QA/Räume/a.md", before: "alt", after: "neu" },
        { path: mapPath, before: null, after: "not written" },
      ],
    }),
  );
  await new MapRepository(store, mapPath).recover();
  assert.equal(await store.read("QA/Räume/a.md"), "alt");
  assert.equal(await store.read(mapPath + ".journal"), null);
});
test("joint validation prevents partial changes and broken bindings", () => {
  const { s, room } = fixture();
  const door = createDoor(s, room, 1, 0.4);
  const before = s.document();
  assert.throws(
    () =>
      s.execute({
        label: "Unvollständig",
        entities: [{ id: room.id, before: room, after: null }],
      }),
    /Wandbindung/,
  );
  assert.deepEqual(s.document(), before);
  assert.ok(s.entities.has(door.id));
  const changed = { ...room, name: "Nicht übernehmen" };
  assert.throws(() =>
    s.execute({
      label: "Veralteter Text",
      entities: [{ id: room.id, before: room, after: changed }],
      texts: [
        { path: room.note!.path, offset: 0, before: "falsch", after: "kaputt" },
      ],
    }),
  );
  assert.deepEqual(s.document(), before);
});
test("ordinary furniture move preserves unrelated records, does not recalculate rules and reports only the object", () => {
  const { s, floor } = fixture(),
    a = createObject(s, floor, { x: 5, y: 5 }),
    b = createObject(s, floor, { x: 7, y: 7 });
  const stable = s.entities.get(b.id),
    revision = s.rulesRevision;
  let ids: ReadonlySet<string> = new Set();
  s.subscribe((e) => (ids = e.ids));
  s.execute({
    label: "Verschieben",
    entities: [{ id: a.id, before: a, after: { ...a, x: 8 } }],
  });
  assert.equal(s.entities.get(b.id), stable);
  assert.equal(s.rulesRevision, revision);
  assert.deepEqual([...ids], [a.id]);
});
test("room geometry invalidates bound door without mutating its semantic record", () => {
  const { s, room } = fixture(),
    door = createDoor(s, room, 1, 0.4);
  const stable = s.entities.get(door.id);
  let ids: ReadonlySet<string> = new Set();
  s.subscribe((e) => (ids = e.ids));
  s.execute({
    label: "Raum ändern",
    entities: [
      {
        id: room.id,
        before: room,
        after: {
          ...room,
          polygons: room.polygons.map((polygon) => ({
            outer: polygon.outer.map((point) => ({
              ...point,
              x: point.x + 1,
            })),
            holes: polygon.holes.map((hole) =>
              hole.map((point) => ({ ...point, x: point.x + 1 })),
            ),
          })),
        },
      },
    ],
  });
  assert.deepEqual(new Set(ids), new Set([room.id, door.id]));
  assert.equal(s.entities.get(door.id), stable);
});
test("save captures a revision while subsequent edits remain dirty and undo is preserved", async () => {
  const { s, room } = fixture(),
    store = new MemoryStore(),
    repo = new MapRepository(store, mapPath);
  const base = s.note(room.note!.path)!;
  let changed = false;
  store.hook = (path) => {
    if (path === mapPath && !changed) {
      changed = true;
      editNote(s, room.note!.path, base, base + "Später\n");
    }
  };
  await repo.save(s);
  assert.equal(s.dirty, true);
  assert.equal(await store.read(room.note!.path), base);
  s.undo();
  assert.equal(s.dirty, false);
});
test("text patch keeps unrelated bytes and undoing a saved new room removes its created text from the draft", async () => {
  assert.deepEqual(textPatch("a.md", "AB\r\n  CD", "AB\r\n  XD"), {
    path: "a.md",
    offset: 6,
    before: "C",
    after: "X",
  });
  const { s, room } = fixture(),
    store = new MemoryStore(),
    repo = new MapRepository(store, mapPath);
  await repo.save(s);
  s.undo();
  assert.equal(s.note(room.note!.path), null);
  await repo.save(s);
  assert.equal(await store.read(room.note!.path), null);
  assert.equal(parseDocument((await store.read(mapPath))!).entities.length, 0);
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
test("unsaved joint draft survives repository recreation without modifying saved originals", async () => {
  const store = new MemoryStore(),
    repo = new MapRepository(store, mapPath),
    { s, room } = fixture();
  await repo.save(s);
  const originalMap = await store.read(mapPath),
    originalNote = await store.read(room.note!.path),
    door = createDoor(s, room, 0, 0.5);
  await repo.persistDraft(s);
  assert.equal(await store.read(mapPath), originalMap);
  assert.equal(await store.read(room.note!.path), originalNote);
  const reopened = new MapRepository(store, mapPath),
    restored = await reopened.open();
  assert.equal(restored.dirty, true);
  assert.ok(restored.entities.has(door.id));
  assert.equal(restored.note(room.note!.path), s.note(room.note!.path));
  await reopened.save(restored);
  assert.equal(restored.dirty, false);
  assert.equal(await store.read(reopened.draftPath), null);
  assert.deepEqual(
    (await new MapRepository(store, mapPath).open()).document(),
    s.document(),
  );
});
test("draft recovery rejects changed map or text; preserves both external work and draft", async () => {
  const store = new MemoryStore(),
    repo = new MapRepository(store, mapPath),
    { s, room } = fixture();
  await repo.save(s);
  createDoor(s, room, 0, 0.5);
  await repo.persistDraft(s);
  const draft = await store.read(repo.draftPath);
  store.files.set(room.note!.path, "Andere Person");
  await assert.rejects(new MapRepository(store, mapPath).open(), FileConflict);
  assert.equal(await store.read(room.note!.path), "Andere Person");
  assert.equal(await store.read(repo.draftPath), draft);
});
test("undo listeners observe the updated history and door changes invalidate their wall", () => {
  const { s, room } = fixture();
  let canRedo = false;
  let ids: ReadonlySet<string> = new Set();
  s.subscribe((e) => {
    canRedo = s.canRedo;
    ids = e.ids;
  });
  const door = createDoor(s, room, 0, 0.5);
  assert.ok(ids.has(room.id));
  assert.ok(ids.has(door.id));
  s.undo();
  assert.equal(canRedo, true);
});
test("crash after commit but before draft cleanup reopens the completed save exactly", async () => {
  for (const textOnly of [false, true]) {
    const store = new MemoryStore(),
      repo = new MapRepository(store, mapPath),
      { s, room } = fixture();
    await repo.save(s);
    if (textOnly) {
      const before = s.note(room.note!.path)!;
      editNote(s, room.note!.path, before, before + "Nur Text\n");
    } else createDoor(s, room, 0, 0.5);
    await repo.persistDraft(s);
    store.hook = (path) => {
      if (path === repo.draftPath)
        throw new Error("crash before draft cleanup");
    };
    await assert.rejects(repo.save(s));
    assert.ok(await store.read(repo.draftPath));
    store.hook = undefined;
    const fresh = await new MapRepository(store, mapPath).open();
    assert.equal(fresh.dirty, false);
    assert.deepEqual(fresh.document(), s.document());
    assert.equal(await store.read(room.note!.path), s.note(room.note!.path));
    assert.equal(await store.read(repo.draftPath), null);
  }
});
