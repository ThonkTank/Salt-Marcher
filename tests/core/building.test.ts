import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDocument, type Door, type Building, type Polygon,
  type Wall, type Surface, isRoom } from "../../src/model";
import { Session } from "../../src/session";
import { adoptFloorAsRoom, createPortal, createBuilding, planBuildingMutation, planBuildingContourMutation } from "../../src/commands";
import { boundarySegments, alignedPortalAt, portalPose, rectangle, buildingEllipse, reanchorPortal, buildingContourEntries, buildingPolygonPoints, nearestBuildingVertex, nearestBuildingSegment, replaceBuildingContour } from "../../src/geometry";
import { composeBuilding } from "../../src/compute";
import { floorEraseActive } from "../../src/drawing";
import { newDocument } from "./fixtures";
import {
  buildingPointGripPixels, buildingVertexGrip, buildingEdgeMidpointGrip,
  previewBuildingVertexDrag, planBuildingVertexDrag,
  previewBuildingEdgeDrag, planBuildingEdgeDrag,
  planBuildingBackspacePoint, buildingPointDragDestination,
  proposeBuildingPointDrag,
} from "../../src/features/bau/building-point-gestures";
import { previewBuildingMutationWithPortals } from "../../src/features/bau/building-edge-portal-preview";

test("Building ellipse sampling follows measured native sizes", () => {
  for (const [a, b, count, sample] of [
    [{ x: 2, y: 2 }, { x: 3, y: 3 }, 28, [668, 515]],
    [{ x: 1, y: 1 }, { x: 4, y: 3 }, 28, [725, 262]],
    [{ x: 2, y: 2 }, { x: 6, y: 6 }, 32, [1123, 521]],
    [{ x: 1, y: 2 }, { x: 7, y: 5 }, 36, [1157, 517]],
    [{ x: 1, y: 1 }, { x: 7, y: 7 }, 48, [1124, 262]],
  ] as const) {
    const contour = buildingEllipse(a, b);
    assert.equal(contour.length, count);
    assert.ok(contour.some(point =>
      Math.abs(point.x * 256 - sample[0]) <= 1.5 &&
      Math.abs(point.y * 256 - sample[1]) <= 1.5));
  }
  assert.equal(buildingEllipse({ x: 3, y: 0.25 },
    { x: 7.5, y: 3.5 }).length, 28);
  assert.equal(buildingEllipse({ x: 1, y: 1 },
    { x: 5.75, y: 4.75 }).length, 32);
});

test("Building Shift curve follows the next polygon point and survives sampled contour storage", () => {
  const base = [{ x: 1, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 5 }],
    curves = [{ index: 2, handle: { x: 5, y: 4 } }],
    pending = buildingPolygonPoints(base, curves),
    short = buildingPolygonPoints([...base, { x: 4, y: 5 }], curves, true),
    wide = buildingPolygonPoints([...base, { x: 1, y: 5 }], curves, true),
    reversed = buildingPolygonPoints(
      [{ x: 6, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 4 }, { x: 6, y: 4 }],
      [{ index: 2, handle: { x: 2, y: 3 } }], true,
    ),
    diagonal = buildingPolygonPoints(
      [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 6, y: 5 }, { x: 1, y: 6 }],
      [{ index: 2, handle: { x: 5, y: 4 } }], true,
    ),
    nativeDiagonal = [
      [1228, 321], [1138, 447], [1064, 567], [1005, 680],
      [962, 785], [934, 882], [921, 970], [924, 1050],
      [941, 1119], [973, 1178], [1020, 1227], [1082, 1264],
      [1158, 1290], [1248, 1303], [1352, 1304], [1471, 1291],
    ];
  assert.equal(pending.length, 19);
  assert.equal(short.length, 20);
  assert.equal(wide.length, 20);
  assert.equal(short[1]!.x, 6);
  assert.ok(Math.abs(short[2]!.x - 1510 / 256) < 0.015);
  assert.ok(Math.abs(short[2]!.y - 551 / 256) < 0.015);
  assert.ok(Math.abs(Math.min(...short.slice(2, 19).map(p => p.x)) - 1324 / 256) < 0.02);
  assert.ok(Math.abs(Math.min(...wide.slice(2, 19).map(p => p.x)) - 1007 / 256) < 0.02);
  assert.equal(reversed.length, 20);
  assert.ok(Math.abs(reversed[2]!.x - 320 / 256) < 0.01);
  assert.ok(Math.abs(reversed[2]!.y - 295 / 256) < 0.01);
  assert.ok(Math.abs(Math.max(...reversed.slice(2, 19).map(p => p.x)) - 784 / 256) < 0.02);
  assert.equal(diagonal.length, 20);
  nativeDiagonal.forEach(([x, y], step) => {
    assert.ok(Math.abs(diagonal[step + 2]!.x * 256 - x!) <= 1.5);
    assert.ok(Math.abs(diagonal[step + 2]!.y * 256 - y!) <= 1.5);
  });
  assert.deepEqual(buildingPolygonPoints(base, [], true), base);
});

test("finished Building Shift contours ignore handle distance and retain separated curves", () => {
  const vertices = [{ x: 1, y: 2 }, { x: 6, y: 2 },
    { x: 6, y: 5 }, { x: 1, y: 7 }];
  const contours = [{ x: 4, y: 4 }, { x: 5, y: 4 }, { x: 5, y: 3 }]
    .map(handle => buildingPolygonPoints(vertices, [{ index: 2, handle }], true));
  assert.deepEqual(contours[0], contours[1]);
  assert.deepEqual(contours[1], contours[2]);
  const two = buildingPolygonPoints(
    [{ x: 1, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 3 },
      { x: 5, y: 4 }, { x: 4, y: 6 }, { x: 1, y: 6 }],
    [{ index: 2, handle: { x: 5, y: 2 } },
      { index: 4, handle: { x: 3, y: 5 } }], true,
  );
  assert.equal(two.length, 37);
  assert.ok(!two.some(point => point.x === 5 && point.y === 4));
  assert.ok(two.some(point => point.x < 4 && point.y > 4));
  const follower = buildingPolygonPoints(
    [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 3 },
      { x: 7, y: 4 }, { x: 1, y: 6 }],
    [{ index: 2, handle: { x: 4, y: 2 } }], true,
  );
  assert.equal(follower.length, 20);
  assert.ok(!follower.some(point => point.x === 7 && point.y === 4));
  assert.ok(Math.abs(follower[2]!.x * 256 - 1305) <= 1.5);
  assert.ok(Math.abs(follower[2]!.y * 256 - 295) <= 1.5);
});

test("consecutive Shift input and crossing cleanup match native Building contours", () => {
  const consecutive = [
      { x: 1, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 4 },
      { x: 4, y: 6 }, { x: 1, y: 6 },
    ],
    firstCurve = { index: 2, handle: { x: 5, y: 3 } },
    secondCurve = { index: 3, handle: { x: 3, y: 5 } },
    p18 = buildingPolygonPoints(consecutive, [firstCurve, secondCurve], true);
  assert.deepEqual(p18, buildingPolygonPoints(consecutive, [firstCurve], true));
  assert.equal(p18.length, 20);
  const draw = (outer: ReturnType<typeof buildingPolygonPoints>) =>
    composeBuilding({ kind: "compose-building", sources: [],
      shape: [{ outer, holes: [] }], nativeBuilding: true, erase: false });
  const split = draw(p18);
  assert.equal(split.mode, "draw");
  if (split.mode !== "draw") return;
  assert.deepEqual(split.polygons.map(p => p.outer.length), [14, 8]);
  assert.ok(Math.abs(split.polygons[0]!.outer[0]!.x * 256 - 1510) <= 1);
  assert.ok(Math.abs(split.polygons[1]!.outer[0]!.y * 256 - 1048) <= 1);

  const p19 = buildingPolygonPoints([
    { x: 1, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 3 },
    { x: 5, y: 4 }, { x: 4, y: 6 }, { x: 1, y: 6 },
  ], [
    { index: 2, handle: { x: 5, y: 2 } },
    { index: 4, handle: { x: 3, y: 5 } },
  ], true);
  assert.equal(p19.length, 37);
  const joined = draw(p19);
  assert.equal(joined.mode, "draw");
  if (joined.mode !== "draw") return;
  assert.equal(joined.polygons.length, 1);
  assert.equal(joined.polygons[0]!.outer.length, 39);
  assert.ok(joined.polygons[0]!.outer.some(p =>
    Math.abs(p.x * 256 - 1469) <= 1 && Math.abs(p.y * 256 - 808) <= 1));

  const p30 = buildingPolygonPoints([
    { x: 1, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 4 },
    { x: 5, y: 5 }, { x: 1, y: 6 },
  ], [firstCurve], true);
  const narrow = draw(p30);
  assert.equal(narrow.mode, "draw");
  if (narrow.mode !== "draw") return;
  assert.deepEqual(narrow.polygons.map(p => p.outer.length), [17, 5]);
});


