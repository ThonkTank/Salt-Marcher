import test from "node:test";
import assert from "node:assert/strict";
import type { Point } from "../../src/model";
import { AtlasHistory } from "../../src/features/atlas/atlas-history";
import { newOverworld } from "../../src/features/atlas/overworld";
import {
  TerrainSource,
  TerrainStroke,
} from "../../src/features/atlas/terrain-source";
import {
  panAtlas,
  zoomAtlas,
  worldToScreen,
  screenToWorld,
} from "../../src/features/atlas/camera";
import {
  CitySource,
  cityDocumentChange,
} from "../../src/features/city/commands";
import { newCityDocument } from "../../src/features/city/codec";
import {
  CityGesture,
  type CityGestureTarget,
} from "../../src/features/city/gestures";
import {
  cityBuildingPoint,
  cityBuildingLocalPoint,
  cityBuildingOutline,
} from "../../src/features/city/geometry";
import { editCity } from "../../src/features/city/edit";

function setup(rotationRadians = 0) {
  const history = new AtlasHistory();
  const source = new CitySource(
    {
      ...newCityDocument("city", "Ort"),
      roadNodes: [
        { id: "a", point: { x: 0, y: 0 } },
        { id: "b", point: { x: 20, y: 0 } },
        { id: "c", point: { x: 0, y: 20 } },
        { id: "d", point: { x: -20, y: 0 } },
      ],
      roads: ["b", "c", "d"].map((id) => ({
        id: "road-" + id,
        startNodeId: "a",
        endNodeId: id,
        via: id === "b" ? [{ x: 10, y: 2 }] : [],
        widthMeters: 4,
      })),
      buildings: [
        {
          id: "house",
          name: "Hof",
          footprint: {
            outer: [
              { x: 0, y: 0 },
              { x: 8, y: 0 },
              { x: 6, y: 10 },
              { x: 0, y: 10 },
            ],
            holes: [
              [
                { x: 2, y: 2 },
                { x: 3, y: 2 },
                { x: 3, y: 4 },
                { x: 2, y: 4 },
              ],
            ],
          },
          position: { x: -100, y: 50 },
          rotationRadians,
          scale: { x: 1, y: 1 },
        },
      ],
    },
    history,
  );
  return { history, source, house: source.read().buildings[0]! };
}
const building = (
  kind: "move-building" | "rotate-building" | "scale-building",
  axes: "both" | "x" | "y" = "both",
): CityGestureTarget =>
  kind === "scale-building"
    ? { kind, ownerId: "city", buildingId: "house", axes }
    : { kind, ownerId: "city", buildingId: "house" };
function near(a: Point, b: Point, tolerance = 1e-9) {
  assert(Math.abs(a.x - b.x) <= tolerance, `${a.x} != ${b.x}`);
  assert(Math.abs(a.y - b.y) <= tolerance, `${a.y} != ${b.y}`);
}
const pivotLocal = { x: 4, y: 5 };

test("City point poses round-trip rotated asymmetric courtyard geometry without freezing inputs", () => {
  const { house } = setup();
  for (const position of [
    { x: -100, y: 50 },
    { x: 1e9, y: -1e9 },
  ]) {
    const pose = {
      ...house,
      position,
      rotationRadians: 0.71,
      scale: { x: 1.7, y: 0.3 },
    };
    const outline = cityBuildingOutline(pose);
    const points = [...pose.footprint.outer, ...pose.footprint.holes.flat()];
    const actual = [...outline.outer, ...outline.holes.flat()];
    points.forEach((point, i) => {
      assert.deepEqual(cityBuildingPoint(pose, point), actual[i]);
      near(
        cityBuildingLocalPoint(pose, actual[i]!),
        point,
        position.x === 1e9 ? 1e-6 : 1e-12,
      );
    });
    assert(!Object.isFrozen(position));
    assert(Object.isFrozen(outline.holes[0]![0]));
  }
  for (const pose of [
    { ...house, scale: { x: 0, y: 1 } },
    { ...house, rotationRadians: Infinity },
  ])
    assert.throws(() => cityBuildingPoint(pose, { x: 0, y: 0 }));
  assert.throws(() =>
    cityBuildingPoint(
      {
        ...house,
        position: { x: Number.MAX_VALUE, y: 0 },
        scale: { x: Number.MAX_VALUE, y: 1 },
      },
      { x: 2, y: 0 },
    ),
  );
  assert.throws(() =>
    cityBuildingLocalPoint(
      { ...house, scale: { x: Number.MIN_VALUE, y: 1 } },
      { x: 100, y: 0 },
    ),
  );
});

