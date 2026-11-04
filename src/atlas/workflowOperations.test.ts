import { it, expect } from "vitest";
import {
  captureOperation,
  captureDraftOperation,
  captureGestureOperation,
  operationTarget,
  recheckOperation,
} from "./workflowOperations";
import type {
  Candidate,
  ExactIntent,
  WorkflowOperation,
} from "./editorWorkflow";
import {
  defaultPopulation,
  toWorld,
  type Road,
  type Parcel,
  type House,
  type Status,
  type Scene,
  type MapObject,
} from "./model";
import {
  newRoadDraft,
  extensionRoadDraft,
  roadEditInput,
  editRoadDraft,
} from "./roadDraft";
import { parcelTransform } from "./parcelEditor";
const status = (revision = 0): Status => ({
  sessionId: "test-session",
  revision,
  path: null,
  dirty: false,
  canUndo: false,
  canRedo: false,
  changes: null,
});
const road: Road = {
  kind: "road",
  id: "road-1",
  name: "Test",
  width: 10,
  material: "earth",
  nodes: [
    { id: "node-2", point: [0, 0], incoming: null, outgoing: null },
    { id: "node-3", point: [80, 0], incoming: null, outgoing: null },
  ],
  path: [
    [0, 0],
    [80, 0],
  ],
  sections: [{ id: "section-4", populatedSides: [] }],
  edgeSections: ["section-4"],
  populationRecipe: null,
};
const parcel: Parcel = {
  kind: "parcel",
  id: "parcel-5",
  source: { kind: "detached" },
  polygon: [
    [-20, -20],
    [60, -20],
    [60, 100],
    [-20, 100],
  ],
  frame: { x: 10, y: 20, angle: 0.37 },
};
const house: House = {
  kind: "house",
  importantPlace: false,
  foundation: { height: 1, transition: 10 },
  id: "house-6",
  name: "Haus",
  roof: "#888888",
  placement: {
    kind: "parcel",
    parcelId: parcel.id,
    gridPose: { xCells: -2, yCells: 1, quarterTurns: 0 },
  },
  transform: parcelTransform(parcel.frame, {
    xCells: -2,
    yCells: 1,
    quarterTurns: 0,
  }),
  contours: [
    [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ],
  ],
  occupancyContours: [],
  occupancyBounds: [0, 0, 10, 10],
};

