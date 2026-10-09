import test from "node:test";
import assert from "node:assert/strict";
import type { Polygon } from "../../src/model";
import { AtlasHistory } from "../../src/features/atlas/atlas-history";
import {
  CitySource,
  cityDocumentChange,
} from "../../src/features/city/commands";
import { editCity, type CityEdit } from "../../src/features/city/edit";
import {
  newCityDocument,
  parseCityDocument,
  serializeCityDocument,
} from "../../src/features/city/codec";
import type { CityBuilding, CityDocument } from "../../src/features/city/model";

const square = (size = 10): Polygon => ({
  outer: [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size },
  ],
  holes: [],
});
function house(id = "house"): CityBuilding {
  return {
    id,
    name: "Innenhof",
    footprint: {
      ...square(),
      holes: [
        [
          { x: 2, y: 2 },
          { x: 4, y: 2 },
          { x: 4, y: 4 },
          { x: 2, y: 4 },
        ],
      ],
    },
    position: { x: -100, y: 50 },
    rotationRadians: 0.2,
    scale: { x: 1, y: 1 },
    plotId: "plot",
  };
}
function town(): CityDocument {
  return {
    ...newCityDocument("city", "Dorf"),
    roadNodes: [
      { id: "center", point: { x: 0, y: 0 } },
      { id: "west", point: { x: -20, y: 0 } },
      { id: "east", point: { x: 20, y: 0 } },
      { id: "north", point: { x: 0, y: -20 } },
    ],
    roads: ["west", "east", "north"].map((id) => ({
      id: "road-" + id,
      startNodeId: "center",
      endNodeId: id,
      via: [],
      widthMeters: 3,
    })),
    districts: [{ id: "district", name: "Altstadt", outline: square(100) }],
    plots: [{ id: "plot", outline: square(20), districtId: "district" }],
    buildings: [house(), house("other-house")],
  };
}
const encode = serializeCityDocument;
function reject(document: CityDocument, edits: unknown) {
  assert.throws(() => editCity(document, edits as readonly CityEdit[]));
}

test("City node movement updates one shared T junction while preserving all edge identities and interior points", () => {
  const initial = town(),
    before = encode(initial),
    point = { x: -7, y: 9 };
  const result = editCity(initial, [
    { kind: "move-node", nodeId: "center", point },
  ]);
  assert.deepEqual(result.roadNodes[0]!.point, point);
  assert.deepEqual(result.roads, initial.roads);
  assert.equal(
    result.roads.filter((r) => r.startNodeId === "center").length,
    3,
  );
  assert.deepEqual(result.buildings, initial.buildings);
  assert.equal(encode(initial), before);
  assert(!Object.isFrozen(point));
  point.x = 999;
  assert.equal(result.roadNodes[0]!.point.x, -7);
  assert(Object.isFrozen(result.roadNodes[0]!.point));
});

test("City road addition, replacement and dependent node removal validate the complete package rather than intermediate references", () => {
  const initial = town();
  const added = editCity(initial, [
    {
      kind: "add-road",
      nodes: [{ id: "south", point: { x: 0, y: 20 } }],
      road: {
        id: "road-south",
        startNodeId: "center",
        endNodeId: "south",
        via: [{ x: 2, y: 10 }],
        widthMeters: 4,
      },
    },
  ]);
  assert.equal(added.roads.length, 4);
  assert.deepEqual(added.roads[3]!.via, [{ x: 2, y: 10 }]);
  reject(initial, [{ kind: "remove-node", nodeId: "west" }]);
  const replacement = {
    ...initial.roads[0]!,
    endNodeId: "east",
    via: [{ x: 0, y: 10 }],
    widthMeters: 7,
  };
  for (const edits of [
    [
      { kind: "remove-node", nodeId: "west" },
      { kind: "replace-road", roadId: "road-west", road: replacement },
    ],
    [
      { kind: "replace-road", roadId: "road-west", road: replacement },
      { kind: "remove-node", nodeId: "west" },
    ],
  ]) {
    const result = editCity(initial, edits as readonly CityEdit[]);
    assert.equal(result.roadNodes.length, 3);
    assert.deepEqual(result.roads[0], replacement);
  }
  const removed = editCity(initial, [
    { kind: "remove-road", roadId: "road-west" },
  ]);
  assert.equal(removed.roads.length, 2);
  assert.deepEqual(removed.roadNodes, initial.roadNodes);
});

