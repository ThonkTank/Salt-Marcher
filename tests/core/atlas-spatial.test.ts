import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AtlasHistory } from "../../src/features/atlas/atlas-history";
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
import {
  LocationSource,
  locationDocumentChange,
} from "../../src/features/location/location-source";
import {
  newLocation,
  parseLocationDocument,
} from "../../src/features/location/location-schema";
import { parseDocument } from "../../src/model";

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
