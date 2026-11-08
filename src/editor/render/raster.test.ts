import { expect, it } from "vitest";
import { rasterize } from "./raster";

it("samples a clipped world-edge tile inside each axis, including partial updates", () => {
  const visited: [number, number][] = [];
  const sample = (x: number, y: number) => {
    if (x < 0 || x > 67_108_864 || y < 67_108_864 || y > 100_000_000)
      throw new Error("World-edge sampling escaped the world");
    visited.push([x, y]);
    return -100;
  };
  const bounds: [number, number, number, number] = [
    0, 67_108_864, 67_108_864, 100_000_000,
  ];
  const pixels = rasterize(sample, bounds, 128, [126, 126, 128, 128]);
  expect(visited).toHaveLength(4);
  expect(visited[3]).toEqual([
    (67_108_864 * 127.5) / 128,
    67_108_864 + (32_891_136 * 127.5) / 128,
  ]);
  expect([...pixels]).toEqual([
    76, 128, 151, 255, 76, 128, 151, 255, 76, 128, 151, 255, 76, 128, 151, 255,
  ]);
});
