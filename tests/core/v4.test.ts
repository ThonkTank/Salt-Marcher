import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDocument, type MapObject, isStructuredRoom } from "../../src/model";
import { addMarkdownSection, editMarkdownSection, keySectionUrl, moveKeySection, removeMarkdownSection, sectionMarkdown, structuredRoom } from "../../src/room-key";
import { Session } from "../../src/session";
import { projectedRoomDocuments, stripFeatureBoundaries } from "../../src/room-projection";
import { createRoom, createDoor, createObject, objectAtPoint, createPortal, addFloor, duplicateFloor } from "../../src/commands";
import { MapRepository } from "../../src/persistence";
import { analyzeDungeon, archiveDefinition, archiveEntities, archiveFloor, archiveOccurrence, archiveRoute, createFeatureDefinition, createFeatureOccurrence, executeLinkedObjectChanges, structuredFeatureText, createRoute, restoreArchive, updateFeatureQuantity } from "../../src/content";
import { newDocument, MemoryStore, mapPath, fixture } from "./fixtures";


test("shared dungeon content, analysis and archive share ordinary exact history", async () => {
  const { s, floor, room } = fixture(),
    second = createRoom(
      s,
      floor,
      [
        { x: 20, y: 2 },
        { x: 30, y: 2 },
        { x: 30, y: 12 },
        { x: 20, y: 12 },
      ],
      "QA/Räume",
    ),
    definition = createFeatureDefinition(s, {
      name: "Schattenwache",
      kind: "creature",
      xp: 450,
      lootValue: 75,
      encounter: "Torwachen",
    }),
    first = createFeatureOccurrence(s, definition.id, room.id, 2),
    secondOccurrence = createFeatureOccurrence(s, definition.id, second.id, 1),
    route = createRoute(s, {
      name: "Haupteingang",
      entrance: true,
      toRoomId: room.id,
      prerequisites: ["Siegelstein"],
      bossGoalOrder: 1,
    });
  assert.match(s.note(room.note!.path)!, new RegExp(`\\^feature-${first.id}`));
  assert.match(
    s.note(second.note!.path)!,
    new RegExp(`\\^feature-${secondOccurrence.id}`),
  );
  updateFeatureQuantity(s, first.id, 3);
  assert.deepEqual(analyzeDungeon(s.content), {
    definitions: 1,
    occurrences: 2,
    totalQuantity: 4,
    xp: 1800,
    lootValue: 300,
    encounters: [{ name: "Torwachen", quantity: 4, xp: 1800 }],
    bossGoals: [route],
  });
  const preservedText = s.note(room.note!.path)!,
    markerId = first.entityId!,
    archivedOccurrence = archiveOccurrence(s, first.id);
  assert.equal(s.entities.has(markerId), false);
  assert.equal(s.content.definitions.length, 1);
  assert.equal(s.note(room.note!.path), preservedText);
  s.undo();
  assert.ok(s.entities.has(markerId));
  assert.equal(s.content.archive.length, 0);
  s.redo();
  restoreArchive(s, archivedOccurrence.id);
  assert.ok(s.entities.has(markerId));
  assert.equal(s.content.occurrences.length, 2);
  const archivedDefinition = archiveDefinition(s, definition.id);
  assert.equal(s.content.definitions.length, 0);
  assert.equal(s.content.occurrences.length, 0);
  restoreArchive(s, archivedDefinition.id);
  assert.equal(analyzeDungeon(s.content).xp, 1800);
  const archivedRoute = archiveRoute(s, route.id);
  assert.equal(s.content.routes.length, 0);
  restoreArchive(s, archivedRoute.id);
  assert.equal(s.content.routes[0]?.bossGoalOrder, 1);
  const store = new MemoryStore(),
    repository = new MapRepository(store, mapPath);
  await repository.save(s);
  const reopened = await new MapRepository(store, mapPath).open();
  assert.deepEqual(reopened.content, s.content);
  assert.equal(analyzeDungeon(reopened.content).lootValue, 300);
});

test("new room keys can embed the native map without duplicating map state", () => {
  const session = new Session(newDocument("Eingebettet", 20, 20)),
    floor = session.floors.keys().next().value!,
    room = createRoom(
      session,
      floor,
      [
        { x: 1, y: 1 },
        { x: 8, y: 1 },
        { x: 8, y: 8 },
        { x: 1, y: 8 },
      ],
      "Dungeons/Eingebettet/Räume",
      {},
      "Dungeons/Eingebettet/Karte.dungeon",
    );
  assert.equal(
    session.note(room.note!.path),
    `---\nroom_id: "${room.id}"\n---\n# 1 Raum 1\n\n![[Dungeons/Eingebettet/Karte.dungeon]]\n\n`,
  );
  assert.equal(session.document().content.definitions.length, 0);
  session.undo();
  assert.equal(session.note(room.note!.path), null);
});