const scene = (
  objects: MapObject[] = [road, parcel, house],
  owner: string | null = house.id,
): Scene => ({
  status: status(),
  objects,
  selectionState: { exists: true, parcelId: parcel.id, houseId: owner },
  contextState: { exists: false, parcelId: null, houseId: null },
});
const candidate = (intent: ExactIntent): Candidate => ({
  token: { workflowId: 1, candidateId: 2, version: status() },
  intent,
  autoFinish: false,
  final: true,
});
function capture(intent: ExactIntent, s = scene()) {
  const result = captureOperation(intent, { scene: s });
  if (!result.ok) throw Error(result.message);
  return result.operation;
}
function ready(op: WorkflowOperation, intent: ExactIntent, s?: Scene) {
  const result = recheckOperation(op, candidate(intent), null, s);
  if (result.kind !== "ready") throw Error(result.message);
  return result;
}
it("preserves negative relative pose through all four quarter turns and a rotated new frame without mutations", () => {
  for (const quarterTurns of [0, 1, 2, 3] as const) {
    const pose = { xCells: -3, yCells: -4, quarterTurns },
      intent: ExactIntent = {
        type: "transformHouse",
        id: house.id,
        transform: parcelTransform(parcel.frame, pose),
      },
      source = scene();
    const before = structuredClone({ intent, source }),
      op = capture(intent, source),
      fresh = { ...parcel, frame: { x: -100, y: 200, angle: 1.71 } };
    const result = ready(op, intent, scene([house, fresh]));
    expect(result.intent).toEqual({
      ...intent,
      transform: parcelTransform(fresh.frame, pose),
    });
    expect({ intent, source }).toEqual(before);
  }
});
it("requires matching full selection closure for transformations and both parcel foundations", () => {
  const transform: ExactIntent = {
    type: "transformHouse",
    id: house.id,
    transform: house.transform,
  };
  const create: ExactIntent = {
    type: "createHouse",
    parcelId: parcel.id,
    transform: house.transform,
    width: 2,
    depth: 3,
  };
  const cells: ExactIntent = {
    type: "createParcelHouse",
    parcelId: parcel.id,
    floor: -1,
    cells: [
      [-2, -3],
      [0, 1],
    ],
  };
  for (const intent of [transform, create, cells]) {
    const source = scene(
        [house, parcel],
        intent === transform ? house.id : null,
      ),
      op = capture(intent, source);
    for (const closure of [
      {
        exists: true,
        parcelId: "other",
        houseId: intent === transform ? house.id : null,
      },
      { exists: true, parcelId: parcel.id, houseId: "other" },
    ]) {
      expect(
        recheckOperation(op, candidate(intent), null, {
          ...source,
          selectionState: closure,
        }).kind,
      ).toBe("restart");
    }
  }
  expect(
    captureOperation(create, { scene: scene([parcel], house.id) }).ok,
  ).toBe(false);
  expect(captureOperation(create, { scene: undefined }).ok).toBe(false);
});
it("recomposes both foundation guides from the new frame and retains desired floors and cells", () => {
  const source = scene([parcel], null),
    fresh = scene([{ ...parcel, frame: { x: 100, y: -50, angle: 1.2 } }], null);
  const create: ExactIntent = {
    type: "createHouse",
    parcelId: parcel.id,
    transform: parcelTransform(parcel.frame, {
      xCells: -2,
      yCells: 3,
      quarterTurns: 3,
    }),
    width: 4,
    depth: 2,
  };
  const a = ready(capture(create, source), create, fresh);
  expect(a.intent.type).toBe("createHouse");
  if (a.intent.type !== "createHouse") throw Error();
  const transform = a.intent.transform;
  expect(a.guide?.points).toEqual(
    (
      [
        [0, 0],
        [4, 0],
        [4, 2],
        [0, 2],
      ] as [number, number][]
    ).map((point) => toWorld(point, transform)),
  );
  expect(a.intent).toMatchObject({ width: 4, depth: 2 });
  const cells: ExactIntent = {
    type: "createParcelHouse",
    parcelId: parcel.id,
    floor: -4,
    cells: [
      [-2, -3],
      [0, 1],
    ],
  };
  const b = ready(capture(cells, source), cells, fresh);
  expect(b.intent).toEqual(cells);
  expect(b.guide?.points).toEqual(
    (
      [
        [-2, -3],
        [1, -3],
        [1, 2],
        [-2, 2],
      ] as [number, number][]
    ).map((point) =>
      toWorld(point, fresh.objects.find((o) => o.kind === "parcel")!.frame),
    ),
  );
});
it("rejects a changed house placement and a detach owner change even when IDs persist", () => {
  const t: ExactIntent = {
      type: "transformHouse",
      id: house.id,
      transform: house.transform,
    },
    op = capture(t);
  expect(
    recheckOperation(
      op,
      candidate(t),
      null,
      scene([{ ...house, placement: { kind: "free" } }, parcel]),
    ).kind,
  ).toBe("restart");
  const d: ExactIntent = { type: "detachParcel", id: parcel.id },
    detach = capture(d);
  expect(
    recheckOperation(detach, candidate(d), null, scene([parcel], null)).kind,
  ).toBe("restart");
  expect(ready(detach, d, scene()).intent).toEqual(d);
});
it("keeps free transforms and free creation independent from parcels and reads", () => {
  const t: ExactIntent = {
      type: "transformHouse",
      id: house.id,
      transform: { x: 40, y: -20, angle: 0.5 },
    },
    free = scene([{ ...house, placement: { kind: "free" } }]);
  expect(ready(capture(t, free), t, free).intent).toEqual(t);
  const create: ExactIntent = {
      type: "createHouse",
      parcelId: null,
      transform: t.transform,
      width: 2,
      depth: 2,
    },
    op = captureOperation(create, { scene: undefined });
  expect(op.ok).toBe(true);
  if (op.ok) {
    expect(operationTarget(op.operation)).toBeNull();
    expect(ready(op.operation, create).intent).toEqual(create);
  }
});
it("requires ordered stable node IDs, including insert anchor, without replacing desired road geometry", () => {
  const intent: ExactIntent = {
      type: "insertRoadNode",
      roadId: road.id,
      afterNodeId: road.nodes[0].id,
      t: 0.4,
    },
    op = capture(intent);
  for (const nodes of [
    [...road.nodes].reverse(),
    road.nodes.map((n, i) => ({ ...n, id: `replacement-${i}` })),
  ])
    expect(
      recheckOperation(op, candidate(intent), null, scene([{ ...road, nodes }]))
        .kind,
    ).toBe("restart");
  expect(
    recheckOperation(
      op,
      candidate({ ...intent, afterNodeId: "gone" }),
      null,
      scene(),
    ).kind,
  ).toBe("restart");
  const update: ExactIntent = {
    type: "updateRoad",
    roadId: road.id,
    road: { ...roadEditInput(road), width: 31 },
  };
  expect(
    ready(capture(update), update, scene([{ ...road, width: 22 }])).intent,
  ).toEqual(update);
});
it("keeps extension topology captured before settings edits and preserves desired populate settings", () => {
  const draft = extensionRoadDraft(road, "end", null);
  const first = captureDraftOperation(draft, { scene: scene() });
  expect(first.ok).toBe(true);
  if (!first.ok || first.operation.kind !== "extendRoad") throw Error();
  const next = { ...draft, population: { ...defaultPopulation, seed: 92 } };
  const second = captureDraftOperation(
    next,
    { scene: undefined },
    first.operation,
  );
  expect(second.ok && second.operation).toEqual({
    ...first.operation,
    draft: next,
  });
  const intent: ExactIntent = {
      type: "populate",
      roadId: road.id,
      settings: { ...defaultPopulation, seed: 76 },
    },
    op = capture(intent);
  expect(op).toEqual({ kind: "populate", roadId: road.id });
  expect(ready(op, intent, scene()).intent).toEqual(intent);
});
it("retains desired terrain data, lets delete recalculate cascades, and handles gone targets", () => {
  const area = {
    kind: "area" as const,
    id: "a",
    name: "A",
    material: "grass" as const,
    order: 1,
    points: [
      [0, 0],
      [10, 0],
      [0, 10],
    ] as [number, number][],
  };
  const intent: ExactIntent = {
    type: "updateArea",
    areaId: "a",
    area: { material: "earth", points: area.points },
  };
  expect(
    ready(capture(intent, scene([area])), intent, scene([area])).intent,
  ).toEqual(intent);
  const del: ExactIntent = { type: "delete", id: road.id },
    op = capture(del);
  expect(ready(op, del, scene([road, house])).intent).toEqual(del);
  expect(
    recheckOperation(op, candidate(del), null, {
      ...scene([]),
      selectionState: { exists: false, houseId: null, parcelId: null },
    }),
  ).toEqual({ kind: "gone", message: "Bereits entfernt." });
});
it("captures incomplete new drafts without a candidate and never requires a target read", () => {
  const draft = newRoadDraft({ name: "R", width: 10, material: "earth" }, null);
  const result = captureDraftOperation(draft, { scene: undefined });
  expect(result.ok).toBe(true);
  if (result.ok) expect(operationTarget(result.operation)).toBeNull();
  const area = {
    kind: "newArea" as const,
    material: "grass" as const,
    points: [],
  };
  const a = captureDraftOperation(area, { scene: undefined });
  expect(a.ok).toBe(true);
});

