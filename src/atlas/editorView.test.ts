import type { ToolSettings } from "./useEditorTools";
import type { MapFeature } from "./generated/MapFeature";
import { defaultPopulation, type Road, type WorldPoint } from "./model";
import { idleWorkflow } from "./editorWorkflow";
import { decideDoubleClick, decidePointerDown } from "./interaction";
import { decideLod, viewScale } from "./lod";
import { expect, it } from "vitest";
import type { Gesture } from "./interaction";
import {
  canEdit,
  editorScene,
  editorInput,
  terrainBrushInfo,
  toolScaleRestriction,
} from "./editorView";
import {
  initialSelection,
  type Tool,
  type EditorSelection,
} from "./editorSelection";
import type { Presentation } from "./presentationLoader";
import { status, workflowObjects } from "../../tests/support/atlasFixtures";

it.each<{
  tool: Tool;
  interior: boolean;
  scale: number;
  pending: number;
  expected: boolean;
}>([
  { tool: "house", interior: false, scale: 3.2, pending: 1, expected: false },
  { tool: "road", interior: false, scale: 0.01, pending: 0, expected: true },
  { tool: "house", interior: false, scale: 0.01, pending: 0, expected: false },
  { tool: "select", interior: true, scale: 0.01, pending: 0, expected: false },
  { tool: "draw", interior: true, scale: 1.28, pending: 1, expected: true },
  { tool: "select", interior: true, scale: 1.28, pending: 1, expected: true },
  { tool: "select", interior: false, scale: 1.28, pending: 1, expected: false },
])(
  "edit readiness: $tool, interior=$interior, scale=$scale, pending=$pending",
  ({ tool, interior, scale, pending, expected }) => {
    const gate = { pending, exclusive: false, uncertain: false };
    expect(canEdit(tool, interior, decideLod(scale), true, gate)).toBe(
      expected,
    );
    expect(canEdit(tool, interior, decideLod(scale), false, gate)).toBe(false);
    expect(
      canEdit(tool, interior, decideLod(scale), true, {
        ...gate,
        exclusive: true,
      }),
    ).toBe(false);
    expect(
      canEdit(tool, interior, decideLod(scale), true, {
        ...gate,
        uncertain: true,
      }),
    ).toBe(false);
  },
);

it("shares scale restrictions with edit readiness across hysteresis", () => {
  const gate = { pending: 0, exclusive: false, uncertain: false };
  const check = (
    lod: ReturnType<typeof decideLod>,
    interior: boolean,
    cases: [Tool, "detail" | "localBrush" | null][],
  ) => {
    for (const [tool, restriction] of cases) {
      expect(toolScaleRestriction(tool, interior, lod)).toBe(restriction);
      expect(canEdit(tool, interior, lod, true, gate)).toBe(
        restriction === null,
      );
    }
  };
  const cold = decideLod(1.27);
  expect(cold.atlasLevel).toBe(2);
  check(cold, false, [
    ["house", "detail"],
    ["scenery", null],
    ["area", null],
    ["water", null],
    ["river", null],
    ["road", null],
    ["select", null],
    ["terrain", null],
    ["regions", null],
  ]);
  const retained = decideLod(1.27, decideLod(1.28));
  expect(retained.atlasLevel).toBe(2);
  check(retained, false, [
    ["house", null],
    ["scenery", null],
  ]);
  check(decideLod(0.31), false, [
    ["area", null],
    ["scenery", null],
    ["water", "localBrush"],
    ["house", "detail"],
    ["road", null],
    ["river", null],
    ["terrain", null],
  ]);
  check(cold, true, [
    ["draw", "detail"],
    ["select", "detail"],
    ["area", "detail"],
  ]);
  check(decideLod(1.28), true, [
    ["draw", null],
    ["select", null],
  ]);
  expect(toolScaleRestriction("road", false, cold)).toBeNull();
  expect(canEdit("road", false, cold, false, gate)).toBe(false);
  expect(canEdit("road", false, cold, true, { ...gate, exclusive: true })).toBe(
    false,
  );
  expect(canEdit("road", false, cold, true, { ...gate, uncertain: true })).toBe(
    false,
  );
  for (const tool of [
    "draw",
    "erase",
    "assign",
    "opening",
    "stairs",
    "select",
  ] as const)
    expect(
      canEdit(tool, true, decideLod(1.28), true, { ...gate, pending: 1 }),
    ).toBe(true);
  for (const tool of ["select", "house"] as const)
    expect(
      canEdit(tool, false, decideLod(1.28), true, { ...gate, pending: 1 }),
    ).toBe(false);
});