test("archiving a selected room keeps its text and restores dependent map content", () => {
  const { s, floor, room } = fixture(),
    door = createDoor(s, room, 0, 0.5),
    object = createObject(s, floor, { x: 6, y: 6 }),
    definition = createFeatureDefinition(s, {
      name: "Schlüssel",
      kind: "loot",
      lootValue: 20,
    }),
    occurrence = createFeatureOccurrence(
      s,
      definition.id,
      room.id,
      1,
      object.id,
    ),
    route = createRoute(s, {
      name: "Eingang",
      entrance: true,
      toRoomId: room.id,
      prerequisites: [],
    }),
    protectedText = s.note(room.note!.path),
    beforeArchive = s.document(),
    bundle = archiveEntities(s, [room.id]);
  assert.deepEqual(
    new Set(bundle.entities.map((entity) => entity.id)),
    new Set([room.id, door.id, object.id]),
  );
  assert.equal(s.entities.has(room.id), false);
  assert.equal(
    s.content.occurrences.some((value) => value.id === occurrence.id),
    false,
  );
  assert.equal(
    s.content.routes.some((value) => value.id === route.id),
    false,
  );
  assert.equal(s.note(room.note!.path), protectedText);
  restoreArchive(s, bundle.id);
  assert.ok(s.entities.has(room.id));
  assert.ok(s.entities.has(door.id));
  assert.ok(s.entities.has(object.id));
  assert.equal(s.content.occurrences[0]?.id, occurrence.id);
  assert.equal(s.content.routes[0]?.id, route.id);
  assert.equal(s.note(room.note!.path), protectedText);
  assert.deepEqual(s.document(), beforeArchive);
});

test("archiving a floor preserves its keys and restores exact layer order", () => {
  const { s } = fixture(),
    upper = addFloor(s),
    room = createRoom(
      s,
      upper.id,
      [
        { x: 20, y: 20 },
        { x: 28, y: 20 },
        { x: 28, y: 27 },
        { x: 20, y: 27 },
      ],
      "Dungeons/Test/Räume",
    ),
    object = createObject(s, upper.id, { x: 23, y: 23 });
  s.execute({
    label: "Sperren",
    entities: [
      { id: object.id, before: object, after: { ...object, locked: true } },
    ],
  });
  const text = s.note(room.note!.path),
    before = s.document(),
    bundle = archiveFloor(s, upper.id);
  assert.equal(s.floors.has(upper.id), false);
  assert.equal(s.entities.has(room.id), false);
  assert.equal(s.entities.has(object.id), false);
  assert.equal(s.note(room.note!.path), text);
  assert.deepEqual(bundle.floors, [upper]);
  restoreArchive(s, bundle.id);
  assert.deepEqual(s.document(), before);
  assert.equal(s.note(room.note!.path), text);
  assert.throws(
    () => archiveFloor(new Session(newDocument("Nur eins", 10, 10)), "missing"),
    /nicht gefunden/,
  );
});

