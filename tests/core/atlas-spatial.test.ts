import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseHTML } from "linkedom";
import { AtlasHistory } from "../../src/features/atlas/atlas-history";
import { AtlasEditor } from "../../src/features/atlas/atlas-editor";
import { TerrainSource } from "../../src/features/atlas/terrain-source";
import { SpatialGraph } from "../../src/features/atlas/spatial-graph";
import {
  checkedSpatialWorld,
  parseSpatialWorld,
  serializeSpatialWorld,
  spatialBase,
  spatialChange,
  spatialState,
  type DetailPlacement,
  type SpatialState,
} from "../../src/features/atlas/spatial-schema";
import {
  projectLocal,
  unprojectLocal,
  relativeCamera,
  panRelativeAtlas,
  zoomRelativeAtlas,
  type RigidFrame,
} from "../../src/features/atlas/relative-frame";
import { parseOverworld } from "../../src/features/atlas/overworld";
import { locationPlacementsChange } from "../../src/features/atlas/location-placement";
import {
  CitySource,
  cityDocumentChange,
} from "../../src/features/city/commands";
import {
  parseCityDocument,
  serializeCityDocument,
} from "../../src/features/city/codec";
import { editCity } from "../../src/features/city/edit";
import {
  DungeonAtlasSource,
  dungeonDocumentChange,
} from "../../src/features/dungeon/atlas-source";
import { DungeonGeometryGesture } from "../../src/features/dungeon/geometry-change";
import {
  buildingVertexGrip,
  proposeBuildingPointDrag,
} from "../../src/features/bau/building-point-gestures";
import { planBuildingContourMutation } from "../../src/commands";
import {
  LocationSource,
  locationDocumentChange,
} from "../../src/features/location/location-source";
import {
  newLocation,
  parseLocationDocument,
} from "../../src/features/location/location-schema";
import {
  isStructuredRoom,
  parseDocument,
  serializeDocument,
  type Door,
  type MapDocument,
} from "../../src/model";
import { projectDocumentCommand, Session } from "../../src/session";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const root = "tests/fixtures/atlas-e2e-v1/input/",
  read = (p: string) => readFileSync(root + p, "utf8");
const worldBytes = read("Atlanten/Gemeinsamer-Testatlas.overworld"),
  cityBytes = read(`Städte/${id(100)}.city`),
  dungeonBytes = read("Dungeons/E2E-01-Testdungeon/Karte.dungeon");
