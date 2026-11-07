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
    setTransform() {},
    getTransform() {
      return { a: 1, d: 1, e: 0, f: 0 };
    },
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

it("keeps soil and rock pigments separate and snow above both", () => {
  let output = new Uint8ClampedArray();
  vi.stubGlobal("document", {
    createElement: () => ({
      getContext: () => ({
        createImageData: () => ({ data: new Uint8ClampedArray(66 * 66 * 4) }),
        putImageData: (image: { data: Uint8ClampedArray }) => {
          output = image.data;
        },
      }),
    }),
  });
  const context = {
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    setTransform() {},
    getTransform() {
      return { a: 1, d: 1, e: 0, f: 0 };
    },
    clip() {},
    drawImage() {},
  } as unknown as CanvasRenderingContext2D;
  const pixels = btoa(
    atob(pixelString(255, 0, 0, 255)) + atob(pixelString(0, 0, 255, 255)),
  );
  const view = { status, level: 0, tiles: [{ x: 0, y: 0, pixels }] };
  try {
    expect(groundColorAt(view, [1, 1], "soil")).toEqual([255, 0, 0]);
    expect(groundColorAt(view, [1, 1], "rock")).toEqual([0, 0, 255]);
    for (const [rock, snow, expected] of [
      [0, 0, [255, 0, 0, 255]],
      [255, 0, [0, 0, 255, 255]],
      [128, 0, [127, 0, 128, 255]],
      [255, 255, [245, 247, 250, 255]],
    ] as const) {
      const terrain = {
        status,
        level: 0,
        tiles: [
          {
            x: 0,
            y: 0,
            contentId: `material-test:${rock}:${snow}`,
            heights: [],
            waters: [],
            foundationTops: [],
            raster: {
              pixels: 2,
              contourInterval: 5,
              contours: [],
              relief: btoa(String.fromCharCode(178, 185, 151, 255)),
              materials: btoa(String.fromCharCode(rock, snow, 222)),
              water: btoa("\0"),
            },
          },
        ],
      };
      new GroundPainter().paint(context, view, terrain);
      const i = (2 * 66 + 2) * 4;
      expect(Array.from(output.slice(i, i + 4))).toEqual(expected);
    }
  } finally {
    vi.unstubAllGlobals();
  }
});

