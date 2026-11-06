import { decideLod } from "./lod";
import { expect, it } from "vitest";
import type { Gesture } from "./interaction";
import { canEdit, editorScene, terrainBrushInfo } from "./editorView";
import { initialSelection, type Tool } from "./editorSelection";
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