it("keeps the last scene visible while withholding interaction data for another context or selection", () => {
  const { house, parcel } = workflowObjects();
  const presentation: Presentation = {
    scene: {
      status: status(),
      objects: [house, parcel],
      contextState: { exists: true, houseId: house.id, parcelId: parcel.id },
      selectionState: { exists: true, houseId: house.id, parcelId: parcel.id },
    },
    active: house.id,
    context: { kind: "house", houseId: house.id },
    selectedId: house.id,
    floor: 0,
    bounds: [0, 0, 100, 100],
    includeLower: false,
    detail: null,
  };
  const selection = {
    ...initialSelection,
    context: presentation.context,
    selected: house.id,
  };
  expect(editorScene(presentation, selection).house).toBe(house);
  for (const next of [
    initialSelection,
    { ...selection, selected: parcel.id },
  ]) {
    const view = editorScene(presentation, next);
    expect(view.objects).toBe(presentation.scene.objects);
    expect(view.scene).toBeUndefined();
    expect(view.house).toBeUndefined();
    expect(view.selectedObject).toBeUndefined();
  }
});

it("projects idle height sampling independently of display resolution", () => {
  for (const tool of ["terrain", "water"] as const) {
    expect(terrainBrushInfo(tool, null, 25.6, 40, 0)).toEqual({
      diameter: 3.125,
      spacing: 5,
      subgrid: true,
    });
    expect(terrainBrushInfo(tool, null, 25.6, 128, 0)).toEqual({
      diameter: 10,
      spacing: 5,
      subgrid: false,
    });
    expect(terrainBrushInfo(tool, null, 25.6, 64, 0)?.subgrid).toBe(false);
    // A rounded diameter of 5 must not hide a genuinely smaller footprint.
    expect(terrainBrushInfo(tool, null, 1, 2.4999, 0)?.subgrid).toBe(true);
  }
  expect(terrainBrushInfo("terrain", null, 25.6, 40, 2)).toEqual({
    diameter: 3.125,
    spacing: 20,
    subgrid: true,
  });
  expect(terrainBrushInfo("water", null, 25.6, 40, 2)?.spacing).toBe(5);
});

it("uses matching captured brush geometry without mutating settings or pointers", () => {
  const pointer: Extract<Gesture, { kind: "terrain" }> = {
    kind: "terrain",
    pointer: 1,
    start: [0, 0],
    screen: [0, 0],
    brush: {
      radius: 3,
      resolution: 2,
      mode: "raise",
      amount: 10,
      strength: 0.25,
      target: 10,
      points: [[0, 0]],
    },
  };
  const settings = { scale: 0.5, radius: 128, authorLevel: 8 };
  const before = structuredClone({ pointer, settings });
  expect(
    terrainBrushInfo(
      "terrain",
      pointer,
      settings.scale,
      settings.radius,
      settings.authorLevel,
    ),
  ).toEqual({ diameter: 6, spacing: 20, subgrid: true });
  expect(terrainBrushInfo("water", pointer, 25.6, 40, 8)).toEqual({
    diameter: 3.125,
    spacing: 5,
    subgrid: true,
  });
  const water = {
    ...pointer,
    water: true,
    brush: { ...pointer.brush, radius: 2, resolution: undefined },
  };
  expect(terrainBrushInfo("water", water, 1, 128, 8)).toEqual({
    diameter: 4,
    spacing: 5,
    subgrid: true,
  });
  expect(terrainBrushInfo("terrain", water, 25.6, 40, 2)?.spacing).toBe(20);
  const pan: Gesture = {
    kind: "pan",
    pointer: 1,
    start: [0, 0],
    screen: [0, 0],
    camera: { x: 0, y: 0, scale: 1 },
  };
  expect(terrainBrushInfo("terrain", pan, 25.6, 40, 0)?.diameter).toBe(3.125);
  for (const tool of [
    "select",
    "area",
    "scenery",
    "regions",
    "road",
    "river",
    "house",
    "draw",
    "erase",
    "assign",
    "opening",
    "stairs",
  ] as const)
    expect(terrainBrushInfo(tool, pointer, 25.6, 40, 0)).toBeNull();
  expect({ pointer, settings }).toEqual(before);
});

it("keeps street name and separates exact policy from the named view", () => {
  const base = decideLod(viewScale(3));
  const entered = decideLod(1.3, base);
  const held = decideLod(1.2, entered);
  const left = decideLod(1.14, held);
  for (const [lod, exact] of [
    [base, false],
    [entered, true],
    [held, true],
    [left, false],
  ] as const) {
    expect(lod.atlasLevel).toBe(3);
    expect(lod.policy.exact).toBe(exact);
    for (const tool of [
      "select",
      "road",
      "river",
      "water",
      "area",
      "terrain",
      "regions",
    ] as const)
      expect(toolScaleRestriction(tool, false, lod)).toBeNull();
    for (const tool of ["house"] as const)
      expect(toolScaleRestriction(tool, false, lod)).toBe(
        exact ? null : "detail",
      );
  }
});

