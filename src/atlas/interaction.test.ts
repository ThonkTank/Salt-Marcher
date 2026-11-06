import { decideLod, viewScale } from "./lod";
import { describe, expect, it } from "vitest";
import {
  evaluateGesture,
  type Gesture,
  decideBlur,
  decideDoubleClick,
  decideKey,
  decidePointerDown,
  decideWheel,
  evaluatePointer,
  evaluateHold,
  snapToRoad,
  type CanvasInputSnapshot,
  type PointerInput,
} from "./interaction";
import { idleWorkflow, geometryState, draftState } from "./editorWorkflow";
import {
  type House,
  type WorldPoint,
  defaultPopulation,
  toWorld,
  type Road,
  type Parcel,
  type Detail,
  type MapObject,
  type Area,
} from "./model";
import { editRoadDraft, extensionRoadDraft, newRoadDraft } from "./roadDraft";

const house = { id: "h", transform: { x: 0, y: 0, angle: 0 } } as House;
const base = {
  pointer: 7,
  start: [0.5, 0.5] as WorldPoint,
  screen: [0, 0] as [number, number],
};
const stairs: Gesture = {
  ...base,
  kind: "stairs",
  house,
  floor: 2,
  travel: "up",
  axis: null,
};
const run = (
  g: Gesture,
  p: WorldPoint,
  screen: [number, number] = [10, 10],
  finish = false,
  pointer = 7,
) => evaluateGesture(g, { pointer, point: p, snapped: p, screen, finish })!;

describe("gesture geometry", () => {
  it("refreshes terrain preview tiles after zoom without changing the stroke", () => {
    const gesture: Gesture = {
      ...base,
      kind: "terrain",
      view: { level: 0, tiles: [[0, 0]] },
      brush: {
        mode: "raise",
        radius: 25,
        amount: 1,
        strength: 0.25,
        target: 10,
        points: [[0, 0]],
      },
    };
    const view = { level: 3, tiles: [[-1, 0] as [number, number]] };
    const snapshot = state({
      terrainView: view,
      workflow: geometryState(
        { ...common, kind: "geometry" },
        { kind: "terrain" },
        gesture,
      ),
    });
    for (const finish of [false, true]) {
      expect(
        evaluatePointer(snapshot, input([20, 4]), finish)?.intent,
      ).toMatchObject({
        type: "terrainStroke",
        view,
        brush: {
          points: [
            [0, 0],
            [20, 4],
          ],
        },
      });
    }
  });
  it("normalizes all pointer directions and up/down travel to the physical lower-floor run", () => {
    for (const travel of ["up", "down"] as const) {
      for (const [direction, dx, dy, reverse] of [
        ["north", 0, -1, "south"],
        ["east", 1, 0, "west"],
        ["south", 0, 1, "north"],
        ["west", -1, 0, "east"],
      ] as const) {
        expect(
          run(
            { ...stairs, travel },
            [0.5 + 10 * dx, 0.5 + 10 * dy],
            [10, 10],
            true,
          ).intent,
        ).toEqual({
          type: "connection",
          buildingId: house.id,
          intent: {
            action: "createStairs",
            floor: travel === "up" ? 2 : 1,
            x: travel === "up" ? 0 : 2 * dx,
            y: travel === "up" ? 0 : 2 * dy,
            direction: travel === "up" ? direction : reverse,
            length: 3,
          },
        });
      }
    }
  });
  it("retains the last axis on a tie and clears the intent on return to the start cell", () => {
    const vertical = run(stairs, [5.5, 15.5]);
    const tie = run(vertical.gesture, [15.5, 15.5]);
    expect(tie.intent).toMatchObject({
      intent: { direction: "south", length: 4 },
    });
    const back = run(tie.gesture, [4.5, 4.5]);
    expect(back.intent).toBeNull();
  });
  it("marks length 65 invalid but leaves domain validation to the core", () => {
    expect(run(stairs, [315.5, 0.5]).guide?.invalid).toBe(false);
    const long = run(stairs, [320.5, 0.5]);
    expect(long.guide?.invalid).toBe(true);
    expect(long.intent).toMatchObject({ intent: { length: 65 } });
  });
  it("evaluates click and rectangle on finish, and does not fall back after an exception", () => {
    const g: Gesture = {
      ...base,
      kind: "interiorRectangle",
      house,
      floor: 4,
      tool: "draw",
      room: "",
    };
    expect(run(g, [1, 1], [1, 1], true).intent).toMatchObject({
      intent: { cells: [[0, 0]], floor: 4 },
    });
    expect(run(g, [10.5, 5.5], [10, 10], true).intent).toMatchObject({
      intent: {
        cells: [
          [0, 0],
          [1, 0],
          [2, 0],
          [0, 1],
          [1, 1],
          [2, 1],
        ],
      },
    });
    const assign: Gesture = {
      ...base,
      kind: "interiorRectangle",
      house,
      floor: 4,
      tool: "assign",
      room: "",
    };
    expect(run(assign, [1, 1], [1, 1], true)).toMatchObject({
      intent: null,
      error: null,
    });
    expect(run(assign, [10, 10]).error).toContain("Raum auswählen");
    const invalid = run(g, [5000, 5000], [10, 10], true);
    expect(invalid.intent).toBeNull();
    expect(invalid.error).toContain("100.000");
  });
  it("ignores a foreign pointer, cancels explicitly, and clears a moved area at origin", () => {
    expect(
      evaluateGesture(stairs, {
        pointer: 8,
        point: [1, 1],
        snapped: [1, 1],
        screen: [1, 1],
        finish: true,
      }),
    ).toBeNull();
    const area: Gesture = {
      ...base,
      kind: "moveArea",
      object: {
        kind: "area",
        id: "a",
        order: 1,
        material: "earth",
        points: [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
      },
    };
    expect(run(area, [10, 10]).intent).not.toBeNull();
    const back = run(area, base.start, [0, 0], true);
    expect(back.intent).toBeNull();
    expect(back.draft).toBeNull();
  });
});

const road: Road = {
  kind: "road",
  id: "road",
  name: "R",
  material: "earth",
  width: 2,
  nodes: [
    { id: "a", point: [0, 0], incoming: [0, 0], outgoing: [0, 0] },
    { id: "b", point: [50, 0], incoming: null, outgoing: null },
  ],
  path: [
    [0, 0],
    [50, 0],
  ],
  edgeSections: ["s"],
  sections: [{ id: "s", populatedSides: [] }],
  populationRecipe: null,
};
const hitHouse: House = {
  kind: "house",
  importantPlace: false,
  foundation: { height: 1, transition: 10 },
  id: "house",
  name: "H",
  roof: "red",
  placement: { kind: "free" },
  transform: { x: 0, y: 0, angle: 0 },
  contours: [
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ],
  ],
  occupancyContours: [],
  occupancyBounds: [0, 0, 20, 20],
};
const parcel: Parcel = {
  kind: "parcel",
  id: "parcel",
  source: { kind: "detached" },
  frame: { x: 0, y: 0, angle: 0 },
  polygon: [
    [-10, -10],
    [30, -10],
    [30, 30],
    [-10, 30],
  ],
};
const area = (id: string, order: number): Area => ({
  kind: "area",
  id,
  order,
  material: "grass",
  points: parcel.polygon,
});
const status = {
  sessionId: "s",
  revision: 0,
  path: null,
  dirty: false,
  canUndo: false,
  canRedo: false,
  changes: null,
};
const state = (
  patch: Partial<CanvasInputSnapshot> = {},
): CanvasInputSnapshot => ({
  workflow: idleWorkflow(),
  camera: { x: 160, y: 120, scale: 2 },
  editable: true,
  deletion: false,
  tool: "select",
  selected: "",
  selectedObject: undefined,
  context: { kind: "exterior" },
  floor: 0,
  room: "",
  connection: "",
  scene: {
    status,
    objects: [],
    contextState: { exists: true, parcelId: null, houseId: null },
    selectionState: { exists: false, parcelId: null, houseId: null },
  },
  detail: null,
  house: undefined,
  parcel: undefined,
  selectionParcel: undefined,
  boundaries: [parcel.id],
  roadWidth: 15,
  material: "earth",
  opening: "door",
  travel: "up",
  populateRoad: false,
  settings: defaultPopulation,
  ...patch,
  lod: patch.lod ?? decideLod(patch.camera?.scale ?? 2),
});
const input = (
  point: WorldPoint = [2.5, 2.5],
  patch: Partial<PointerInput> = {},
): PointerInput => ({
  pointer: 7,
  button: 0,
  point,
  screen: [100, 100],
  alt: false,
  space: false,
  ...patch,
});
const sceneState = (
  objects: MapObject[],
  patch: Partial<CanvasInputSnapshot> = {},
) => {
  const snapshot = state(patch);
  return { ...snapshot, scene: { ...snapshot.scene!, objects } };
};
const gestureOf = (snapshot: CanvasInputSnapshot, point?: WorldPoint) =>
  decidePointerDown(snapshot, input(point)).commands.find(
    (c) => c.kind === "beginGesture",
  )?.gesture;
