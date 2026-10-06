import { test } from "node:test";
import assert from "node:assert/strict";
import { type Light, isRoom } from "../../src/model";
import { Session } from "../../src/session";
import { adoptFloorAsRoom, scatterObjects, createLight, createPortal, createWall, createSurface, createBuilding, createMapPath, createRoof, addFloor } from "../../src/commands";
import { boundarySegments, inside, portalPose, smoothPath, hit, moveEntity, nearestPath } from "../../src/geometry";
import { composeBuilding, paint, visibility } from "../../src/compute";
import { newDocument, fixture } from "./fixtures";


test("paint keeps a fast stroke continuous and erasing creates a real hole", () => {
  const painted = paint({
    kind: "paint",
    polygons: [],
    points: [
      { x: 2, y: 2 },
      { x: 18, y: 2 },
    ],
    radius: 2,
    erase: false,
  });
  assert.equal(painted.length, 1);
  assert.equal(inside({ x: 10, y: 2 }, painted[0]!.outer), true);
  const erased = paint({
    kind: "paint",
    polygons: painted,
    points: [{ x: 10, y: 2 }],
    radius: 0.75,
    erase: true,
  });
  assert.equal(erased.length, 1);
  assert.equal(erased[0]!.holes.length, 1);
  assert.equal(inside({ x: 10, y: 2 }, erased[0]!.holes[0]!), true);
});

test("floor shapes merge on overlap, retain shared walls on touch, and erase real holes", () => {
  const polygon = (x: number, y: number, width: number, height: number) => ({
      outer: [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ],
      holes: [],
    }),
    sources = [
      { id: "left", polygons: [polygon(0, 0, 5, 5)] },
      { id: "right", polygons: [polygon(5, 0, 5, 5)] },
    ];
  const insideLeft = composeBuilding({
    kind: "compose-building",
    sources,
    shape: [polygon(1, 1, 2, 2)],
    erase: false,
  });
  assert.equal(insideLeft.mode, "draw");
  if (insideLeft.mode === "draw")
    assert.deepEqual(insideLeft.mergedIds, ["left"]);

  const fresh = composeBuilding({
    kind: "compose-building",
    sources: [],
    shape: [polygon(12, 2, 4, 3)],
    erase: false,
  });
  assert.equal(fresh.mode, "draw");
  if (fresh.mode === "draw") assert.equal(fresh.polygons[0]!.outer.length, 4);

  const bridge = composeBuilding({
    kind: "compose-building",
    sources,
    shape: [polygon(4, 2, 2, 1)],
    erase: false,
  });
  assert.equal(bridge.mode, "draw");
  if (bridge.mode === "draw") {
    assert.deepEqual(bridge.mergedIds, ["left", "right"]);
    assert.equal(bridge.polygons.length, 1);
  }

  const erased = composeBuilding({
    kind: "compose-building",
    sources: [{ id: "room", polygons: [polygon(0, 0, 10, 10)] }],
    shape: [polygon(2, 2, 6, 6)],
    erase: true,
  });
  assert.equal(erased.mode, "erase");
  if (erased.mode === "erase") {
    assert.equal(erased.changes.length, 1);
    assert.equal(erased.changes[0]!.polygons[0]!.holes.length, 1);
  }
});

test("corridor strokes join and split the same floor geometry", () => {
  const room = {
      outer: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 8 },
        { x: 0, y: 8 },
      ],
      holes: [],
    },
    joined = composeBuilding({
      kind: "compose-building",
      sources: [{ id: "room", polygons: [room] }],
      stroke: {
        points: [
          { x: 7.5, y: 4 },
          { x: 12, y: 4 },
          { x: 12, y: 7 },
        ],
        radius: 0.5,
      },
      erase: false,
    });
  assert.equal(joined.mode, "draw");
  if (joined.mode !== "draw") return;
  assert.deepEqual(joined.mergedIds, ["room"]);
  assert.equal(joined.polygons.length, 1);
  assert.equal(inside({ x: 12, y: 6 }, joined.polygons[0]!.outer), true);

  const split = composeBuilding({
    kind: "compose-building",
    sources: [{ id: "room", polygons: joined.polygons }],
    stroke: {
      points: [
        { x: 4, y: -1 },
        { x: 4, y: 9 },
      ],
      radius: 0.5,
    },
    erase: true,
  });
  assert.equal(split.mode, "erase");
  if (split.mode === "erase") {
    assert.equal(split.changes.length, 1);
    assert.equal(split.changes[0]!.polygons.length, 2);
  }
});

