import { decideLod } from "./lod";
import { describe, expect, it, vi } from "vitest";
import { groundColorAt, groundRequest, GroundPainter } from "./groundView";
import { GroundCache } from "./presentationCache";
import { AtlasClient } from "./client";
import type { GroundArgs } from "./generated/GroundArgs";
import type { GroundResponse } from "./generated/GroundResponse";
import type { Status } from "./model";
const status = { sessionId: "ground", revision: 0, changes: null } as Status;
const pixelString = (r = 0, g = 0, b = 0, a = 0) =>
  btoa(String.fromCharCode(r, g, b, a).repeat(66 * 66));
describe("ground presentation", () => {
  it("bounds requests at every zoom including negative world coordinates", () => {
    for (const scale of [0.000064, 0.064, 1.28, 6.4, 64]) {
      const args = groundRequest(
        [-720 / scale, -480 / scale, 720 / scale, 480 / scale],
        decideLod(scale).groundLevel,
      );
      expect(args.tiles.length).toBeLessThanOrEqual(64);
      expect(args.tiles.length).toBeGreaterThan(0);
      expect(args.level).toBeGreaterThanOrEqual(0);
      expect(args.level).toBeLessThanOrEqual(24);
    }
  });
  it("pipette composites premultiplied color over unshaded soil", () => {
    const view: GroundResponse = {
      status,
      level: 0,
      tiles: [{ x: -1, y: -1, pixels: pixelString(60, 100, 40, 128) }],
    };
    expect(groundColorAt(view, [-2, -2])).toEqual([149, 192, 115]);
    expect(groundColorAt(view, [200, 200])).toBeNull();
  });
  it("reuses tiles and invalidates adjacent halos on an edit", async () => {
    const requests: GroundArgs[] = [];
    let version = status;
    const client = new AtlasClient(async (cmd, args) => {
      expect(cmd).toBe("groundTiles");
      const input = args as GroundArgs;
      requests.push(input);
      return {
        status: version,
        level: input.level,
        tiles: input.tiles.map(([x, y]) => ({ x, y, pixels: pixelString() })),
      };
    });
    const cache = new GroundCache();
    await cache.load(client, status, [0, 0, 120, 30], 0, () => true);
    await cache.load(client, status, [0, 0, 120, 30], 0, () => true);
    expect(requests).toHaveLength(1);
    version = {
      ...status,
      revision: 1,
      changes: {
        world: [[63, 10, 64, 11]],
        interiors: [],
        metadata: [],
        relations: [],
      },
    };
    await cache.load(client, version, [0, 0, 120, 30], 0, () => true);
    expect(requests[1].tiles).toContainEqual([0, 0]);
    expect(requests[1].tiles).toContainEqual([1, 0]);
  });
  it("does not publish a response after its request has been superseded", async () => {
    let release!: (value: GroundResponse) => void;
    const client = new AtlasClient(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    let wanted = true;
    const task = new GroundCache().load(
      client,
      status,
      [0, 0, 10, 10],
      1,
      () => wanted,
    );
    wanted = false;
    release({ status, level: 0, tiles: [] });
    expect(await task).toBeNull();
  });
});

it("reuses shaded rasters across navigation and redraws only changed local dependencies", () => {
  const rasterize = vi.fn();
  const context = {
    createImageData: () => ({ data: new Uint8ClampedArray(66 * 66 * 4) }),
    putImageData: rasterize,
  };
  vi.stubGlobal("document", {
    createElement: () => ({ getContext: () => context }),
  });
  const c = {
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    drawImage() {},
  } as unknown as CanvasRenderingContext2D;
  const tile = (x: number) => ({
    contentId: `ground:${x}`,
    x,
    y: 0,
    heights: Array(1089).fill(0) as number[],
    waters: [],
    foundationTops: [],
  });
  const local = tile(0),
    distant = tile(10);
  const ground = {
    status,
    level: 0,
    tiles: [{ x: 0, y: 0, pixels: pixelString(80, 90, 40, 255) }],
  };
  const painter = new GroundPainter();
  try {
    painter.paint(c, ground, { status, level: 0, tiles: [local, distant] });
    expect(rasterize).toHaveBeenCalledTimes(1);
    // A new response and an offscreen edit do not change the shaded pixels.
    painter.paint(c, ground, { status, level: 0, tiles: [local, tile(10)] });
    expect(rasterize).toHaveBeenCalledTimes(1);
    const changed = tile(0);
    changed.heights = changed.heights.map((_, i) => (i % 33) * 10);
    painter.paint(c, ground, { status, level: 0, tiles: [changed, distant] });
    expect(rasterize).toHaveBeenCalledTimes(2);
    // Newly available neighboring heights change edge relief as well.
    painter.paint(c, ground, { status, level: 0, tiles: [changed, tile(-1)] });
    expect(rasterize).toHaveBeenCalledTimes(3);
    painter.paint(c, ground);
    expect(rasterize).toHaveBeenCalledTimes(4);
  } finally {
    vi.unstubAllGlobals();
  }
});