const common = {
  id: 1,
  context: "exterior:0",
  sessionId: "s",
  guide: null,
  navigation: null,
  basis: { sessionId: "s", revision: 0 },
  candidate: null,
  rollback: null,
  stage: { phase: "editing" as const },
};
const detail: Detail = {
  status,
  buildingId: hitHouse.id,
  floor: 0,
  bounds: [0, 0, 4, 4],
  includeLower: false,
  cells: [{ x: 0, y: 0, floor: 0, roomId: "r" }],
  lower: [],
  rooms: [],
  connections: [
    {
      id: "door",
      created: 1,
      offset: 0,
      fromRoom: "r",
      toRoom: null,
      floor: 0,
      x: 0,
      y: 0,
      type: "opening",
      kind: "door",
      axis: "horizontal",
    },
  ],
};

const brushSettings = {
  ground: {
    mode: "paint" as const,
    tip: "soft" as const,
    color: [10, 20, 30] as [number, number, number],
    diameter: 80,
    opacity: 1,
    flow: 1,
  },
  brush: {
    mode: "raise" as const,
    radius: 40,
    amount: 1,
    strength: 0.25,
    target: 10,
  },
  scenery: {
    biome: "forest" as const,
    radius: 40,
    density: 0.65,
    size: 8,
  },
  region: { id: "r", diameter: 80, mode: "paint" as const },
} satisfies Partial<CanvasInputSnapshot>;