test("City house dragging retains pointer offset, final absolute movement and exactly one undo", () => {
  const { history, source, house } = setup(),
    before = source.read();
  const address = building("move-building"),
    start = { x: -97, y: 53 };
  const gesture = new CityGesture(source, address, start);
  Object.assign(start, { x: 900 });
  Object.assign(address, { buildingId: "missing" });
  gesture.update({ x: -90, y: 60 });
  const preview = gesture.update({ x: -87, y: 63 });
  assert.deepEqual(preview.document.buildings[0]!.position, { x: -90, y: 60 });
  assert.deepEqual(preview.document.buildings[0]!.footprint, house.footprint);
  assert.deepEqual(source.read(), before);
  assert.equal(history.undoDepth, 0);
  assert.equal(gesture.target.kind, "move-building");
  assert(Object.isFrozen(gesture.target));
  assert(gesture.apply("Haus ziehen"));
  assert.equal(history.undoDepth, 1);
  assert.throws(() => gesture.update({ x: 0, y: 0 }));
  assert.equal(gesture.state, "applied");
  assert.equal(gesture.cancel(), false);
  history.undo();
  assert.deepEqual(source.read(), before);
  history.redo();
  assert.deepEqual(source.read(), preview.document);
});

test("City T-junction and one via handle preserve all other referenced street geometry", () => {
  const { history, source } = setup(),
    before = source.read();
  const node = new CityGesture(
    source,
    { kind: "move-node", ownerId: "city", nodeId: "a" },
    { x: 1, y: 1 },
  );
  const moved = node.update({ x: 4, y: 6 });
  assert.deepEqual(moved.document.roadNodes[0]!.point, { x: 3, y: 5 });
  assert.deepEqual(moved.document.roads, before.roads);
  assert(node.apply("Knoten"));
  const roadBefore = source.read();
  const via = new CityGesture(
    source,
    { kind: "move-road-point", ownerId: "city", roadId: "road-b", viaIndex: 0 },
    { x: 11, y: 3 },
  );
  const after = via.update({ x: 15, y: 6 }).document;
  assert.deepEqual(after.roads[0]!.via, [{ x: 14, y: 5 }]);
  assert.deepEqual(after.roadNodes, roadBefore.roadNodes);
  assert.deepEqual(after.roads.slice(1), roadBefore.roads.slice(1));
  assert(via.apply("Verlauf"));
  assert.equal(history.undoDepth, 2);
  history.undo();
  assert.deepEqual(source.read(), roadBefore);
  history.undo();
  assert.deepEqual(source.read(), before);
});

test("City building rotation and axis grips preserve the actual courtyard pivot", () => {
  for (const axes of ["both", "x", "y"] as const)
    for (const angle of [0, 0.71]) {
      const { source, house } = setup(angle);
      const start = cityBuildingPoint(house, { x: 8, y: 10 });
      const gesture = new CityGesture(
        source,
        building("scale-building", axes),
        start,
      );
      const pointer = cityBuildingPoint(house, { x: 12, y: 15 });
      const changed = gesture.update(pointer).document.buildings[0]!;
      near(changed.scale, {
        x: axes === "y" ? 1 : 2,
        y: axes === "x" ? 1 : 2,
      });
      near(
        cityBuildingPoint(changed, pivotLocal),
        cityBuildingPoint(house, pivotLocal),
      );
      assert.deepEqual(changed.footprint, house.footprint);
    }
  const { source, house } = setup();
  const pivot = cityBuildingPoint(house, pivotLocal);
  const rotation = new CityGesture(source, building("rotate-building"), {
    x: pivot.x + 10,
    y: pivot.y,
  });
  const changed = rotation.update({ x: pivot.x, y: pivot.y + 10 }).document
    .buildings[0]!;
  assert.equal(changed.rotationRadians, Math.PI / 2);
  near(cityBuildingPoint(changed, pivotLocal), pivot);
  const original = cityBuildingOutline(house),
    rotated = cityBuildingOutline(changed);
  for (let i = 0; i < original.holes[0]!.length; i++) {
    const p = original.holes[0]![i]!;
    near(rotated.holes[0]![i]!, {
      x: pivot.x - (p.y - pivot.y),
      y: pivot.y + (p.x - pivot.x),
    });
  }
});