const details: readonly DetailPlacement[] = [
  {
    kind: "city",
    id: id(201),
    documentId: id(100),
    parent: { kind: "location", locationId: id(11) },
    offsetMeters: { x: 0, y: 0 },
    rotationRadians: 0,
  },
  {
    kind: "dungeon",
    id: id(202),
    documentId: id(30),
    parent: { kind: "city-building", cityId: id(100), buildingId: id(105) },
    anchor: {
      parentPointMeters: { x: 0, y: 0 },
      mapPointFields: { x: 4, y: 4 },
    },
    rotationRadians: 0,
    surfaceFloorId: id(32),
    entrances: [
      {
        routeId: id(33),
        floorId: id(32),
        roomId: id(31),
        pointFields: { x: 4, y: 4 },
      },
    ],
  },
];
const state2 = (detailPlacements = details): SpatialState => ({
  version: 2,
  detailPlacements,
});
function fixture(includeCity = true) {
  const history = new AtlasHistory(),
    world = parseSpatialWorld(worldBytes);
  const source = new TerrainSource(
    spatialBase(world),
    history,
    async (ref) => read(`Atlasdaten/${id(10)}/${ref.file}`),
    spatialState(world),
  );
  const locations = [11, 12].map(
    (n) =>
      new LocationSource(
        id(n),
        history,
        parseLocationDocument(read(`Orte/${id(n)}.location`)),
      ),
  );
  const city = new CitySource(parseCityDocument(cityBytes), history),
    dungeon = new DungeonAtlasSource(parseDocument(dungeonBytes), history);
  const graph = new SpatialGraph(source, [
    ...locations,
    ...(includeCity ? [city] : []),
    dungeon,
  ]);
  return {
    history,
    source,
    locations,
    city,
    dungeon,
    graph,
    attach: () =>
      history.execute({
        label: "Karten verankern",
        changes: [spatialChange(world.id, source.spatialState(), state2())],
      }),
  };
}
const near = (a: number, b: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const snapshot = (f: ReturnType<typeof fixture>) =>
  JSON.stringify([
    f.history.entries(id(10)),
    f.city.read(),
    f.dungeon.read(),
    f.locations.map((l) => l.read()),
    f.history.undoDepth,
    f.history.canRedo,
  ]);

test("Spatial native codec preserves V1 bytes and keeps V2 closed in the existing host parser", () => {
  assert.equal(
    serializeSpatialWorld(parseSpatialWorld(worldBytes)),
    worldBytes,
  );
  const world = checkedSpatialWorld({
    ...parseSpatialWorld(worldBytes),
    version: 2,
    detailPlacements: details,
  });
  const bytes = serializeSpatialWorld(world);
  assert.equal(serializeSpatialWorld(parseSpatialWorld(bytes)), bytes);
  assert.throws(() => parseOverworld(bytes, true));
  const h = new AtlasHistory(),
    old = new TerrainSource(
      parseOverworld(worldBytes, true),
      h,
      async () => "",
    );
  assert.throws(() => old.spatialState(), /nicht aktiviert/);
  assert.throws(() =>
    h.execute({
      label: "Nicht aktivierter Anschluss",
      changes: [
        spatialChange(id(10), { version: 1, detailPlacements: [] }, state2()),
      ],
    }),
  );
  assert.equal(h.undoDepth, 0);
});

test("Spatial native codec rejects unknown fields, getters, sparse lists, aliases and malformed parents before JSON", () => {
  const fresh = () =>
    JSON.parse(
      JSON.stringify({
        ...parseSpatialWorld(worldBytes),
        version: 2,
        detailPlacements: details,
      }),
    );
  const unknown = { ...fresh(), ignored: true };
  assert.throws(() => checkedSpatialWorld(unknown));
  let accessed = 0;
  const getter = fresh();
  Object.defineProperty(getter, "detailPlacements", {
    enumerable: true,
    get: () => {
      accessed++;
      return [];
    },
  });
  assert.throws(() => checkedSpatialWorld(getter));
  assert.equal(accessed, 0);
  const sparse = fresh();
  delete sparse.detailPlacements[0];
  assert.throws(() => checkedSpatialWorld(sparse));
  const metadata = fresh();
  Object.assign(metadata.detailPlacements, { extra: true });
  assert.throws(() => checkedSpatialWorld(metadata));
  const nested = fresh();
  Object.assign(nested.detailPlacements[0]!.parent, { extra: true });
  assert.throws(() => checkedSpatialWorld(nested));
  const origin = fresh();
  Object.assign(origin.origin, { extra: true });
  assert.throws(() => checkedSpatialWorld(origin));
  const aliases = fresh();
  aliases.detailPlacements[0]!.id = id(11);
  assert.throws(() => checkedSpatialWorld(aliases));
  const duplicate = fresh();
  duplicate.detailPlacements.push(duplicate.detailPlacements[0]!);
  assert.throws(() => checkedSpatialWorld(duplicate));
  const wrongVersion = { ...fresh(), version: 1 };
  assert.throws(() => checkedSpatialWorld(wrongVersion));
});

test("Actual owners attach in one World command; Undo restores exact V1 and native component bytes", () => {
  const f = fixture();
  assert.equal(f.attach(), true);
  assert.equal(f.history.undoDepth, 1);
  assert.equal(f.graph.world().version, 2);
  assert.equal(f.source.cells().length, 0);
  assert.equal(f.history.undo(), true);
  assert.equal(serializeSpatialWorld(f.graph.world()), worldBytes);
  assert.equal(serializeCityDocument(f.city.read()), cityBytes);
  assert.equal(f.dungeon.read().documentBytes, dungeonBytes);
  assert.equal(f.history.redo(), true);
  assert.equal(f.graph.world().version, 2);
  const loaded = parseSpatialWorld(serializeSpatialWorld(f.graph.world()));
  assert.deepEqual(spatialState(loaded), f.source.spatialState());
});

test("Actual native house edits and Source-Key compose with bindings; house dock scales but Dungeon stays physical", () => {
  const f = fixture(),
    before = f.city.read();
  const footprint = editCity(before, [
    {
      kind: "set-building-footprint",
      buildingId: id(105),
      footprint: {
        outer: [
          { x: 0, y: 0 },
          { x: 15.24, y: 0 },
          { x: 15.24, y: 12.192 },
          { x: 0, y: 12.192 },
        ],
        holes: [],
      },
    },
  ]);
  const after = editCity(footprint, [
    {
      kind: "set-building-pose",
      buildingId: id(105),
      position: { x: -18, y: 8 },
      rotationRadians: Math.PI / 2,
      scale: { x: 2, y: 0.5 },
    },
  ]);
  const modified = JSON.parse(JSON.stringify(details));
  const dungeon = modified[1]!;
  assert.equal(dungeon.kind, "dungeon");
  if (dungeon.kind === "dungeon")
    dungeon.anchor.parentPointMeters = { x: 1, y: 2 };
  const keyBefore = f.dungeon.read().document,
    keyAfter = JSON.parse(JSON.stringify(keyBefore));
  const room = keyAfter.entities[0]!;
  assert.ok("key" in room);
  if ("key" in room)
    room.key.sections[0] = {
      id: id(34),
      kind: "markdown",
      markdown: "Änderung\r\n**Tür**  \r\n",
    };
  f.history.execute({
    label: "Haus, Bindung und Raum-Key",
    changes: [
      cityDocumentChange(before, after),
      spatialChange(id(10), f.source.spatialState(), state2(modified)),
      dungeonDocumentChange(keyBefore, keyAfter),
    ],
  });
  assert.equal(f.history.undoDepth, 1);
  const frame = f.graph.frame(id(30)),
    camera = relativeCamera({ x: 0, y: 0 }, { x: 0, y: 0 }, 1),
    viewport = { width: 200, height: 200 };
  const a = projectLocal(frame, camera, viewport, { x: 4, y: 4 }),
    b = projectLocal(frame, camera, viewport, { x: 14, y: 4 });
  near(a.x, 81);
  near(a.y, 110);
  near(b.x, 81);
  near(b.y, 125.24);
  near(Math.hypot(b.x - a.x, b.y - a.y), 15.24);
  assert.deepEqual(f.city.read().buildings[1], before.buildings[1]);
  f.history.undo();
  assert.equal(serializeCityDocument(f.city.read()), cityBytes);
  assert.equal(f.dungeon.read().documentBytes, dungeonBytes);
  assert.equal(serializeSpatialWorld(f.graph.world()), worldBytes);
  f.history.redo();
  assert.equal(f.dungeon.read().keyClosure[0]!.sectionId, id(34));
});

test("City, house and relative Dungeon rotations compose; Location-parent dungeons use the same physical frame", () => {
  const f = fixture(),
    before = f.city.read();
  const house = editCity(before, [
    {
      kind: "set-building-pose",
      buildingId: id(105),
      position: { x: -18, y: 8 },
      rotationRadians: Math.PI / 2,
      scale: { x: 2, y: 0.5 },
    },
  ]);
  const raw = JSON.parse(JSON.stringify(details));
  raw[0].rotationRadians = Math.PI / 2;
  raw[0].offsetMeters = { x: 10, y: -20 };
  raw[1].rotationRadians = -Math.PI / 2;
  raw[1].anchor.parentPointMeters = { x: 1, y: 2 };
  f.history.execute({
    label: "Transformkette",
    changes: [
      cityDocumentChange(before, house),
      spatialChange(id(10), f.source.spatialState(), state2(raw)),
    ],
  });
  const camera = relativeCamera({ x: 0, y: 0 }, { x: 0, y: 0 }, 1),
    viewport = { width: 200, height: 200 };
  const frame = f.graph.frame(id(30)),
    dock = projectLocal(frame, camera, viewport, { x: 4, y: 4 });
  near(dock.x, 100);
  near(dock.y, 61);
  const corner = projectLocal(frame, camera, viewport, { x: 14, y: 12 });
  near(corner.x, 87.808);
  near(corner.y, 76.24);
  const inverse = unprojectLocal(frame, camera, viewport, corner);
  near(inverse.x, 14);
  near(inverse.y, 12);
  raw[1].parent = { kind: "location", locationId: id(12) };
  raw[1].anchor.parentPointMeters = { x: 7, y: -3 };
  f.history.execute({
    label: "Direkt am POI verankern",
    changes: [spatialChange(id(10), f.source.spatialState(), state2(raw))],
  });
  const poi = f.source
    .placements()
    .find((p) => p.locationId === id(12))!.position;
  const poiCamera = relativeCamera(poi, { x: 0, y: 0 }, 1),
    point = projectLocal(f.graph.frame(id(30)), poiCamera, viewport, {
      x: 5,
      y: 4,
    });
  near(point.x, 107);
  near(point.y, 95.476);
});

test("Bound house removal rejects Preview/Apply atomically and preserves Redo; explicit detach composes once", () => {
  const f = fixture();
  f.attach();
  const before = f.city.read();
  const moved = editCity(before, [
    {
      kind: "set-building-pose",
      buildingId: id(105),
      position: { x: -18, y: 8 },
      rotationRadians: 0,
      scale: { x: 1, y: 1 },
    },
  ]);
  f.history.execute({
    label: "Haus bewegen",
    changes: [cityDocumentChange(before, moved)],
  });
  f.history.undo();
  const removed = editCity(f.city.read(), [
      { kind: "remove-building", buildingId: id(105) },
    ]),
    original = snapshot(f);
  const cmd = {
    label: "Ungültige Entfernung",
    changes: [
      cityDocumentChange(f.city.read(), removed),
      locationDocumentChange(id(11), f.locations[0]!.read(), {
        ...f.locations[0]!.read()!,
        name: "Darf nicht geändert werden",
      }),
    ],
  };
  assert.throws(() => f.history.check(cmd), /Gebundenes Haus/);
  assert.throws(() => f.history.execute(cmd), /Gebundenes Haus/);
  assert.equal(snapshot(f), original);
  assert.equal(f.history.redo(), true);
  const current = f.city.read(),
    detached = editCity(current, [
      { kind: "remove-building", buildingId: id(105) },
    ]);
  const depth = f.history.undoDepth;
  f.history.execute({
    label: "Haus entfernen und Dungeon entkoppeln",
    changes: [
      cityDocumentChange(current, detached),
      spatialChange(id(10), f.source.spatialState(), state2([details[0]!])),
    ],
  });
  assert.equal(f.history.undoDepth, depth + 1);
  assert.equal(f.dungeon.read().documentBytes, dungeonBytes);
  assert.throws(() => f.graph.frame(id(30)), /nicht verortet/);
  f.history.undo();
  assert.ok(f.graph.frame(id(30)));
  f.history.redo();
  assert.equal(f.dungeon.read().documentBytes, dungeonBytes);
});

test("Graph checks complete future state including a new Location; missing parent removal never partly mutates", () => {
  const f = fixture(),
    added = newLocation(id(203), "Neuer Ort", "city", [id(204), id(205)]),
    location = new LocationSource(added.id, f.history);
  f.graph.include(location);
  const placements = [
    ...f.source.placements(),
    {
      id: id(206),
      kind: "location" as const,
      locationId: added.id,
      position: { x: -12, y: 20 },
    },
  ];
  const future = JSON.parse(JSON.stringify(details));
  future[0]!.parent = { kind: "location", locationId: added.id };
  const cmd = {
    label: "Neuer Parent und Karten",
    changes: [
      spatialChange(id(10), f.source.spatialState(), state2(future)),
      locationPlacementsChange(id(10), f.source.placements(), placements),
      locationDocumentChange(added.id, null, added),
    ],
  };
  f.history.check(cmd);
  assert.equal(location.read(), null);
  assert.equal(f.history.undoDepth, 0);
  f.history.execute(cmd);
  assert.deepEqual(f.graph.frame(id(100)).anchor, { x: -12, y: 20 });
  const original = snapshot(f);
  assert.throws(() =>
    f.history.execute({
      label: "Parent löschen",
      changes: [
        locationDocumentChange(added.id, added, null),
        locationPlacementsChange(
          id(10),
          placements,
          placements.filter((p) => p.locationId !== added.id),
        ),
      ],
    }),
  );
  assert.equal(snapshot(f), original);
  assert.deepEqual(location.read(), added);
  f.history.undo();
  assert.equal(location.read(), null);
  assert.equal(f.graph.world().version, 1);
  f.history.redo();
  assert.equal(location.read()!.id, added.id);
});

test("Missing/unloaded/wrong-type children and bad Floor/Room/Route fail without changing any owner or history", () => {
  const absent = fixture(false),
    original = snapshot(absent);
  assert.throws(() => absent.attach(), /ungeladen|anderen Typ/);
  assert.equal(snapshot(absent), original);
  absent.graph.include(absent.city);
  absent.attach();
  for (const mutate of [
    (p: any) => {
      p.parent.cityId = id(11);
    },
    (p: any) => {
      p.surfaceFloorId = id(31);
    },
    (p: any) => {
      p.entrances[0].floorId = id(31);
    },
    (p: any) => {
      p.entrances[0].roomId = id(32);
    },
    (p: any) => {
      p.entrances[0].routeId = id(34);
    },
  ]) {
    const bad = structuredClone(details);
    mutate(bad[1]);
    const before = snapshot(absent);
    assert.throws(() =>
      absent.history.execute({
        label: "Falsche Closure",
        changes: [
          spatialChange(id(10), absent.source.spatialState(), state2(bad)),
        ],
      }),
    );
    assert.equal(snapshot(absent), before);
  }
  const otherHistory = new AtlasHistory(),
    foreign = new CitySource(parseCityDocument(cityBytes), otherHistory);
  assert.throws(() => absent.graph.include(foreign), /AtlasHistory/);
});

test("Local navigation references use native section/room closure and never a second placement", () => {
  const f = fixture();
  f.attach();
  const before = f.locations[0]!.read()!;
  const linked = {
    ...before,
    detailMaps: [{ kind: "city" as const, documentId: id(100) }],
    keyLinks: [
      {
        kind: "room" as const,
        atlasId: id(10),
        documentId: id(30),
        roomId: id(31),
        sectionId: id(34),
        anchor: null,
      },
    ],
  };
  f.history.execute({
    label: "Navigation verknüpfen",
    changes: [locationDocumentChange(id(11), before, linked)],
  });
  const original = snapshot(f),
    wrong = {
      ...linked,
      keyLinks: [{ ...linked.keyLinks[0]!, sectionId: id(33) }],
    };
  assert.throws(
    () =>
      f.history.execute({
        label: "Falscher Abschnitt",
        changes: [locationDocumentChange(id(11), linked, wrong)],
      }),
    /Keyabschnitt/,
  );
  assert.equal(snapshot(f), original);
  assert.equal(f.graph.world().version, 2);
  assert.equal(f.source.spatialState().detailPlacements.length, 2);
});

test("Placement identities cannot alias native room/section/house identities", () => {
  const f = fixture();
  for (const duplicate of [id(31), id(34), id(105)]) {
    const raw = JSON.parse(JSON.stringify(details));
    raw[0].id = duplicate;
    const before = snapshot(f);
    assert.throws(
      () =>
        f.history.execute({
          label: "Element-ID missbrauchen",
          changes: [
            spatialChange(id(10), f.source.spatialState(), state2(raw)),
          ],
        }),
      /Elementkennung/,
    );
    assert.equal(snapshot(f), before);
  }
});

test("Relative camera preserves centimeter detail, hit inversion, pixel Pan and Pointer Zoom at ±1e16 meters", () => {
  for (const anchor of [1e16, -1e16]) {
    const f = fixture();
    f.attach();
    const before = f.source.placements();
    f.history.execute({
      label: "Ferne Verortung",
      changes: [
        locationPlacementsChange(
          id(10),
          before,
          before.map((p) =>
            p.locationId === id(11)
              ? { ...p, position: { x: anchor, y: anchor } }
              : p,
          ),
        ),
      ],
    });
    const frame = f.graph.frame(id(100)),
      viewport = { width: 200, height: 200 },
      camera = relativeCamera({ x: anchor, y: anchor }, { x: 0, y: 0 }, 0.01),
      point = { x: 0.01, y: 0.01 };
    const screen = projectLocal(frame, camera, viewport, point);
    near(screen.x, 101);
    near(screen.y, 101);
    const hit = unprojectLocal(frame, camera, viewport, screen);
    near(hit.x, point.x);
    near(hit.y, point.y);
    const panned = panRelativeAtlas(camera, 1, 0);
    near(projectLocal(frame, panned, viewport, point).x, 102);
    const zoomed = zoomRelativeAtlas(panned, viewport, screen, 0.5),
      atPointer = unprojectLocal(frame, panned, viewport, screen);
    near(projectLocal(frame, zoomed, viewport, atPointer).x, screen.x);
    near(projectLocal(frame, zoomed, viewport, atPointer).y, screen.y);
    let travelled = camera;
    for (let i = 0; i < 1000; i++)
      travelled = panRelativeAtlas(travelled, 1, -1);
    for (let i = 0; i < 1000; i++)
      travelled = panRelativeAtlas(travelled, -1, 1);
    near(projectLocal(frame, travelled, viewport, point).x, 101, 1e-6);
    near(projectLocal(frame, travelled, viewport, point).y, 101, 1e-6);
  }
});

test("Parent translations stay separate until projection; large house position never loses Dungeon detail", () => {
  const f = fixture();
  f.attach();
  const before = f.city.read(),
    after = editCity(before, [
      {
        kind: "set-building-pose",
        buildingId: id(105),
        position: { x: 1e16, y: -1e16 },
        rotationRadians: 0,
        scale: { x: 1, y: 1 },
      },
    ]);
  f.history.execute({
    label: "Fernes Haus",
    changes: [cityDocumentChange(before, after)],
  });
  const frame = f.graph.frame(id(30)),
    camera = relativeCamera({ x: 1e16, y: -1e16 }, { x: 0, y: 0 }, 0.01),
    viewport = { width: 200, height: 200 };
  const p = { x: 4.01, y: 4.01 },
    screen = projectLocal(frame, camera, viewport, p);
  near(screen.x, 101.524);
  near(screen.y, 101.524);
  const hit = unprojectLocal(frame, camera, viewport, screen);
  near(hit.x, p.x);
  near(hit.y, p.y);
  const rotated: RigidFrame = {
    ...frame,
    rotationRadians: 0.7,
    precisionMeters: 1,
  };
  assert.throws(
    () => projectLocal(rotated, camera, viewport, p),
    /nicht zuverlässig/,
  );
});

test("Prospective validation protects Undo/Redo, immutable retained snapshots and synchronous non-reentrant checks", () => {
  const h = new AtlasHistory();
  h.register("x", (_t, v) => {
    if (typeof v !== "number") throw new Error("wrong");
  });
  h.hydrate("x", [["a", 0]]);
  let locked = false,
    retained: any;
  h.addPreflight((view) => {
    if (locked) throw new Error("locked");
    retained = view;
    assert.ok(Object.isFrozen(view.entries("x")));
  });
  const command = {
    label: "Änderung",
    changes: [{ ownerId: "x", target: "a", before: 0, after: 1 }],
  };
  h.execute(command);
  const initialView = retained;
  locked = true;
  assert.throws(() => h.undo(), /locked/);
  assert.equal(h.read("x", "a"), 1);
  assert.equal(h.undoDepth, 1);
  locked = false;
  h.undo();
  assert.equal(initialView.read("x", "a"), 1);
  locked = true;
  assert.throws(() => h.redo(), /locked/);
  assert.equal(h.read("x", "a"), 0);
  assert.equal(h.canRedo, true);
  locked = false;
  const cancel = h.addPreflight(() => {
    h.hydrate("x", [["a", 7]]);
  });
  assert.throws(() => h.redo(), /darf den Zustand/);
  cancel();
  const asyncCheck = h.addPreflight(() => Promise.resolve() as unknown as void);
  assert.throws(() => h.redo(), /synchron/);
  asyncCheck();
  h.redo();
  assert.equal(h.read("x", "a"), 1);
});

function geometryGesture(
  f: ReturnType<typeof fixture>,
  pointer = { x: 4, y: 4 },
) {
  const access = {
    graph: () => f.graph,
    dungeon: (ownerId: string) => {
      assert.equal(ownerId, id(30));
      return f.dungeon;
    },
  };
  return new DungeonGeometryGesture(access, {
    ownerId: id(30),
    floorId: id(32),
    roomId: id(31),
    pointer,
    tolerance: 0.5,
  });
}

test("Dungeon geometry proposal is pure, preserves native closure and hands off one canonical 1.524m change", () => {
  const f = fixture();
  f.attach();
  const document = f.dungeon.read().document,
    door: Door = {
      id: id(35),
      kind: "door",
      floorId: id(32),
      anchor: { boundaryId: id(31), contour: 0, at: 0.125 },
      width: 1,
      variant: "door",
    },
    withDoor = { ...document, entities: [...document.entities, door] };
  f.history.execute({
    label: "Abhängiges Portal vorbereiten",
    changes: [dungeonDocumentChange(document, withDoor)],
  });
  const before = f.dungeon.read(),
    depth = f.history.undoDepth,
    redo = f.history.canRedo,
    gesture = geometryGesture(f);
  assert.equal(gesture.basis.frame.metersPerUnit, 1.524);
  assert.equal(gesture.basis.graph, f.graph);
  assert.equal(gesture.basis.terrainSource, f.source);
  assert.equal(gesture.basis.history, f.history);
  assert.equal(gesture.basis.dungeonSource, f.dungeon);
  assert.equal(gesture.basis.citySource, f.city);
  assert.equal(gesture.address.contour, 0);
  assert.equal(gesture.address.point, 0);

  const proposal = gesture.sample(() => ({ x: 3, y: 4 }), true);
  assert.ok(proposal);
  assert.equal(f.dungeon.read().documentBytes, before.documentBytes);
  assert.deepEqual(f.dungeon.read().keyClosure, before.keyClosure);
  assert.equal(f.history.undoDepth, depth);
  assert.equal(f.history.canRedo, redo);
  assert.equal(proposal.change.ownerId, id(30));
  assert.equal(proposal.change.before, before.documentBytes);
  assert.equal(proposal.change.after, serializeDocument(proposal.preview));
  assert.deepEqual(proposal.preview.floors, before.document.floors);
  assert.deepEqual(proposal.preview.content, before.document.content);
  assert.deepEqual(
    proposal.preview.entities.map((entity) => entity.id),
    before.document.entities.map((entity) => entity.id),
  );
  const previewDoor = proposal.preview.entities.find(
    (entity) => entity.id === door.id,
  );
  assert.ok(previewDoor?.kind === "door");
  assert.notDeepEqual(previewDoor, door);
  const previewRoom = proposal.preview.entities.find((entity) => entity.id === id(31));
  assert.ok(previewRoom && isStructuredRoom(previewRoom));
  if (previewRoom && isStructuredRoom(previewRoom))
    assert.equal(
      previewRoom.key.sections[0]?.kind === "markdown"
        ? previewRoom.key.sections[0].markdown
        : null,
      "## Eingang\r\nDie Basalttür ist geschlossen.  \r\n",
    );

  const change = gesture.handoff();
  assert.deepEqual(change, proposal.change);
  assert.equal(gesture.status, "handed-off");
  const command = { label: "Gemeinsamer Konturzug", changes: [change!] };
  f.history.check(command);
  assert.equal(f.history.execute(command), true);
  assert.equal(f.history.undoDepth, depth + 1);
  assert.equal(f.dungeon.read().documentBytes, proposal.change.after);
  assert.equal(f.history.undo(), true);
  assert.equal(f.dungeon.read().documentBytes, before.documentBytes);
  assert.equal(f.history.redo(), true);
  assert.equal(f.dungeon.read().documentBytes, proposal.change.after);
});

test("Rejected Dungeon geometry samples revoke the visible proposal and cannot commit an older drag", () => {
  const f = fixture();
  f.attach();
  const cityBefore = f.city.read(),
    cityAfter = editCity(cityBefore, [{
      kind: "set-building-pose",
      buildingId: id(105),
      position: { x: -18, y: 8 },
      rotationRadians: 0,
      scale: { x: 1, y: 1 },
    }]);
  f.history.execute({
    label: "Redostand vorbereiten",
    changes: [cityDocumentChange(cityBefore, cityAfter)],
  });
  f.history.undo();
  const before = snapshot(f),
    invalidTopology = geometryGesture(f);
  assert.ok(invalidTopology.sample(() => ({ x: 3, y: 4 }), false));
  assert.throws(
    () => invalidTopology.sample(() => ({ x: 14, y: 4 }), false),
    /Nullsegment/,
  );
  assert.equal(invalidTopology.preview, undefined);
  assert.equal(invalidTopology.handoff(), null);
  assert.equal(snapshot(f), before);

  const invalidCoordinate = geometryGesture(f);
  assert.ok(invalidCoordinate.sample(() => ({ x: 3, y: 4 }), false));
  assert.equal(
    invalidCoordinate.sample(() => ({ x: Number.NaN, y: 4 }), false),
    null,
  );
  assert.equal(invalidCoordinate.preview, undefined);
  assert.equal(invalidCoordinate.handoff(), null);
  assert.equal(snapshot(f), before);

  const corrected = geometryGesture(f);
  const first = corrected.sample(() => ({ x: 3, y: 4 }), false);
  assert.ok(first);
  assert.throws(
    () => corrected.sample(() => ({ x: 14, y: 4 }), false),
    /Nullsegment/,
  );
  const visible = corrected.sample(() => ({ x: 2, y: 4 }), false);
  assert.ok(visible);
  assert.notEqual(visible.change.after, first.change.after);
  assert.deepEqual(corrected.handoff(), visible.change);
  assert.equal(snapshot(f), before);

  const failedResolution = geometryGesture(f),
    initial = failedResolution.sample(() => ({ x: 3, y: 4 }), false);
  assert.ok(initial);
  assert.throws(
    () => failedResolution.sample(() => {
      throw new Error("Koordinatenauflösung fehlgeschlagen");
    }, false),
    /Koordinatenauflösung fehlgeschlagen/,
  );
  assert.equal(failedResolution.preview, undefined);
  const recovered = failedResolution.sample(() => ({ x: 2, y: 4 }), false);
  assert.ok(recovered);
  assert.notEqual(recovered.change.after, initial.change.after);
  assert.deepEqual(failedResolution.handoff(), recovered.change);
  assert.equal(snapshot(f), before);
});

test("Atlas pointer callbacks revoke a Dungeon proposal when delayed unprojection fails", () => {
  const f = fixture();
  f.attach();
  const cityBefore = f.city.read(),
    cityAfter = editCity(cityBefore, [{
      kind: "set-building-pose",
      buildingId: id(105),
      position: { x: -18, y: 8 },
      rotationRadians: 0,
      scale: { x: 1, y: 1 },
    }]);
  f.history.execute({
    label: "Callback-Redostand vorbereiten",
    changes: [cityDocumentChange(cityBefore, cityAfter)],
  });
  f.history.undo();
  const before = snapshot(f),
    beforeBytes = f.dungeon.read().documentBytes,
    beforeDepth = f.history.undoDepth;
  assert.equal(f.history.canRedo, true);
  let draftWrites = 0;
  const unsubscribe = f.history.subscribe(() => {
    draftWrites++;
  });

  const { document, window } = parseHTML(
      "<html><body><main><div></div><span></span></main></body></html>",
    ),
    root = document.querySelector("main")! as unknown as HTMLElement,
    viewport = document.querySelector("div")! as unknown as HTMLDivElement,
    status = document.querySelector("span")! as unknown as HTMLSpanElement,
    gesture = geometryGesture(f),
    frame = gesture.basis.frame,
    camera = relativeCamera(frame.anchor, { x: 0, y: 0 }, 1),
    rendererViewport = { width: 100, height: 100 },
    spatial: { dungeonPreview?: MapDocument } = {},
    renderer = {
      viewport: rendererViewport,
      schedule: () => {},
    };
  Object.assign(viewport, {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
  });
  const editor = Object.create(AtlasEditor.prototype) as any;
  Object.assign(editor, {
    abort: new AbortController(),
    root,
    viewport,
    status,
    currentTerrain: f.source,
    storage: { status: () => ({ dirty: false, hasDraft: false }) },
    renderer,
    spatial,
    pointer: {
      id: 7,
      action: "dungeon",
      x: 0,
      y: 0,
      startX: 0,
      startY: 0,
      moved: true,
    },
    dungeonDrag: { gesture, frame, camera },
  });
  (editor as any).bind();
  const pointer = (type: string, x: number, y: number) => {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, {
      pointerId: 7,
      clientX: x,
      clientY: y,
      altKey: false,
      button: 0,
    });
    return event;
  };
  const valid = projectLocal(frame, camera, rendererViewport, { x: 3, y: 4 });
  window.dispatchEvent(pointer("pointermove", valid.x, valid.y));
  assert.ok(spatial.dungeonPreview);
  assert.ok(gesture.preview);

  window.dispatchEvent(pointer("pointermove", Number.NaN, valid.y));
  assert.equal(spatial.dungeonPreview, undefined);
  assert.equal(gesture.preview, undefined);
  assert.match(status.textContent ?? "", /Ungültige räumliche Zahl/);
  window.dispatchEvent(pointer("pointerup", Number.NaN, valid.y));

  assert.equal(f.dungeon.read().documentBytes, beforeBytes);
  assert.equal(f.history.undoDepth, beforeDepth);
  assert.equal(f.history.canRedo, true);
  assert.equal(draftWrites, 0);
  assert.equal(snapshot(f), before);
  assert.equal((editor as any).dungeonDrag, undefined);
  assert.equal((editor as any).pointer, undefined);

  const fresh = geometryGesture(f);
  assert.ok(fresh.sample(() => ({ x: 2, y: 4 }), false));
  fresh.cancel();
  unsubscribe();
  (editor as any).abort.abort();
});