test("V4 rooms keep exact Markdown, passage sections and stable targets without room files", () => {
  const document = newDocument("Strukturierter Key", 20, 20, undefined, undefined, 4);
  const session = new Session(document);
  const floor = document.floors[0]!.id;
  const room = createRoom(session, floor,
    [{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 9 }, { x: 1, y: 9 }],
    "QA/Räume", {}, "QA/Karte.dungeon");
  assert.ok(isStructuredRoom(room));
  assert.equal(room.note, undefined);
  assert.equal(session.snapshot().notes.size, 0);
  const first = structuredRoom(session, room.id).key.sections[0]!;
  assert.equal(first.kind, "markdown");
  const exact = "## A · Truhe:\r\n*Alter Text*  \r\n[[Dungeons/Probe/Item|Beute]]\r\n";
  editMarkdownSection(session, room.id, first.id, "", exact);
  const featureContent = {
    ...session.content,
    definitions: [{ id: "qa-definition", name: "Truhe", kind: "feature" as const,
      xp: 0, lootValue: 0 }],
    occurrences: [{ id: "qa-occurrence", definitionId: "qa-definition",
      roomId: room.id, marker: "A", quantity: 1, sectionId: first.id }],
  };
  session.execute({ label: "V4-Feature-Ziel prüfen",
    content: { before: session.content, after: featureContent } });
  assert.throws(() => session.execute({ label: "Falsches Abschnittsziel",
    content: { before: session.content,
      after: { ...session.content,
        occurrences: [{ ...session.content.occurrences[0]!, sectionId: "missing" }] } } }),
    /Feature-Vorkommen/);
  const second = addMarkdownSection(session, room.id, first.id);
  assert.throws(() => removeMarkdownSection(session, room.id, first.id), /verknüpft/);
  editMarkdownSection(session, room.id, second, "", "## Hinweise\nEine Zeile.\n");
  moveKeySection(session, room.id, second, -1);
  const door = createPortal(session, floor,
    { boundary: structuredRoom(session, room.id), anchor: { contour: 0, at: 0.5 } },
    { variant: "door", width: 1, blocksLight: true });
  const after = structuredRoom(session, room.id);
  assert.equal(after.key.sections.find((section) => section.id === first.id)?.kind, "markdown");
  assert.equal((after.key.sections.find((section) => section.id === first.id) as { markdown: string }).markdown, exact);
  const passage = after.key.sections.find((section) => section.kind === "passage" && section.doorId === door.id)!;
  assert.match(sectionMarkdown(session, passage), /Tür/);
  assert.equal(keySectionUrl(session.id, room.id, first.id).includes("section=" + first.id), true);
  assert.equal(keySectionUrl(session.id, room.id, first.id, "QA Vault").includes("vault=QA+Vault"), true);
  assert.equal(session.snapshot().notes.size, 0);
  const saved = session.document();
  session.undo();
  assert.equal(session.entities.has(door.id), false);
  session.redo();
  assert.deepEqual(session.document(), saved);
  assert.deepEqual(parseDocument(JSON.stringify(saved)), saved);
  const archived = archiveEntities(session, [door.id]);
  assert.equal(session.entities.has(door.id), false);
  assert.match(sectionMarkdown(session, passage), /Tür/);
  assert.deepEqual(parseDocument(JSON.stringify(session.document())), session.document());
  restoreArchive(session, archived.id);
  assert.equal(session.entities.has(door.id), true);
  assert.deepEqual(session.document(), saved);
  const copiedFloor = duplicateFloor(session, floor);
  const copiedRoom = [...session.entities.values()].find((entity) =>
    isStructuredRoom(entity) && entity.floorId === copiedFloor.id);
  assert.ok(isStructuredRoom(copiedRoom));
  assert.notEqual(copiedRoom.key.sections[0]?.id, passage.id);
  assert.ok(copiedRoom.key.sections.some((section) =>
    section.kind === "markdown" && section.markdown === exact));
  assert.deepEqual(parseDocument(JSON.stringify(session.document())), session.document());
  const archivedFloor = archiveFloor(session, copiedFloor.id);
  assert.equal(session.floors.has(copiedFloor.id), false);
  restoreArchive(session, archivedFloor.id);
  assert.ok(session.floors.has(copiedFloor.id));
});

