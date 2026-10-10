import { PNG } from "pngjs";
import { RASTER_CANARY } from "./fixture.mjs";

const distance = (a, b) =>
  Math.max(...a.map((value, index) => Math.abs(value - b[index])));

export function canaryPixels(scale = 1, transform = (value) => value) {
  const width = RASTER_CANARY.width * scale,
    height = RASTER_CANARY.height * scale;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.floor(x / scale),
        sourceY = Math.floor(y / scale);
      const color =
        RASTER_CANARY.colors[
          (sourceX + 2 * sourceY) % RASTER_CANARY.colors.length
        ].map(transform);
      const offset = 4 * (y * width + x);
      data.set([...color, 255], offset);
    }
  return { width, height, data };
}

export function findPrivateRaster({ width, height, data }, tolerance = 18) {
  for (const scale of [1, 2, 3]) {
    const targetWidth = RASTER_CANARY.width * scale,
      targetHeight = RASTER_CANARY.height * scale;
    for (let y = 0; y <= height - targetHeight; y += 1)
      for (let x = 0; x <= width - targetWidth; x += 1) {
        let matched = true;
        for (let cy = 0; cy < RASTER_CANARY.height && matched; cy += 1) {
          for (let cx = 0; cx < RASTER_CANARY.width; cx += 1) {
            const actualOffset =
              4 * ((y + cy * scale) * width + x + cx * scale);
            const actual = [...data.subarray(actualOffset, actualOffset + 3)];
            const expected =
              RASTER_CANARY.colors[(cx + 2 * cy) % RASTER_CANARY.colors.length];
            if (distance(actual, expected) > tolerance) {
              matched = false;
              break;
            }
          }
        }
        if (matched) return { x, y, scale };
      }
  }
  return null;
}

export const readPng = (bytes) => PNG.sync.read(bytes);
