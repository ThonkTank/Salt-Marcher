import { describe, expect, it } from "vitest";
import { AtlasClient } from "./client";
import { CityCache, GroundCache, TerrainCache } from "./presentationCache";
import { status as makeStatus } from "../../tests/support/atlasFixtures";
import { deferred } from "../../tests/support/deferred";
import type { Status } from "./model";

// Exercise the public layer adapters, including their different revision policies.
for (const [name, Cache, verifyRevision] of [
  ["city", CityCache, false],
  ["ground", GroundCache, false],
  ["terrain", TerrainCache, true],
] as const) {
  describe(`${name} cache lifetime`, () => {
    const bounds = [1, 1, 20, 20] as const;
    const initial = makeStatus();
    function harness() {
      let version = initial;
      const requests: Array<{ level: number; tiles: [number, number][] }> = [];
      const client = new AtlasClient(async (_cmd, args) => {
        const request = args as (typeof requests)[number];
        requests.push(request);
        return response(version, request);
      });
      const cache = new Cache();
      return {
        client,
        cache,
        requests,
        load: (next = version) => {
          version = next;
          return cache.load(client, next, [...bounds], 1, () => true);
        },
      };
    }
    function response(
      status: Status,
      args: { level: number; tiles: [number, number][] },
    ) {
      return {
        status,
        level: args.level,
        tiles: args.tiles.map(([x, y]) => ({
          x,
          y,
          density: [],
          features: [],
          pixels: "",
          contentId: `cache:${x}:${y}`,
          heights: [],
          waters: [],
          foundationTops: [],
        })),
      };
    }
    it("retains clean tiles only across a consecutive revision with complete hints", async () => {
      const h = harness();
      const first = await h.load();
      const next = {
        ...initial,
        revision: 1,
        changes: { world: [], interiors: [], metadata: [], relations: [] },
      };
      const clean = await h.load(next);
      expect(clean?.tiles[0]).toBe(first?.tiles[0]);
      expect(h.requests).toHaveLength(verifyRevision ? 2 : 1);
      if (verifyRevision) expect(h.requests[1].tiles).toEqual([]);
      await h.load({ ...next, revision: 3 });
      expect(h.requests.at(-1)?.tiles.length).toBeGreaterThan(0);
      await h.load({ ...next, sessionId: "new-session" });
      expect(h.requests.at(-1)?.tiles.length).toBeGreaterThan(0);
    });
    it("rejects an old response after client A → B → A even at the same version", async () => {
      const pending = deferred<unknown>();
      let args!: { level: number; tiles: [number, number][] };
      let reads = 0;
      const a = new AtlasClient(async (_cmd, input) => {
        args = input as typeof args;
        if (++reads === 1) return pending.promise;
        return response(initial, args);
      });
      const b = new AtlasClient(async (_cmd, input) =>
        response(initial, input as typeof args),
      );
      const cache = new Cache();
      const old = cache.load(a, initial, [...bounds], 1, () => true);
      await cache.load(b, initial, [...bounds], 1, () => true);
      const current = await cache.load(a, initial, [...bounds], 1, () => true);
      pending.resolve(response(initial, args));
      expect(await old).toBeNull();
      expect(
        (await cache.load(a, initial, [...bounds], 1, () => true))?.tiles[0],
      ).toBe(current?.tiles[0]);
    });
    it("rejects a mismatched response and retries without caching it", async () => {
      let revision = 1;
      const client = new AtlasClient(async (_cmd, input) =>
        response(
          { ...initial, revision },
          input as { level: number; tiles: [number, number][] },
        ),
      );
      const cache = new Cache();
      await expect(
        cache.load(client, initial, [...bounds], 1, () => true),
      ).rejects.toThrow();
      revision = 0;
      expect(
        (await cache.load(client, initial, [...bounds], 1, () => true))?.tiles,
      ).not.toHaveLength(0);
    });
  });
}

it("seeds confirmed terrain without rereading and ignores older confirmations", async () => {
  let reads = 0;
  const client = new AtlasClient(async () => {
    reads++;
    throw Error("unexpected terrain read");
  });
  const cache = new TerrainCache();
  const status = { ...makeStatus(), revision: 2 };
  const tile = {
    contentId: "seed",
    x: 0,
    y: 0,
    heights: [],
    waters: [],
    foundationTops: [],
  };
  cache.seed(client, { status, level: 0, tiles: [tile] });
  cache.seed(client, {
    status: { ...status, revision: 1 },
    level: 0,
    tiles: [{ ...tile, heights: [99] }],
  });
  const result = await cache.load(
    client,
    status,
    [1, 1, 20, 20],
    0,
    () => true,
  );
  expect(result?.tiles[0]).toBe(tile);
  expect(reads).toBe(0);
});