it("replaces only the selected exact road tile duplicate without creating freshness", () => {
  const { road: original } = workflowObjects();
  const road: Road = {
    ...original,
    width: 2,
    path: [
      [0, 0],
      [5, 0],
    ],
    nodes: [original.nodes[0], { ...original.nodes[1], point: [5, 0] }],
  };
  const tile: MapFeature = {
    id: road.id,
    kind: "road",
    name: "",
    important: false,
    paths: [
      [
        [0, 100],
        [5, 100],
      ],
    ],
    width: 2,
    rank: 10,
    color: "earth",
  };
  const other = {
    ...tile,
    id: "other",
    rank: 1000,
    paths: [
      [
        [0, 200],
        [5, 200],
      ],
    ] as WorldPoint[][],
  };
  const house = { ...tile, id: "house", kind: "house" };
  const presentation: Presentation = {
    scene: {
      status: status(),
      objects: [road],
      contextState: { exists: true, houseId: null, parcelId: null },
      selectionState: { exists: true, houseId: null, parcelId: null },
    },
    active: "",
    context: { kind: "exterior" },
    selectedId: road.id,
    floor: 0,
    bounds: [-200, -200, 200, 200],
    includeLower: false,
    detail: null,
    overview: {
      level: 0,
      tiles: [{ x: 0, y: 0, features: [tile, other, house], density: [] }],
    },
  };
  const selection = { ...initialSelection, selected: road.id };
  const tools: ToolSettings = {
    ground: {
      mode: "paint",
      tip: "soft",
      color: [157, 181, 139],
      diameter: 80,
      opacity: 1,
      flow: 1,
    },
    groundPicker: false,
    brush: { mode: "land", radius: 40, amount: 1, strength: 0.25, target: 10 },
    scenery: { biome: "forest", radius: 40, density: 0.65 },
    contours: true,
    roughness: { amount: 0.33, seed: 1 },
    terrainFollow: { tolerance: 0.1 },
    material: "earth",
    roadWidth: 15,
    opening: "door",
    travel: "up",
    settings: defaultPopulation,
    populateRoad: true,
  };
  const make = (p = presentation, sel = selection, editable = true) => ({
    ...editorInput({
      selection: sel,
      scene: editorScene(p, sel),
      tools,
      view: { planning: undefined, stalePlanParcels: [] },
      presentation: p,
      camera: { x: 0, y: 0, scale: viewScale(3) },
      lod: decideLod(viewScale(3)),
      bounds: p.bounds,
      editable,
      deletion: false,
      revision: 0,
      regions: { selected: "", diameter: 80, mode: "paint", fresh: true },
      river: undefined,
    }),
    workflow: idleWorkflow(),
  });
  const before = structuredClone(presentation);
  const snapshot = make();
  expect(
    snapshot.overviewRoads?.filter((f) => f.id === road.id).map((f) => f.paths),
  ).toEqual([[road.path]]);
  expect(snapshot.overviewRoads).toContain(other);
  expect(snapshot.overviewRoads).toContain(house);
  expect(decideDoubleClick(snapshot, [2.5, 0])).toMatchObject([
    { kind: "intent", intent: { type: "insertRoadNode", roadId: road.id } },
  ]);
  expect(decideDoubleClick(snapshot, [2.5, 100])).toMatchObject([
    { kind: "camera" },
  ]);
  const pointer = {
    pointer: 1,
    button: 0,
    point: [2.5, 100] as WorldPoint,
    screen: [20, 20] as [number, number],
    alt: false,
    space: false,
  };
  expect(decidePointerDown(snapshot, pointer).commands).toMatchObject([
    { kind: "beginGesture", gesture: { kind: "pan" } },
  ]);
  expect(
    decideDoubleClick(make(presentation, selection, false), [2.5, 0]),
  ).toEqual([]);
  const retained = make(presentation, selection, false);
  for (const point of [
    [0, 0],
    [5 + 22 / viewScale(3), 0],
  ] as WorldPoint[]) {
    const decision = decidePointerDown(retained, { ...pointer, point });
    expect(decision.commands.some((c) => c.kind === "intent")).toBe(false);
    expect(
      decision.commands.find((c) => c.kind === "beginGesture")?.gesture.kind,
    ).toBe("pan");
  }
  for (const [p, sel] of [
    [
      { ...presentation, scene: { ...presentation.scene, objects: [] } },
      selection,
    ],
    [presentation, { ...selection, selected: "missing" }],
    [
      presentation,
      { ...selection, context: { kind: "house" as const, houseId: "missing" } },
    ],
  ] satisfies [Presentation, EditorSelection][]) {
    const missing = make(p, sel);
    expect(missing.overviewRoads).toEqual([tile, other, house]);
    expect(decideDoubleClick(missing, [2.5, 100])).toMatchObject(
      sel.context.kind === "exterior" ? [{ kind: "camera" }] : [],
    );
  }
  expect(presentation).toEqual(before);
});
