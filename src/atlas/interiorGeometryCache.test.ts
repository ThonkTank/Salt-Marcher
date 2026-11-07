import { expect, it } from "vitest";
import { InteriorGeometryCache } from "./interiorGeometryCache";
import type { Detail, Status } from "./model";

const detail = (x = 0, size = 1): Detail => ({
  status: { sessionId: "s", revision: 1 } as Status,
  buildingId: "h",
  floor: 0,
  includeLower: true,
  bounds: [x, 0, x, 1],
  cells: Array.from({ length: size }, (_, i) => ({
    x: i,
    y: 0,
    floor: 0,
    roomId: "r",
  })),
  lower: [],
  rooms: [],
  connections: [],
});

it("reuses geometry across revisions and invalidates changed cells, bounds and context", () => {
  const a = detail();
  for (const changed of [
    { ...a, status: { ...a.status, sessionId: "other" } },
    { ...a, buildingId: "other" },
    { ...a, floor: 1 },
    { ...a, includeLower: false },
    { ...a, bounds: [0, 0, 32, 31] as Detail["bounds"] },
    { ...a, cells: [...a.cells] },
    { ...a, lower: [...a.lower] },
  ]) {
    const cache = new InteriorGeometryCache(() => ({}));
    const first = cache.get(a);
    expect(cache.get({ ...a, status: { ...a.status, revision: 2 } })).toBe(
      first,
    );
    expect(cache.get(changed)).not.toBe(first);
  }
});

it("reuses A/B/A paths, evicts by recency and budget, and clears", () => {
  const cache = new InteriorGeometryCache(() => ({}));
  const a = detail(0),
    b = detail(1),
    c = detail(2);
  const first = cache.get(a),
    second = cache.get(b);
  expect(cache.get(a)).toBe(first);
  cache.get(c);
  expect(cache.get(b)).not.toBe(second);
  const beforeClear = cache.get(a);
  cache.clear();
  expect(cache.get(a)).not.toBe(beforeClear);
  const bigA = detail(3, 32_769),
    bigB = detail(4, 32_769);
  const big = cache.get(bigA);
  cache.get(bigB);
  expect(cache.get(bigA)).not.toBe(big);
});