test("Unchanged City transform pointers preserve exact poses and redo despite pivot rounding", () => {
  const { history, source } = setup();
  const initial = source.read();
  const after = editCity(initial, [
    {
      kind: "set-building-pose",
      buildingId: "house",
      position: { x: 0.01, y: -0.55 },
      rotationRadians: 0.73,
      scale: { x: 1.7, y: 0.3 },
    },
  ]);
  history.execute({
    label: "pose",
    changes: [cityDocumentChange(initial, after)],
  });
  const edited = source.read();
  history.execute({
    label: "move",
    changes: [
      cityDocumentChange(
        edited,
        editCity(edited, [
          { kind: "move-node", nodeId: "c", point: { x: 0, y: 30 } },
        ]),
      ),
    ],
  });
  history.undo();
  const house = source.read().buildings[0]!,
    start = cityBuildingPoint(house, { x: 8, y: 10 });
  for (const kind of ["rotate-building", "scale-building"] as const) {
    const gesture = new CityGesture(source, building(kind), start);
    assert.deepEqual(gesture.update(start).document, edited);
    assert.equal(gesture.apply("unchanged"), false);
    assert(history.canRedo);
  }
  const separate = setup();
  const axisStart = cityBuildingPoint(separate.house, { x: 8, y: 10 });
  const axis = new CityGesture(
    separate.source,
    building("scale-building", "x"),
    axisStart,
  );
  assert.deepEqual(
    axis.update({ x: axisStart.x, y: axisStart.y + 10 }).document,
    separate.source.read(),
  );
  assert.equal(axis.apply("irrelevant axis"), false);
});

test("Invalid pointer, collapsed edge and bad scale remove prior City previews and recover", () => {
  const { history, source, house } = setup();
  const gesture = new CityGesture(
    source,
    building("scale-building"),
    cityBuildingPoint(house, { x: 8, y: 10 }),
  );
  gesture.update(cityBuildingPoint(house, { x: 12, y: 15 }));
  for (const point of [
    { x: Infinity, y: 1 },
    { x: Number.MAX_VALUE, y: Number.MAX_VALUE },
    cityBuildingPoint(house, { x: 0, y: 0 }),
    cityBuildingPoint(house, pivotLocal),
  ]) {
    gesture.update(cityBuildingPoint(house, { x: 12, y: 15 }));
    assert.throws(() => gesture.update(point));
    assert.equal(gesture.preview, null);
    assert.throws(() => gesture.apply("bad"));
  }
  gesture.update(cityBuildingPoint(house, { x: 12, y: 15 }));
  assert(gesture.apply("corrected"));
  const node = new CityGesture(
    source,
    { kind: "move-node", ownerId: "city", nodeId: "c" },
    { x: 0, y: 20 },
  );
  node.update({ x: 1, y: 21 });
  assert.throws(() => node.update({ x: 0, y: 0 }));
  assert.equal(node.state, "invalid");
  assert.equal(node.preview, null);
  assert.throws(() => node.apply("collapsed"));
  node.update({ x: 0, y: 25 });
  assert(node.apply("corrected node"));
  assert.equal(history.undoDepth, 2);
});

