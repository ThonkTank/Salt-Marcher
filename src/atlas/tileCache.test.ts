import { knownChanges } from "./documentVersion";
import { describe, expect, it, vi } from "vitest";
import {
  tileAffected,
  TileCache,
  tileKey,
  type TileContext,
} from "./tileCache";
import type { DetailTile, Status } from "./model";

const context: TileContext = {
  session: "s",
  revision: 1,
  house: "h",
  editor: "house:h",
  selectedId: "",
  floor: 0,
  lower: true,
  retry: 0,
  enabled: true,
};
const tile = (cells = 0, lower = 0) =>
  ({
    cells: Array(cells).fill({}),
    lower: Array(lower).fill({}),
  }) as DetailTile;
const yes = () => true;
const status = (
  revision: number,
  interiors: NonNullable<Status["changes"]>["interiors"] = [],
): Status => ({
  sessionId: "s",
  revision,
  path: null,
  dirty: true,
  canUndo: true,
  canRedo: false,
  changes: { world: [], metadata: [], interiors, relations: [] },
});
const realTile = (x: number, floor = 0, lower = true): DetailTile => ({
  status: status(1),
  buildingId: "h",
  floor,
  includeLower: lower,
  bounds: [x * 128, 0, x * 128 + 127, 127],
  cells: [{ floor, x: x * 128, y: 0, roomId: `room${x}` }],
  lower: [],
});
const owner = Symbol();
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};