test("a drawn floor becomes a numbered room with the same id and one undo restores it", () => {
  const document = newDocument("Grundriss", 30, 30),
    session = new Session(document),
    floorId = document.floors[0]!.id,
    surface = createBuilding(
      session,
      floorId,
      [{
        outer: [
          { x: 2, y: 3 },
          { x: 9, y: 3 },
          { x: 9, y: 8 },
          { x: 2, y: 8 },
        ],
        holes: [],
      }],
      {
        layer: 200,
        fill: 0xbfb09a,
        wall: 0x403e39,
        wallWidth: 0.2,
      },
    ),
    room = adoptFloorAsRoom(
      session,
      surface.id,
      "Dungeons/Grundriss/Räume",
      {},
      "Dungeons/Grundriss/Karte.dungeon",
    );
  assert.equal(room.id, surface.id);
  assert.equal(room.number, "1");
  assert.equal(room.polygons[0]!.outer.length, 4);
  assert.match(session.note(room.note!.path)!, /^---\nroom_id:/);
  session.undo();
  assert.equal(session.entities.get(surface.id)?.kind, "building");
  assert.equal(isRoom(session.entities.get(surface.id)), false);
  assert.equal(session.note(room.note!.path), null);
});

test("light visibility stops at walls but remains open through a portal gap", () => {
  const light: Light = {
    id: "light",
    kind: "light",
    floorId: "floor",
    x: 0,
    y: 0,
    radius: 10,
    intensity: 1,
    color: 0xffffff,
    shadows: true,
  };
  const closestToEast = (points: readonly { x: number; y: number }[]) =>
    points.reduce((best, point) =>
      Math.abs(point.y) < Math.abs(best.y) ? point : best,
    );
  const blocked = closestToEast(
    visibility(light, [{ a: { x: 4, y: -5 }, b: { x: 4, y: 5 } }]),
  );
  assert.ok(blocked.x <= 4.001);
  const throughGap = closestToEast(
    visibility(light, [
      { a: { x: 4, y: -5 }, b: { x: 4, y: -1 } },
      { a: { x: 4, y: 1 }, b: { x: 4, y: 5 } },
    ]),
  );
  assert.ok(throughGap.x > 9.9);
});

test("floor and light commands are validated and share normal undo redo", () => {
  const { s, floor } = fixture();
  const upper = addFloor(s);
  const light = createLight(
    s,
    upper.id,
    { x: 8, y: 9 },
    { radius: 7, intensity: 1.2, color: 0xffcc88, shadows: true },
  );
  assert.equal(s.entities.get(light.id)?.floorId, upper.id);
  s.undo();
  assert.equal(s.entities.has(light.id), false);
  s.undo();
  assert.equal(s.floors.has(upper.id), false);
  s.redo();
  s.redo();
  assert.equal(s.entities.get(light.id)?.floorId, upper.id);
  assert.throws(
    () =>
      createLight(
        s,
        floor,
        { x: 1, y: 1 },
        { radius: 0, intensity: 1, color: 0xffffff, shadows: false },
      ),
    /Lichtquelle/,
  );
});

test("independent curved wall keeps a bound portal opening while points move", () => {
  const { s, floor } = fixture();
  const wall = createWall(
    s,
    floor,
    [
      { x: 2, y: 20 },
      { x: 10, y: 14 },
      { x: 18, y: 20 },
    ],
    true,
  );
  const door = createPortal(
    s,
    floor,
    { boundary: wall, anchor: { contour: 0, at: 0.5 } },
    { variant: "door", width: 2, blocksLight: true },
  );
  const stableDoor = s.entities.get(door.id)!;
  const curved = smoothPath(wall.points, false);
  assert.ok(curved.length > wall.points.length);
  const beforePose = portalPose(stableDoor as typeof door, (id) =>
    s.entities.get(id),
  );
  const visible = boundarySegments(wall, [stableDoor as typeof door]);
  assert.ok(visible.length > 2);
  assert.ok(
    visible.every(
      (segment) =>
        Math.hypot(
          (segment.a.x + segment.b.x) / 2 - beforePose.x,
          (segment.a.y + segment.b.y) / 2 - beforePose.y,
        ) > 0.5,
    ),
  );
  const moved = {
    ...wall,
    points: wall.points.map((point, index) =>
      index === 1 ? { x: point.x, y: point.y - 4 } : point,
    ),
  };
  s.execute({
    label: "Wandpunkt verschieben",
    entities: [{ id: wall.id, before: wall, after: moved }],
  });
  const afterPose = portalPose(s.entities.get(door.id) as typeof door, (id) =>
    s.entities.get(id),
  );
  assert.notEqual(afterPose.y, beforePose.y);
  assert.equal(s.entities.get(door.id), stableDoor);
  s.undo();
  assert.deepEqual(
    portalPose(door, (id) => s.entities.get(id)),
    beforePose,
  );
});

test("freestanding portal remains independent from room geometry", () => {
  const { s, floor } = fixture();
  const portal = createPortal(
    s,
    floor,
    { point: { x: 22, y: 17 }, rotation: Math.PI / 4 },
    { variant: "bars", width: 1.5, blocksLight: false, flip: true },
  );
  assert.deepEqual(
    portalPose(portal, (id) => s.entities.get(id)),
    {
      x: 22,
      y: 17,
      angle: Math.PI / 4,
    },
  );
  assert.equal(portal.anchor, undefined);
  assert.equal(portal.blocksLight, false);
});

