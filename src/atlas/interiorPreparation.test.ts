import { expect, it } from "vitest";
import {
  prepareCells,
  prepareInterior,
  type CellPreparation,
} from "./interiorPreparation";
import type { Detail } from "./model";

type Cell = Detail["cells"][number];
const cell = (x: number, y: number, roomId = "r", floor = 0): Cell => ({
  x,
  y,
  roomId,
  floor,
});
const edgeKey = (x: number, y: number, X: number, Y: number) =>
  [
    [x, y],
    [X, Y],
  ]
    .sort(([a, b], [c, d]) => a - c || b - d)
    .flat()
    .join(",");
function edges(c: Cell) {
  return [
    edgeKey(c.x, c.y, c.x + 1, c.y),
    edgeKey(c.x, c.y + 1, c.x + 1, c.y + 1),
    edgeKey(c.x, c.y, c.x, c.y + 1),
    edgeKey(c.x + 1, c.y, c.x + 1, c.y + 1),
  ];
}
// Independent edge-incidence oracle: no neighbor lookup, row grouping or run merging.
function oracle(cells: Cell[], bounds: Detail["bounds"]) {
  const incidence = new Map<string, Cell[]>();
  for (const c of cells)
    for (const key of edges(c))
      incidence.set(key, [...(incidence.get(key) ?? []), c]);
  const walls: string[] = [],
    grid = new Set<string>(),
    fills: string[] = [];
  for (const c of cells) {
    if (
      c.x < bounds[0] ||
      c.y < bounds[1] ||
      c.x > bounds[2] ||
      c.y > bounds[3]
    )
      continue;
    fills.push(`${c.roomId}:${c.x},${c.y}`);
    for (const key of edges(c)) {
      grid.add(key);
      if (
        !incidence
          .get(key)!
          .some((other) => other !== c && other.roomId === c.roomId)
      )
        walls.push(key);
    }
  }
  return { fills: fills.sort(), walls: walls.sort(), grid: [...grid].sort() };
}
function expandSegments(values: Float64Array) {
  const out: string[] = [];
  for (let i = 0; i < values.length; i += 4) {
    const [x, y, X, Y] = values.slice(i, i + 4);
    const length = Math.abs(X - x) + Math.abs(Y - y),
      dx = Math.sign(X - x),
      dy = Math.sign(Y - y);
    for (let n = 0; n < length; n++)
      out.push(
        edgeKey(x + n * dx, y + n * dy, x + (n + 1) * dx, y + (n + 1) * dy),
      );
  }
  return out.sort();
}
function expand(value: CellPreparation) {
  const fills: string[] = [];
  for (const { room, rectangles } of value.fills)
    for (let i = 0; i < rectangles.length; i += 4)
      for (let x = rectangles[i]; x < rectangles[i] + rectangles[i + 2]; x++)
        for (
          let y = rectangles[i + 1];
          y < rectangles[i + 1] + rectangles[i + 3];
          y++
        )
          fills.push(`${room}:${x},${y}`);
  return {
    fills: fills.sort(),
    walls: expandSegments(value.walls),
    grid: expandSegments(value.grid),
  };
}
it.each([
  ["single negative cell", [cell(-2, -3)]],
  ["same-room adjacency", [cell(0, 0), cell(1, 0), cell(2, 0)]],
  ["different rooms", [cell(0, 0, "a"), cell(1, 0, "b")]],
  [
    "hole and disconnected island",
    Array.from({ length: 9 }, (_, i) => cell(i % 3, Math.floor(i / 3)))
      .filter((c) => c.x !== 1 || c.y !== 1)
      .concat(cell(-3, 2)),
  ],
] as const)(
  "matches independent raster/edge oracle for %s, including shuffled input",
  (_, cells) => {
    const input = [...cells],
      bounds: Detail["bounds"] = [-10, -10, 10, 10];
    const before = structuredClone(input);
    expect(expand(prepareCells(input, bounds))).toEqual(oracle(input, bounds));
    expect(expand(prepareCells([...input].reverse(), bounds))).toEqual(
      oracle(input, bounds),
    );
    expect(input).toEqual(before);
  },
);
it("uses halo neighbors to suppress walls without emitting halo fill/grid", () => {
  const cells = [cell(-1, 0), cell(0, 0), cell(1, 0)],
    bounds: Detail["bounds"] = [0, 0, 0, 0];
  const result = prepareCells(cells, bounds);
  expect(expand(result)).toEqual(oracle(cells, bounds));
  expect(result.walls.length / 4).toBe(2);
  expect(expand(result).fills).toEqual(["r:0,0"]);
});
it("keeps main and ghost room geometry separate", () => {
  const result = prepareInterior({
    cells: [cell(0, 0)],
    lower: [cell(0, 0, "lower", -1)],
    bounds: [0, 0, 0, 0],
  });
  expect(result.main.fills[0].room).toBe("r");
  expect(result.ghost.fills[0].room).toBe("lower");
});
it("preserves lower overlapping-floor last-neighbor semantics and room insertion order", () => {
  // The neighbor at (1,0) is looked up by XY, last input wins, regardless of floor.
  const items = [cell(0, 0, "a", -1), cell(1, 0, "a", -1), cell(1, 0, "b", -2)];
  const result = prepareCells(items, [0, 0, 0, 0]);
  expect(result.walls.length / 4).toBe(4);
  const reversedNeighbor = prepareCells(
    [items[0], items[2], items[1]],
    [0, 0, 0, 0],
  );
  expect(reversedNeighbor.walls.length / 4).toBe(3);
  expect(
    prepareCells([cell(0, 0, "b"), cell(1, 0, "a")], [0, 0, 1, 0]).fills.map(
      (f) => f.room,
    ),
  ).toEqual(["b", "a"]);
});