describe("pure canvas input decisions", () => {
  it.each(
    (["area", "terrain", "water", "scenery", "regions"] as const).flatMap(
      (tool) => [2, 8].map((scale) => ({ tool, scale })),
    ),
  )(
    "keeps $tool diameter at 80 CSS pixels (scale $scale)",
    ({ tool, scale }) => {
      const stroke = gestureOf(
        state({
          ...brushSettings,
          camera: { x: 0, y: 0, scale },
          tool,
        }),
      );
      if (!stroke) throw Error("Missing gesture");
      const radius =
        stroke.kind === "ground"
          ? stroke.brush.diameter / 2
          : stroke.kind === "region"
            ? stroke.radius
            : stroke.kind === "terrain" || stroke.kind === "scenery"
              ? stroke.brush.radius
              : 0;
      expect(radius * 2 * scale).toBe(80);
    },
  );

  it("freezes physical author resolution at stroke start across later LOD changes", () => {
    const entered = decideLod(0.4);
    const lod = decideLod(0.37, entered);
    expect(lod.terrainLevel).not.toBe(lod.authorTerrainLevel);
    const gesture = gestureOf(
      state({
        ...brushSettings,
        tool: "terrain",
        camera: { x: 0, y: 0, scale: 0.37 },
        lod,
      }),
    );
    if (gesture?.kind !== "terrain") throw Error("Missing terrain stroke");
    expect(gesture.brush.resolution).toBe(lod.authorTerrainLevel);
    const later = state({
      camera: { x: 0, y: 0, scale: 2 },
      tool: "terrain",
      terrainView: { level: 0, tiles: [[0, 0]] },
      workflow: geometryState(
        { ...common, kind: "geometry" },
        { kind: "terrain" },
        gesture,
      ),
    });
    expect(evaluatePointer(later, input([20, 4]), true)?.intent).toMatchObject({
      type: "terrainStroke",
      brush: { resolution: lod.authorTerrainLevel },
    });
  });

  it("continues held ground flow at the last point with monotonic elapsed time", () => {
    const pointer = gestureOf(state({ ...brushSettings, tool: "area" }));
    if (pointer?.kind !== "ground") throw Error("Missing ground stroke");
    const gesture = {
      ...pointer,
      started: 100,
      brush: {
        ...pointer.brush,
        points: [
          [2, 3, 0],
          [4, 5, 200],
        ] as [number, number, number][],
      },
    };
    const snapshot = state({
      workflow: geometryState(
        {
          ...common,
          kind: "geometry",
          basis: status,
          stage: { phase: "editing" },
        },
        { kind: "ground" },
        gesture,
      ),
    });
    const result = evaluateHold(snapshot, 450);
    expect(result?.intent).toMatchObject({
      type: "groundStroke",
      brush: {
        points: [
          [2, 3, 0],
          [4, 5, 200],
          [4, 5, 350],
        ],
      },
    });
    expect(evaluateHold(snapshot, 150)?.intent).toMatchObject({
      brush: {
        points: [
          [2, 3, 0],
          [4, 5, 200],
          [4, 5, 200],
        ],
      },
    });
    expect(gesture.brush.points).toEqual([
      [2, 3, 0],
      [4, 5, 200],
    ]);
    expect(evaluateHold(state(), 450)).toBeNull();
  });

  it.each(["terrain", "water", "scenery", "regions"] as const)(
    "does not repeat a held %s brush",
    (tool) => {
      const pointer = gestureOf(state({ ...brushSettings, tool }));
      if (
        !pointer ||
        (pointer.kind !== "terrain" &&
          pointer.kind !== "scenery" &&
          pointer.kind !== "region")
      )
        throw Error("Missing brush");
      expect(
        evaluateHold(
          state({
            workflow: geometryState(
              {
                ...common,
                kind: "geometry",
                basis: status,
                stage: { phase: "editing" },
              },
              { kind: pointer.kind },
              pointer,
            ),
          }),
          450,
        ),
      ).toBeNull();
    },
  );

  it("rejects active and foreign pointers and unsupported buttons before focus", () => {
    const snapshot = state({
      workflow: {
        ...idleWorkflow(),
        navigation: { ...base, kind: "pan", camera: state().camera },
      },
    });
    for (const pointer of [7, 8])
      expect(
        decidePointerDown(snapshot, input(undefined, { pointer })),
      ).toEqual({ focus: false, capture: false, commands: [] });
    expect(decidePointerDown(state(), input(undefined, { button: 2 }))).toEqual(
      { focus: false, capture: false, commands: [] },
    );
  });
  it.each([{ button: 1 }, { space: true }])(
    "allows pan ahead of editing and deletion gates: %j",
    (patch) => {
      const snapshot = state({ editable: false, deletion: true });
      const decision = decidePointerDown(snapshot, input(undefined, patch));
      expect(decision).toMatchObject({
        focus: true,
        capture: true,
        commands: [{ kind: "beginGesture", gesture: { kind: "pan" } }],
      });
      expect(decidePointerDown(snapshot, input()).commands).toEqual([]);
    },
  );
  it("prioritizes road handles in incoming/outgoing/point order over interior hits", () => {
    const snapshot = sceneState([hitHouse, road], {
      selected: road.id,
      selectedObject: road,
      house: hitHouse,
      detail,
    });
    expect(gestureOf(snapshot, [0, 0])).toMatchObject({
      kind: "node",
      index: 0,
      handle: "incoming",
    });
    expect(decidePointerDown(snapshot, input([0, 0])).commands[0]).toEqual({
      kind: "selection",
      event: { type: "pointerNode", value: "a" },
    });
  });
  it("prioritizes selected area vertices over active interior connections", () => {
    const a = {
      ...area("a", 1),
      kind: "area" as const,
      points: [
        [2.5, 0],
        [15, 0],
        [0, 15],
      ] as WorldPoint[],
    };
    expect(
      gestureOf(
        sceneState([a, hitHouse], {
          selected: a.id,
          selectedObject: a,
          house: hitHouse,
          detail,
        }),
        [2.5, 0],
      ),
    ).toMatchObject({ kind: "areaPoint", index: 0 });
  });
  it("selects an active connection ahead of room and scene geometry", () => {
    const snapshot = sceneState([hitHouse, road], {
      house: hitHouse,
      detail,
      context: { kind: "house", houseId: hitHouse.id },
    });
    expect(decidePointerDown(snapshot, input([2.5, 0])).commands).toEqual([
      { kind: "selection", event: { type: "pointerConnection", id: "door" } },
      { kind: "selection", event: { type: "pointerRoom", id: "" } },
    ]);
  });
  it("selects a room on its first hit and moves it on a second hit", () => {
    const snapshot = sceneState([hitHouse], {
      house: hitHouse,
      detail,
      context: { kind: "house", houseId: hitHouse.id },
    });
    expect(decidePointerDown(snapshot, input()).commands).toEqual([
      { kind: "selection", event: { type: "pointerConnection", id: "" } },
      { kind: "selection", event: { type: "pointerRoom", id: "r" } },
    ]);
    expect(gestureOf({ ...snapshot, room: "r" })).toMatchObject({
      kind: "roomMove",
      room: "r",
      cells: [[0, 0]],
    });
  });
  it("gives free rotation priority and preserves bound-house grid ownership", () => {
    expect(
      gestureOf(
        sceneState([hitHouse, road], {
          selected: hitHouse.id,
          selectedObject: hitHouse,
        }),
        toWorld([0, -3], hitHouse.transform),
      ),
    ).toMatchObject({ kind: "houseTransform", mode: "rotate" });
    const bound: House = {
      ...hitHouse,
      placement: {
        kind: "parcel",
        parcelId: parcel.id,
        gridPose: { xCells: 0, yCells: 0, quarterTurns: 0 },
      },
    };
    expect(
      gestureOf(
        sceneState([bound], {
          selected: bound.id,
          selectedObject: bound,
          selectionParcel: parcel,
        }),
      ),
    ).toMatchObject({ kind: "houseTransform", mode: "move", parcel });
  });
  it("uses house, road, visible parcel, newest terrain priority regardless of array order", () => {
    const objects = [area("old", 1), hitHouse, road, parcel, area("young", 2)];
    const selectedAt = (items: MapObject[], boundaries = [parcel.id]) =>
      decidePointerDown(
        sceneState(items, { boundaries }),
        input([2.5, 0.5]),
      ).commands.flatMap((c) =>
        c.kind === "selection" && c.event.type === "selectObject"
          ? [c.event.id]
          : [],
      )[0];
    expect(selectedAt(objects)).toBe(hitHouse.id);
    expect(selectedAt(objects.filter((o) => o.kind !== "house"))).toBe(road.id);
    expect(
      selectedAt(
        objects.filter((o) => o.kind !== "house" && o.kind !== "road"),
      ),
    ).toBe(parcel.id);
    expect(selectedAt([area("young", 2), parcel, area("old", 1)], [])).toBe(
      "young",
    );
  });
  it("keeps extension anchors node-free and starts a captured ground stroke", () => {
    const draft = extensionRoadDraft(road, "end", null);
    const workflow = draftState(
      { ...common, kind: "draft" },
      { kind: "extendRoad", draft, nodeIds: road.nodes.map((n) => n.id) },
      null,
    );
    const decision = decidePointerDown(
      state({ tool: "road", workflow }),
      input(road.nodes[1].point),
    );
    expect(decision.commands).toMatchObject([
      { kind: "planParcel", key: null },
      {
        kind: "beginGesture",
        gesture: { kind: "newNode", index: 0, draft: { nodes: [] } },
        rollback: draft,
      },
    ]);
    const ground = {
      mode: "paint" as const,
      tip: "soft" as const,
      color: [157, 181, 139] as [number, number, number],
      diameter: 60,
      opacity: 1,
      flow: 1,
    };
    const areaDecision = decidePointerDown(
      state({ tool: "area", ground }),
      input(),
    );
    expect(areaDecision.capture).toBe(true);
    expect(areaDecision.commands).toMatchObject([
      {
        kind: "beginGesture",
        gesture: {
          kind: "ground",
          brush: { ...ground, diameter: 30, points: [[2.5, 2.5, 0]] },
        },
      },
    ]);
    expect(draft.nodes).toEqual([]);
  });
  it("snaps within eight CSS pixels, bypasses with Alt and excludes the edited road", () => {
    const snapshot = sceneState([road]);
    expect(snapToRoad([20, 3.99], false, snapshot)).toEqual([20, 0]);
    const edge: WorldPoint = [20, 4];
    expect(snapToRoad(edge, false, snapshot)).toBe(edge);
    expect(snapToRoad(edge, true, snapshot)).toBe(edge);
    const g: Gesture = {
      ...base,
      kind: "node",
      object: editRoadDraft(road),
      index: 0,
      handle: "point",
    };
    const workflow = geometryState(
      { ...common, kind: "geometry" },
      { kind: "editRoad", roadId: road.id, nodeIds: ["a", "b"], draft: null },
      g,
    );
    const own = { ...snapshot, workflow, selected: road.id };
    expect(snapToRoad([20, 1], false, own)).toEqual([20, 1]);
    const other = {
      ...road,
      id: "other",
      path: [
        [0, 3],
        [50, 3],
      ] as WorldPoint[],
    };
    const snapState = {
      ...own,
      scene: { ...snapshot.scene!, objects: [road, other] },
    };
    const move = evaluatePointer(snapState, input([20, 4]), false)!;
    const finish = evaluatePointer(snapState, input([20, 4]), true)!;
    expect(move.intent).toEqual(finish.intent);
    expect(finish.draft).toMatchObject({ nodes: [{ point: [20, 3] }, {}] });
    expect(
      evaluatePointer(snapState, input([20, 4], { pointer: 8 }), true),
    ).toBeNull();
    expect(
      evaluatePointer(snapState, input([20, 4], { alt: true }), true)?.draft,
    ).toMatchObject({ nodes: [{ point: [20, 4] }, {}] });
  });
  it.each([
    { point: [0.1, 2.5] as WorldPoint, axis: "vertical", x: 0, y: 0 },
    { point: [4.9, 2.5] as WorldPoint, axis: "vertical", x: 1, y: 0 },
    { point: [2.5, 0.1] as WorldPoint, axis: "horizontal", x: 0, y: 0 },
    { point: [2.5, 4.9] as WorldPoint, axis: "horizontal", x: 0, y: 1 },
    { point: [2.5, 2.5] as WorldPoint, axis: "horizontal", x: 0, y: 1 },
  ])(
    "places openings on their nearest wall, retaining tie behavior: %j",
    ({ point, axis, x, y }) => {
      const snapshot = state({
        tool: "opening",
        house: hitHouse,
        floor: -2,
        opening: "passage",
      });
      expect(decidePointerDown(snapshot, input(point)).commands).toEqual([
        {
          kind: "intent",
          intent: {
            type: "connection",
            buildingId: hitHouse.id,
            intent: {
              action: "createOpening",
              floor: -2,
              x,
              y,
              axis,
              kind: "passage",
            },
          },
        },
      ]);
    },
  );
  it("pins the parcel frame without guessing offscreen house ownership", () => {
    const snapshot = sceneState([parcel], { tool: "house" });
    const gesture = gestureOf(snapshot);
    expect(gesture).toMatchObject({ kind: "houseRectangle", parcel });
    expect(gesture?.kind === "houseRectangle" && gesture.parcel).not.toBe(
      parcel,
    );
    expect(
      gestureOf(
        state({
          tool: "draw",
          parcel,
          context: { kind: "parcel", parcelId: parcel.id },
          floor: -3,
        }),
      ),
    ).toMatchObject({ kind: "parcelRectangle", floor: -3 });
  });
  it("keeps backend road splitting and nearest area-segment insertion", () => {
    const commands = decideDoubleClick(
      state({ selectedObject: road }),
      [20, 0],
    );
    expect(commands).toMatchObject([
      {
        kind: "intent",
        intent: { type: "insertRoadNode", roadId: road.id, afterNodeId: "a" },
      },
    ]);
    expect(
      commands[0].kind === "intent" && commands[0].intent,
    ).not.toHaveProperty("road");
    const a = {
      ...area("a", 0),
      kind: "area" as const,
      points: [
        [0, 0],
        [10, 0],
        [0, 10],
      ] as WorldPoint[],
    };
    expect(
      decideDoubleClick(state({ selectedObject: a }), [5, 0]),
    ).toMatchObject([
      {
        kind: "intent",
        intent: {
          area: {
            points: [
              [0, 0],
              [5, 0],
              [10, 0],
              [0, 10],
            ],
          },
        },
      },
    ]);
    expect(a.points).toHaveLength(3);
    expect(
      decideDoubleClick(state({ selectedObject: hitHouse }), [0, 0]),
    ).toEqual([
      { kind: "selection", event: { type: "openHouse", id: hitHouse.id } },
    ]);
    expect(
      decideDoubleClick(state({ selectedObject: parcel }), [0, 0]),
    ).toEqual([
      { kind: "selection", event: { type: "openParcel", id: parcel.id } },
    ]);
    expect(
      decideDoubleClick(
        state({ selectedObject: road, editable: false }),
        [20, 0],
      ),
    ).toEqual([]);
  });
  it("zooms free exact exterior around the world anchor using the physical level", () => {
    const point: WorldPoint = [23, -11];
    for (const level of [1, 2]) {
      const camera = { x: 105, y: -44, scale: viewScale(level) };
      const commands = decideDoubleClick(state({ camera }), point);
      expect(commands).toHaveLength(1);
      expect(commands[0].kind).toBe("camera");
      if (commands[0].kind !== "camera") throw Error("expected camera");
      const next = commands[0].camera;
      expect(next.scale).toBe(viewScale(level - 1));
      expect(next.x + point[0] * next.scale).toBeCloseTo(
        camera.x + point[0] * camera.scale,
        9,
      );
      expect(next.y + point[1] * next.scale).toBeCloseTo(
        camera.y + point[1] * camera.scale,
        9,
      );
    }
    const measuredCamera = {
      x: -87.90000000000003,
      y: -47.5,
      scale: 6.773333333333333,
    };
    const anchor: WorldPoint = [
      (413 - measuredCamera.x) / measuredCamera.scale,
      (378 - measuredCamera.y) / measuredCamera.scale,
    ];
    const measuredCommands = decideDoubleClick(
      state({ camera: measuredCamera }),
      anchor,
    );
    expect(measuredCommands).toHaveLength(1);
    if (measuredCommands[0].kind !== "camera") throw Error("expected camera");
    const measuredNext = measuredCommands[0].camera;
    expect(measuredNext.scale).toBe(25.6);
    expect(measuredNext.x + anchor[0] * measuredNext.scale).toBeCloseTo(413, 9);
    expect(measuredNext.y + anchor[1] * measuredNext.scale).toBeCloseTo(378, 9);
    const camera = { x: 0, y: 0, scale: 20 };
    const lod = decideLod(camera.scale, decideLod(viewScale(1)));
    expect(lod.navigationLevel).toBe(1);
    expect(decideDoubleClick(state({ camera, lod }), point)).toMatchObject([
      { kind: "camera", camera: { scale: viewScale(0) } },
    ]);
    expect(
      decideDoubleClick(
        state({ camera: { ...camera, scale: viewScale(0) } }),
        point,
      ),
    ).toEqual([]);
  });
  it("requires a fresh free exterior scene and no active workflow", () => {
    const camera = { x: 0, y: 0, scale: viewScale(1) };
    const point: WorldPoint = [2, 0];
    const patches: Partial<CanvasInputSnapshot>[] = [
      { scene: undefined },
      { editable: false },
      { context: { kind: "house", houseId: "h" } },
      { tool: "house" },
      { tool: "road" },
      {
        workflow: geometryState(
          { ...common, kind: "geometry" },
          { kind: "terrain" },
          null,
        ),
      },
      {
        workflow: {
          ...idleWorkflow(),
          navigation: { ...base, kind: "pan", camera },
        },
      },
      {
        planning: {
          road,
          objects: [],
          settings: defaultPopulation,
          selectedKey: null,
        },
      },
      { stalePlanParcels: [parcel] },
    ];
    for (const patch of patches)
      expect(decideDoubleClick(state({ camera, ...patch }), point)).toEqual([]);
    const scenery = {
      kind: "scenery",
      id: "s",
      assets: [{ point, size: 2 }],
    } as MapObject;
    for (const object of [hitHouse, road, parcel, scenery, area("a", 0)])
      expect(
        decideDoubleClick(sceneState([object], { camera }), point),
      ).toEqual([]);
    expect(
      decideDoubleClick(
        sceneState([parcel], { camera, boundaries: [] }),
        point,
      ),
    ).toMatchObject([{ kind: "camera" }]);
  });
  it("leaves form keys local and prevents only existing keyboard defaults", () => {
    const key = {
      key: "Escape",
      code: "Escape",
      ctrl: false,
      meta: false,
      shift: false,
      formTarget: true,
    };
    expect(decideKey(state(), key)).toEqual({
      preventDefault: false,
      space: null,
      commands: [],
    });
    expect(decideKey(state(), { ...key, formTarget: false }).commands).toEqual([
      { kind: "cancelEditor" },
    ]);
    expect(decideKey(state(), { ...key, key: "Delete" }).commands).toEqual([]);
    expect(
      decideKey(state(), { ...key, key: "Enter", formTarget: false }),
    ).toMatchObject({ preventDefault: true, commands: [{ kind: "accept" }] });
    expect(
      decideKey(state({ deletion: true }), {
        ...key,
        key: "Enter",
        formTarget: false,
      }).commands,
    ).toEqual([]);
    expect(
      decideKey(state(), {
        ...key,
        key: " ",
        code: "Space",
        formTarget: false,
      }),
    ).toMatchObject({ preventDefault: true, space: true });
    expect(decideKey(state(), { ...key, key: "q", formTarget: false })).toEqual(
      { preventDefault: false, space: null, commands: [] },
    );
    expect(
      decideKey(state(), {
        ...key,
        key: "Z",
        ctrl: true,
        shift: true,
        formTarget: false,
      }).commands,
    ).toEqual([{ kind: "history", redo: true }]);
    expect(
      decideKey(state(), {
        ...key,
        key: "s",
        meta: true,
        shift: true,
        formTarget: false,
      }).commands,
    ).toEqual([{ kind: "document", kindOfDocument: "saveAs" }]);
    expect(
      decideKey(state(), { ...key, key: "Delete", formTarget: false }).commands,
    ).toEqual([{ kind: "deleteSelection" }]);
  });
  it.each([
    { floor: 2147483647, key: "PageUp" },
    { floor: -2147483648, key: "PageDown" },
  ])("clamps floor navigation at i32 limits: %j", ({ floor, key }) => {
    const event = {
      key,
      code: key,
      ctrl: false,
      meta: false,
      shift: false,
      formTarget: false,
    };
    expect(
      decideKey(
        state({ floor, context: { kind: "parcel", parcelId: parcel.id } }),
        event,
      ).commands,
    ).toEqual([
      {
        kind: "selection",
        event: { type: "stepFloor", delta: key === "PageUp" ? 1 : -1 },
      },
    ]);

    expect(decideKey(state(), event)).toMatchObject({
      preventDefault: true,
      commands: [],
    });
  });
  it("keeps house/parcel/exterior wheel limits, pivot and gesture exclusion", () => {
    for (const context of [
      { kind: "house", houseId: "house" },
      { kind: "parcel", parcelId: "parcel" },
      { kind: "exterior" },
    ] as const) {
      const snapshot = state({ context });
      expect(decideWheel(snapshot, [10, 20], 100000)).toEqual([
        {
          kind: "camera",

          camera: {
            scale: context.kind === "house" ? 1.28 : 0.000002,
            x: 160 + 10 * (2 - (context.kind === "house" ? 1.28 : 0.000002)),
            y: 120 + 20 * (2 - (context.kind === "house" ? 1.28 : 0.000002)),
          },
        },
      ]);
      expect(decideWheel(snapshot, [0, 0], -100000)).toMatchObject([
        { camera: { scale: 25.6 } },
      ]);
    }
    expect(
      decideWheel(
        state({
          workflow: {
            ...idleWorkflow(),
            navigation: { ...base, kind: "pan", camera: state().camera },
          },
        }),
        [0, 0],
        10,
      ),
    ).toEqual([]);
  });
});