test("bound portals snap to the center of a matching corridor endpoint", () => {
  const room = {
      id: "room",
      kind: "building" as const,
      floorId: "floor",
      number: "1",
      name: "Eingang",
      note: { path: "Dungeons/Test/Räume/01 Eingang.md" },
      polygons: [{
        outer: rectangle({ x: 0, y: 0 }, { x: 7, y: 7 }),
        holes: [],
      }],
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
    },
    corridor = {
      id: "corridor",
      kind: "path" as const,
      floorId: "floor",
      points: [
        { x: 3.5, y: 0 },
        { x: 3.5, y: -5 },
      ],
      width: 3,
      style: "road" as const,
      color: 0xffffff,
      outlineColor: 0,
      outlineWidth: 0.1,
      layer: 0,
      start: "round" as const,
      end: "round" as const,
      blocksLight: false,
      smooth: false,
      closed: false,
    };
  assert.deepEqual(
    alignedPortalAt({ x: 3.1, y: 0 }, room, [corridor], 3),
    { contour: 0, at: 0.125 },
  );
  assert.notDeepEqual(
    alignedPortalAt({ x: 3.1, y: 0 }, room, [corridor], 1),
    { contour: 0, at: 0.125 },
  );
});

test("floor erase state follows the persistent mode and transient Alt modifier", () => {
  assert.equal(floorEraseActive("draw", false), false);
  assert.equal(floorEraseActive("draw", true), true);
  assert.equal(floorEraseActive("erase", false), true);
  assert.equal(floorEraseActive("erase", true), true);
});

test("building keeps multiple parts, holes and the same id when assigned a room key", () => {
  const document = newDocument("Gebäudeaggregat", 40, 40),
    session = new Session(document),
    floorId = document.floors[0]!.id,
    polygons = [
      {
        outer: rectangle({ x: 1, y: 1 }, { x: 12, y: 12 }),
        holes: [rectangle({ x: 4, y: 4 }, { x: 7, y: 7 })],
      },
      {
        outer: rectangle({ x: 18, y: 2 }, { x: 24, y: 8 }),
        holes: [],
      },
    ],
    building = createBuilding(session, floorId, polygons, {
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
    }),
    room = adoptFloorAsRoom(
      session,
      building.id,
      "QA/Räume",
      {},
      "QA/Gebäudeaggregat.dungeon",
    );
  assert.equal(session.document().version, 3);
  assert.equal(room.id, building.id);
  assert.deepEqual(room.polygons, polygons);
  assert.equal(isRoom(room), true);
  session.undo();
  const restored = session.entities.get(building.id);
  assert.equal(restored?.kind, "building");
  assert.equal(isRoom(restored), false);
  if (restored?.kind !== "building") throw new Error("Gebäude fehlt.");
  assert.deepEqual(restored.polygons, polygons);
  assert.equal(session.note(room.note!.path), null);
});

test("room assignment binds existing building portals and creates their key blocks atomically", () => {
  const document = newDocument("Portale vor Raum", 30, 30),
    session = new Session(document),
    floorId = document.floors[0]!.id,
    building = createBuilding(session, floorId, [{
      outer: rectangle({ x: 2, y: 2 }, { x: 12, y: 10 }),
      holes: [],
    }], {
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
    }),
    northDoor = createPortal(session, floorId,
      { boundary: building, anchor: { contour: 0, at: 0.125 } },
      { variant: "door", width: 1, blocksLight: true,
        passage: { description: "Steintür", state: "locked", hidden: true,
          hiddenDC: 14, hp: 20, ac: 15, key: "Messingschlüssel" } },
    ),
    westOpening = createPortal(session, floorId,
      { boundary: building, anchor: { contour: 0, at: 0.875 } },
      { variant: "opening", width: 1, blocksLight: false },
    ),
    room = adoptFloorAsRoom(session, building.id, "QA/Räume"),
    key = session.note(room.note!.path)!;
  assert.equal(northDoor.note, undefined);
  assert.equal(westOpening.note, undefined);
  assert.match(key, new RegExp(`\\^durchgang-${northDoor.id}`));
  assert.match(key, new RegExp(`\\^durchgang-${westOpening.id}`));
  assert.match(key, /Steintür\. Verschlossen\. Versteckt \(SG 14\)\. 20 HP, RK 15\. Schlüssel: Messingschlüssel\./);
  for (const id of [northDoor.id, westOpening.id]) {
    const door = session.entities.get(id);
    assert.equal(door?.kind, "door");
    if (door?.kind !== "door") continue;
    assert.equal(door.note?.path, room.note!.path);
    assert.ok(door.passage?.direction);
  }
  const finalDocument = session.document();
  session.undo();
  assert.equal(session.note(room.note!.path), null);
  assert.deepEqual(session.entities.get(northDoor.id), northDoor);
  assert.deepEqual(session.entities.get(westOpening.id), westOpening);
  assert.equal(isRoom(session.entities.get(building.id)), false);
  session.redo();
  assert.equal(session.note(room.note!.path), key);
  assert.deepEqual(session.document(), finalDocument);
  assert.deepEqual(parseDocument(JSON.stringify(finalDocument)), finalDocument);
});

test("room assignment refuses to replace an existing portal key reference", () => {
  const document = newDocument("Geschützter Durchgang", 20, 20),
    session = new Session(document),
    floorId = document.floors[0]!.id,
    building = createBuilding(session, floorId, [{
      outer: rectangle({ x: 2, y: 2 }, { x: 10, y: 10 }),
      holes: [],
    }], { layer: 200, fill: 0xbfb09a, wall: 0x403e39, wallWidth: 0.2 }),
    door = createPortal(session, floorId,
      { boundary: building, anchor: { contour: 0, at: 0.125 } },
      { variant: "door", width: 1, blocksLight: true },
    ),
    existing = { ...door, note: { path: "QA/Andere.md", anchor: "alter-anker" } };
  session.loadNote("QA/Andere.md", "Bewahrter Text.\r\n");
  session.execute({ label: "Vorhandenen Verweis setzen", entities: [
    { id: door.id, before: door, after: existing },
  ] });
  const before = session.document();
  assert.throws(
    () => adoptFloorAsRoom(session, building.id, "QA/Räume"),
    /anderen Key-Verweis/,
  );
  assert.deepEqual(session.document(), before);
  assert.equal(session.note("QA/Andere.md"), "Bewahrter Text.\r\n");
  assert.equal(isRoom(session.entities.get(building.id)), false);
});

test("building room metadata is all-or-nothing", () => {
  const document = newDocument("Raumidentität", 20, 20),
    floorId = document.floors[0]!.id,
    partial: Building = {
      id: "partial-room",
      kind: "building",
      floorId,
      polygons: [{
        outer: rectangle({ x: 1, y: 1 }, { x: 5, y: 5 }),
        holes: [],
      }],
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
      name: "Unvollständig",
    };
  assert.throws(
    () => new Session({ ...document, entities: [partial] }),
    /Gebäudedaten/,
  );
});

test("portal anchors address one building contour and reject missing contours", () => {
  const document = newDocument("Konturportal", 30, 30),
    session = new Session(document),
    floorId = document.floors[0]!.id,
    building = createBuilding(
      session,
      floorId,
      [{
        outer: rectangle({ x: 1, y: 1 }, { x: 12, y: 12 }),
        holes: [rectangle({ x: 3, y: 3 }, { x: 7, y: 7 })],
      }],
      {
        layer: 200,
        fill: 0xbfb09a,
        wall: 0x403e39,
        wallWidth: 0.2,
      },
    ),
    door = createPortal(
      session,
      floorId,
      { boundary: building, anchor: { contour: 1, at: 0.125 } },
      { variant: "door", width: 2, blocksLight: true },
    ),
    pose = portalPose(door, (id) => session.entities.get(id));
  assert.deepEqual(pose, { x: 5, y: 3, angle: 0 });
  assert.equal(boundarySegments(building, [door]).length, 9);
  assert.deepEqual(
    parseDocument(JSON.stringify(session.document())).entities.find(
      (entity) => entity.id === door.id,
    ),
    door,
  );
  assert.throws(
    () =>
      createPortal(
        session,
        floorId,
        { boundary: building, anchor: { contour: 2, at: 0.5 } },
        { variant: "door", width: 1, blocksLight: true },
      ),
    /Wandbindung/,
  );
});

test("portal reanchoring follows point edits but survives booleans only on retained walls", () => {
  const document = newDocument("Portalabgleich", 30, 30),
    session = new Session(document),
    floorId = document.floors[0]!.id,
    before = createBuilding(
      session,
      floorId,
      [{
        outer: rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }),
        holes: [],
      }],
      {
        layer: 200,
        fill: 0xbfb09a,
        wall: 0x403e39,
        wallWidth: 0.2,
      },
    ),
    door = createPortal(
      session,
      floorId,
      { boundary: before, anchor: { contour: 0, at: 0.125 } },
      { variant: "door", width: 1, blocksLight: true },
    ),
    extended: Building = {
      ...before,
      polygons: [{
        outer: rectangle({ x: 0, y: 0 }, { x: 12, y: 10 }),
        holes: [],
      }],
    },
    retained = reanchorPortal(door, before, extended, "survive");
  assert.ok(retained);
  assert.deepEqual(
    portalPose(retained, (id) => (id === extended.id ? extended : undefined)),
    { x: 5, y: 0, angle: 0 },
  );
  const moved: Building = {
      ...before,
      polygons: [{
        outer: [
          { x: 0, y: 1 },
          { x: 10, y: 1 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        holes: [],
      }],
    },
    followed = reanchorPortal(door, before, moved, "follow");
  assert.ok(followed);
  assert.equal(
    portalPose(followed, (id) => (id === moved.id ? moved : undefined)).y,
    1,
  );
  const partial: Building = {
    ...before,
    polygons: [{
      outer: [
        { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 2 },
        { x: 6, y: 2 }, { x: 6, y: 0 }, { x: 10, y: 0 },
        { x: 10, y: 10 }, { x: 0, y: 10 },
      ],
      holes: [],
    }],
  };
  const partiallyRetained = reanchorPortal(door, before, partial, "survive");
  assert.ok(partiallyRetained);
  assert.deepEqual(
    portalPose(partiallyRetained, (id) => (id === partial.id ? partial : undefined)),
    { x: 5, y: 0, angle: 0 },
  );
  const cut: Building = {
    ...before,
    polygons: [{
      outer: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 2 },
        { x: 6, y: 2 },
        { x: 6, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      holes: [],
    }],
  };
  assert.equal(reanchorPortal(door, before, cut, "survive"), null);
});