it("revalidates dirty and skipped revisions by content ID, but isolates sessions", async () => {
  const initial = makeStatus();
  let current = initial,
    contentId = "unchanged";
  let reads = 0;
  const client = new AtlasClient(async (_cmd, args) => {
    reads++;
    return {
      status: current,
      level: 0,
      tiles: (args.tiles as [number, number][]).map(([x, y]) => ({
        x,
        y,
        contentId,
        heights: [],
        waters: [],
        foundationTops: [],
      })),
    };
  });
  const cache = new TerrainCache();
  const load = () => cache.load(client, current, [1, 1, 20, 20], 0, () => true);
  const first = (await load())!.tiles[0];
  current = {
    ...initial,
    revision: 1,
    changes: {
      world: [[0, 0, 20, 20]],
      interiors: [],
      metadata: [],
      relations: [],
    },
  };
  expect((await load())!.tiles[0]).toBe(first);
  current = { ...current, revision: 4 };
  expect((await load())!.tiles[0]).toBe(first);
  expect(reads).toBe(3); // IDs never authorize reuse before a fresh read.
  contentId = "changed";
  current = { ...current, revision: 5 };
  expect((await load())!.tiles[0]).not.toBe(first);
  current = { ...initial, sessionId: "replacement" };
  contentId = "unchanged";
  const replacement = (await load())!.tiles[0];
  expect(replacement).not.toBe(first);
  cache.seed(client, {
    status: { ...initial, revision: 99 },
    level: 0,
    tiles: [first],
  });
  expect((await load())!.tiles[0]).toBe(replacement);
});

it("keeps resolution and contour variants separate and trims confirmations immediately", async () => {
  const status = makeStatus();
  const requests: unknown[] = [];
  const client = new AtlasClient(async (_cmd, args) => {
    requests.push(args);
    return {
      status,
      level: args.level,
      tiles: (args.tiles as [number, number][]).map(([x, y]) => ({
        x,
        y,
        contentId: `${x}:${y}:${args.pixels}:${args.contourInterval}`,
        heights: [],
        waters: [],
        foundationTops: [],
        raster: {
          pixels: args.pixels,
          contourInterval: args.contourInterval,
          relief: "",
          water: "",
          contours: [],
        },
      })),
    };
  });
  const cache = new TerrainCache();
  const load = (scale: number) =>
    cache.load(client, status, [1, 1, 20, 20], 0, () => true, scale, 1);
  const fine = (await load(3))!.tiles[0];
  expect((await load(0.1))!.tiles[0]).not.toBe(fine);
  expect((await load(3))!.tiles[0]).toBe(fine);
  expect(requests).toHaveLength(2);
  // No load between these seeds: acknowledgements alone must obey entry limits.
  for (let x = 0; x < 257; x++)
    cache.seed(client, {
      status,
      level: 0,
      tiles: [
        {
          x,
          y: 0,
          contentId: `seed:${x}`,
          heights: [],
          waters: [],
          foundationTops: [],
        },
      ],
    });
  await cache.load(client, status, [1, 1, 20, 20], 0, () => true);
  expect(requests).toHaveLength(3);
});

it("discards an in-flight read superseded by a confirmation and cannot roll revision back", async () => {
  const old = makeStatus(),
    current = { ...old, revision: 1 };
  const pending = deferred<unknown>();
  const client = new AtlasClient(() => pending.promise);
  const cache = new TerrainCache();
  const tile = {
    contentId: "confirmed",
    x: 0,
    y: 0,
    heights: [],
    waters: [],
    foundationTops: [],
  };
  const read = cache.load(client, old, [1, 1, 20, 20], 0, () => true);
  cache.seed(client, { status: current, level: 0, tiles: [tile] });
  pending.resolve({
    status: old,
    level: 0,
    tiles: [{ ...tile, contentId: "obsolete" }],
  });
  expect(await read).toBeNull();
  expect(
    await cache.load(client, old, [1, 1, 20, 20], 0, () => true),
  ).toBeNull();
  expect(
    (await cache.load(client, current, [1, 1, 20, 20], 0, () => true))!
      .tiles[0],
  ).toBe(tile);
});

it("invalidates the relief sampling halo outside the visible tile", async () => {
  let current = makeStatus();
  const requests: [number, number][][] = [];
  const client = new AtlasClient(async (_cmd, args) => {
    const tiles = args.tiles as [number, number][];
    requests.push(tiles);
    return {
      status: current,
      level: 5,
      tiles: tiles.map(([x, y]) => ({
        contentId: "flat",
        x,
        y,
        heights: [],
        waters: [],
        foundationTops: [],
      })),
    };
  });
  const cache = new TerrainCache();
  await cache.load(client, current, [1, 1, 20, 20], 5, () => true);
  current = {
    ...current,
    revision: 1,
    changes: {
      world: [[5300, 20, 5310, 30]],
      interiors: [],
      metadata: [],
      relations: [],
    },
  };
  await cache.load(client, current, [1, 1, 20, 20], 5, () => true);
  expect(requests[1]).toEqual([[0, 0]]);
});
