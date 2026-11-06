import { decideLod } from "./lod";
import { TerrainCache } from "./presentationCache";
import { describe, it, expect } from "vitest";
import { terrainRequest, heightAt } from "./terrainView";
import type { AtlasClient } from "./client";
import type { Status } from "./model";
import type { TerrainResponse } from "./generated/TerrainResponse";
const status = { sessionId: "terrain-test", revision: 0 } as Status;
const tile = {
  waters: [],
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
      const args = terrainRequest(bounds, decideLod(scale).terrainLevel);
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
    const first = cache.load(client, status, [0, 0, 20, 20], 0, () => wanted);
    await Promise.resolve();
    await Promise.resolve();
    expect(requests).toHaveLength(1);
    wanted = false;
    requests[0].resolve({ status, level: 0, tiles: [tile] });
    expect(await first).toBeNull();
    const nextStatus = { ...status, revision: 1 };
    const next = cache.load(client, nextStatus, [0, 0, 20, 20], 0, () => true);
    await Promise.resolve();
    await Promise.resolve();
    requests[1].resolve({
      status: nextStatus,
      level: 0,
      tiles: [tile],
    });
    expect((await next)?.status).toEqual(nextStatus);
    expect(
      (await cache.load(client, nextStatus, [0, 0, 20, 20], 0, () => true))
        ?.tiles[0],
    ).toEqual(tile);
    expect(requests).toHaveLength(2);
  });
});

it("samples independent neighboring tiles across negative coordinates and LOD changes", () => {
  for (const level of [0, 8]) {
    const step = 5 * 2 ** level;
    const tiles = Array.from({ length: 64 }, (_, i) => {
      const x = (i % 8) - 4,
        y = Math.floor(i / 8) - 4;
      return {
        ...tile,
        x,
        y,
        heights: Array.from(
          { length: 1089 },
          (_, j) =>
            ((x * 32 + (j % 33)) * 0.25 + (y * 32 + Math.floor(j / 33)) * 0.5) *
            step,
        ),
      };
    });
    const view = { status, level, tiles };
    for (const tile of tiles) {
      const x = (tile.x * 32 + 0.25) * step;
      const y = (tile.y * 32 + 31.75) * step;
      expect(heightAt(view, [x, y])).toBeCloseTo(x * 0.25 + y * 0.5);
    }
    expect(heightAt(view, [4 * 32 * step, 0])).toBeNull();
  }
});