describe("river input through the shared decision path", () => {
  const river: NonNullable<CanvasInputSnapshot["river"]> = {
    river: undefined,
    views: [],
    fresh: true,
    width: 20,
    mode: "draw",
    settings: {
      tolerance: 0.1,
      roughness: 0.5,
      meander: 40,
      sourceFade: true,
      seed: 1,
    },
  };
  const riverState = (patch: Partial<CanvasInputSnapshot> = {}) =>
    state({ tool: "river", river, ...patch });
  const first = () => {
    const command = decidePointerDown(riverState(), input([20, 30]))
      .commands[0];
    if (command.kind !== "riverDraft") throw Error("Expected river draft");
    return command;
  };
  it("creates a typed draft without capture and preserves navigation priority", () => {
    const command = first();
    expect(command.intent.action).toMatchObject({
      kind: "put",
      nodes: [{ point: [20, 30], width: 20 }],
    });
    expect(command.pointer).toBeNull();
    for (const patch of [{ space: true }, { button: 1 }]) {
      const decision = decidePointerDown(riverState(), input([20, 30], patch));
      expect(decision.capture).toBe(true);
      expect(decision.commands).toMatchObject([
        { kind: "beginGesture", gesture: { kind: "pan" } },
      ]);
    }
    expect(
      decidePointerDown(
        riverState({ river: { ...river, fresh: false } }),
        input(),
      ).commands,
    ).toEqual([]);
    expect(
      decidePointerDown(riverState({ editable: false }), input()).commands,
    ).toEqual([]);
  });
  it("captures node hits before selection and rejects a competing pointer", () => {
    const command = first();
    const workflow = geometryState(
      { ...common, kind: "geometry" },
      { kind: "river", intent: command.intent },
      null,
    );
    const snapshot = riverState({
      workflow,
      river: { ...river, mode: "select" },
    });
    const decision = decidePointerDown(snapshot, input([20, 30]));
    const next = decision.commands[0];
    expect(decision.capture).toBe(true);
    if (next.kind !== "riverDraft" || !next.pointer)
      throw Error("Expected river gesture");
    expect(next.pointer.index).toBe(0);
    const dragging = geometryState(
      { ...common, kind: "geometry" },
      { kind: "river", intent: command.intent },
      next.pointer,
    );
    expect(
      decidePointerDown(
        { ...snapshot, workflow: dragging },
        input([40, 50], { pointer: 8 }),
      ).commands,
    ).toEqual([]);
    expect(
      evaluatePointer(
        { ...snapshot, workflow: dragging },
        input([40, 50]),
        true,
      )?.intent,
    ).toMatchObject({ action: { nodes: [{ point: [40, 50] }] } });
  });
  it("extends the chosen end without changing existing node data", () => {
    const command = first();
    const workflow = geometryState(
      { ...common, kind: "geometry" },
      { kind: "river", intent: command.intent, append: "start" },
      null,
    );
    const decision = decidePointerDown(
      riverState({ workflow }),
      input([0, 10]),
    );
    expect(decision.commands[0]).toMatchObject({
      kind: "riverDraft",
      node: 0,
      intent: { action: { nodes: [{ point: [0, 10] }, { point: [20, 30] }] } },
    });
    expect(command.intent.action).toMatchObject({
      nodes: [{ point: [20, 30] }],
    });
  });
  it("routes right click and double click to acceptance without overview zoom", () => {
    const snapshot = riverState({ camera: { x: 0, y: 0, scale: 0.1 } });
    expect(
      decidePointerDown(snapshot, input([20, 30], { button: 2 })).commands,
    ).toEqual([{ kind: "accept" }]);
    expect(decideDoubleClick(snapshot, [20, 30])).toEqual([{ kind: "accept" }]);
  });
  it("keeps local field keys local and cancels river drafts on blur and document shortcuts", () => {
    const key = {
      key: "z",
      code: "KeyZ",
      ctrl: true,
      meta: false,
      shift: false,
      formTarget: false,
    };
    expect(decideKey(riverState(), key).commands).toEqual([
      { kind: "cancelEditor" },
      { kind: "history", redo: false },
    ]);
    expect(
      decideKey(riverState(), { ...key, formTarget: true }).commands,
    ).toEqual([]);
    expect(decideBlur(riverState())).toEqual([{ kind: "cancelEditor" }]);
    expect(decideBlur(state())).toEqual([]);
  });
});

