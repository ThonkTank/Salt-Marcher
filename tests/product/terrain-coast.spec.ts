import { expect, test } from "../support/fixture";
import { ready, url } from "../support/editor";

test("Rust water rasters draw without seams at both DPRs and preserve their coverage", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  const result = await page.evaluate(async () => {
    const path = "/src/atlas/terrainView.ts";
    const { TerrainPainter } = (await import(
      /* @vite-ignore */ path
    )) as typeof import("../../src/atlas/terrainView");
    await window.atlasCore("commit", {
      version: await window.atlasCore("status", {}),
      intent: {
        type: "terrainStroke",
        brush: {
          resolution: 0,
          mode: "land",
          radius: 45,
          amount: 1,
          strength: 1,
          target: 10,
          points: [[160, 80]],
        },
      },
    });
    const errors: number[] = [];
    for (const dpr of [1, 2]) {
      const pixels = 256 * dpr;
      const view = await window.atlasCore("terrainTiles", {
        level: 0,
        pixels,
        tiles: [
          [0, 0],
          [1, 0],
        ],
      });
      const canvas = document.createElement("canvas");
      canvas.width = 2 * pixels;
      canvas.height = pixels;
      const c = canvas.getContext("2d")!;
      c.scale(pixels / 160, pixels / 160);
      new TerrainPainter().paint(c, view, pixels / 160, false, undefined, true);
      const actual = c.getImageData(0, 0, 2 * pixels, pixels).data;
      for (const tile of view.tiles) {
        const expected = Uint8Array.from(atob(tile.raster!.water), (c) =>
          c.charCodeAt(0),
        );
        for (let y = 0; y < pixels; y++)
          for (let x = 0; x < pixels; x++) {
            const alpha =
              expected.length === 1
                ? expected[0]
                : expected[(y + 1) * (pixels + 2) + x + 1];
            errors.push(
              Math.abs(
                actual[(y * 2 * pixels + tile.x * pixels + x) * 4 + 3] - alpha,
              ),
            );
          }
      }
    }
    return errors.reduce((max, e) => Math.max(max, e), 0);
  });
  expect(result).toBeLessThanOrEqual(1);
});

test("fractional tile positions preserve opaque relief and translucent water without seams", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  const errors = await page.evaluate(async () => {
    const path = "/src/atlas/terrainView.ts";
    const { TerrainPainter } = (await import(
      /* @vite-ignore */ path
    )) as typeof import("../../src/atlas/terrainView");
    const tiles = [-1, 0, 1].flatMap((y) =>
      [-1, 0, 1].map((x) => ({
        x,
        y,
        contentId: `uniform-${x}-${y}`,
        waters: [],
        foundationTops: [],
        heights: [],
        raster: {
          pixels: 128,
          contourInterval: 5,
          contours: [],
          relief: btoa(String.fromCharCode(178, 185, 151, 255)),
          water: btoa(String.fromCharCode(128)),
        },
      })),
    );
    const view = {
      status: await window.atlasCore("status", {}),
      level: 0,
      tiles,
    };
    const errors: number[] = [];
    for (const dpr of [1, 2])
      for (const scale of [0.6773333333333333, 0.21]) {
        for (const water of [false, true]) {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 120 * dpr;
          const c = canvas.getContext("2d")!;
          c.setTransform(
            scale * dpr,
            0,
            0,
            scale * dpr,
            50.37 * dpr,
            51.61 * dpr,
          );
          new TerrainPainter().paint(c, view, scale, false, undefined, water);
          // Includes horizontal/vertical joins and their crossing, away from outer edges.
          const bytes = c.getImageData(
            30 * dpr,
            30 * dpr,
            40 * dpr,
            40 * dpr,
          ).data;
          for (let i = 3; i < bytes.length; i += 4)
            errors.push(Math.abs(bytes[i] - (water ? 128 : 255)));
        }
      }
    return Math.max(...errors);
  });
  expect(errors).toBe(0);
});
