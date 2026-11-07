import { expect, test } from "../support/fixture";
import {
  calls,
  paintedReady,
  ready,
  status,
  settled,
  url,
} from "../support/editor";
import type { TerrainArgs } from "../../src/atlas/generated/TerrainArgs";

test("high peaks stay snowy while rock and soil colors paint independently", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Höhen", exact: true }).click();
  await page.getByLabel("Pinselmodus").selectOption("mountains");
  await page.getByLabel("Breite (Meter)").fill("12192");
  await page.getByLabel("Breite (Meter)").press("Enter");
  await page.getByRole("button", { name: "Auf Pinselgröße zoomen" }).click();
  await page.getByLabel("Höhenlinien").uncheck();
  await page.getByLabel("Reliefhöhe (Meter)").fill("8500");
  await page.getByLabel("Reliefhöhe (Meter)").press("Enter");
  await paintedReady(page);
  for (let pass = 0; pass < 2; pass++) {
    await page.mouse.move(500, 460);
    await page.mouse.down();
    await page.mouse.move(800, 400, { steps: 24 });
    await page.mouse.up();
    await expect
      .poll(() => page.evaluate(() => window.atlasWritesIdle()), {
        timeout: 30_000,
      })
      .toBe(true);
    await settled(page);
    await paintedReady(page);
  }
  const requests = (await calls(page, "terrainTiles")).map(
    (c) => c.args as TerrainArgs,
  );
  const args = requests.at(-1)!;
  args.tiles = [
    ...new Map(
      requests
        .filter((r) => r.level === args.level)
        .flatMap((r) => r.tiles)
        .map((t) => [t.join(":"), t]),
    ).values(),
  ];
  const points = await page.evaluate(async (args) => {
    const view = await window.atlasCore("terrainTiles", args);
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-testid="atlas-canvas"]',
    )!;
    const rect = canvas.getBoundingClientRect(),
      matrix = canvas.getContext("2d")!.getTransform(),
      ratio = canvas.width / rect.width;
    const result: Record<string, { x: number; y: number }> = {};
    for (const tile of view.tiles) {
      const data = Uint8Array.from(atob(tile.raster!.materials), (c) =>
        c.charCodeAt(0),
      );
      if (data.length === 3) continue;
      for (let y = 2; y < 33; y++)
        for (let x = 2; x < 33; x++) {
          const index = (y * 35 + x) * 3;
          const kind =
            data[index] === 255 && data[index + 1] === 0
              ? "rock"
              : data[index + 1] === 255
                ? "snow"
                : "";
          if (!kind || result[kind]) continue;
          if (
            [-1, 0, 1].some((dy) =>
              [-1, 0, 1].some(
                (dx) =>
                  data[((y + dy) * 35 + x + dx) * 3 + 1] !==
                    (kind === "snow" ? 255 : 0) ||
                  (kind === "rock" &&
                    data[((y + dy) * 35 + x + dx) * 3] !== 255),
              ),
            )
          )
            continue;
          const width = 160 * 2 ** view.level;
          const wx = (tile.x + (x - 1) / 32) * width,
            wy = (tile.y + (y - 1) / 32) * width;
          const px = (wx * matrix.a + matrix.e) / ratio,
            py = (wy * matrix.d + matrix.f) / ratio;
          if (
            px < 180 ||
            px > rect.width - 100 ||
            py < 180 ||
            py > rect.height - 150
          )
            continue;
          result[kind] = { x: rect.left + px, y: rect.top + py };
        }
    }
    return result;
  }, args);
  expect(points.rock).toBeDefined();
  expect(points.snow).toBeDefined();
  const pixel = (point: { x: number; y: number }) =>
    page
      .getByTestId("atlas-canvas")
      .evaluate((canvas: HTMLCanvasElement, p) => {
        const rect = canvas.getBoundingClientRect(),
          ratio = canvas.width / rect.width;
        return Array.from(
          canvas
            .getContext("2d")!
            .getImageData(
              Math.floor((p.x - rect.left) * ratio),
              Math.floor((p.y - rect.top) * ratio),
              1,
              1,
            ).data,
        );
      }, point);
  const stone = await pixel(points.rock),
    snow = await pixel(points.snow);
  expect(
    Math.max(...stone.slice(0, 3)) - Math.min(...stone.slice(0, 3)),
  ).toBeLessThan(20);
  expect(Math.min(...snow.slice(0, 3))).toBeGreaterThan(140);
  await page.getByRole("button", { name: "Boden", exact: true }).click();
  await page.getByRole("button", { name: "Hart", exact: true }).click();
  await page.getByLabel("Pinselgröße (Pixel)", { exact: true }).fill("16");
  await page.getByLabel("Pinselgröße (Pixel)", { exact: true }).press("Enter");
  const paint = async (point: { x: number; y: number }) => {
    const before = (await status(page)).revision;
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 2, point.y, { steps: 3 });
    await page.mouse.up();
    await expect
      .poll(async () => (await status(page)).revision)
      .toBeGreaterThan(before);
    await paintedReady(page);
  };
  await page.getByLabel("Bodenfarbe", { exact: true }).fill("#00ff00");
  await paint(points.rock);
  // Separate raster filtering may round a channel by one byte.
  for (const [i, channel] of (await pixel(points.rock)).entries())
    expect(Math.abs(channel - stone[i])).toBeLessThanOrEqual(2);
  await page.getByLabel("Farbebene").selectOption("rock");
  await page.getByLabel("Bodenfarbe", { exact: true }).fill("#ff0000");
  await paint(points.rock);
  const red = await pixel(points.rock);
  expect(red[0]).toBeGreaterThan(red[1] * 2);
  const beforeUndo = (await status(page)).revision;
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect
    .poll(async () => (await status(page)).revision)
    .toBeGreaterThan(beforeUndo);
  await paintedReady(page);
  for (const [i, channel] of (await pixel(points.rock)).entries())
    expect(Math.abs(channel - stone[i])).toBeLessThanOrEqual(2);
  await paint(points.snow);
  for (const [i, channel] of (await pixel(points.snow)).entries())
    expect(Math.abs(channel - snow[i])).toBeLessThanOrEqual(2);
});