test("pattern, water, terrain, textured path and roof share the validated model", () => {
  const { s, floor } = fixture();
  const pattern = createSurface(
    s,
    floor,
    "pattern",
    [
      { x: 20, y: 2 },
      { x: 28, y: 2 },
      { x: 28, y: 8 },
      { x: 20, y: 8 },
    ],
    {
      layer: 100,
      color: 0xb4976c,
      wallColor: 0x5d4a35,
      wallWidth: 0.08,
      opacity: 0.9,
      effect: "none",
    },
  );
  const water = createSurface(
    s,
    floor,
    "water",
    [
      { x: 20, y: 10 },
      { x: 30, y: 10 },
      { x: 30, y: 16 },
      { x: 20, y: 16 },
    ],
    {
      layer: -50,
      color: 0x6faac2,
      wallColor: 0xbed9df,
      wallWidth: 0.2,
      opacity: 0.82,
      effect: "ripples",
    },
  );
  const path = createMapPath(
    s,
    floor,
    [
      { x: 3, y: 20 },
      { x: 10, y: 17 },
      { x: 18, y: 22 },
    ],
    {
      closed: false,
      smooth: true,
      width: 1.2,
      style: "road",
      color: 0xa99473,
      outlineColor: 0x625744,
      outlineWidth: 0.12,
      layer: 500,
      start: "round",
      end: "taper",
      blocksLight: false,
    },
  );
  const roof = createRoof(
    s,
    floor,
    [
      { x: 32, y: 2 },
      { x: 44, y: 2 },
      { x: 44, y: 10 },
      { x: 32, y: 10 },
    ],
    {
      roofType: "hip",
      color: 0x8d5d4a,
      outlineColor: 0x46352f,
      layer: 400,
    },
  );
  assert.equal(s.document().entities.length, 5);
  assert.equal(
    hit({ x: 24, y: 5 }, pattern, () => undefined, 0),
    true,
  );
  assert.equal(
    hit({ x: 25, y: 13 }, water, () => undefined, 0),
    true,
  );
  assert.ok(nearestPath({ x: 10, y: 17 }, path).distance < 0.001);
  assert.equal(
    hit({ x: 38, y: 6 }, roof, () => undefined, 0),
    true,
  );
  assert.equal(roof.ridge.length, 2);
  const moved = moveEntity(path, 2, -1);
  assert.equal(moved.kind, "path");
  if (moved.kind === "path") assert.deepEqual(moved.points[0], { x: 5, y: 19 });
});

test("terrain surfaces and blocking paths reject malformed values", () => {
  const { s, floor } = fixture();
  const terrain = createSurface(
    s,
    floor,
    "terrain",
    [
      { x: 1, y: 20 },
      { x: 8, y: 20 },
      { x: 8, y: 28 },
      { x: 1, y: 28 },
    ],
    {
      layer: -500,
      color: 0x718657,
      wallColor: 0x718657,
      wallWidth: 0,
      opacity: 0.75,
      effect: "none",
    },
  );
  assert.equal(terrain.category, "terrain");
  assert.throws(
    () =>
      createMapPath(
        s,
        floor,
        [
          { x: 1, y: 1 },
          { x: 2, y: 2 },
        ],
        {
          closed: false,
          smooth: false,
          width: 0,
          style: "rail",
          color: 0xffffff,
          outlineColor: 0,
          outlineWidth: 0,
          layer: 1,
          start: "square",
          end: "square",
          blocksLight: true,
        },
      ),
    /Texturpfad/,
  );
});

test("object scattering is deterministic and commits as one undo step", () => {
  const { s, floor } = fixture(),
    beforeHistory = s.historySize,
    settings = {
      object: {
        rotation: 0,
        width: 1,
        height: 0.7,
        color: 0x765231,
        label: "",
      },
      spacing: 2,
      spread: 0.6,
      rotationJitter: Math.PI,
      scaleJitter: 0.2,
      seed: 42,
    },
    first = scatterObjects(
      s,
      floor,
      [
        { x: 2, y: 20 },
        { x: 12, y: 20 },
      ],
      settings,
    );
  assert.ok(first.length >= 5);
  assert.equal(s.historySize, beforeHistory + 1);
  const positions = first.map(({ x, y, rotation, width }) => ({
    x,
    y,
    rotation,
    width,
  }));
  s.undo();
  assert.ok(first.every((object) => !s.entities.has(object.id)));
  const fresh = fixture();
  const second = scatterObjects(
    fresh.s,
    fresh.floor,
    [
      { x: 2, y: 20 },
      { x: 12, y: 20 },
    ],
    settings,
  );
  assert.deepEqual(
    second.map(({ x, y, rotation, width }) => ({ x, y, rotation, width })),
    positions,
  );
});