it("routes brush wheel resizing through pure input decisions and freezes it during a stroke", () => {
  for (const tool of [
    "area",
    "terrain",
    "water",
    "scenery",
    "regions",
  ] as const) {
    const snapshot = state({ tool });
    expect(decideWheel(snapshot, [0, 0], -100, true)).toEqual([
      { kind: "groundSize", factor: 1.1 },
    ]);
    expect(decideWheel(snapshot, [0, 0], 100, true)).toEqual([
      { kind: "groundSize", factor: 1 / 1.1 },
    ]);
    expect(decideWheel(snapshot, [0, 0], -100)[0].kind).toBe("camera");
  }
  const gesture: Gesture = {
    ...base,
    kind: "terrain",
    brush: {
      mode: "raise",
      radius: 25,
      amount: 1,
      strength: 0.25,
      target: 10,
      points: [[0, 0]],
    },
  };
  const snapshot = state({
    tool: "terrain",
    workflow: geometryState(
      { ...common, kind: "geometry" },
      { kind: "terrain" },
      gesture,
    ),
  });
  expect(decideWheel(snapshot, [0, 0], -100, true)).toEqual([]);
  expect(decideWheel(snapshot, [0, 0], -100)).toEqual([]);
});

it.each([
  [0.5, 12, 15.98, false],
  [0.5, 12, 16, true],
  [0.5, 12, 16.02, true],
  [viewScale(3), 12, 5, false],
  [0.05, 11.99, 200, false],
  [0.05, 12, 200, true],
  [0.05, 12.01, 200, true],
  [0.064, 2, 200, true],
] as const)(
  "shares painted road eligibility at scale %s width %s proxy %s: %s",
  (scale, width, proxy, visible) => {
    const feature = {
      id: "r",
      kind: "road",
      name: "",
      important: false,
      paths: [
        [
          [0, 0],
          [proxy, 0],
        ],
      ] as WorldPoint[][],
      width,
      rank: width * proxy,
      color: "earth",
    };
    const snapshot = state({
      camera: { x: 17, y: 23, scale },
      overviewRoads: [feature],
    });
    const point: WorldPoint = [proxy / 2, 0];
    const commands = decidePointerDown(snapshot, input(point)).commands;
    expect(commands).toMatchObject(
      visible
        ? [{ kind: "selection", event: { type: "selectObject", id: "r" } }]
        : [{ kind: "beginGesture", gesture: { kind: "pan" } }],
    );
    const double = decideDoubleClick(snapshot, point);
    if (visible) expect(double).toEqual([]);
    else {
      expect(double).toHaveLength(1);
      if (double[0].kind !== "camera") throw Error("expected free zoom");
      expect(
        double[0].camera.x + point[0] * double[0].camera.scale,
      ).toBeCloseTo(17 + point[0] * scale, 10);
      expect(double[0].camera.y).toBe(23);
      if (scale === viewScale(3)) expect(double[0].camera.scale).toBe(1.28);
    }
  },
);

