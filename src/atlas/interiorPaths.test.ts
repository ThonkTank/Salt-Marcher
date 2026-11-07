import { afterEach, expect, it, vi } from "vitest";
import { buildInteriorPaths, materializeInterior } from "./interiorPaths";
import { prepareInterior } from "./interiorPreparation";
import { InteriorGeometryCache } from "./interiorGeometryCache";
import type { Detail } from "./model";
class RecordingPath {
  commands: Array<[string, ...number[]]> = [];
  rect(...v: number[]) {
    this.commands.push(["rect", ...v]);
  }
  moveTo(...v: number[]) {
    this.commands.push(["moveTo", ...v]);
  }
  lineTo(...v: number[]) {
    this.commands.push(["lineTo", ...v]);
  }
}
afterEach(() => vi.unstubAllGlobals());
const detail: Detail = {
  status: {
    sessionId: "s",
    revision: 1,
    dirty: false,
    path: null,
    canUndo: false,
    canRedo: false,
    changes: null,
  },
  buildingId: "h",
  floor: 0,
  includeLower: true,
  bounds: [0, 0, 0, 0],
  cells: [{ x: 0, y: 0, roomId: "r", floor: 0 }],
  lower: [],
  rooms: [],
  connections: [],
};
it("materializes exact rectangles and oriented wall segments without retaining numeric data", () => {
  vi.stubGlobal("Path2D", RecordingPath);
  const numeric = prepareInterior(detail),
    result = materializeInterior(numeric);
  expect(
    (result.main.fills.get("r") as unknown as RecordingPath).commands,
  ).toEqual([["rect", 0, 0, 1, 1]]);
  expect((result.main.walls as unknown as RecordingPath).commands).toEqual([
    ["moveTo", 0, 0],
    ["lineTo", 0, 1],
    ["moveTo", 1, 0],
    ["lineTo", 1, 1],
    ["moveTo", 0, 0],
    ["lineTo", 1, 0],
    ["moveTo", 0, 1],
    ["lineTo", 1, 1],
  ]);
  numeric.main.fills[0].rectangles.fill(99);
  expect(
    (result.main.fills.get("r") as unknown as RecordingPath).commands,
  ).toEqual([["rect", 0, 0, 1, 1]]);
  expect(Object.keys(result.main)).toEqual(["fills", "walls", "grid"]);
});
it("reuses cached paths without allocating new Path2D objects", () => {
  let allocations = 0;
  vi.stubGlobal(
    "Path2D",
    class extends RecordingPath {
      constructor() {
        super();
        allocations++;
      }
    },
  );
  const cache = new InteriorGeometryCache(buildInteriorPaths);
  const first = cache.get(detail);
  const builtAllocations = allocations;
  expect(builtAllocations).toBeGreaterThan(0);
  expect(cache.get(detail)).toBe(first);
  expect(allocations).toBe(builtAllocations);
});