test("Dungeon geometry uses the immutable actual begin pointer for off-center and snapped deltas", () => {
  const f = fixture();
  f.attach();
  const start = { x: 4.2, y: 4.2 },
    gesture = geometryGesture(f, start);
  start.x = 99;
  start.y = 99;
  assert.deepEqual(gesture.startPointer, { x: 4.2, y: 4.2 });
  assert.ok(Object.isFrozen(gesture.startPointer));

  const shifted = gesture.sample(() => ({ x: 3.2, y: 4.2 }), false),
    shiftedRoom = shifted?.preview.entities.find((entity) => entity.id === id(31));
  assert.ok(shiftedRoom && isStructuredRoom(shiftedRoom));
  if (shiftedRoom && isStructuredRoom(shiftedRoom))
    assert.deepEqual(shiftedRoom.polygons[0]!.outer[0], { x: 3, y: 4 });
  assert.equal(gesture.sample(() => ({ x: 4.2, y: 4.2 }), false), null);
  assert.equal(gesture.preview, undefined);
  assert.equal(gesture.sample(() => ({ x: 3.71, y: 4.2 }), true), null);
  const snapped = gesture.sample(() => ({ x: 3.69, y: 4.2 }), true),
    snappedRoom = snapped?.preview.entities.find((entity) => entity.id === id(31));
  assert.ok(snappedRoom && isStructuredRoom(snappedRoom));
  if (snappedRoom && isStructuredRoom(snappedRoom))
    assert.deepEqual(snappedRoom.polygons[0]!.outer[0], { x: 3, y: 4 });
  gesture.cancel();
});

