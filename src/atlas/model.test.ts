import { describe, it, expect } from "vitest";
import {
  toWorld,
  openingPoint,
  type Connection,
  screenToWorld,
  worldToScreen,
  toLocal,
  contains,
  interiorBounds,
  interiorTiles,
  interiorTileCoordinate,
  mergeDetails,
  type Detail,
} from "./model";
describe("local building transforms", () => {
  it("round trips arbitrary rotations and negative positions", () => {
    for (const angle of [0, 0.3, -1.7, Math.PI, 5.9]) {
      const t = { x: -24.73, y: 108.91, angle };
      const p: [number, number] = [-3.25, 7.6];
      const back = toLocal(toWorld(p, t), t);
      expect(back[0]).toBeCloseTo(p[0], 10);
      expect(back[1]).toBeCloseTo(p[1], 10);
    }
  });
  it("retains courtyard holes", () => {
    const rings: [number, number][][] = [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
      [
        [2, 2],
        [2, 8],
        [8, 8],
        [8, 2],
      ],
    ];
    expect(contains(rings, [1, 1])).toBe(true);
    expect(contains(rings, [5, 5])).toBe(false);
  });
});
it("covers rotated wide views with bounded tiles and deduplicates SQL halos", () => {
  const transform = { x: -210, y: 30, angle: 0.7 };
  const bounds = interiorBounds([-500, -100, 2400, 900], transform);
  const tiles = interiorTiles(bounds);
  expect(tiles.length).toBeGreaterThan(1);
  for (const p of [
    [-500, -100],
    [2400, -100],
    [2400, 900],
    [-500, 900],
  ] as [number, number][]) {
    const [x, y] = toLocal(p, transform).map(Math.floor);
    expect(
      tiles.filter(
        ({ core: b }) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3],
      ),
    ).toHaveLength(1);
  }
  expect(
    tiles.every(
      ({ core: b }) => (b[2] - b[0] + 3) * (b[3] - b[1] + 3) <= 100000,
    ),
  ).toBe(true);
  const cell = { floor: 0, x: 127, y: 10, roomId: "r" };
  const part = {
    status: {
      sessionId: "s",
      revision: 1,
      path: null,
      dirty: false,
      canUndo: false,
      canRedo: false,
      changes: null,
    },
    buildingId: "h",
    floor: 0,
    includeLower: true,
    bounds: tiles[0].core,
    cells: [cell],
    lower: [{ ...cell, floor: -1 }],
    rooms: [],
    connections: [],
  } as Detail;
  const merged = mergeDetails(
    [part, { ...part, bounds: tiles[1].core }],
    part,
    bounds,
  );
  expect(merged.cells).toEqual([cell]);
  expect(merged.lower).toHaveLength(1);
  expect(merged.bounds).toEqual(bounds);
});

it("uses stable floor-based tile coordinates and clips request cores at domain edges", () => {
  expect([-129, -128, -1, 0, 127, 128].map(interiorTileCoordinate)).toEqual([
    -2, -1, -1, 0, 0, 1,
  ]);
  expect(
    interiorTiles([-128, -1, 128, 0]).map(({ x, y, core }) => [x, y, core]),
  ).toEqual([
    [-1, -1, [-128, -128, -1, -1]],
    [0, -1, [0, -128, 127, -1]],
    [1, -1, [128, -128, 255, -1]],
    [-1, 0, [-128, 0, -1, 127]],
    [0, 0, [0, 0, 127, 127]],
    [1, 0, [128, 0, 255, 127]],
  ]);
  expect(interiorTiles([1, 2, 126, 120])).toEqual(
    interiorTiles([2, 3, 127, 121]),
  );
  for (const b of [
    [-1_000_010, -1_000_010, -999_990, -999_990],
    [999_990, 999_990, 1_000_010, 1_000_010],
    [2_000_000, 2_000_000, 2_000_001, 2_000_001],
  ] as [number, number, number, number][]) {
    for (const { core, sqlHalo } of interiorTiles(b)) {
      expect(core.every((v) => Math.abs(v) <= 1_000_001)).toBe(true);
      expect(
        (core[2] - core[0] + 3) * (core[3] - core[1] + 3),
      ).toBeLessThanOrEqual(100_000);
      expect(sqlHalo).toEqual([
        core[0] - 1,
        core[1] - 1,
        core[2] + 1,
        core[3] + 1,
      ]);
    }
  }
});

it("converts screen pixels explicitly without accepting local cells as world coordinates", () => {
  const camera = { x: -21, y: 80, scale: 1.28 };
  const world = screenToWorld([10, 20], camera);
  expect(worldToScreen(world, camera)).toEqual([10, 20]);
  const local = toLocal(world, { x: 0, y: 0, angle: 0 });
  // @ts-expect-error Local cells must pass through toWorld before screen projection.
  worldToScreen(local, camera);
});

it("projects a shifted opening consistently along either local wall axis", () => {
  for (const axis of ["horizontal", "vertical"] as const) {
    const c: Extract<Connection, { type: "opening" }> = {
      id: "c",
      created: 0,
      fromRoom: "r",
      toRoom: null,
      floor: 0,
      x: 1,
      y: -2,
      type: "opening",
      kind: "door",
      axis,
      offset: 0.5,
    };
    expect(openingPoint(c, 0.5)).toEqual(
      axis === "horizontal" ? [2, -2] : [1, -1],
    );
    expect(openingPoint(c, 1)).toEqual(
      axis === "horizontal" ? [2.5, -2] : [1, -0.5],
    );
  }
});