test("City building pose, courtyard contour replacement and removal preserve unrelated identity and geometry", () => {
  const initial = town(),
    pose = {
      kind: "set-building-pose" as const,
      buildingId: "house",
      position: { x: 1e9, y: -1e9 },
      rotationRadians: 0.7,
      scale: { x: 2, y: 0.5 },
    };
  const moved = editCity(initial, [pose]);
  assert.deepEqual(
    moved.buildings[0]!.footprint,
    initial.buildings[0]!.footprint,
  );
  assert.equal(moved.buildings[0]!.plotId, "plot");
  assert.equal(moved.buildings[0]!.name, "Innenhof");
  assert.deepEqual(moved.buildings[1], initial.buildings[1]);
  const replaced = editCity(moved, [
    {
      kind: "set-building-footprint",
      buildingId: "house",
      footprint: square(0.001),
    },
  ]);
  assert.deepEqual(replaced.buildings[0]!.position, pose.position);
  assert.equal(replaced.buildings[0]!.rotationRadians, pose.rotationRadians);
  assert.deepEqual(replaced.buildings[0]!.scale, pose.scale);
  const removed = editCity(replaced, [
    { kind: "remove-building", buildingId: "house" },
  ]);
  assert.deepEqual(removed.buildings, [initial.buildings[1]]);
  assert.deepEqual(removed.plots, initial.plots);
  assert.deepEqual(removed.districts, initial.districts);
  for (const scale of [
    { x: 0, y: 1 },
    { x: Infinity, y: 1 },
    { x: 1e-300, y: 1e-300 },
  ])
    reject(initial, [{ ...pose, scale }]);
  reject(initial, [
    { ...pose, position: { x: Number.MAX_VALUE, y: Number.MAX_VALUE } },
  ]);
  reject(initial, [
    {
      kind: "set-building-footprint",
      buildingId: "house",
      footprint: {
        ...square(),
        outer: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
          { x: 10, y: 0 },
        ],
      },
    },
  ]);
});

test("City can materialize a street, plaza and two houses with caller IDs and detached immutable results", () => {
  const initial = {
    ...newCityDocument("new-city", "Neues Dorf"),
    plots: town().plots,
    districts: town().districts,
  };
  const building = house("new-house"),
    plaza = { id: "plaza", name: "Markt", outline: square(30) };
  const edits: CityEdit[] = [
    { kind: "add-road", nodes: town().roadNodes, road: town().roads[0]! },
    { kind: "add-building", building },
    { kind: "add-building", building: house("second-house") },
    { kind: "add-plaza", plaza },
  ];
  const result = editCity(initial, edits),
    expected = encode(result);
  assert.equal(result.buildings.length, 2);
  assert.equal(result.plazas[0]!.id, "plaza");
  assert.equal(encode(parseCityDocument(expected)), expected);
  assert(!Object.isFrozen(initial));
  assert(!Object.isFrozen(building));
  assert(!Object.isFrozen(plaza));
  assert(!Object.isFrozen(edits));
  Object.assign(building.position, { x: 999 });
  Object.assign(plaza.outline.outer[0]!, { x: 999 });
  assert.equal(encode(result), expected);
  assert(Object.isFrozen(result.plazas[0]!.outline.outer[0]));
});