test("Pure document projection and native Session share record validation, ordering and portal application", () => {
  const f = fixture();
  f.attach();
  const base = f.dungeon.read().document,
    door: Door = {
      id: id(35),
      kind: "door",
      floorId: id(32),
      anchor: { boundaryId: id(31), contour: 0, at: 0.125 },
      width: 1,
      variant: "door",
    },
    document = { ...base, entities: [...base.entities, door] },
    room = document.entities.find((entity) => entity.id === id(31));
  assert.ok(room && isStructuredRoom(room));
  if (!room || !isStructuredRoom(room)) return;
  const grip = buildingVertexGrip(room, { x: 4, y: 4 }, 0.5),
    geometry = grip && proposeBuildingPointDrag(room, grip, { x: 3, y: 4 });
  assert.ok(grip && geometry);
  if (!grip || !geometry) return;
  const command = planBuildingContourMutation({
    entities: document.entities,
    before: room,
    ...geometry,
  });
  assert.ok(command);
  if (!command) return;

  const beforeBytes = serializeDocument(document),
    projected = projectDocumentCommand(document, command),
    native = new Session(document);
  native.execute(command);
  assert.equal(serializeDocument(native.document()), serializeDocument(projected));
  assert.deepEqual(
    native.document().entities.map((entity) => entity.id),
    projected.entities.map((entity) => entity.id),
  );
  assert.equal(serializeDocument(document), beforeBytes);

  assert.throws(() => projectDocumentCommand(projected, command), /Veraltete Änderung/);
  assert.throws(() => native.execute(command), /Veraltete Änderung/);

  const invalidRoom = structuredClone(
      command.entities?.find((change) => change.id === room.id)?.after,
    );
  assert.ok(invalidRoom && isStructuredRoom(invalidRoom));
  if (!invalidRoom || !isStructuredRoom(invalidRoom)) return;
  const invalidAfter = { ...invalidRoom, id: id(999) };
  const invalid = {
    ...command,
    entities: command.entities?.map((change) =>
      change.id === room.id ? { ...change, after: invalidAfter } : change,
    ),
  };
  assert.throws(
    () => projectDocumentCommand(document, invalid),
    /Abweichende Datensatzkennung/,
  );
  assert.throws(
    () => new Session(document).execute(invalid),
    /Abweichende Datensatzkennung/,
  );
  assert.equal(serializeDocument(document), beforeBytes);
});

