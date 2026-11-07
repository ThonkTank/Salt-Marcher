import { expect, it } from "vitest";
import {
  defaultPopulation,
  type Area,
  type CurveNodeInput,
  type Intent,
  type NewRoadInput,
  type Road,
  type RoadEditInput,
} from "./model";
import {
  areaInput,
  smoothRoadDraft,
  changeRoadProperties,
  setRoadHandles,
  moveRoadNode,
  drawingNodes,
  editAreaDraft,
  editRoadDraft,
  extensionRoadDraft,
  newRoadDraft,
  roadDraftGeometry,
  toDraftIntent,
  toRoadIntent,
} from "./roadDraft";
const road: Road = {
  kind: "road",
  id: "road-1",
  name: "R",
  width: 10,
  material: "stone",
  nodes: [
    { id: "node-2", point: [0, 0], incoming: [-3, 7], outgoing: [20, -10] },
    { id: "node-3", point: [60, 0], incoming: [40, 10], outgoing: [69, -4] },
  ],
  path: [
    [0, 0],
    [60, 0],
  ],
  sections: [{ id: "section-4", populatedSides: ["left"] }],
  edgeSections: ["section-4"],
  populationRecipe: { settings: defaultPopulation, algorithmVersion: 4 },
};
const nodes: CurveNodeInput[] = [
  { point: [-20, 10], incoming: [-15, 8], outgoing: [-25, 12] },
  { point: [-60, 5], incoming: [-50, 6], outgoing: [-70, 4] },
];
it("serializes create and edit into exact input DTOs and keeps incomplete geometry local", () => {
  const draft = newRoadDraft({ name: "N", width: 12, material: "earth" });
  expect(toRoadIntent(draft)).toBeNull();
  draft.nodes.push(nodes[0]);
  expect(toRoadIntent(draft)).toBeNull();
  expect(roadDraftGeometry(draft)).toEqual({
    kind: "road",
    width: 12,
    material: "earth",
    nodes: [nodes[0]],
  });
  draft.nodes.push(nodes[1]);
  expect(toRoadIntent(draft)).toEqual({
    type: "createRoad",
    road: { name: "N", width: 12, material: "earth", nodes },
    population: null,
  });
  expect(Object.keys(newRoadDraft(road)).sort()).toEqual([
    "kind",
    "material",
    "name",
    "nodes",
    "population",
    "width",
  ]);
  const edit = editRoadDraft(road);
  edit.width = 14;
  const serialized = toRoadIntent(edit);
  expect(serialized).toEqual({
    type: "updateRoad",
    roadId: road.id,
    road: { name: "R", width: 14, material: "stone", nodes: road.nodes },
  });
  expect(Object.keys(edit).sort()).toEqual([
    "kind",
    "material",
    "name",
    "nodes",
    "roadId",
    "width",
  ]);
  expect(road.width).toBe(10);
  expect(serialized && JSON.parse(JSON.stringify(serialized))).toEqual(
    serialized,
  );
});
it.each(["start", "end"] as const)(
  "serializes asymmetric %s extension handles only at the wire boundary",
  (end) => {
    const before = structuredClone(road);
    const draft = extensionRoadDraft(
      road,
      end,
      end === "start" ? defaultPopulation : null,
    );
    expect(toRoadIntent(draft)).toBeNull();
    draft.anchor.outgoing = [-5, 3];
    draft.nodes = structuredClone(nodes);
    const drawn = structuredClone(draft);
    expect(drawingNodes(draft)).toEqual([draft.anchor, ...nodes]);
    expect(roadDraftGeometry(draft)).toEqual({
      kind: "road",
      width: 10,
      material: "stone",
      nodes: [draft.anchor, ...nodes],
    });
    expect(toRoadIntent(draft)).toEqual({
      type: "extendRoad",
      roadId: road.id,
      end,
      endpointHandle: [-5, 3],
      population: end === "start" ? defaultPopulation : null,
      nodes:
        end === "end"
          ? nodes
          : [
              { point: [-60, 5], incoming: [-70, 4], outgoing: [-50, 6] },
              { point: [-20, 10], incoming: [-25, 12], outgoing: [-15, 8] },
            ],
    });
    expect(toRoadIntent(draft)).toEqual(toRoadIntent(draft));
    expect(draft).toEqual(drawn);
    expect(road).toEqual(before);
    expect(Object.keys(draft).sort()).toEqual([
      "anchor",
      "end",
      "kind",
      "material",
      "nodes",
      "population",
      "roadId",
      "width",
    ]);
  },
);
it("keeps area identity and order out of authored area values", () => {
  const area: Area = {
    kind: "area",
    id: "area-9",
    material: "grass",
    points: [
      [0, 0],
      [10, 0],
      [0, 10],
    ],
    order: 48,
  };
  expect(areaInput(area)).toEqual({ material: "grass", points: area.points });
  expect(toDraftIntent(editAreaDraft(area))).toEqual({
    type: "updateArea",
    areaId: area.id,
    area: { material: "grass", points: area.points },
  });
  expect(
    toDraftIntent({ kind: "newArea", material: "earth", points: [] }),
  ).toBeNull();
  expect(
    toDraftIntent({ kind: "newArea", material: "grass", points: area.points }),
  ).toEqual({
    type: "createArea",
    area: { material: "grass", points: area.points },
  });
});
// These compile-time rejections prevent stored objects and placeholder identities
// from flowing into commands through structural assignment.
function inputTypeRejections(stored: Road, area: Area) {
  // @ts-expect-error persisted geometry is not a create input
  const create: NewRoadInput = stored;
  // @ts-expect-error persisted geometry is not an update input
  const update: RoadEditInput = stored;
  const node: CurveNodeInput = {
    // @ts-expect-error new nodes cannot carry placeholder IDs
    id: "",
    point: [0, 0],
    incoming: null,
    outgoing: null,
  };
  // @ts-expect-error area input cannot carry identity or order
  const terrain: Intent = { type: "createArea", area };
  const extension: Intent = {
    type: "extendRoad",
    roadId: "road-1",
    end: "start",
    nodes: [],
    endpointHandle: null,
    // @ts-expect-error explicit nullable population replaces boolean extension flags
    populate: false,
    settings: defaultPopulation,
  };
  const populatedUpdate: Intent = {
    type: "updateRoad",
    roadId: "road-1",
    road: update,
    // @ts-expect-error update cannot populate existing sections
    population: defaultPopulation,
  };
  return [create, update, node, terrain, extension, populatedUpdate];
}
void inputTypeRejections;