describe("tile cache", () => {
  it("uses the inclusive SQL halo and every lower floor only when enabled", () => {
    const tile = realTile(0, 2);
    const region = (floor: number, x: number, buildingId = "h") => ({
      buildingId,
      floor,
      bounds: [x, 5, x, 5] as [number, number, number, number],
    });
    for (const r of [region(2, -1), region(2, 128), region(-100, 5)])
      expect(tileAffected(tile, knownChanges(status(2, [r]))!)).toBe(true);
    for (const r of [
      region(2, -2),
      region(2, 129),
      region(3, 5),
      region(2, 5, "other"),
    ])
      expect(tileAffected(tile, knownChanges(status(2, [r]))!)).toBe(false);
    expect(
      tileAffected(
        { ...tile, includeLower: false },
        knownChanges(status(2, [region(-100, 5)]))!,
      ),
    ).toBe(false);
  });
  it("promotes only fulfilled unaffected tiles across known adjacent revisions", async () => {
    const cache = new TileCache();
    cache.setContext(context);
    const load = vi.fn(async (_wanted: () => boolean) => realTile(0));
    const old = await cache.get(context, 0, 0, owner, load, yes);
    await cache.get(context, 1, 0, owner, async () => realTile(1), yes);
    const next = { ...context, revision: 2 };
    cache.setContext(
      next,
      status(2, [{ buildingId: "h", floor: 0, bounds: [128, 0, 128, 0] }]),
    );
    // x=128 touches tile 0's halo and tile 1's core.
    const refetch = vi.fn(async () => realTile(0));
    await cache.get(next, 0, 0, owner, refetch, yes);
    expect(refetch).toHaveBeenCalledTimes(1);
    const keep = new TileCache();
    keep.setContext(context);
    await keep.get(context, 0, 0, owner, async () => old, yes);
    keep.setContext(
      next,
      status(2, [{ buildingId: "h", floor: 0, bounds: [129, 0, 129, 0] }]),
    );
    const promoted = await keep.get(next, 0, 0, owner, refetch, yes);
    expect(promoted?.status.revision).toBe(2);
    expect(promoted?.cells).toBe(old?.cells);
    expect(refetch).toHaveBeenCalledTimes(1);
    for (const [revision, hint] of [
      [4, status(4)],
      [5, { ...status(5), changes: null }],
    ] as const) {
      const nextContext = { ...context, revision };
      keep.setContext(nextContext, hint);
      await keep.get(nextContext, 0, 0, owner, refetch, yes);
    }
    expect(refetch).toHaveBeenCalledTimes(3);
  });
  it("keys every identity component without collisions", () => {
    const key = tileKey(context, -1, 2);
    for (const changed of [
      { session: "s2" },
      { house: "h2" },
      { editor: "parcel:p" },
      { selectedId: "p" },
      { floor: -1 },
      { lower: false },
    ])
      expect(tileKey({ ...context, ...changed }, -1, 2)).not.toBe(key);
    expect(tileKey(context, 1, 2)).not.toBe(key);
    expect(tileKey(context, -1, -2)).not.toBe(key);
  });
  it("deduplicates across owners, retains physical work after release, and retries errors", async () => {
    const cache = new TileCache();
    cache.setContext(context);
    const pending = deferred<DetailTile | undefined>();
    const load = vi.fn(() => pending.promise);
    const a = cache.get(context, 0, 0, owner, load, yes);
    cache.release(owner);
    const b = cache.get(context, 0, 0, Symbol(), load, yes);
    pending.resolve(tile(1));
    expect(await a).toBe(await b);
    expect(load).toHaveBeenCalledTimes(1);
    const fail = vi
      .fn()
      .mockRejectedValueOnce(Error("failed"))
      .mockResolvedValueOnce(tile(2));
    await expect(cache.get(context, 1, 0, owner, fail, yes)).rejects.toThrow(
      "failed",
    );
    expect(
      (await cache.get(context, 1, 0, owner, fail, yes))?.cells,
    ).toHaveLength(2);
    expect(fail).toHaveBeenCalledTimes(2);
  });
  it("bounds empty entries and record totals with deterministic LRU; oversized tiles are not retained", async () => {
    const cache = new TileCache(2, 3);
    cache.setContext(context);
    const load = vi.fn(async () => tile());
    await cache.get(context, 0, 0, owner, load, yes);
    await cache.get(context, 1, 0, owner, load, yes);
    await cache.get(context, 0, 0, owner, load, yes);
    await cache.get(context, 2, 0, owner, load, yes);
    await cache.get(context, 1, 0, owner, load, yes);
    expect(load).toHaveBeenCalledTimes(4);
    const dense = vi.fn(async () => tile(2, 1));
    await cache.get(context, 3, 0, owner, dense, yes);
    await cache.get(context, 4, 0, owner, async () => tile(1), yes);
    await cache.get(context, 3, 0, owner, dense, yes);
    expect(dense).toHaveBeenCalledTimes(2);
    const big = vi.fn(async () => tile(4));
    await cache.get(context, 5, 0, owner, big, yes);
    await cache.get(context, 5, 0, owner, big, yes);
    expect(big).toHaveBeenCalledTimes(2);
  });
  it("rejects invalid tiles and isolates late responses on each lifecycle boundary", async () => {
    for (const change of [
      { session: "s2" },
      { house: "h2" },
      { editor: "parcel:p" },
      { selectedId: "p" },
      { floor: 1 },
      { lower: false },
      { revision: 2 },
      { retry: 1 },
      { enabled: false },
    ]) {
      const cache = new TileCache();
      cache.setContext(context);
      const pending = deferred<DetailTile | undefined>();
      const old = cache.get(context, 0, 0, owner, () => pending.promise, yes);
      const next = { ...context, ...change };
      cache.setContext(next);
      pending.resolve(tile(1));
      await old;
      const load = vi.fn(async () => tile(2));
      expect(
        (await cache.get(next, 0, 0, owner, load, yes))?.cells,
      ).toHaveLength(2);
      expect(load).toHaveBeenCalledTimes(1);
    }
    const cache = new TileCache();
    cache.setContext(context);
    const load = vi.fn(async () => tile());
    await expect(
      cache.get(context, 0, 0, owner, load, () => false),
    ).rejects.toThrow();
    await cache.get(context, 0, 0, owner, load, yes);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("does not admit a queued request without a current owner", async () => {
    const cache = new TileCache();
    cache.setContext(context);
    let wanted!: () => boolean;
    const gate = deferred<void>();
    const promise = cache.get(
      context,
      0,
      0,
      owner,
      async (check) => {
        wanted = check;
        await gate.promise;
        return check() ? tile() : undefined;
      },
      yes,
    );
    await Promise.resolve();
    cache.release(owner);
    expect(wanted()).toBe(false);
    gate.resolve();
    expect(await promise).toBeUndefined();
  });
});
