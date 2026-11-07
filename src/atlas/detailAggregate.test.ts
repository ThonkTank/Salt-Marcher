import { expect, it } from "vitest";
import { DetailAggregate } from "./detailAggregate";
import type { DetailTile, InteriorMetadata, Status } from "./model";

const status = { sessionId: "s", revision: 1 } as Status;
const metadata: InteriorMetadata = {
  status,
  buildingId: "h",
  rooms: [],
  connections: [],
};
const tile = (x: number, size = 1): DetailTile => ({
  status,
  buildingId: "h",
  floor: 0,
  includeLower: true,
  bounds: [x, 0, x + size - 1, 0],
  cells: Array.from({ length: size }, (_, i) => ({
    floor: 0,
    x: x + i,
    y: 0,
    roomId: "r",
  })),
  lower: [],
});

it("unions halo duplicates and reuses geometry with current metadata across promoted envelopes", () => {
  const a = tile(0),
    b = { ...tile(1), cells: a.cells };
  a.lower = a.cells.map((c) => ({ ...c, floor: -1 }));
  b.lower = a.lower;
  const cache = new DetailAggregate();
  const first = cache.get(["a", "b"], [a, b], metadata);
  expect(first.bounds).toEqual([0, 0, 1, 0]);
  expect(first.cells).toEqual(a.cells);
  expect(first.lower).toEqual(a.lower);
  const updated = {
    ...metadata,
    status: { ...status, revision: 2 },
    rooms: [],
  };
  const hit = cache.get(
    ["a", "b"],
    [a, b].map((p) => ({ ...p, status: updated.status })),
    updated,
  );
  expect(hit.cells).toBe(first.cells);
  expect(hit.lower).toBe(first.lower);
  expect(hit.bounds).toBe(first.bounds);
  expect(hit.rooms).toBe(updated.rooms);
  expect(hit.connections).toBe(updated.connections);
  expect(hit.status).toBe(updated.status);
});

it("invalidates changed tile identity, keys, bounds and context", () => {
  const a = tile(0),
    b = tile(1);
  for (const [keys, parts] of [
    [
      ["a", "c"],
      [a, b],
    ],
    [["a"], [a]],
    ...[
      { ...a, bounds: [-1, 0, 0, 0] as DetailTile["bounds"] },
      { ...a, cells: [...a.cells] },
      { ...a, lower: [...a.lower] },
      { ...a, status: { ...status, sessionId: "other" } },
      { ...a, buildingId: "other" },
      { ...a, floor: 1 },
      { ...a, includeLower: false },
    ].map(
      (changed) =>
        [
          ["a", "b"],
          [changed, b],
        ] as [string[], DetailTile[]],
    ),
  ] as [string[], DetailTile[]][]) {
    const cache = new DetailAggregate();
    const first = cache.get(["a", "b"], [a, b], metadata);
    expect(cache.get(keys, parts, metadata).cells).not.toBe(first.cells);
  }
});

it("reuses A/B/A, evicts the least recent entry, respects cell/tile budgets and clears", () => {
  const cache = new DetailAggregate();
  const a = tile(0),
    b = tile(1),
    c = tile(2);
  const first = cache.get(["a"], [a], metadata);
  const second = cache.get(["b"], [b], metadata);
  expect(cache.get(["a"], [a], metadata).cells).toBe(first.cells);
  cache.get(["c"], [c], metadata);
  expect(cache.get(["b"], [b], metadata).cells).not.toBe(second.cells);
  const beforeClear = cache.get(["a"], [a], metadata);
  cache.clear();
  expect(cache.get(["a"], [a], metadata).cells).not.toBe(beforeClear.cells);
  for (const parts of [
    [tile(0, 32_769)],
    Array.from({ length: 33 }, (_, i) => tile(i)),
  ]) {
    const keys = parts.map((_, i) => `tile${i}`);
    const first = cache.get(keys, parts, metadata);
    cache.get(["large"], [tile(100_000, 32_769)], metadata);
    expect(cache.get(keys, parts, metadata).cells).not.toBe(first.cells);
  }
});
