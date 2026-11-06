import { expect, it } from "vitest";
import { roadInsertion } from "./roadGeometry";
import type { Road } from "./model";
const road: Road = {
  kind: "road",
  id: "road-1",
  name: "R",
  material: "earth",
  width: 10,
  nodes: [
    { id: "node-2", point: [0, 0], incoming: null, outgoing: [20, -10] },
    { id: "node-3", point: [60, 0], incoming: [40, 10], outgoing: null },
  ],
  path: [],
  sections: [{ id: "section-4", populatedSides: [] }],
  edgeSections: ["section-4"],
  populationRecipe: null,
};
it("picks a backend edge/t and never rewrites stable node or section IDs", () => {
  const intent = roadInsertion(road, [30, 0]);
  expect(intent).toMatchObject({
    type: "insertRoadNode",
    roadId: road.id,
    afterNodeId: "node-2",
  });
  expect(intent.t).toBeCloseTo(0.5, 5);
  expect(road.nodes).toHaveLength(2);
  expect(road.edgeSections).toEqual(["section-4"]);
});
