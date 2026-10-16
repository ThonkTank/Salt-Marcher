import { test } from "node:test";
import assert from "node:assert/strict";
import { convertV1Document } from "../tools/migrate-building-v2.mjs";

function sourceDocument() {
  const room = {
      id: "room-stable",
      kind: "room",
      floorId: "floor",
      points: [
        { x: 1, y: 1 },
        { x: 8, y: 1 },
        { x: 8, y: 6 },
        { x: 1, y: 6 },
      ],
      number: "7",
      name: "Raum 7",
      note: { path: "Räume/room-stable.md" },
      fill: 0xbfb09a,
      wall: 0x403e39,
    },
    door = {
      id: "door-stable",
      kind: "door",
      floorId: "floor",
      boundaryId: room.id,
      at: 0.25,
      width: 1,
      variant: "door",
      note: { path: room.note.path, anchor: "durchgang-door-stable" },
    },
    object = {
      id: "object-stable",
      kind: "object",
      floorId: "floor",
      roomId: room.id,
      x: 3,
      y: 3,
      rotation: 0,
      width: 1,
      height: 1,
      color: 0xffffff,
      label: "",
    },
    floorSurface = {
      id: "floor-stable",
      kind: "surface",
      floorId: "floor",
      category: "floor",
      polygons: [{
        outer: [
          { x: 10, y: 1 },
          { x: 14, y: 1 },
          { x: 14, y: 5 },
          { x: 10, y: 5 },
        ],
        holes: [],
      }],
      layer: 200,
      color: 0xbfb09a,
      wallColor: 0x403e39,
      wallWidth: 0.2,
      opacity: 1,
      effect: "none",
    };
  return {
    format: "dungeon-map",
    version: 1,
    id: "map-stable",
    settings: {},
    floors: [{ id: "floor", name: "Erdgeschoss", elevation: 0 }],
    entities: [room, door, object, floorSurface],
    content: {
      definitions: [],
      occurrences: [{
        id: "occurrence",
        definitionId: "definition",
        roomId: room.id,
        marker: "A",
        quantity: 1,
        note: { path: room.note.path, anchor: "A" },
      }],
      routes: [{
        id: "route",
        name: "Eingang",
        entrance: true,
        toRoomId: room.id,
        prerequisites: [],
      }],
      archive: [{
        id: "archive",
        label: "Archiv",
        archivedAt: "2026-10-04T00:00:00.000Z",
        floors: [], floorPositions: [], definitions: [], definitionPositions: [],
        occurrences: [], occurrencePositions: [], routes: [], routePositions: [],
        entities: [structuredClone(room)], entityPositions: [0],
      }],
    },
  };
}

test("offline conversion preserves ids and references while replacing room and floor records", () => {
  const source = sourceDocument(),
    before = structuredClone(source),
    converted = convertV1Document(source);
  assert.deepEqual(source, before);
  assert.equal(converted.version, 2);
  assert.deepEqual(
    converted.entities.map((entity) => entity.id),
    before.entities.map((entity) => entity.id),
  );
  const room = converted.entities.find((entity) => entity.id === "room-stable"),
    floor = converted.entities.find((entity) => entity.id === "floor-stable"),
    door = converted.entities.find((entity) => entity.id === "door-stable"),
    object = converted.entities.find((entity) => entity.id === "object-stable");
  assert.equal(room.kind, "building");
  assert.equal(room.number, "7");
  assert.equal(room.note.path, "Räume/room-stable.md");
  assert.equal(floor.kind, "building");
  assert.deepEqual(door.anchor, {
    boundaryId: "room-stable",
    contour: 0,
    at: 0.25,
  });
  assert.equal(object.roomId, "room-stable");
  assert.equal(converted.content.occurrences[0].roomId, "room-stable");
  assert.equal(converted.content.routes[0].toRoomId, "room-stable");
  assert.equal(converted.content.archive[0].entities[0].kind, "building");
});

test("offline conversion refuses a lossy floor effect", () => {
  const source = sourceDocument();
  source.entities.at(-1).opacity = 0.5;
  assert.throws(() => convertV1Document(source), /nicht verlustfrei/);
});