it("edits properties and handles without changing stored nodes or author identities", () => {
  const original = structuredClone(road);
  const changed = changeRoadProperties(road, { width: 25, material: "stone" });
  const curved = setRoadHandles(changed, changed.nodes[0].id, true);
  const node = curved.nodes[0];
  const moved = moveRoadNode(curved, 0, "point", [
    node.point[0] + 7,
    node.point[1] - 3,
  ]);
  expect(moved.nodes[0].incoming).toEqual([
    node.incoming![0] + 7,
    node.incoming![1] - 3,
  ]);
  expect(moved.nodes[0].outgoing).toEqual([
    node.outgoing![0] + 7,
    node.outgoing![1] - 3,
  ]);
  expect(moved.nodes.map((n) => n.id)).toEqual(road.nodes.map((n) => n.id));
  expect(moved).toMatchObject({ width: 25, material: "stone" });
  expect(
    setRoadHandles(moved, moved.nodes[0].id, false).nodes[0],
  ).toMatchObject({ incoming: null, outgoing: null });
  expect(road).toEqual(original);
});

it("smooths uneven points into finite interpolating cubics without mutating input", () => {
  const draft = newRoadDraft({ name: "Smooth", width: 10, material: "earth" });
  draft.nodes = [
    [0, 0],
    [0.01, 0],
    [80, 40],
    [81, 40],
  ].map((point) => ({
    point: point as [number, number],
    incoming: null,
    outgoing: null,
  }));
  const copy = structuredClone(draft);
  const result = smoothRoadDraft(draft);
  expect(draft).toEqual(copy);
  expect(result.nodes.map((n) => n.point)).toEqual(
    draft.nodes.map((n) => n.point),
  );
  expect(
    result.nodes
      .flatMap((n) => [n.incoming, n.outgoing])
      .filter((p) => p !== null)
      .flat()
      .every(Number.isFinite),
  ).toBe(true);
  const straight = smoothRoadDraft({
    ...draft,
    nodes: [
      draft.nodes[0],
      { point: [100, 0] as [number, number], incoming: null, outgoing: null },
    ],
  });
  expect(straight.nodes[0].outgoing?.[1]).toBe(0);
  expect(straight.nodes[1].incoming?.[1]).toBe(0);
});