test("building draw keeps the sole room id and commits portal loss without touching key bytes", () => {
  const document = newDocument("Atomarer Grundriss", 30, 30),
    floorId = document.floors[0]!.id,
    style = {
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
    },
    plain: Building = {
      id: "plain-first",
      kind: "building",
      floorId,
      polygons: [{
        outer: rectangle({ x: 9, y: 0 }, { x: 16, y: 10 }),
        holes: [],
      }],
      ...style,
    },
    room: Building = {
      id: "numbered-later",
      kind: "building",
      floorId,
      polygons: [{
        outer: rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }),
        holes: [],
      }],
      number: "7",
      name: "Sonderraum",
      note: { path: "QA/Räume/07 Sonderraum.md" },
      ...style,
    },
    kept: Door = {
      id: "kept-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: room.id, contour: 0, at: 0.875 },
      width: 1,
      variant: "door",
    },
    lost: Door = {
      id: "lost-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: plain.id, contour: 0, at: 29 / 34 },
      width: 1,
      variant: "door",
    },
    session = new Session({
      ...document,
      entities: [plain, room, kept, lost],
    }),
    keyBytes = "---\r\nroom_id: \"numbered-later\"\r\n---\r\n# 7  Sonderraum!\r\n\r\n- Tür:  unverändert.\r\n";
  session.loadNote(room.note!.path, keyBytes);
  const beforeEntities = session.document().entities,
    beforePose = portalPose(kept, (id) => session.entities.get(id)),
    result = composeBuilding({
      kind: "compose-building",
      sources: [
        { id: plain.id, polygons: plain.polygons },
        { id: room.id, polygons: room.polygons },
      ],
      shape: [{
        outer: rectangle({ x: 8, y: 4 }, { x: 11, y: 6 }),
        holes: [],
      }],
      erase: false,
    }),
    plan = planBuildingMutation({
      entities: [...session.entities.values()],
      floorId,
      result,
      expectedRevision: session.revision,
      currentRevision: session.revision,
    });
  assert.equal(plan.selectedId, room.id);
  assert.ok(plan.command);
  assert.equal(Object.hasOwn(plan.command!, "texts"), false);
  session.execute(plan.command!);
  assert.equal(session.historySize, 1);
  assert.equal(session.entities.has(plain.id), false);
  assert.equal(isRoom(session.entities.get(room.id)), true);
  assert.equal(session.entities.has(lost.id), false);
  const keptAfter = session.entities.get(kept.id);
  assert.equal(keptAfter?.kind, "door");
  if (keptAfter?.kind !== "door") throw new Error("Portal fehlt.");
  assert.equal(keptAfter.anchor?.boundaryId, room.id);
  const afterPose = portalPose(keptAfter, (id) => session.entities.get(id));
  assert.ok(Math.abs(afterPose.x - beforePose.x) < 1e-8);
  assert.ok(Math.abs(afterPose.y - beforePose.y) < 1e-8);
  assert.equal(session.note(room.note!.path), keyBytes);
  const afterEntities = session.document().entities;

  session.undo();
  assert.deepEqual(session.document().entities, beforeEntities);
  assert.equal(session.note(room.note!.path), keyBytes);
  session.redo();
  assert.deepEqual(session.document().entities, afterEntities);
  assert.equal(session.note(room.note!.path), keyBytes);
});

test("building draw chooses the earlier unnumbered id independent of worker id order", () => {
  const document = newDocument("Deterministische ID", 30, 30),
    floorId = document.floors[0]!.id,
    style = {
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
    },
    first: Building = {
      id: "document-first",
      kind: "building",
      floorId,
      polygons: [{
        outer: rectangle({ x: 0, y: 0 }, { x: 6, y: 6 }),
        holes: [],
      }],
      ...style,
    },
    second: Building = {
      id: "worker-first",
      kind: "building",
      floorId,
      polygons: [{
        outer: rectangle({ x: 5, y: 0 }, { x: 11, y: 6 }),
        holes: [],
      }],
      ...style,
    },
    geometry = composeBuilding({
      kind: "compose-building",
      sources: [
        { id: second.id, polygons: second.polygons },
        { id: first.id, polygons: first.polygons },
      ],
      shape: [{
        outer: rectangle({ x: 4, y: 2 }, { x: 7, y: 4 }),
        holes: [],
      }],
      erase: false,
    });
  assert.equal(geometry.mode, "draw");
  if (geometry.mode !== "draw") return;
  assert.deepEqual(geometry.mergedIds, [second.id, first.id]);
  const plan = planBuildingMutation({
    entities: [first, second],
    floorId,
    result: geometry,
    expectedRevision: 4,
    currentRevision: 4,
  });
  assert.equal(plan.selectedId, first.id);
  assert.ok(
    plan.command?.entities?.some(
      (change) => change.id === second.id && change.after === null,
    ),
  );
});

test("building planner creates and fully erases an unnumbered building with ordinary undo", () => {
  const document = newDocument("Neuer Grundriss", 20, 20),
    floorId = document.floors[0]!.id,
    polygon = {
      outer: rectangle({ x: 2, y: 2 }, { x: 8, y: 8 }),
      holes: [],
    },
    fresh: Building = {
      id: "fresh-building",
      kind: "building",
      floorId,
      polygons: [polygon],
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
    },
    session = new Session(document),
    draw = composeBuilding({
      kind: "compose-building",
      sources: [],
      shape: [polygon],
      erase: false,
    }),
    create = planBuildingMutation({
      entities: [],
      floorId,
      result: draw,
      expectedRevision: 0,
      currentRevision: 0,
      newBuilding: fresh,
    });
  assert.ok(create.command);
  session.execute(create.command!);
  assert.equal(session.entities.has(fresh.id), true);
  assert.equal(session.historySize, 1);

  const erase = composeBuilding({
      kind: "compose-building",
      sources: [{ id: fresh.id, polygons: fresh.polygons }],
      shape: [{
        outer: rectangle({ x: 1, y: 1 }, { x: 9, y: 9 }),
        holes: [],
      }],
      erase: true,
    }),
    remove = planBuildingMutation({
      entities: [...session.entities.values()],
      floorId,
      result: erase,
      expectedRevision: 1,
      currentRevision: 1,
    });
  assert.ok(remove.command);
  session.execute(remove.command!);
  assert.equal(session.entities.has(fresh.id), false);
  assert.equal(session.historySize, 2);
  session.undo();
  assert.deepEqual(session.entities.get(fresh.id), fresh);
  session.undo();
  assert.equal(session.entities.has(fresh.id), false);
  session.redo();
  session.redo();
  assert.equal(session.entities.has(fresh.id), false);
});

test("Building Alt erase renews both separated None walls in the same history step", () => {
  const document = newDocument("Wandneuerzeugung", 20, 20),
    floorId = document.floors[0]!.id,
    make = (id: string, x: number, wallWidth: number): Building => ({
      id, kind: "building", floorId,
      polygons: [{ outer: rectangle({ x, y: 2 }, { x: x + 2, y: 4 }), holes: [] }],
      layer: 200, fill: 0x7f7e71, floorAlpha: 255,
      wall: 0x726e65, wallAlpha: 255, wallBevel: true, wallWidth,
      ...(wallWidth ? { wallAssetId: "pack:old-wall" } : {}),
    }),
    edited = { ...make("edited", 2, 0.2), number: "7", name: "Raum 7",
      note: { path: "QA/Räume/07.md" } },
    noneA = make("none-a", 7, 0),
    noneB = make("none-b", 12, 0),
    existing = make("existing", 17, 0.2),
    locked = { ...make("locked-none", 7, 0), locked: true },
    session = new Session({ ...document,
      entities: [edited, noneA, noneB, existing, locked] }),
    keyBytes = "# 7 Raum 7\r\n\r\nWortlaut bleibt!\r\n";
  session.loadNote(edited.note.path, keyBytes);
  const before = session.document().entities,
    geometry = composeBuilding({
      kind: "compose-building",
      sources: [edited, noneA, noneB, existing].map(({ id, polygons }) =>
        ({ id, polygons })),
      shape: [{ outer: rectangle({ x: 2, y: 2 }, { x: 3, y: 3 }), holes: [] }],
      erase: true,
    }),
    plan = planBuildingMutation({
      entities: [...session.entities.values()], floorId, result: geometry,
      expectedRevision: 0, currentRevision: 0,
      eraseWallStyle: { wall: 0x445566, wallAlpha: 128,
        wallBevel: false, wallWidth: 0.2, wallAssetId: "pack:battlements" },
    });
  assert.ok(plan.command);
  assert.deepEqual(plan.command!.entities?.map(change => change.id),
    [edited.id, noneA.id, noneB.id]);
  session.execute(plan.command!);
  assert.equal(session.historySize, 1);
  for (const id of [edited.id, noneA.id, noneB.id]) {
    const after = session.entities.get(id) as Building;
    assert.equal(after.wall, 0x445566);
    assert.equal(after.wallAlpha, 128);
    assert.equal(after.wallBevel, false);
    assert.equal(after.wallWidth, 0.2);
    assert.equal(after.wallAssetId, "pack:battlements");
    assert.equal(after.fill, 0x7f7e71);
  }
  assert.deepEqual(session.entities.get(existing.id), existing);
  assert.deepEqual(session.entities.get(locked.id), locked);
  assert.equal(session.note(edited.note.path), keyBytes);
  const after = session.document().entities;
  assert.deepEqual(parseDocument(JSON.stringify(session.document())).entities, after);
  session.undo();
  assert.deepEqual(session.document().entities, before);
  session.redo();
  assert.deepEqual(session.document().entities, after);
  assert.equal(session.note(edited.note.path), keyBytes);
});