test("City gesture target and lever guards reject malformed input without invoking accessors", () => {
  const { history, source, house } = setup();
  let calls = 0;
  const getter = { ...building("move-building") };
  Object.defineProperty(getter, "buildingId", {
    get() {
      calls++;
      return "house";
    },
  });
  const discriminant = { ...building("move-building") };
  Object.defineProperty(discriminant, "kind", {
    get() {
      calls++;
      return "move-building";
    },
  });
  for (const t of [
    getter,
    discriminant,
    { ...building("move-building"), ownerId: "other" },
    { ...building("move-building"), extra: 1 },
    { ...building("move-building"), buildingId: "a" },
    { kind: "unknown", ownerId: "city", buildingId: "house" },
    {
      kind: "move-road-point",
      ownerId: "city",
      roadId: "road-b",
      viaIndex: 0.5,
    },
    { kind: "move-road-point", ownerId: "city", roadId: "road-b", viaIndex: 1 },
  ])
    assert.throws(
      () => new CityGesture(source, t as CityGestureTarget, { x: 0, y: 0 }),
    );
  const p = { x: 0, y: 0 };
  Object.defineProperty(p, "x", {
    get() {
      calls++;
      return 0;
    },
  });
  assert.throws(() => new CityGesture(source, building("move-building"), p));
  assert.throws(
    () =>
      new CityGesture(
        source,
        building("rotate-building"),
        cityBuildingPoint(house, pivotLocal),
      ),
  );
  assert.throws(
    () =>
      new CityGesture(
        source,
        building("scale-building"),
        cityBuildingPoint(house, { x: 4, y: 10 }),
      ),
  );
  const ready = new CityGesture(source, building("move-building"), {
    x: 0,
    y: 0,
  });
  ready.update({ x: 1, y: 1 });
  assert.throws(() => ready.update(p));
  assert.equal(ready.preview, null);
  assert.equal(calls, 0);
  assert.equal(history.undoDepth, 0);
});

test("Real terrain and concurrent City changes keep one gesture owner and history conflict boundary", async () => {
  const { history, source } = setup(),
    world = newOverworld("world", "Welt", "pointy");
  const terrain = new TerrainSource(world, history, async () => {
    throw Error("no files");
  });
  await terrain.ensure([{ q: 0, r: 0 }]);
  const gesture = new CityGesture(source, building("move-building"), {
    x: 0,
    y: 0,
  });
  gesture.update({ x: 10, y: 10 });
  const stroke = new TerrainStroke(terrain, "forest");
  stroke.add({ q: 0, r: 0 });
  assert(stroke.finish());
  assert(gesture.apply("city"));
  history.undo();
  assert.equal(terrain.read({ q: 0, r: 0 })?.terrain, "forest");
  history.redo();
  const stale = new CityGesture(source, building("move-building"), {
    x: 0,
    y: 0,
  });
  stale.update({ x: 20, y: 20 });
  const before = source.read();
  const after = editCity(before, [
    { kind: "remove-building", buildingId: "house" },
  ]);
  history.execute({
    label: "foreign",
    changes: [cityDocumentChange(before, after)],
  });
  assert.throws(() => stale.apply("stale"), /kollidiert/);
  assert.equal(stale.state, "failed");
  assert.throws(() => stale.update({ x: 30, y: 30 }));
  assert.equal(stale.state, "failed");
  assert(stale.cancel());
  assert.deepEqual(source.read(), after);
  assert.equal(history.undoDepth, 3);
});

test("Current Atlas camera projections supply the same bound local gesture across pan and zoom", () => {
  const { source } = setup();
  const gesture = new CityGesture(source, building("move-building"), {
    x: -97,
    y: 53,
  });
  let camera = { center: { x: -100, y: 50 }, metersPerPixel: 0.1 };
  for (const viewport of [
    { width: 800, height: 600 },
    { width: 1200, height: 700 },
  ]) {
    camera = panAtlas(camera, 23, -17);
    camera = zoomAtlas(camera, viewport, { x: 250, y: 150 }, 0.5);
    const local = { x: -87, y: 63 };
    const screen = worldToScreen(camera, viewport, local);
    const input = screenToWorld(camera, viewport, screen);
    near(gesture.update(input).document.buildings[0]!.position, {
      x: -90,
      y: 60,
    });
    assert.equal(gesture.target.ownerId, "city");
  }
  assert.equal(gesture.state, "editing");
  assert(gesture.cancel());
});