test("V4 feature text is exact, links one object and copies only its shared text on room change", () => {
  const doc = newDocument("V4 Features", 30, 15, undefined, undefined, 4);
  const s = new Session(doc), floor = doc.floors[0]!.id;
  const outline = (left: number) => [
    { x: left, y: 1 }, { x: left + 9, y: 1 },
    { x: left + 9, y: 10 }, { x: left, y: 10 },
  ];
  const a = createRoom(s, floor, outline(1), "QA/Räume");
  const b = createRoom(s, floor, outline(14), "QA/Räume");
  const aFirst = structuredRoom(s, a.id).key.sections[0]!;
  editMarkdownSection(s, a.id, aFirst.id, "", "## D · Bestehender Eintrag:\nUnverändert.\n");
  const definition = createFeatureDefinition(s, {
    name: "Schrein", kind: "feature", description: "Nicht in V4 kopieren", xp: 0, lootValue: 0,
  });
  assert.equal(definition.description, undefined);
  const object = createObject(s, floor, { x: 3, y: 3 }, {
    rotation: 0, width: 1, height: 1, color: 0xffffff, label: "Altar",
  });
  const exact = "*Wortlaut*  \r\n[[QA/Item|Fund]]\r\n";
  const first = createFeatureOccurrence(s, definition.id, a.id, 1, object.id, {},
    { markdown: exact, sectionId: aFirst.id });
  assert.equal(first.marker, "E");
  assert.equal(structuredFeatureText(s, first), exact);
  assert.equal((s.entities.get(object.id) as MapObject).label, "Altar");
  assert.throws(() => createFeatureOccurrence(s, definition.id, a.id, 1, object.id, {},
    { markdown: "zweites Vorkommen" }), /bereits ein Feature/);
  const other = createFeatureOccurrence(s, definition.id, a.id, 1, undefined, {},
    { markdown: "Anderer Text.", sectionId: aFirst.id });
  assert.equal(other.marker, "F");
  const shared = structuredRoom(s, a.id).key.sections.find((section) => section.id === aFirst.id)!;
  assert.equal(shared.kind, "markdown");
  assert.throws(() => editMarkdownSection(s, a.id, shared.id, shared.markdown,
    shared.markdown.replace(`<!-- dungeon-feature:${first.id}:start -->`, "")), /Grenzen/);
  const beforeMove = s.document(), history = s.historySize;
  const moved = objectAtPoint(s, object, { x: 16, y: 3 });
  executeLinkedObjectChanges(s, "Feature verschieben", [{ id: object.id, before: object, after: moved }]);
  assert.equal(s.historySize, history + 1);
  const relocated = s.content.occurrences.find((item) => item.id === first.id)!;
  assert.equal(relocated.roomId, b.id);
  assert.equal(relocated.marker, "A");
  assert.notEqual(relocated.sectionId, aFirst.id);
  assert.equal(structuredFeatureText(s, relocated), exact);
  assert.equal(structuredFeatureText(s, other), "Anderer Text.");
  assert.match((structuredRoom(s, a.id).key.sections.find((section) => section.id === aFirst.id) as
    { markdown: string }).markdown, /Wortlaut/);
  assert.throws(() => executeLinkedObjectChanges(s, "Außerhalb", [{
    id: object.id, before: moved, after: objectAtPoint(s, moved, { x: 12, y: 3 }),
  }]), /Zielraum/);
  assert.equal(s.historySize, history + 1);
  s.undo();
  assert.deepEqual(s.document(), beforeMove);
  s.redo();
  assert.deepEqual(parseDocument(JSON.stringify(s.document())), s.document());
  const next = createFeatureOccurrence(s, definition.id, a.id, 1, undefined, {},
    { markdown: "Neu." });
  assert.equal(next.marker, "G");
});

test("V4 imported shared text, generic Key targets and room projection survive a room move", () => {
  const doc = newDocument("Importierte Räume", 30, 12, undefined, undefined, 4);
  const setup = new Session(doc), floor = doc.floors[0]!.id;
  const outline = (x: number) => [{ x, y: 1 }, { x: x + 8, y: 1 },
    { x: x + 8, y: 9 }, { x, y: 9 }];
  const a = createRoom(setup, floor, outline(1), "QA/Räume");
  const b = createRoom(setup, floor, outline(14), "QA/Räume");
  const linked = createObject(setup, floor, { x: 3, y: 3 });
  const generic = createObject(setup, floor, { x: 4, y: 3 });
  const section = structuredRoom(setup, a.id).key.sections[0]!.id;
  const textId = "shared-text", body = "Originalwortlaut.\n";
  const markdown = `## A · Gemeinsamer Ort:\n<!-- dungeon-feature:${textId}:start -->\n${body}\n<!-- dungeon-feature:${textId}:end -->`;
  const original = setup.document();
  const migrated = { ...original,
    entities: original.entities.map((entity) => entity.id === a.id
      ? { ...entity, key: { sections: [{ id: section, kind: "markdown" as const, markdown }],
          sourcePath: "QA/Räume/01 Ort.md" } }
      : entity.id === generic.id
        ? { ...entity, keyTarget: { roomId: a.id, sectionId: section,
            anchor: "A · Gemeinsamer Ort:" } } : entity),
    content: { ...original.content, definitions: [
      { id: "definition-a", name: "A", kind: "feature" as const, xp: 0, lootValue: 0 },
      { id: "definition-b", name: "B", kind: "creature" as const, xp: 0, lootValue: 0 },
    ], occurrences: [
      { id: "occ-a", definitionId: "definition-a", roomId: a.id,
        entityId: linked.id, marker: "A", quantity: 1, sectionId: section, textId },
      { id: "occ-b", definitionId: "definition-b", roomId: a.id,
        marker: "B", quantity: 1, sectionId: section, textId },
    ] },
  };
  const s = new Session(parseDocument(JSON.stringify(migrated)));
  const first = s.content.occurrences[0]!, second = s.content.occurrences[1]!;
  assert.equal(structuredFeatureText(s, first), body);
  assert.equal(structuredFeatureText(s, second), body);
  assert.equal(stripFeatureBoundaries(markdown), "## A · Gemeinsamer Ort:\n" + body);
  const projection = projectedRoomDocuments(s.document());
  assert.equal(projection.find((room) => room.id === a.id)?.text,
    `---\nroom_id: "1"\n---\n## A · Gemeinsamer Ort:\n${body}`);
  const moved = objectAtPoint(s, linked, { x: 16, y: 3 });
  executeLinkedObjectChanges(s, "Gemeinsamen Text bewegen", [
    { id: linked.id, before: linked, after: moved },
  ]);
  const after = s.content.occurrences.find((item) => item.id === first.id)!;
  assert.equal(after.roomId, b.id);
  assert.notEqual(after.textId, second.textId);
  assert.equal(structuredFeatureText(s, after), body);
  assert.equal(structuredFeatureText(s, second), body);
  assert.equal((s.entities.get(generic.id) as MapObject).keyTarget?.sectionId, section);
  const copy = duplicateFloor(s, floor);
  const copiedRoom = [...s.entities.values()].find((entity) => isStructuredRoom(entity) &&
    entity.floorId === copy.id && entity.number === "1");
  const copiedGeneric = [...s.entities.values()].find((entity) => entity.kind === "object" &&
    entity.floorId === copy.id && entity.id !== generic.id && entity.keyTarget);
  assert.ok(isStructuredRoom(copiedRoom));
  assert.equal(copiedRoom.key.sourcePath, undefined);
  assert.equal(copiedGeneric?.keyTarget?.roomId, copiedRoom.id);
  assert.deepEqual(parseDocument(JSON.stringify(s.document())), s.document());
});