test("building erase removes only unsupported portals in the same undo step", () => {
  const document = newDocument("Portalradierer", 20, 20),
    floorId = document.floors[0]!.id,
    room: Building = {
      id: "erase-room",
      kind: "building",
      floorId,
      polygons: [{
        outer: rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }),
        holes: [],
      }],
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
      number: "1",
      name: "Radierraum",
      note: { path: "QA/Räume/01 Radierraum.md" },
    },
    lost: Door = {
      id: "erased-wall-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: room.id, contour: 0, at: 0.05 },
      width: 1,
      variant: "door",
    },
    kept: Door = {
      id: "remaining-wall-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: room.id, contour: 0, at: 0.2 },
      width: 1,
      variant: "door",
    },
    session = new Session({ ...document, entities: [room, lost, kept] }),
    keyBytes = "# 1  Radierraum\r\n\r\nUngewöhnlich; exakt!\r\n";
  session.loadNote(room.note!.path, keyBytes);
  const before = session.document().entities,
    keptPose = portalPose(kept, (id) => session.entities.get(id)),
    result = composeBuilding({
      kind: "compose-building",
      sources: [{ id: room.id, polygons: room.polygons }],
      shape: [{
        outer: rectangle({ x: 1, y: -1 }, { x: 3, y: 2 }),
        holes: [],
      }],
      erase: true,
    }),
    plan = planBuildingMutation({
      entities: [...session.entities.values()],
      floorId,
      result,
      expectedRevision: 0,
      currentRevision: 0,
    });
  assert.ok(plan.command);
  assert.equal(Object.hasOwn(plan.command!, "texts"), false);
  session.execute(plan.command!);
  assert.equal(session.historySize, 1);
  assert.equal(session.entities.has(lost.id), false);
  const keptAfter = session.entities.get(kept.id);
  assert.equal(keptAfter?.kind, "door");
  if (keptAfter?.kind !== "door") throw new Error("Portal fehlt.");
  const nextPose = portalPose(keptAfter, (id) => session.entities.get(id));
  assert.ok(Math.abs(nextPose.x - keptPose.x) < 1e-8);
  assert.ok(Math.abs(nextPose.y - keptPose.y) < 1e-8);
  assert.equal(session.note(room.note!.path), keyBytes);
  const after = session.document().entities;
  session.undo();
  assert.deepEqual(session.document().entities, before);
  session.redo();
  assert.deepEqual(session.document().entities, after);
  assert.equal(session.note(room.note!.path), keyBytes);
});

test("building planner rejects two rooms, full room erase and stale worker output", () => {
  const document = newDocument("Schutzregeln", 20, 20),
    floorId = document.floors[0]!.id,
    room = (id: string, number: string, x: number): Building => ({
      id,
      kind: "building",
      floorId,
      polygons: [{
        outer: rectangle({ x, y: 0 }, { x: x + 6, y: 6 }),
        holes: [],
      }],
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
      number,
      name: "Raum " + number,
      note: { path: `QA/Räume/${number}.md` },
    }),
    first = room("room-a", "1", 0),
    second = room("room-b", "2", 5),
    draw = composeBuilding({
      kind: "compose-building",
      sources: [
        { id: first.id, polygons: first.polygons },
        { id: second.id, polygons: second.polygons },
      ],
      shape: [{
        outer: rectangle({ x: 4, y: 2 }, { x: 7, y: 4 }),
        holes: [],
      }],
      erase: false,
    });
  assert.throws(
    () => planBuildingMutation({
      entities: [first, second],
      floorId,
      result: draw,
      expectedRevision: 0,
      currentRevision: 0,
    }),
    /Zwei nummerierte Räume/,
  );
  const erase = composeBuilding({
    kind: "compose-building",
    sources: [{ id: first.id, polygons: first.polygons }],
    shape: [{
      outer: rectangle({ x: -1, y: -1 }, { x: 7, y: 7 }),
      holes: [],
    }],
    erase: true,
  });
  assert.throws(
    () => planBuildingMutation({
      entities: [first],
      floorId,
      result: erase,
      expectedRevision: 0,
      currentRevision: 0,
    }),
    /Archivierungsablauf/,
  );
  assert.throws(
    () => planBuildingMutation({
      entities: [first],
      floorId,
      result: draw,
      expectedRevision: 8,
      currentRevision: 9,
    }),
    /inzwischen geändert/,
  );
});

function multiContourBuilding(floorId: string): Building {
  return {
    id: "multi-contour-room",
    kind: "building",
    floorId,
    polygons: [
      {
        outer: rectangle({ x: 0, y: 0 }, { x: 12, y: 12 }),
        holes: [rectangle({ x: 3, y: 3 }, { x: 7, y: 7 })],
      },
      {
        outer: rectangle({ x: 20, y: 0 }, { x: 28, y: 8 }),
        holes: [],
      },
    ],
    layer: 200,
    fill: 0xbfb09a,
    wall: 0x403e39,
    wallWidth: 0.2,
    number: "4",
    name: "Mehrkonturraum",
    note: { path: "QA/Räume/04 Mehrkonturraum.md" },
  };
}

test("building contour addressing distinguishes outer rings, holes and detached parts", () => {
  const building = multiContourBuilding("floor"),
    entries = buildingContourEntries(building);
  assert.deepEqual(
    entries.map(({ contour, polygon, hole }) => ({ contour, polygon, hole })),
    [
      { contour: 0, polygon: 0, hole: undefined },
      { contour: 1, polygon: 0, hole: 0 },
      { contour: 2, polygon: 1, hole: undefined },
    ],
  );
  const vertex = nearestBuildingVertex({ x: 7.1, y: 3 }, building);
  assert.equal(vertex.contour, 1);
  assert.equal(vertex.index, 1);
  assert.ok(Math.abs(vertex.distance - 0.1) < 1e-9);
  const segment = nearestBuildingSegment({ x: 24, y: 0.1 }, building);
  assert.equal(segment.contour, 2);
  assert.equal(segment.index, 0);
  assert.ok(Math.abs(segment.distance - 0.1) < 1e-9);
  const changedHole = [
      { x: 3, y: 3 },
      { x: 9, y: 4 },
      { x: 7, y: 7 },
      { x: 3, y: 7 },
    ],
    after = replaceBuildingContour(building, 1, changedHole);
  assert.deepEqual(after.polygons[0]!.outer, building.polygons[0]!.outer);
  assert.deepEqual(after.polygons[0]!.holes[0], changedHole);
  assert.deepEqual(after.polygons[1], building.polygons[1]);
});

test("moving a hole point follows its portal atomically and preserves exact key bytes", () => {
  const document = newDocument("Lochpunkt", 40, 30),
    floorId = document.floors[0]!.id,
    building = multiContourBuilding(floorId),
    holeDoor: Door = {
      id: "hole-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: building.id, contour: 1, at: 0.125 },
      width: 0.5,
      variant: "door",
    },
    detachedDoor: Door = {
      id: "detached-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: building.id, contour: 2, at: 0.125 },
      width: 0.5,
      variant: "door",
    },
    session = new Session({
      ...document,
      entities: [building, holeDoor, detachedDoor],
    }),
    keyBytes = "# 4  Mehrkonturraum\r\n\r\nLochwand:  exakt; bitte!\r\n";
  session.loadNote(building.note!.path, keyBytes);
  const hole = [...building.polygons[0]!.holes[0]!];
  hole[1] = { x: 9, y: 4 };
  const after = replaceBuildingContour(building, 1, hole),
    command = planBuildingContourMutation({
      entities: [...session.entities.values()],
      before: building,
      after,
      edit: { kind: "move", contour: 1, index: 1 },
    });
  assert.ok(command);
  assert.equal(Object.hasOwn(command!, "texts"), false);
  assert.deepEqual(
    command!.entities?.map((change) => change.id),
    [building.id, holeDoor.id],
  );
  const beforeEntities = session.document().entities;
  session.execute(command!);
  assert.equal(session.historySize, 1);
  const movedDoor = session.entities.get(holeDoor.id);
  assert.equal(movedDoor?.kind, "door");
  if (movedDoor?.kind !== "door") throw new Error("Lochportal fehlt.");
  const pose = portalPose(movedDoor, (id) => session.entities.get(id));
  assert.ok(Math.abs(pose.x - 6) < 1e-8);
  assert.ok(Math.abs(pose.y - 3.5) < 1e-8);
  assert.ok(Math.abs(pose.angle - Math.atan2(1, 6)) < 1e-8);
  assert.deepEqual(session.entities.get(detachedDoor.id), detachedDoor);
  assert.equal(session.note(building.note!.path), keyBytes);
  const afterEntities = session.document().entities;
  session.undo();
  assert.deepEqual(session.document().entities, beforeEntities);
  assert.equal(session.note(building.note!.path), keyBytes);
  session.redo();
  assert.deepEqual(session.document().entities, afterEntities);
  assert.equal(session.note(building.note!.path), keyBytes);
});

