import { describe, expect, it } from "vitest";
import {
  evaluateGesture,
  type Gesture,
  decideDoubleClick,
  decideKey,
  decidePointerDown,
  decideWheel,
  evaluatePointer,
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
import { editRoadDraft, extensionRoadDraft } from "./roadDraft";

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

describe("pure canvas input decisions", () => {
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
      kind: "nodeSelection",
      value: "a",
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
      { kind: "connectionSelection", id: "door" },
      { kind: "roomSelection", room: "" },
    ]);
  });
  it("selects a room on its first hit and moves it on a second hit", () => {
    const snapshot = sceneState([hitHouse], {
      house: hitHouse,
      detail,
      context: { kind: "house", houseId: hitHouse.id },
    });
    expect(decidePointerDown(snapshot, input()).commands).toEqual([
      { kind: "connectionSelection", id: "" },
      { kind: "roomSelection", room: "r" },
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
      ).commands.find((c) => c.kind === "select")?.object?.id;
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
  it("keeps extension anchor clicks node-free and area draft clicks capture-free", () => {
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
    const areaDecision = decidePointerDown(state({ tool: "area" }), input());
    expect(areaDecision.capture).toBe(false);
    expect(areaDecision.commands).toEqual([
      {
        kind: "draft",
        draft: { kind: "newArea", material: "earth", points: [[2.5, 2.5]] },
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
    ).toEqual([{ kind: "openHouse", house: hitHouse }]);
    expect(
      decideDoubleClick(state({ selectedObject: parcel }), [0, 0]),
    ).toEqual([{ kind: "openParcel", parcel }]);
    expect(
      decideDoubleClick(
        state({ selectedObject: road, editable: false }),
        [20, 0],
      ),
    ).toEqual([]);
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
    ).toEqual([{ kind: "floor", delta: key === "PageUp" ? 1 : -1 }]);

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
            scale: context.kind === "house" ? 1.28 : 0.000064,
            x: 160 + 10 * (2 - (context.kind === "house" ? 1.28 : 0.000064)),
            y: 120 + 20 * (2 - (context.kind === "house" ? 1.28 : 0.000064)),
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