test("Parent undo invalidates a Dungeon gesture terminally without consuming its normal Redo", () => {
  const f = fixture();
  f.attach();
  const cityBefore = f.city.read(),
    cityAfter = editCity(cityBefore, [{
      kind: "set-building-pose",
      buildingId: id(105),
      position: { x: -18, y: 8 },
      rotationRadians: 0,
      scale: { x: 1, y: 1 },
    }]);
  f.history.execute({
    label: "Haus bewegen",
    changes: [cityDocumentChange(cityBefore, cityAfter)],
  });
  const bytes = f.dungeon.read().documentBytes,
    gesture = geometryGesture(f);
  assert.ok(gesture.sample(() => ({ x: 3, y: 4 }), true));
  const depth = f.history.undoDepth;
  assert.equal(f.history.undo(), true);
  assert.equal(gesture.status, "changed-basis");
  assert.equal(gesture.preview, undefined);
  assert.equal(gesture.sample(() => ({ x: 2, y: 4 }), true), null);
  assert.equal(gesture.handoff(), null);
  assert.equal(f.history.undoDepth, depth - 1);
  assert.equal(f.history.canRedo, true);
  assert.equal(f.dungeon.read().documentBytes, bytes);
});

test("Binding changes and A-to-B-to-A history remain terminally stale; a fresh begin uses the current frame", () => {
  const f = fixture();
  f.attach();
  const gesture = geometryGesture(f),
    beforeState = f.source.spatialState(),
    changed = JSON.parse(JSON.stringify(details));
  changed[1].anchor.parentPointMeters = { x: 2, y: 3 };
  f.history.execute({
    label: "Dungeonanker ändern",
    changes: [spatialChange(id(10), beforeState, state2(changed))],
  });
  f.history.undo();
  assert.deepEqual(f.source.spatialState(), beforeState);
  assert.equal(gesture.status, "changed-basis");
  assert.equal(gesture.sample(() => ({ x: 3, y: 4 }), true), null);
  assert.equal(gesture.handoff(), null);

  const fresh = geometryGesture(f),
    proposal = fresh.sample(() => ({ x: 3, y: 4 }), true);
  assert.ok(proposal);
  assert.equal(fresh.status, "active");
  fresh.cancel();
  assert.equal(fresh.handoff(), null);
});