test("inserting on a detached contour removes a portal from the replaced wall", () => {
  const document = newDocument("Getrennte Restfläche", 40, 30),
    floorId = document.floors[0]!.id,
    building = multiContourBuilding(floorId),
    door: Door = {
      id: "detached-edit-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: building.id, contour: 2, at: 0.1875 },
      width: 0.5,
      variant: "door",
    },
    session = new Session({ ...document, entities: [building, door] }),
    contour = [...building.polygons[1]!.outer];
  contour.splice(1, 0, { x: 24, y: -2 });
  const after = replaceBuildingContour(building, 2, contour),
    command = planBuildingContourMutation({
      entities: [...session.entities.values()],
      before: building,
      after,
      edit: { kind: "insert", contour: 2, index: 1 },
    });
  assert.ok(command);
  const beforeEntities = session.document().entities;
  session.execute(command!);
  assert.equal(session.entities.has(door.id), false);
  session.undo();
  assert.deepEqual(session.document().entities, beforeEntities);
  session.redo();
  assert.equal(session.entities.has(door.id), false);
});

test("removing a hole point projects an adjacent portal onto the joined edge", () => {
  const document = newDocument("Lochpunkt entfernen", 40, 30),
    floorId = document.floors[0]!.id,
    building = multiContourBuilding(floorId),
    door: Door = {
      id: "removed-hole-point-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: building.id, contour: 1, at: 0.125 },
      width: 0.5,
      variant: "door",
    },
    session = new Session({ ...document, entities: [building, door] }),
    hole = building.polygons[0]!.holes[0]!.filter((_, index) => index !== 1),
    after = replaceBuildingContour(building, 1, hole),
    command = planBuildingContourMutation({
      entities: [...session.entities.values()],
      before: building,
      after,
      edit: { kind: "remove", contour: 1, index: 1 },
    });
  assert.ok(command);
  session.execute(command!);
  const followed = session.entities.get(door.id);
  assert.equal(followed?.kind, "door");
  if (followed?.kind !== "door") throw new Error("Portal fehlt.");
  const pose = portalPose(followed, (id) => session.entities.get(id));
  assert.ok(Math.abs(pose.x - 4) < 1e-8);
  assert.ok(Math.abs(pose.y - 4) < 1e-8);
  assert.ok(Math.abs(pose.angle - Math.PI / 4) < 1e-8);
  session.undo();
  assert.deepEqual(session.entities.get(door.id), door);
  session.redo();
  assert.equal(session.entities.has(door.id), true);
});

function rejectsBuildingTopology(
  name: string,
  polygons: readonly Polygon[],
  contour: number,
  afterPoints: readonly { x: number; y: number }[],
  edit: Parameters<typeof planBuildingContourMutation>[0]["edit"],
): void {
  const document = newDocument(name, 40, 40),
    floorId = document.floors[0]!.id,
    building: Building = {
      id: "guarded-building",
      kind: "building",
      floorId,
      polygons,
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
      number: "9",
      name: "Topologieschutz",
      note: { path: "QA/Räume/09 Topologieschutz.md" },
    },
    door: Door = {
      id: "guarded-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: building.id, contour: 0, at: 0.75 },
      width: 0.5,
      variant: "door",
    },
    session = new Session({ ...document, entities: [building, door] }),
    keyBytes = "# 9  Topologieschutz\r\n\r\nUnverändert!\r\n",
    after = replaceBuildingContour(building, contour, afterPoints),
    beforeDocument = session.document();
  session.loadNote(building.note!.path, keyBytes);
  assert.throws(
    () =>
      planBuildingContourMutation({
        entities: [...session.entities.values()],
        before: building,
        after,
        edit,
      }),
    /Ungültige Gebäudetopologie/,
  );
  assert.deepEqual(session.document(), beforeDocument);
  assert.deepEqual(session.entities.get(door.id), door);
  assert.equal(session.note(building.note!.path), keyBytes);
  assert.equal(session.historySize, 0);
  assert.equal(session.dirty, false);
}

test("point mutation rejects a near-zero-area contour before creating a command", () => {
  const document = newDocument("Fast flächenlose Kontur", 40, 40),
    floorId = document.floors[0]!.id,
    building: Building = {
      id: "near-zero-area-building",
      kind: "building",
      floorId,
      polygons: [{
        outer: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }],
        holes: [],
      }],
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
      number: "10",
      name: "Flächenschutz",
      note: { path: "QA/Räume/10 Flächenschutz.md" },
    },
    door: Door = {
      id: "near-zero-area-door",
      kind: "door",
      floorId,
      anchor: { boundaryId: building.id, contour: 0, at: 0.1 },
      width: 0.5,
      variant: "door",
    },
    session = new Session({ ...document, entities: [building, door] }),
    keyBytes = "# 10  Flächenschutz\r\n\r\nUnverändert!\r\n",
    points = [...building.polygons[0]!.outer];
  session.loadNote(building.note!.path, keyBytes);
  points[2] = { x: 0, y: 0.000005 };
  const after = replaceBuildingContour(building, 0, points),
    twiceArea = points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length]!;
      return sum + point.x * next.y - next.x * point.y;
    }, 0),
    beforeDocument = session.document();
  assert.ok(Math.abs(twiceArea - 0.00005) < 1e-12);
  let command: ReturnType<typeof planBuildingContourMutation> | undefined;
  assert.throws(
    () => {
      command = planBuildingContourMutation({
        entities: [...session.entities.values()],
        before: building,
        after,
        edit: { kind: "move", contour: 0, index: 2 },
      });
    },
    /Die Kontur hat keine Fläche\./,
  );
  assert.equal(command, undefined);
  assert.deepEqual(session.document(), beforeDocument);
  assert.deepEqual(session.entities.get(door.id), door);
  assert.equal(session.note(building.note!.path), keyBytes);
  assert.equal(session.revision, 0);
  assert.equal(session.historySize, 0);
  assert.equal(session.dirty, false);
  assert.equal(session.canUndo, false);
  assert.equal(session.canRedo, false);
});

test("point mutation validation does not add the topology guard to document loading", () => {
  const document = newDocument("Bestehende Kontur", 40, 40),
    floorId = document.floors[0]!.id,
    existing: Building = {
      id: "existing-self-intersection",
      kind: "building",
      floorId,
      polygons: [{
        outer: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 10, y: 0 },
          { x: 0, y: 8 },
        ],
        holes: [],
      }],
      layer: 200,
      fill: 0xbfb09a,
      wall: 0x403e39,
      wallWidth: 0.2,
    },
    parsed = parseDocument(JSON.stringify({
      ...document,
      entities: [existing],
    }));
  assert.deepEqual(parsed.entities, [existing]);
});

test("point topology guard rejects the self-intersecting move reproducer", () => {
  rejectsBuildingTopology(
    "Selbstschnitt Move",
    [{
      outer: rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }),
      holes: [],
    }],
    0,
    [{ x: 0, y: 0 }, { x: 5, y: 12 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
    { kind: "move", contour: 0, index: 1 },
  );
});

test("point topology guard rejects the self-intersecting insert reproducer", () => {
  rejectsBuildingTopology(
    "Selbstschnitt Insert",
    [{
      outer: rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }),
      holes: [],
    }],
    0,
    [
      { x: 0, y: 0 },
      { x: 5, y: 12 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    { kind: "insert", contour: 0, index: 1 },
  );
});

test("point topology guard rejects the self-intersecting remove reproducer", () => {
  const before = [
    { x: 3, y: 1 },
    { x: 7, y: 2 },
    { x: 6, y: 3 },
    { x: 4, y: 3 },
    { x: 4, y: 5 },
    { x: 5, y: 8 },
    { x: 1, y: 7 },
  ];
  rejectsBuildingTopology(
    "Selbstschnitt Remove",
    [{ outer: before, holes: [] }],
    0,
    before.slice(1),
    { kind: "remove", contour: 0, index: 0 },
  );
});

test("point topology guard rejects a hole escaping its outer ring", () => {
  rejectsBuildingTopology(
    "Auslaufendes Loch",
    [{
      outer: rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }),
      holes: [rectangle({ x: 3, y: 3 }, { x: 7, y: 7 })],
    }],
    1,
    [{ x: 3, y: 3 }, { x: 12, y: 3 }, { x: 7, y: 7 }, { x: 3, y: 7 }],
    { kind: "move", contour: 1, index: 1 },
  );
});

