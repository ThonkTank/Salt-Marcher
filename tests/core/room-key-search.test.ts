import { test } from "node:test";
import assert from "node:assert/strict";
import { addFloor, createDoor, createRoom } from "../../src/commands";
import { editMarkdownSection, structuredRoom } from "../../src/room-key";
import {
  roomKeySearchTargetExists,
  searchRoomKeys,
  type RoomKeySectionMatch,
} from "../../src/room-key-search";
import { Session } from "../../src/session";
import { newDocument } from "./fixtures";

function outline(left: number) {
  return [
    { x: left, y: 1 }, { x: left + 6, y: 1 },
    { x: left + 6, y: 7 }, { x: left, y: 7 },
  ];
}

test("room key search returns one ordered overview entry per V4 room without mutation", () => {
  const session = new Session(newDocument("Suche", 30, 20, undefined, undefined, 4)),
    ground = session.floors.values().next().value!,
    upper = addFloor(session),
    first = createRoom(session, ground.id, outline(1), "QA/Räume"),
    upperRoom = createRoom(session, upper.id, outline(10), "QA/Räume"),
    duplicate = createRoom(session, ground.id, outline(18), "QA/Räume");
  session.execute({ label: "Doppelte Raumnummer für Suche", entities: [{
    id: duplicate.id,
    before: duplicate,
    after: { ...duplicate, number: first.number, name: "Anderer Raum" },
  }] });
  const duplicateCurrent = structuredRoom(session, duplicate.id);
  const before = session.document(), dirty = session.dirty,
    historySize = session.historySize, canUndo = session.canUndo,
    canRedo = session.canRedo, revision = session.revision;

  const result = searchRoomKeys(session, "  \n  ");

  assert.equal(result.available, true);
  assert.equal(result.query, "");
  assert.deepEqual(result.entries.map((entry) => [
    entry.floorId, entry.roomNumber, entry.roomId,
  ]), [[first, duplicateCurrent].sort((a, b) => a.id < b.id ? -1 : 1), [upperRoom]]
    .flat().map((room) => [
    room.floorId, room.number, room.id,
  ]));
  assert.ok(result.entries.every((entry) => entry.kind === "room"));
  assert.deepEqual(session.document(), before);
  assert.equal(session.dirty, dirty);
  assert.equal(session.historySize, historySize);
  assert.equal(session.canUndo, canUndo);
  assert.equal(session.canRedo, canRedo);
  assert.equal(session.revision, revision);
});

test("room key search normalizes Unicode and returns every matching section with stable targets", () => {
  const session = new Session(newDocument("Hinweise", 30, 20, undefined, undefined, 4)),
    upper = addFloor(session),
    room = createRoom(session, upper.id, outline(2), "QA/Räume"),
    first = structuredRoom(session, room.id).key.sections[0]!;
  assert.equal(first.kind, "markdown");
  editMarkdownSection(session, room.id, first.id, "",
    "## Licht\n<!-- dungeon-feature:licht:start -->\nDie blaue Fa\u0308ckel öffnet den Geheimgang.\n\n<!-- dungeon-feature:licht:end -->");
  const second = structuredRoom(session, room.id).key.sections[0]!;
  session.execute({ label: "Zweiten Suchabschnitt ergänzen", entities: [{
    id: room.id,
    before: structuredRoom(session, room.id),
    after: { ...structuredRoom(session, room.id), key: {
      ...structuredRoom(session, room.id).key,
      sections: [...structuredRoom(session, room.id).key.sections,
        { id: "zweiter-hinweis", kind: "markdown" as const,
          markdown: "## Reserve\nEine zweite BLAUE FÄCKEL wartet hier." }],
    } },
  }] });
  const before = session.document(), result = searchRoomKeys(session, "  blaue fäckel ");

  assert.equal(result.query, "blaue fäckel");
  assert.equal(result.entries.length, 2);
  for (const entry of result.entries) {
    assert.equal(entry.kind, "section");
    assert.equal(entry.roomId, room.id);
    assert.equal(entry.floorId, upper.id);
    assert.equal(entry.floorName, "Geschoss 1");
    assert.equal(entry.roomNumber, room.number);
    assert.equal(roomKeySearchTargetExists(session, entry), true);
    assert.doesNotMatch((entry as RoomKeySectionMatch).snippet, /dungeon-feature/);
  }
  assert.equal((result.entries[0] as RoomKeySectionMatch).sectionId, second.id);
  assert.match((result.entries[0] as RoomKeySectionMatch).snippet, /blaue Fäckel/i);
  assert.equal(searchRoomKeys(session, "dungeon-feature").entries.length, 0);
  assert.deepEqual(session.document(), before);
});