test("City edit identity guards reject reuse, repeated writes, missing targets and invalid road geometry", () => {
  const initial = town(),
    road = initial.roads[0]!;
  for (const edits of [
    [
      { kind: "remove-building", buildingId: "house" },
      { kind: "add-building", building: house() },
    ],
    [
      { kind: "add-building", building: house("temp") },
      { kind: "remove-building", buildingId: "temp" },
    ],
    [
      { kind: "remove-building", buildingId: "house" },
      { kind: "add-road", nodes: [], road: { ...road, id: "house" } },
    ],
    [
      { kind: "move-node", nodeId: "center", point: { x: 1, y: 1 } },
      { kind: "move-node", nodeId: "center", point: { x: 2, y: 2 } },
    ],
    [{ kind: "remove-road", roadId: "house" }],
    [{ kind: "remove-building", buildingId: "missing" }],
    [
      {
        kind: "replace-road",
        roadId: road.id,
        road: { ...road, id: "changed" },
      },
    ],
    [
      {
        kind: "replace-road",
        roadId: road.id,
        road: { ...road, endNodeId: "missing" },
      },
    ],
    [
      {
        kind: "replace-road",
        roadId: road.id,
        road: { ...road, widthMeters: 0 },
      },
    ],
    [{ kind: "move-node", nodeId: "west", point: { x: 0, y: 0 } }],
    [{ kind: "add-road", nodes: [], road: { ...road, id: "other-house" } }],
  ])
    reject(initial, edits);
});

test("City edits reject metadata, accessors, sparse lists and invalid initial data before destructive actions", () => {
  const initial = town(),
    valid = { kind: "move-node", nodeId: "center", point: { x: 1, y: 2 } },
    before = encode(initial);
  let calls = 0;
  const getter = { ...valid };
  Object.defineProperty(getter, "point", {
    get() {
      calls++;
      return { x: 1, y: 2 };
    },
  });
  const accessor: unknown[] = [];
  Object.defineProperty(accessor, "0", {
    get() {
      calls++;
      return valid;
    },
  });
  class Custom extends Array {}
  for (const edits of [
    new Array(1),
    accessor,
    new Custom(),
    Object.assign([valid], { future: 1 }),
    [{ ...valid, future: 1 }],
    [getter],
    [{ kind: "unknown" }],
    [{ ...valid, point: { x: 1, y: 2, future: 1 } }],
    [{ kind: "add-building", building: { ...house("new"), future: 1 } }],
  ])
    reject(initial, edits);
  assert.equal(calls, 0);
  reject({ ...initial, buildings: [{ ...house(), scale: { x: 0, y: 1 } }] }, [
    { kind: "remove-building", buildingId: "house" },
  ]);
  reject(initial, [valid, { kind: "remove-building", buildingId: "missing" }]);
  assert.equal(encode(initial), before);
  const empty = editCity(initial, []);
  assert.notEqual(empty, initial);
  assert.deepEqual(empty, initial);
});

test("City edit packages use one real shared history step and reject stale gestures without changing another owner", () => {
  const history = new AtlasHistory(),
    initial = town(),
    source = new CitySource(initial, history),
    other = new CitySource({ ...initial, id: "other-city" }, history);
  const before = source.read(),
    after = editCity(before, [
      { kind: "move-node", nodeId: "center", point: { x: 3, y: 4 } },
      {
        kind: "set-building-pose",
        buildingId: "house",
        position: { x: 50, y: -70 },
        rotationRadians: 1,
        scale: { x: 1.3, y: 0.7 },
      },
    ]);
  const gesture = cityDocumentChange(before, after),
    otherBefore = encode(other.read());
  history.execute({ label: "Straße und Haus", changes: [gesture] });
  assert.equal(history.undoDepth, 1);
  assert.throws(
    () => history.execute({ label: "stale", changes: [gesture] }),
    /kollidiert/,
  );
  assert.equal(encode(other.read()), otherBefore);
  history.undo();
  assert.equal(encode(source.read()), encode(initial));
  assert.equal(
    history.execute({
      label: "empty",
      changes: [cityDocumentChange(before, editCity(before, []))],
    }),
    false,
  );
  assert(history.canRedo);
  history.redo();
  assert.equal(encode(source.read()), encode(after));
  assert.equal(encode(other.read()), otherBefore);
});