test("point topology guard also rejects null edges, hole overlap and part overlap", () => {
  rejectsBuildingTopology(
    "Nullkante",
    [{
      outer: rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }),
      holes: [],
    }],
    0,
    [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    { kind: "insert", contour: 0, index: 1 },
  );
  rejectsBuildingTopology(
    "Lochüberlappung",
    [{
      outer: rectangle({ x: 0, y: 0 }, { x: 20, y: 20 }),
      holes: [
        rectangle({ x: 2, y: 2 }, { x: 6, y: 6 }),
        rectangle({ x: 8, y: 2 }, { x: 12, y: 6 }),
      ],
    }],
    1,
    [{ x: 2, y: 2 }, { x: 10, y: 2 }, { x: 6, y: 6 }, { x: 2, y: 6 }],
    { kind: "move", contour: 1, index: 1 },
  );
  rejectsBuildingTopology(
    "Teilüberlappung",
    [
      {
        outer: rectangle({ x: 0, y: 0 }, { x: 6, y: 6 }),
        holes: [],
      },
      {
        outer: rectangle({ x: 10, y: 0 }, { x: 16, y: 6 }),
        holes: [],
      },
    ],
    1,
    [{ x: 4, y: 0 }, { x: 16, y: 0 }, { x: 16, y: 6 }, { x: 10, y: 6 }],
    { kind: "move", contour: 1, index: 0 },
  );
});

test("Edit Points keeps the measured screen grip radius at 100 and 75 percent", () => {
  const building: Building = {
    id: "grips", kind: "building", floorId: "floor",
    polygons: [{ outer: rectangle({ x: 0, y: 0 }, { x: 4, y: 4 }), holes: [] }],
    layer: 200, fill: 0xbfb09a, wall: 0x403e39, wallWidth: 0.2,
  };
  assert.equal(buildingPointGripPixels, 16);
  for (const scale of [64, 48]) {
    const radius = buildingPointGripPixels / scale;
    assert.ok(buildingVertexGrip(building, { x: 0, y: -15 / scale }, radius));
    assert.equal(buildingVertexGrip(building, { x: 0, y: -17 / scale }, radius), null);
    assert.ok(buildingEdgeMidpointGrip(building, { x: 2, y: -15 / scale }, radius));
    assert.equal(buildingEdgeMidpointGrip(building, { x: 2, y: -17 / scale }, radius), null);
  }
});

test("Building point grips edit a rectangle and sampled ellipse in one history step", () => {
  for (const contour of [
    rectangle({ x: 1, y: 1 }, { x: 6, y: 5 }),
    buildingEllipse({ x: 1, y: 1 }, { x: 5, y: 5 }),
  ]) {
    const document = newDocument("Punktzug", 12, 12),
      building: Building = {
        id: "point-building", kind: "building", floorId: document.floors[0]!.id,
        polygons: [{ outer: contour, holes: [] }], layer: 200,
        fill: 0xbfb09a, wall: 0x403e39, wallWidth: 0.2,
      },
      session = new Session({ ...document, entities: [building] }),
      grip = buildingVertexGrip(building, contour[0]!, 0.2);
    assert.ok(grip);
    assert.equal(buildingVertexGrip(building,
      { x: contour[0]!.x + 0.21, y: contour[0]!.y }, 0.2), null);
    const destination = { x: contour[0]!.x - 0.5, y: contour[0]!.y - 0.5 },
      preview = previewBuildingVertexDrag(building, grip!, destination),
      planned = planBuildingVertexDrag([...session.entities.values()],
        building, grip!, destination);
    assert.ok(preview);
    assert.equal(planned.status, "command");
    if (planned.status !== "command") continue;
    assert.deepEqual(planned.after, preview);
    assert.deepEqual(session.entities.get(building.id), building);
    session.execute(planned.command);
    assert.deepEqual(session.entities.get(building.id), preview);
    assert.equal(session.historySize, 1);
    session.undo();
    assert.deepEqual(session.entities.get(building.id), building);
    session.redo();
    assert.deepEqual(session.entities.get(building.id), preview);
  }
});

test("one point proposal keeps vertex-relative and edge-absolute snap behavior", () => {
  const document = newDocument("Punktvorschlag", 12, 12),
    building: Building = { id: "proposal-building", kind: "building",
      floorId: document.floors[0]!.id,
      polygons: [{ outer: rectangle({ x: 2, y: 2 }, { x: 6, y: 6 }), holes: [] }],
      layer: 200, fill: 0xbfb09a, wall: 0x403e39, wallWidth: 0.2 },
    vertex = buildingVertexGrip(building, { x: 2, y: 2 }, 0.2),
    edge = buildingEdgeMidpointGrip(building, { x: 4, y: 2 }, 0.2);
  assert.ok(vertex);
  assert.ok(edge);
  const start = { x: 2.1, y: 2.1 }, pointer = { x: 1.51, y: 1.49 };
  assert.deepEqual(buildingPointDragDestination(vertex!, start, pointer, true),
    { x: 1, y: 1 });
  assert.deepEqual(buildingPointDragDestination(vertex!, start, pointer, false),
    { x: 1.41, y: 1.39 });
  const corner = proposeBuildingPointDrag(building, vertex!, { x: 1, y: 1 });
  assert.deepEqual(corner?.edit, { kind: "move", contour: 0, index: 0 });
  assert.deepEqual(corner?.after, previewBuildingVertexDrag(building, vertex!, { x: 1, y: 1 }));
  const edgePointer = { x: 4.49, y: 1.49 };
  assert.deepEqual(buildingPointDragDestination(edge!, start, edgePointer, true),
    { x: 4, y: 1 });
  assert.deepEqual(buildingPointDragDestination(edge!, start, edgePointer, false),
    edgePointer);
  const inserted = proposeBuildingPointDrag(building, edge!, { x: 4, y: 1 });
  assert.deepEqual(inserted?.edit, { kind: "insert", contour: 0, index: 1 });
  assert.deepEqual(inserted?.after, previewBuildingEdgeDrag(building, edge!, { x: 4, y: 1 }));
});

test("local portal dependents match the full preview scan across contours", () => {
  const document = newDocument("Lokale Portale", 30, 20),
    floorId = document.floors[0]!.id,
    makeBuilding = (id: string, polygons: Polygon[]): Building => ({
      id, kind: "building", floorId, polygons, layer: 200,
      fill: 0xbfb09a, wall: 0x403e39, wallWidth: 0.2,
    }),
    triangle = makeBuilding("edge", [{ outer: [
      { x: 2, y: 10 }, { x: 6, y: 10 }, { x: 6, y: 14 },
    ], holes: [] }]),
    hole = makeBuilding("hole", [{
      outer: rectangle({ x: 1, y: 1 }, { x: 12, y: 9 }),
      holes: [[{ x: 4, y: 4 }, { x: 6, y: 4 }, { x: 4, y: 6 }]],
    }]),
    multi = makeBuilding("multi", [
      { outer: [{ x: 15, y: 1 }, { x: 20, y: 1 }, { x: 15, y: 6 }], holes: [] },
      { outer: [{ x: 22, y: 1 }, { x: 27, y: 1 }, { x: 22, y: 6 }], holes: [] },
    ]),
    cases = [
      { building: triangle, contour: 0, at: { x: 4, y: 10 },
        destination: { x: 4, y: 9 }, edge: true, anchors: [0.15, 0.6] },
      { building: hole, contour: 1, at: { x: 4, y: 4 },
        destination: { x: 4, y: 3.5 }, edge: false, anchors: [0.2] },
      { building: multi, contour: 1, at: { x: 27, y: 1 },
        destination: { x: 27, y: 0.5 }, edge: false, anchors: [0.2] },
    ];
  for (const item of cases) {
    const doors: Door[] = item.anchors.map((at, index) => ({
        id: `${item.building.id}-door-${index}`, kind: "door", floorId,
        anchor: { boundaryId: item.building.id, contour: item.contour, at },
        width: 0.7, variant: "door",
      })),
      foreign = makeBuilding("foreign", [{
        outer: rectangle({ x: 15, y: 10 }, { x: 19, y: 14 }), holes: [],
      }]),
      foreignDoor: Door = { id: "foreign-door", kind: "door", floorId,
        anchor: { boundaryId: foreign.id, contour: 0, at: 0.2 },
        width: 0.7, variant: "door" },
      session = new Session({ ...document,
        entities: [item.building, ...doors, foreign, foreignDoor] }),
      grip = item.edge
        ? buildingEdgeMidpointGrip(item.building, item.at, 0.2)
        : buildingVertexGrip(item.building, item.at, 0.2);
    assert.ok(grip);
    const proposal = proposeBuildingPointDrag(item.building, grip!, item.destination);
    assert.ok(proposal);
    const local = [...session.dependents(item.building.id)]
      .map(id => session.entities.get(id))
      .filter((entity): entity is Door =>
        entity?.kind === "door" && entity.anchor?.boundaryId === item.building.id),
      full = [...session.entities.values()];
    assert.equal(local.length, doors.length);
    assert.deepEqual(previewBuildingMutationWithPortals(local, item.building,
      proposal!.after, proposal!.edit),
    previewBuildingMutationWithPortals(full, item.building,
      proposal!.after, proposal!.edit));
  }
});