test("V4 single feature section keeps its ID when its object changes rooms", () => {
  const doc = newDocument("V4 Einzeltext", 30, 15, undefined, undefined, 4);
  const s = new Session(doc), floor = doc.floors[0]!.id;
  const a = createRoom(s, floor, [{ x: 1, y: 1 }, { x: 9, y: 1 },
    { x: 9, y: 9 }, { x: 1, y: 9 }], "QA/Räume");
  const b = createRoom(s, floor, [{ x: 14, y: 1 }, { x: 22, y: 1 },
    { x: 22, y: 9 }, { x: 14, y: 9 }], "QA/Räume");
  const definition = createFeatureDefinition(s, { name: "Statue", kind: "feature" });
  const object = createObject(s, floor, { x: 3, y: 3 });
  const occurrence = createFeatureOccurrence(s, definition.id, a.id, 1, object.id, {},
    { markdown: "Exakt.\n" });
  const moved = objectAtPoint(s, object, { x: 16, y: 3 });
  executeLinkedObjectChanges(s, "Statue verschieben", [{ id: object.id, before: object, after: moved }]);
  const after = s.content.occurrences.find((item) => item.id === occurrence.id)!;
  assert.equal(after.sectionId, occurrence.sectionId);
  assert.equal(after.roomId, b.id);
  assert.equal(structuredFeatureText(s, after), "Exakt.\n");
  assert.ok(!structuredRoom(s, a.id).key.sections.some((section) => section.id === occurrence.sectionId));
  const copy = duplicateFloor(s, floor);
  const copied = s.content.occurrences.find((item) => item.id !== occurrence.id &&
    s.entities.get(item.roomId)?.floorId === copy.id)!;
  assert.ok(copied);
  assert.notEqual(copied.sectionId, occurrence.sectionId);
  assert.equal(structuredFeatureText(s, copied), "Exakt.\n");
  const nextSection = addMarkdownSection(s, a.id);
  editMarkdownSection(s, a.id, nextSection, "", "## Hinweise\nUnverändert.\n");
  createPortal(s, floor,
    { boundary: structuredRoom(s, a.id), anchor: { contour: 0, at: 0.5 } },
    { variant: "door", width: 1, blocksLight: true });
  moveKeySection(s, a.id, nextSection, -1);
  const next = createFeatureOccurrence(s, definition.id, a.id, 1, undefined, {},
    { markdown: "Weiterer Text." });
  assert.equal(next.marker, "B");
  assert.deepEqual(parseDocument(JSON.stringify(s.document())), s.document());
});