test("room key search includes passage text and revalidates damaged targets", () => {
  const session = new Session(newDocument("Durchgänge", 20, 20, undefined, undefined, 4)),
    floor = session.floors.values().next().value!,
    room = createRoom(session, floor.id, outline(2), "QA/Räume"),
    door = createDoor(session, room, 0, 0.5);
  session.execute({ label: "Passage beschreiben", entities: [{
    id: door.id,
    before: door,
    after: { ...door, passage: { ...door.passage!, description: "Silberner Schlüssel" } },
  }] });
  const result = searchRoomKeys(session, "silberner schlüssel"),
    match = result.entries[0] as RoomKeySectionMatch;
  assert.equal(result.entries.length, 1);
  assert.equal(match.kind, "section");
  assert.equal(match.sectionTitle, "Tür");
  assert.equal(roomKeySearchTargetExists(session, match), true);
  assert.equal(roomKeySearchTargetExists(session, { ...match, sectionId: "missing" }), false);
  assert.equal(roomKeySearchTargetExists(session, { ...match, roomId: "missing" }), false);
  assert.equal(roomKeySearchTargetExists(session, { ...match, floorId: "missing" }), false);
});

test("room key snippets retain length-changing Unicode folds and long complete matches", () => {
  const session = new Session(newDocument("Ausschnitte", 20, 20, undefined, undefined, 4)),
    floor = session.floors.values().next().value!,
    room = createRoom(session, floor.id, outline(2), "QA/Räume"),
    section = structuredRoom(session, room.id).key.sections[0]!;
  assert.equal(section.kind, "markdown");
  const longMatch = "Q".repeat(130);
  editMarkdownSection(session, room.id, section.id, "",
    `${"İ".repeat(100)}needle${"z".repeat(200)}\n${"x".repeat(200)}${longMatch}${"y".repeat(200)}`);

  const unicode = searchRoomKeys(session, "needle").entries[0] as RoomKeySectionMatch,
    long = searchRoomKeys(session, longMatch.toLocaleLowerCase("de")).entries[0] as RoomKeySectionMatch;
  assert.match(unicode.snippet, /needle/);
  assert.equal(long.snippet.includes(longMatch), true);
});

test("room key search canonicalizes context-sensitive Greek sigma", () => {
  const session = new Session(newDocument("Sigma", 20, 20, undefined, undefined, 4)),
    floor = session.floors.values().next().value!,
    room = createRoom(session, floor.id, outline(2), "QA/Räume"),
    section = structuredRoom(session, room.id).key.sections[0]!;
  assert.equal(section.kind, "markdown");
  editMarkdownSection(session, room.id, section.id, "", "Das Zeichen ΟΣ bleibt sichtbar.");

  const match = searchRoomKeys(session, "ος").entries[0] as RoomKeySectionMatch;
  assert.equal(match.roomId, room.id);
  assert.match(match.snippet, /ΟΣ/);
});

test("room key search is explicitly unavailable for non-V4 sessions", () => {
  const session = new Session(newDocument("Alt", 12, 12, undefined, undefined, 3));
  assert.deepEqual(searchRoomKeys(session, "Hinweis"), {
    available: false,
    query: "Hinweis",
    entries: [],
  });
  assert.equal(roomKeySearchTargetExists(session, {
    roomId: "room", floorId: session.floors.keys().next().value!,
  }), false);
});