test("edge preview and commit remove a portal on the replaced wall without a premature document edit", () => {
  const document = newDocument("Kantenpunkt", 12, 12),
    building: Building = {
      id: "edge-building", kind: "building", floorId: document.floors[0]!.id,
      polygons: [{ outer: [
        { x: 1, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 5 },
      ], holes: [] }], layer: 200, fill: 0xbfb09a,
      wall: 0x403e39, wallWidth: 0.2,
    },
    door: Door = {
      id: "edge-door", kind: "door", floorId: document.floors[0]!.id,
      anchor: { boundaryId: building.id, contour: 0, at: 0.2 },
      width: 0.8, variant: "door",
    },
    session = new Session({ ...document, entities: [building, door] }),
    midpoint = { x: 3.5, y: 1 },
    grip = buildingEdgeMidpointGrip(building, midpoint, 0.2),
    destination = { x: 3.5, y: 0 },
    before = session.document();
  assert.ok(grip);
  assert.equal(buildingEdgeMidpointGrip(building,
    { x: midpoint.x, y: midpoint.y + 0.21 }, 0.2), null);
  const after = previewBuildingEdgeDrag(building, grip!, destination);
  assert.ok(after);
  const preview = previewBuildingMutationWithPortals(
      [...session.entities.values()], building, after!,
      { kind: "insert", contour: grip!.contour, index: grip!.index + 1 }),
    planned = planBuildingEdgeDrag([...session.entities.values()],
      building, grip!, destination);
  assert.equal(planned.status, "command");
  if (planned.status !== "command") return;
  assert.deepEqual(session.document(), before);
  assert.deepEqual(planned.after, preview.building);
  assert.equal(preview.portals[0]?.after, null);
  assert.deepEqual(planned.command.entities?.find(change => change.id === door.id)?.after,
    preview.portals[0]?.after);
  session.execute(planned.command);
  assert.equal((session.entities.get(building.id) as Building).polygons[0]!.outer.length, 4);
  assert.equal(session.historySize, 1);
  session.undo();
  assert.deepEqual(session.entities.get(door.id), door);
  session.redo();
  assert.equal(session.entities.has(door.id), false);
});

test("inserting a corner removes a portal on the replaced wall and keeps a distant portal", () => {
  const document = newDocument("Zwei Portale am Punktzug", 12, 16),
    building: Building = {
      id: "two-portal-building", kind: "building", floorId: document.floors[0]!.id,
      polygons: [{ outer: [{ x: 2, y: 10 }, { x: 6, y: 10 },
        { x: 6, y: 14 }], holes: [] }],
      layer: 200, fill: 0xbfb09a, wall: 0x403e39, wallWidth: 0.2,
    },
    near: Door = { id: "near", kind: "door", floorId: building.floorId,
      anchor: { boundaryId: building.id, contour: 0, at: 0.15 },
      width: 0.7, variant: "door" },
    far: Door = { id: "far", kind: "door", floorId: building.floorId,
      anchor: { boundaryId: building.id, contour: 0, at: 0.6 },
      width: 0.7, variant: "door" },
    session = new Session({ ...document, entities: [building, near, far] }),
    grip = buildingEdgeMidpointGrip(building, { x: 4, y: 10 }, 0.2),
    destination = { x: 4, y: 9 };
  assert.ok(grip);
  const result = planBuildingEdgeDrag([...session.entities.values()],
    building, grip!, destination);
  assert.equal(result.status, "command");
  if (result.status !== "command") return;
  const nearChange = result.command.entities?.find(change => change.id === near.id),
    farChange = result.command.entities?.find(change => change.id === far.id);
  assert.equal(nearChange?.after, null);
  assert.equal(farChange?.after?.kind, "door");
  session.execute(result.command);
  assert.equal(session.entities.has(near.id), false);
  const kept = session.entities.get(far.id);
  assert.equal(kept?.kind, "door");
  if (kept?.kind !== "door") return;
  const beforePose = portalPose(far, id => id === building.id ? building : undefined),
    afterPose = portalPose(kept, id => session.entities.get(id));
  assert.ok(Math.hypot(afterPose.x - beforePose.x, afterPose.y - beforePose.y) < 1e-10);
  session.undo();
  assert.deepEqual(session.entities.get(near.id), near);
  assert.deepEqual(session.entities.get(far.id), far);
  session.redo();
  assert.equal(session.entities.has(near.id), false);
});

test("native delete action removes one point and then the final three-point outline", () => {
  const document = newDocument("Punkt entfernen", 12, 12),
    building: Building = {
      id: "backspace-building", kind: "building", floorId: document.floors[0]!.id,
      polygons: [{ outer: rectangle({ x: 1, y: 1 }, { x: 6, y: 5 }), holes: [] }],
      layer: 200, fill: 0xbfb09a, wall: 0x403e39, wallWidth: 0.2,
    },
    session = new Session({ ...document, entities: [building] }),
    grip = buildingVertexGrip(building, { x: 6, y: 1 }, 0.2),
    result = planBuildingBackspacePoint([...session.entities.values()], building, grip!);
  assert.equal(result.status, "command");
  if (result.status !== "command") return;
  session.execute(result.command);
  assert.equal(result.after.polygons[0]!.outer.length, 3);
  const nextGrip = buildingVertexGrip(result.after,
    result.after.polygons[0]!.outer[0]!, 0.2),
    outline = planBuildingBackspacePoint(
      [...session.entities.values()], result.after, nextGrip!);
  assert.equal(outline.status, "outline-removed");
  if (outline.status !== "outline-removed") return;
  assert.equal(outline.after, null);
  session.execute(outline.command);
  assert.equal(session.entities.has(building.id), false);
  assert.equal(session.historySize, 2);
  session.undo();
  assert.deepEqual(session.entities.get(building.id), result.after);
  session.redo();
  assert.equal(session.entities.has(building.id), false);
});

test("removing a Building point applies the selected wall in the same undo step", () => {
  const document = newDocument("Paketwand Punkt entfernen", 8, 8),
    building: Building = {
      id: "qa-wall", kind: "building", floorId: document.floors[0]!.id,
      polygons: [{ outer: [
        { x: 3, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 1 },
        { x: 2, y: 1 }, { x: 4, y: 1 },
      ], holes: [] }],
      layer: 200, fill: 0xbfb09a, wall: 0xffffff, wallAlpha: 255,
      wallBevel: true, wallWidth: 0.2, wallAssetId: "pack:QAWall01",
    },
    session = new Session({ ...document, entities: [building] }),
    grip = buildingVertexGrip(building, { x: 2, y: 1 }, 0.2)!,
    battlements = { wall: 0x726e65, wallAlpha: 255, wallBevel: true,
      wallWidth: 0.2, wallAssetId: "pack:battlements" },
    result = planBuildingBackspacePoint(
      [...session.entities.values()], building, grip, battlements);
  assert.equal(result.status, "command");
  if (result.status !== "command") return;
  session.execute(result.command);
  assert.equal(result.after.polygons[0]!.outer.length, 4);
  assert.equal(result.after.wallAssetId, battlements.wallAssetId);
  assert.equal(result.after.wall, battlements.wall);
  assert.deepEqual(session.entities.get(building.id), result.after);
  session.undo();
  assert.deepEqual(session.entities.get(building.id), building);
  session.redo();
  assert.deepEqual(session.entities.get(building.id), result.after);

  const selectedQa = planBuildingBackspacePoint(
    [building], building, grip, { ...battlements, wall: building.wall,
      wallAssetId: building.wallAssetId });
  assert.equal(selectedQa.status, "command");
  if (selectedQa.status === "command")
    assert.equal(selectedQa.after.wallAssetId, building.wallAssetId);
});

test("inserting a Building point previews and commits the selected wall", () => {
  const document = newDocument("Paketwand Punkt einfügen", 8, 8),
    building: Building = {
      id: "qa-wall-insert", kind: "building", floorId: document.floors[0]!.id,
      polygons: [{ outer: [
        { x: 3, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 1 }, { x: 4, y: 1 },
      ], holes: [] }],
      layer: 200, fill: 0xbfb09a, wall: 0xffffff, wallAlpha: 255,
      wallBevel: true, wallWidth: 0.2, wallAssetId: "pack:QAWall01",
    },
    session = new Session({ ...document, entities: [building] }),
    grip = buildingEdgeMidpointGrip(building, { x: 2.5, y: 1 }, 0.2)!,
    battlements = { wall: 0x726e65, wallAlpha: 255, wallBevel: true,
      wallWidth: 0.2, wallAssetId: "pack:battlements" },
    destination = { x: 2.5, y: 0.75 },
    preview = previewBuildingEdgeDrag(building, grip, destination, battlements),
    result = planBuildingEdgeDrag([...session.entities.values()], building,
      grip, destination, battlements);
  assert.equal(result.status, "command");
  if (result.status !== "command") return;
  assert.deepEqual(preview, result.after);
  assert.equal(result.after.polygons[0]!.outer.length, 5);
  assert.equal(result.after.wallAssetId, battlements.wallAssetId);
  assert.equal(result.after.wall, battlements.wall);
  session.execute(result.command);
  assert.deepEqual(session.entities.get(building.id), result.after);
  session.undo();
  assert.deepEqual(session.entities.get(building.id), building);
  session.redo();
  assert.deepEqual(session.entities.get(building.id), result.after);
});

