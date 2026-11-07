import { afterEach, expect, it, vi } from "vitest";
import {
  decodeBytes,
  terrainImage,
  prepareMaterialSampler,
} from "./terrainRaster";
import type { SurfaceTile } from "./generated/SurfaceTile";
import type { TerrainResponse } from "./generated/TerrainResponse";
afterEach(() => vi.unstubAllGlobals());
it("decodes opaque relief and constant water with a shared pixel halo", () => {
  const data: Uint8ClampedArray[] = [];
  vi.stubGlobal("document", {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        createImageData: (w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
        }),
        putImageData: (image: { data: Uint8ClampedArray }) =>
          data.push(image.data),
      }),
    }),
  });
  const rgba = Array.from({ length: 16 }, () => [178, 185, 151, 255]).flat();
  const tile: SurfaceTile = {
    contentId: "decode-test",
    x: -1,
    y: 0,
    heights: [],
    waters: [],
    foundationTops: [],
    raster: {
      contourInterval: 5,
      pixels: 2,
      relief: btoa(String.fromCharCode(...rgba)),
      materials: btoa(String.fromCharCode(0, 0, 222)),
      water: btoa(String.fromCharCode(127)),
      contours: [],
    },
  };
  expect([...decodeBytes(btoa("abc"))]).toEqual([97, 98, 99]);
  const image = terrainImage(tile, false);
  expect(image.width).toBe(4);
  expect([...data[0]]).toEqual(rgba);
  expect(terrainImage(structuredClone(tile), false)).toBe(image);
  expect(terrainImage(tile, true).width).toBe(1);
  expect([...data[1]]).toEqual([134, 184, 198, 127]);
  const constant = structuredClone(tile);
  constant.contentId = "constant-relief-test";
  constant.raster!.pixels = 1024;
  constant.raster!.relief = btoa(String.fromCharCode(178, 185, 151, 255));
  expect(terrainImage(constant, false).width).toBe(1);
  expect([...data[2]]).toEqual([178, 185, 151, 255]);
  const patterned = structuredClone(tile);
  patterned.contentId = "patterned-water-test";
  patterned.raster!.water = btoa(
    String.fromCharCode(...Array.from({ length: 16 }, (_, i) => i * 17)),
  );
  expect(terrainImage(patterned, true).width).toBe(4);
  expect([...data[3]].filter((_, i) => i % 4 === 3)).toEqual(
    Array.from({ length: 16 }, (_, i) => i * 17),
  );
  expect(
    prepareMaterialSampler({ level: 0, tiles: [tile] } as TerrainResponse)(
      -80,
      80,
    )[2],
  ).toBeCloseTo(1, 2);
});