it("captures gesture starts through the same rules and leaves the house owner read explicit", () => {
  const base = {
    pointer: 1,
    start: [0, 0] as [number, number],
    screen: [0, 0] as [number, number],
  };
  const node = captureGestureOperation(
    {
      ...base,
      kind: "node",
      object: editRoadDraft(road),
      index: 1,
      handle: "point",
    },
    { scene: scene() },
  );
  expect(node.ok && node.operation.kind).toBe("editRoad");
  const rectangle = captureGestureOperation(
    { ...base, kind: "houseRectangle", parcel },
    { scene: undefined },
  );
  expect(rectangle.ok && rectangle.operation).toEqual({
    kind: "createHouse",
    parcelId: parcel.id,
    gridPose: null,
  });
});

it("rechecks new road and terrain drafts without reads or changing desired data and reports missing nondelete targets", () => {
  const newRoad: ExactIntent = {
    type: "createRoad",
    road: {
      name: "N",
      width: 10,
      material: "earth",
      nodes: road.nodes.map(({ point, incoming, outgoing }) => ({
        point,
        incoming,
        outgoing,
      })),
    },
    population: null,
  };
  const newArea: ExactIntent = {
    type: "createArea",
    area: {
      material: "grass",
      points: [
        [0, 0],
        [20, 0],
        [0, 20],
      ],
    },
  };
  const draftRoad = {
    ...newRoadDraft({ name: "N", width: 10, material: "earth" }),
    nodes: newRoad.road.nodes,
  };
  const draftArea = { kind: "newArea" as const, ...newArea.area };
  for (const [intent, draft] of [
    [newRoad, draftRoad],
    [newArea, draftArea],
  ] as const) {
    const result = captureOperation(intent, { scene: undefined }, draft);
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error();
    expect(operationTarget(result.operation)).toBeNull();
    expect(ready(result.operation, intent).intent).toEqual(intent);
  }
  const intent: ExactIntent = { type: "detachParcel", id: parcel.id };
  expect(
    recheckOperation(capture(intent), candidate(intent), null, {
      ...scene([]),
      selectionState: { exists: false, parcelId: null, houseId: null },
    }),
  ).toEqual({
    kind: "gone",
    message: "Objekt fehlt. Bitte neue Aktion beginnen.",
  });
});