it("requires the exact matching selected header for short road exceptions and fresh data for writes", () => {
  const short: Road = {
    ...road,
    nodes: [road.nodes[0], { ...road.nodes[1], point: [5, 0] }],
    path: [
      [0, 0],
      [5, 0],
    ],
  };
  for (const scale of [viewScale(3), 0.05]) {
    const feature = {
      id: short.id,
      kind: "road",
      name: "",
      important: false,
      paths: [short.path],
      width: short.width,
      rank: 10,
      color: "earth",
    };
    const snapshot = state({
      camera: { x: 0, y: 0, scale },
      selected: short.id,
      selectedObject: short,
      overviewRoads: [feature],
    });
    expect(decideDoubleClick(snapshot, [2.5, 0])).toMatchObject([
      {
        kind: "intent",
        intent: { type: "insertRoadNode", roadId: short.id, afterNodeId: "a" },
      },
    ]);
    expect(gestureOf(snapshot, [0, 0])?.kind).toBe("node");
    for (const selectedObject of [
      undefined,
      {
        ...short,
        id: "other",
        nodes: short.nodes.map((n) => ({
          ...n,
          point: [1000, 1000] as WorldPoint,
        })),
        path: [
          [1000, 1000],
          [1005, 1000],
        ] as WorldPoint[],
      },
    ]) {
      const missing = { ...snapshot, selectedObject };
      expect(gestureOf(missing, [2.5, 0])?.kind).toBe("pan");
      expect(decideDoubleClick(missing, [2.5, 0])).toMatchObject([
        { kind: "camera" },
      ]);
    }
    expect(
      decideDoubleClick({ ...snapshot, editable: false }, [2.5, 0]),
    ).toEqual([]);
    expect(gestureOf({ ...snapshot, editable: false }, [0, 0])?.kind).not.toBe(
      "node",
    );
    expect(decideDoubleClick({ ...snapshot, tool: "road" }, [2.5, 0])).toEqual(
      [],
    );
    expect(decideDoubleClick({ ...snapshot, tool: "river" }, [2.5, 0])).toEqual(
      [{ kind: "accept" }],
    );
    expect(
      decideDoubleClick(
        { ...snapshot, tool: "river", editable: false },
        [2.5, 0],
      ),
    ).toEqual([]);
  }
});