test("Byte-identical Source, Graph and History replacement blocks the old gesture and permits only a fresh begin", () => {
  const a = fixture(),
    b = fixture();
  a.attach();
  b.attach();
  assert.equal(a.dungeon.read().documentBytes, b.dungeon.read().documentBytes);
  assert.deepEqual(a.source.spatialState(), b.source.spatialState());
  let current = a;
  const access = {
      graph: () => current.graph,
      dungeon: (_ownerId: string) => current.dungeon,
    },
    old = new DungeonGeometryGesture(access, {
      ownerId: id(30),
      floorId: id(32),
      roomId: id(31),
      pointer: { x: 4, y: 4 },
      tolerance: 0.5,
    });
  assert.ok(old.sample(() => ({ x: 3, y: 4 }), true));
  current = b;
  assert.equal(old.sample(() => ({ x: 2, y: 4 }), true), null);
  assert.equal(old.status, "changed-basis");
  assert.equal(old.handoff(), null);
  assert.equal(a.history.undoDepth, 1);
  assert.equal(b.history.undoDepth, 1);
  const fresh = new DungeonGeometryGesture(access, {
    ownerId: id(30),
    floorId: id(32),
    roomId: id(31),
    pointer: { x: 4, y: 4 },
    tolerance: 0.5,
  });
  assert.ok(fresh.sample(() => ({ x: 3, y: 4 }), true));
  fresh.cancel();
});

test("Dungeon geometry rejects null, locked and non-outer grips without history or source effects", () => {
  const f = fixture();
  f.attach();
  const before = snapshot(f),
    gesture = geometryGesture(f);
  assert.equal(gesture.sample(() => ({ x: 4, y: 4 }), true), null);
  assert.equal(gesture.handoff(), null);
  assert.equal(snapshot(f), before);

  assert.throws(
    () => new DungeonGeometryGesture(
      { graph: () => f.graph, dungeon: () => f.dungeon },
      {
        ownerId: id(30),
        floorId: id(32),
        roomId: id(31),
        pointer: { x: 9, y: 8 },
        tolerance: 0.1,
      },
    ),
    /äußerer Raumkonturpunkt/,
  );
  assert.equal(snapshot(f), before);
});