test("V4 group move copies two feature fragments atomically and rejects an invalid target", () => {
  const doc = newDocument("V4 Sammelzug", 30, 15, undefined, undefined, 4);
  const s = new Session(doc), floor = doc.floors[0]!.id;
  const corners = (left: number) => [{ x: left, y: 1 }, { x: left + 8, y: 1 },
    { x: left + 8, y: 9 }, { x: left, y: 9 }];
  const a = createRoom(s, floor, corners(1), "QA/Räume");
  const b = createRoom(s, floor, corners(14), "QA/Räume");
  const definition = createFeatureDefinition(s, { name: "Fund", kind: "loot" });
  const firstObject = createObject(s, floor, { x: 3, y: 3 });
  const secondObject = createObject(s, floor, { x: 5, y: 3 });
  const sectionId = structuredRoom(s, a.id).key.sections[0]!.id;
  const first = createFeatureOccurrence(s, definition.id, a.id, 1, firstObject.id, {},
    { markdown: "Erster Fund.", sectionId });
  const second = createFeatureOccurrence(s, definition.id, a.id, 1, secondObject.id, {},
    { markdown: "Zweiter Fund.", sectionId });
  const before = s.document(), history = s.historySize;
  assert.throws(() => executeLinkedObjectChanges(s, "Ungültiger Sammelzug", [
    { id: firstObject.id, before: firstObject,
      after: objectAtPoint(s, firstObject, { x: 16, y: 3 }) },
    { id: secondObject.id, before: secondObject,
      after: objectAtPoint(s, secondObject, { x: 11, y: 3 }) },
  ]), /Zielraum/);
  assert.equal(s.historySize, history);
  assert.deepEqual(s.document(), before);
  executeLinkedObjectChanges(s, "Sammelzug", [
    { id: firstObject.id, before: firstObject,
      after: objectAtPoint(s, firstObject, { x: 16, y: 3 }) },
    { id: secondObject.id, before: secondObject,
      after: objectAtPoint(s, secondObject, { x: 18, y: 3 }) },
  ]);
  assert.equal(s.historySize, history + 1);
  const moved = s.content.occurrences.filter((item) => [first.id, second.id].includes(item.id));
  assert.deepEqual(moved.map((item) => item.marker), ["A", "B"]);
  assert.ok(moved.every((item) => item.roomId === b.id && item.sectionId !== sectionId));
  assert.deepEqual(moved.map((item) => structuredFeatureText(s, item)),
    ["Erster Fund.", "Zweiter Fund."]);
  const source = structuredRoom(s, a.id).key.sections.find((item) => item.id === sectionId)!;
  assert.equal(source.kind, "markdown");
  assert.match(source.markdown, /Erster Fund\./);
  assert.match(source.markdown, /Zweiter Fund\./);
  s.undo();
  assert.deepEqual(s.document(), before);
  s.redo();
  assert.deepEqual(parseDocument(JSON.stringify(s.document())), s.document());
});

test("V4 key edits survive pending drafts, save and fresh repository opening", async () => {
  const store = new MemoryStore();
  const path = "QA/V4/Karte.dungeon";
  const initial = newDocument("V4 Entwurf", 20, 20, undefined, undefined, 4);
  const repository = new MapRepository(store, path);
  const session = new Session(initial);
  await repository.beginPending(initial, session);
  const room = createRoom(session, initial.floors[0]!.id,
    [{ x: 1, y: 1 }, { x: 8, y: 1 }, { x: 8, y: 8 }, { x: 1, y: 8 }],
    "QA/V4/Räume");
  const section = structuredRoom(session, room.id).key.sections[0]!;
  editMarkdownSection(session, room.id, section.id, "", "*Wortlaut bleibt.*\n");
  await repository.persistDraft(session);
  assert.equal(await store.read(path), null);
  assert.equal([...store.files.keys()].some((key) => key.endsWith(".md")), false);
  const restoredRepository = new MapRepository(store, path);
  const restored = await restoredRepository.openPending();
  assert.equal(restored.version, 4);
  assert.equal(sectionMarkdown(restored, structuredRoom(restored, room.id).key.sections[0]!), "*Wortlaut bleibt.*\n");
  await restoredRepository.save(restored);
  const fresh = await new MapRepository(store, path).open();
  assert.equal(fresh.version, 4);
  assert.deepEqual(fresh.document(), restored.document());
  assert.equal([...store.files.keys()].some((key) => key.endsWith(".md")), false);
});