test("Rotated irrelevant-axis motions preserve exact City pose and redo at different coordinate magnitudes", () => {
  for (const angle of [0.3, 0.71, 0.73, 1.2])
    for (const axes of ["x", "y"] as const)
      for (const large of [false, true]) {
        const { history, source } = setup(angle);
        const before = source.read(),
          base = before.buildings[0]!;
        const house = {
          ...base,
          position: large ? { x: 1e9, y: -1e9 } : base.position,
          scale: { x: 1.7, y: 0.3 },
        };
        history.execute({
          label: "pose",
          changes: [
            cityDocumentChange(before, { ...before, buildings: [house] }),
          ],
        });
        const posed = source.read();
        history.execute({
          label: "redo candidate",
          changes: [
            cityDocumentChange(
              posed,
              editCity(posed, [
                { kind: "move-node", nodeId: "c", point: { x: 0, y: 30 } },
              ]),
            ),
          ],
        });
        history.undo();
        const start = cityBuildingPoint(house, { x: 8, y: 10 }),
          pointer = cityBuildingPoint(
            house,
            axes === "x" ? { x: 8, y: 20 } : { x: 16, y: 10 },
          );
        const gesture = new CityGesture(
          source,
          building("scale-building", axes),
          start,
        );
        assert.deepEqual(gesture.update(pointer).document, posed);
        assert.equal(gesture.apply("irrelevant axis"), false);
        assert.equal(history.undoDepth, 1);
        assert(history.canRedo);
      }
});

test("Scale roundoff handling preserves meaningful tiny changes, negative grips and rejects reflection", () => {
  const { history, source } = setup(0.71),
    before = source.read();
  const original = before.buildings[0]!;
  const house = {
    ...original,
    position: { x: 0, y: 0 },
    scale: { x: 0.001, y: 0.001 },
  };
  history.execute({
    label: "millimeter house",
    changes: [cityDocumentChange(before, { ...before, buildings: [house] })],
  });
  const start = cityBuildingPoint(house, { x: 8, y: 10 });
  const gesture = new CityGesture(
    source,
    building("scale-building", "x"),
    start,
  );
  const preview = gesture.update(
    cityBuildingPoint(house, { x: 8 + 1e-7, y: 10 }),
  );
  assert(preview.document.buildings[0]!.scale.x > house.scale.x);
  assert(gesture.apply("tiny real change"));
  const current = source.read().buildings[0]!;
  const negative = new CityGesture(
    source,
    building("scale-building"),
    cityBuildingPoint(current, { x: 0, y: 0 }),
  );
  near(
    negative.update(cityBuildingPoint(current, { x: -4, y: -5 })).document
      .buildings[0]!.scale,
    { x: current.scale.x * 2, y: current.scale.y * 2 },
  );
  assert.throws(() =>
    negative.update(cityBuildingPoint(current, { x: 8, y: 10 })),
  );
  assert.equal(negative.preview, null);
  assert.throws(() => negative.apply("reflection"));
  assert.throws(
    () =>
      new CityGesture(
        source,
        building("scale-building", "x"),
        cityBuildingPoint(current, { x: 4, y: 10 }),
      ),
  );
  negative.cancel();
});

test("An unselected large axis does not hide a real independent millimeter-house scale change", () => {
  for (const axes of ["x", "y"] as const) {
    const { history, source } = setup(),
      before = source.read();
    const house = {
      ...before.buildings[0]!,
      position: { x: 0, y: 0 },
      scale: { x: 0.001, y: 0.001 },
    };
    history.execute({
      label: "small house",
      changes: [cityDocumentChange(before, { ...before, buildings: [house] })],
    });
    const posed = source.read(),
      start = cityBuildingPoint(house, { x: 8, y: 10 });
    const gesture = new CityGesture(
      source,
      building("scale-building", axes),
      start,
    );
    const point =
      axes === "x"
        ? { x: start.x + 1e-10, y: 1e6 }
        : { x: 1e6, y: start.y + 1e-10 };
    const after = gesture.update(point).document;
    assert(after.buildings[0]!.scale[axes] > house.scale[axes]);
    assert.equal(
      after.buildings[0]!.scale[axes === "x" ? "y" : "x"],
      house.scale[axes === "x" ? "y" : "x"],
    );
    assert(gesture.apply("small selected-axis change"));
    assert.equal(history.undoDepth, 2);
    history.undo();
    assert.deepEqual(source.read(), posed);
    history.redo();
    assert.deepEqual(source.read(), after);
  }
});