test("three-point removal changes only its part and reanchors or removes its portals atomically", () => {
  const document = newDocument("Zwei Umrisse", 30, 15),
    building: Building = {
      id: "multi-outline", kind: "building", floorId: document.floors[0]!.id,
      polygons: [
        { outer: [{ x: 1, y: 1 }, { x: 6, y: 1 }, { x: 1, y: 6 }], holes: [] },
        { outer: [{ x: 15, y: 1 }, { x: 20, y: 1 }, { x: 15, y: 6 }], holes: [] },
      ], layer: 200, fill: 0xbfb09a, wall: 0x403e39, wallWidth: 0.2,
    },
    removedDoor: Door = {
      id: "removed-door", kind: "door", floorId: document.floors[0]!.id,
      anchor: { boundaryId: building.id, contour: 0, at: 0.1 },
      width: 0.7, variant: "door",
    },
    retainedDoor: Door = {
      id: "retained-door", kind: "door", floorId: document.floors[0]!.id,
      anchor: { boundaryId: building.id, contour: 1, at: 0.1 },
      width: 0.7, variant: "door",
    },
    session = new Session({ ...document, entities: [building, removedDoor, retainedDoor] }),
    grip = buildingVertexGrip(building, { x: 1, y: 1 }, 0.2),
    result = planBuildingBackspacePoint([...session.entities.values()], building, grip!);
  assert.equal(result.status, "outline-removed");
  if (result.status !== "outline-removed") return;
  assert.deepEqual(result.after?.polygons, [building.polygons[1]]);
  session.execute(result.command);
  assert.equal(session.entities.has(removedDoor.id), false);
  const retainedAnchor = (session.entities.get(retainedDoor.id) as Door).anchor;
  assert.equal(retainedAnchor?.boundaryId, building.id);
  assert.equal(retainedAnchor?.contour, 0);
  assert.ok(Math.abs(retainedAnchor!.at - retainedDoor.anchor!.at) < 1e-12);
  assert.equal(session.historySize, 1);
  session.undo();
  assert.deepEqual(session.entities.get(building.id), building);
  assert.deepEqual(session.entities.get(removedDoor.id), removedDoor);
  assert.deepEqual(session.entities.get(retainedDoor.id), retainedDoor);
  session.redo();
  assert.deepEqual((session.entities.get(building.id) as Building).polygons,
    [building.polygons[1]]);
});

test("a three-point hole can be removed without changing its outer ring", () => {
  const document = newDocument("Innenumriss", 15, 15),
    building: Building = {
      id: "hole-outline", kind: "building", floorId: document.floors[0]!.id,
      polygons: [{ outer: rectangle({ x: 1, y: 1 }, { x: 12, y: 12 }),
        holes: [[{ x: 4, y: 4 }, { x: 6, y: 4 }, { x: 4, y: 6 }]] }],
      layer: 200, fill: 0xbfb09a, wall: 0x403e39, wallWidth: 0.2,
    },
    session = new Session({ ...document, entities: [building] }),
    grip = buildingVertexGrip(building, { x: 4, y: 4 }, 0.2),
    result = planBuildingBackspacePoint([...session.entities.values()], building, grip!);
  assert.equal(grip?.contour, 1);
  assert.equal(result.status, "outline-removed");
  if (result.status !== "outline-removed") return;
  assert.deepEqual(result.after?.polygons, [{ outer: building.polygons[0]!.outer, holes: [] }]);
  session.execute(result.command);
  session.undo();
  assert.deepEqual(session.entities.get(building.id), building);
});

test("last outline of a numbered room leaves its identity and Key intact", () => {
  const document = newDocument("Geschützter Raum", 12, 12),
    room: Building = {
      id: "numbered-room", kind: "building", floorId: document.floors[0]!.id,
      number: "1", name: "Geschützter Raum", note: { path: "Räume/01 Geschützter Raum.md" },
      polygons: [{ outer: [{ x: 1, y: 1 }, { x: 6, y: 1 }, { x: 1, y: 6 }], holes: [] }],
      layer: 200, fill: 0xbfb09a, wall: 0x403e39, wallWidth: 0.2,
    },
    session = new Session({ ...document, entities: [room] }),
    grip = buildingVertexGrip(room, { x: 1, y: 1 }, 0.2),
    result = planBuildingBackspacePoint([...session.entities.values()], room, grip!);
  assert.equal(result.status, "protected-room");
  assert.equal(session.historySize, 0);
  assert.deepEqual(session.entities.get(room.id), room);
});

test("point grips address a hole and a second Building part without changing the other contours", () => {
  const document = newDocument("Mehrteilpunkte", 30, 20),
    building: Building = {
      id: "multipart-points", kind: "building", floorId: document.floors[0]!.id,
      polygons: [
        { outer: rectangle({ x: 1, y: 1 }, { x: 15, y: 15 }),
          holes: [rectangle({ x: 4, y: 4 }, { x: 7, y: 7 })] },
        { outer: rectangle({ x: 18, y: 1 }, { x: 24, y: 7 }), holes: [] },
      ], layer: 200, fill: 0xbfb09a, wall: 0x403e39, wallWidth: 0.2,
    },
    session = new Session({ ...document, entities: [building] }),
    holeGrip = buildingVertexGrip(building, { x: 4, y: 4 }, 0.2);
  assert.equal(holeGrip?.contour, 1);
  const invalid = { x: 16, y: 4 };
  assert.throws(() => planBuildingVertexDrag([...session.entities.values()],
    building, holeGrip!, invalid));
  assert.equal(session.historySize, 0);
  const hole = planBuildingVertexDrag([...session.entities.values()],
    building, holeGrip!, { x: 3, y: 4 });
  assert.equal(hole.status, "command");
  if (hole.status !== "command") return;
  assert.deepEqual(hole.after.polygons[0]!.outer, building.polygons[0]!.outer);
  assert.deepEqual(hole.after.polygons[1], building.polygons[1]);
  session.execute(hole.command);
  const edgeGrip = buildingEdgeMidpointGrip(hole.after, { x: 21, y: 1 }, 0.2);
  assert.equal(edgeGrip?.contour, 2);
  const part = planBuildingEdgeDrag([...session.entities.values()], hole.after,
    edgeGrip!, { x: 21, y: 0 });
  assert.equal(part.status, "command");
  if (part.status !== "command") return;
  assert.deepEqual(part.after.polygons[0], hole.after.polygons[0]);
  assert.equal(part.after.polygons[1]!.outer.length, 5);
  session.execute(part.command);
  assert.equal(session.historySize, 2);
  session.undo();
  assert.deepEqual(session.entities.get(building.id), hole.after);
  session.undo();
  assert.deepEqual(session.entities.get(building.id), building);
});

test("Building floor and wall alpha and bevel survive parsing without altering older records", () => {
  const document = newDocument("Stilwerte", 12, 12);
  const original: Building = {
    id: "building-style", kind: "building", floorId: document.floors[0]!.id,
    polygons: [{ outer: rectangle({ x: 1, y: 1 }, { x: 4, y: 4 }), holes: [] }],
    layer: 200, fill: 0xff0000, floorAlpha: 128,
    wall: 0xff00ff, wallAlpha: 64, wallWidth: 0.2, wallBevel: true,
  };
  const parsed = parseDocument(JSON.stringify({ ...document, entities: [original] }));
  assert.deepEqual(parsed.entities[0], original);
  const legacy: Record<string, unknown> = { ...original };
  delete legacy.floorAlpha;
  delete legacy.wallAlpha;
  delete legacy.wallBevel;
  assert.deepEqual(parseDocument(JSON.stringify({ ...document, entities: [legacy] })).entities[0], legacy);
  for (const broken of [
    { floorAlpha: -1 }, { floorAlpha: 256 }, { wallAlpha: 3.5 },
    { wallBevel: "yes" },
  ]) assert.throws(() => parseDocument(JSON.stringify({
    ...document, entities: [{ ...original, ...broken }],
  })));
});

test("Wall and Cave picker alpha survive parsing while old records remain opaque", () => {
  const document = newDocument("Gemeinsamer Picker", 8, 8),
    floorId = document.floors[0]!.id;
  const wall: Wall = {
    id: "wall-picker", kind: "wall", floorId,
    points: [{ x: 1, y: 1 }, { x: 3, y: 1 }], closed: false,
    smooth: false, color: 0x74591d, alpha: 128, width: .22,
  };
  const cave: Surface = {
    id: "cave-picker", kind: "surface", floorId, category: "cave",
    polygons: [{ outer: rectangle({ x: 3, y: 3 }, { x: 5, y: 5 }), holes: [] }],
    layer: -300, color: 0xafa99b, wallColor: 0x73581d,
    wallAlpha: 128, wallWidth: .3,
  };
  for (const entities of [[wall, cave], [
    { ...wall, alpha: undefined }, { ...cave, wallAlpha: undefined },
  ]]) assert.deepEqual(parseDocument(JSON.stringify({ ...document, entities })).entities,
    JSON.parse(JSON.stringify(entities)));
  for (const [key, value] of [["alpha", -1], ["alpha", 256],
    ["wallAlpha", 3.5]] as const) {
    const entities = key === "alpha" ? [{ ...wall, alpha: value }, cave]
      : [wall, { ...cave, wallAlpha: value }];
    assert.throws(() => parseDocument(JSON.stringify({ ...document, entities })));
  }
});
