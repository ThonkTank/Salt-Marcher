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