it("keeps narrow visible hits in held roof policy and rejects nonroad features", () => {
  const feature = {
    id: "r",
    kind: "road",
    name: "",
    important: false,
    paths: [
      [
        [0, 0],
        [200, 0],
      ],
    ] as WorldPoint[][],
    width: 2,
    rank: 400,
    color: "earth",
  };
  const snapshot = state({
    camera: { x: 0, y: 0, scale: 0.06 },
    lod: decideLod(0.06, decideLod(0.064)),
    overviewRoads: [feature],
  });
  expect(decidePointerDown(snapshot, input([100, 0])).commands).toMatchObject([
    { kind: "selection" },
  ]);
  expect(decideDoubleClick(snapshot, [100, 0])).toEqual([]);
  expect(
    decideDoubleClick(
      { ...snapshot, overviewRoads: [{ ...feature, kind: "house" }] },
      [100, 0],
    ),
  ).toMatchObject([{ kind: "camera" }]);
});

it("keeps new and extending road doubleclicks as draft actions in overview", () => {
  const extend = extensionRoadDraft(road, "end", null);
  const fresh = newRoadDraft(road);
  const workflows = [
    draftState(
      { ...common, kind: "draft" },
      {
        kind: "extendRoad",
        draft: extend,
        nodeIds: road.nodes.map((n) => n.id),
      },
      null,
    ),
    draftState(
      { ...common, kind: "draft" },
      { kind: "newRoad", draft: fresh },
      null,
    ),
  ];
  for (const workflow of workflows)
    for (const tool of ["select", "road"] as const)
      expect(
        decideDoubleClick(
          state({
            camera: { x: 0, y: 0, scale: viewScale(3) },
            workflow,
            tool,
          }),
          [200, 200],
        ),
      ).toEqual([]);
});