it("composes semantic landscape weights independently and preserves snow", () => {
  let output = new Uint8ClampedArray();
  vi.stubGlobal("document", {
    createElement: () => ({
      getContext: () => ({
        createImageData: () => ({ data: new Uint8ClampedArray(66 * 66 * 4) }),
        putImageData: (image: { data: Uint8ClampedArray }) => {
          output = image.data;
        },
      }),
    }),
  });
  const context = {
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    setTransform() {},
    getTransform() {
      return { a: 1, d: 1, e: 0, f: 0 };
    },
    clip() {},
    drawImage() {},
  } as unknown as CanvasRenderingContext2D;
  try {
    const painter = new GroundPainter();
    const view = {
      status,
      level: 0,
      tiles: [{ x: 0, y: 0, pixels: pixelString(128, 0, 0, 0) }],
    };
    painter.paintLandscape(context, view, undefined);
    expect(Array.from(output.slice(0, 4))).toEqual([77, 112, 70, 128]);
    const terrain = {
      status,
      level: 0,
      tiles: [
        {
          x: 0,
          y: 0,
          contentId: "landscape-snow",
          heights: [],
          waters: [],
          foundationTops: [],
          raster: {
            pixels: 2,
            contourInterval: 5,
            contours: [],
            relief: btoa(String.fromCharCode(178, 185, 151, 255)),
            materials: btoa(String.fromCharCode(0, 255, 222)),
            water: btoa("\0"),
          },
        },
      ],
    };
    painter.paintLandscape(context, view, terrain);
    const i = (2 * 66 + 2) * 4;
    expect(Array.from(output.slice(i, i + 4))).toEqual([245, 247, 250, 128]);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("does no raster or symbol work for wholly empty landscape responses", () => {
  const create = vi.fn();
  vi.stubGlobal("document", { createElement: create });
  const context = {} as CanvasRenderingContext2D;
  try {
    new GroundPainter().paintLandscape(
      context,
      { status, level: 0, tiles: [{ x: 0, y: 0, pixels: "" }] },
      undefined,
    );
    new GroundPainter().paintLandscapeSymbols(
      context,
      { status, level: 0, tiles: [{ x: 0, y: 0, pixels: "" }] },
      undefined,
      1,
    );
    expect(create).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

it.each(
  [1, 1.5, 2].flatMap((dpr) =>
    [-130000, 0, 130000].map((origin) => ({ dpr, origin })),
  ),
)(
  "clips adjacent landscapes directly in device pixels at DPR $dpr and world tile $origin",
  ({ dpr, origin }) => {
    const transform = {
      a: 0.73 * dpr,
      b: 0,
      c: 0,
      d: 0.73 * dpr,
      e: (-origin * 256 * 0.73 + 13.37) * dpr,
      f: (origin * 256 * 0.73 + 5.19) * dpr,
    };
    let active: number[] = [
      transform.a,
      0,
      0,
      transform.d,
      transform.e,
      transform.f,
    ];
    const clips: number[][] = [];
    const drawImage = vi.fn((..._args: unknown[]) =>
      expect(active).toEqual([1, 0, 0, 1, 0, 0]),
    );
    const context = {
      save() {},
      restore() {},
      beginPath() {},
      clip() {},
      getTransform: () => transform,
      setTransform: (...args: unknown[]) => {
        active =
          args.length === 1
            ? [transform.a, 0, 0, transform.d, transform.e, transform.f]
            : (args as number[]);
      },
      rect: (...args: number[]) => {
        expect(active).toEqual([1, 0, 0, 1, 0, 0]);
        clips.push(args);
      },
      drawImage,
    } as unknown as CanvasRenderingContext2D;
    vi.stubGlobal("document", {
      createElement: () => ({
        getContext: () => ({
          createImageData: () => ({ data: new Uint8ClampedArray(66 * 66 * 4) }),
          putImageData() {},
        }),
      }),
    });
    try {
      const tiles = [origin - 1, origin, origin + 1].map((x) => ({
        x,
        y: -origin,
        pixels: pixelString(128, 0, 0, 0),
      }));
      new GroundPainter().paintLandscape(
        context,
        { status, level: 2, tiles },
        undefined,
      );
      for (const clip of clips) expect(clip.every(Number.isInteger)).toBe(true);
      expect(clips[0][0] + clips[0][2]).toBe(clips[1][0]);
      expect(clips[1][0] + clips[1][2]).toBe(clips[2][0]);
      for (let i = 0; i < tiles.length; i++) {
        expect(
          Math.abs(
            clips[i][0] - (tiles[i].x * 256 * transform.a + transform.e),
          ),
        ).toBeLessThanOrEqual(0.5);
        const imageArgs = drawImage.mock.calls[i].slice(1) as number[];
        const expected = [
          ((i - 1) * 256 * 0.73 + 13.37 - 4 * 0.73) * dpr,
          (5.19 - 4 * 0.73) * dpr,
          264 * 0.73 * dpr,
          264 * 0.73 * dpr,
        ];
        // Translating the viewport by millions of feet must still send the same
        // small device coordinates to the raster API (including its full halo).
        expected.forEach((value, k) =>
          expect(imageArgs[k]).toBeCloseTo(value, 6),
        );
      }
    } finally {
      vi.unstubAllGlobals();
    }
  },
);

it("skips empty ground raster work while preserving soil and rock pipette colors", () => {
  const view: GroundResponse = {
    status,
    level: 0,
    tiles: [{ x: -1, y: -1, pixels: "" }],
  };
  const create = vi.fn();
  vi.stubGlobal("document", { createElement: create });
  try {
    new GroundPainter().paint({} as CanvasRenderingContext2D, view);
    expect(create).not.toHaveBeenCalled();
    expect(groundColorAt(view, [-1, -1], "soil")).toEqual([178, 185, 151]);
    expect(groundColorAt(view, [-1, -1], "rock")).toEqual([145, 142, 137]);
    expect(groundColorAt(view, [100, 100])).toBeNull();
  } finally {
    vi.unstubAllGlobals();
  }
});
