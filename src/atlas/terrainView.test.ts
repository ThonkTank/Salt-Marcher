import { TerrainCache } from "./presentationCache";
import { describe, it, expect } from "vitest";
import { terrainRequest, heightAt } from "./terrainView";
import type { AtlasClient } from "./client";
import type { Status } from "./model";
import type { TerrainResponse } from "./generated/TerrainResponse";
const status = { sessionId: "terrain-test", revision: 0 } as Status;
const tile = {
  foundationTops: [] as [string, number][],
  x: 0,
  y: 0,
  heights: Array.from(
    { length: 1089 },
    (_, i) => Math.floor(i / 33) + (i % 33),
  ),
};
describe("terrain presentation", () => {
  it("uses the same diagonal interpolation, handles missing and negative tiles", () => {
    const view: TerrainResponse = {
      status,
      level: 0,
      waterLevel: 0,
      tiles: [tile],
    };
    expect(heightAt(view, [2.5, 2.5])).toBe(1);
    expect(heightAt(view, [4, 1])).toBe(1);
    expect(heightAt(view, [-1, 0])).toBeNull();
    expect(
      heightAt(
        { ...view, tiles: [{ ...tile, x: -1, y: -1 }] },
        [-157.5, -157.5],
      ),
    ).toBe(1);
  });
  it("bounds requests at every zoom and covers the viewport with world anchored tiles", () => {
    for (const scale of [6.4, 1.28, 0.32, 0.001, 0.000064]) {
      const bounds: [number, number, number, number] = [
        -1000 / scale,
        -500 / scale,
        1000 / scale,
        500 / scale,
      ];
      const args = terrainRequest(bounds, scale);
      expect(args.tiles.length).toBeGreaterThan(0);
      expect(args.tiles.length).toBeLessThanOrEqual(64);
      expect(args.level).toBeLessThanOrEqual(21);
    }
  });
  it("caches same revision and refuses an obsolete read after a newer revision", async () => {
    const requests: { resolve: (v: TerrainResponse) => void }[] = [];
    const client = {
      read: () =>
        new Promise<TerrainResponse>((resolve) => requests.push({ resolve })),
    } as unknown as AtlasClient;
    const cache = new TerrainCache();
    let wanted = true;
    const first = cache.load(client, status, [0, 0, 20, 20], 3.2, () => wanted);
    await Promise.resolve();
    await Promise.resolve();
    expect(requests).toHaveLength(1);
    wanted = false;
    requests[0].resolve({ status, level: 0, waterLevel: 0, tiles: [tile] });
    expect(await first).toBeNull();
    const nextStatus = { ...status, revision: 1 };
    const next = cache.load(
      client,
      nextStatus,
      [0, 0, 20, 20],
      3.2,
      () => true,
    );
    await Promise.resolve();
    await Promise.resolve();
    requests[1].resolve({
      status: nextStatus,
      level: 0,
      waterLevel: 12,
      tiles: [tile],
    });
    expect((await next)?.waterLevel).toBe(12);
    expect(
      (await cache.load(client, nextStatus, [0, 0, 20, 20], 3.2, () => true))
        ?.tiles[0],
    ).toEqual(tile);
    expect(requests).toHaveLength(2);
  });
});
