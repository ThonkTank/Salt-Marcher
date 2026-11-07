import {
  calls,
  dragWorld,
  holdResponse,
  ready,
  releaseResponse,
  status,
  url,
} from "../support/editor";
import { expect, test } from "../support/fixture";
const terrain = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    window.atlasCore("terrainTiles", {
      level: 0,
      tiles: [[0, 0]],
    }),
  );
test("Gewässerpinsel zeigt Vorschau, übernimmt atomar und unterstützt History und Datei", async ({
  page,
}, info) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Gewässer", exact: true }).click();
  await expect(page.getByLabel("Wasserstand (Fuß)")).toHaveCount(0);
  await dragWorld(page, [40, 40], [90, 50], false);
  await expect
    .poll(async () =>
      (await calls(page, "preview")).some(
        (c) => (c.args.intent as { type?: string })?.type === "waterStroke",
      ),
    )
    .toBe(true);
  expect((await status(page)).revision).toBe(0);
  await page.mouse.up();
  await expect.poll(async () => (await status(page)).revision).toBe(1);
  await ready(page);
  const original = (await terrain(page)).tiles;
  expect(original[0].waters.length).toBeGreaterThan(0);
  expect(original[0].waters[0].level).toBe(-100);
  expect(Math.min(...original[0].heights)).toBeLessThan(10);
  await page.screenshot({ path: info.outputPath("water-brush.png") });
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await ready(page);
  expect((await terrain(page)).tiles[0].waters).toEqual([]);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await ready(page);
  expect((await terrain(page)).tiles).toEqual(original);
  await page.evaluate(async () => {
    await window.atlasCore("save", {});
    await window.atlasCore("open", {});
  });
  expect((await terrain(page)).tiles).toEqual(original);
});
test("Abbruch und verspätete Gewässervorschauen ändern kein Dokument", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Gewässer", exact: true }).click();
  await holdResponse(page, "preview");
  await dragWorld(page, [40, 40], [70, 50], false);
  await expect
    .poll(async () => (await calls(page, "preview")).length)
    .toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await releaseResponse(page);
  expect((await status(page)).revision).toBe(0);
  expect((await terrain(page)).tiles[0].waters).toEqual([]);
  await dragWorld(page, [40, 40], [70, 50], false);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.up();
  expect((await status(page)).revision).toBe(0);
});
test("Gewässer bleiben in der Übersicht malbar und Höhen entfernen Inselwasser dauerhaft", async ({
  page,
}, info) => {
  const { screen } = await import("../support/editor");
  const { waterAt } = await import("../../src/atlas/waterView");
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Gewässer", exact: true }).click();
  await page.getByLabel("Pinselgröße (Pixel)").fill("100");
  await page.getByLabel("Pinselgröße (Pixel)").blur();
  const p = await screen(page, [50, 50]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.wheel(0, 900);
  await expect(
    page.getByRole("button", { name: "Zum Bearbeiten hineinzoomen" }),
  ).toBeVisible();
  await ready(page);
  await dragWorld(page, [40, 40], [70, 40]);
  await expect.poll(async () => (await status(page)).revision).toBe(1);
  await ready(page);
  expect(waterAt((await terrain(page)).tiles[0].waters, [40, 40])).toBe(-100);
  await page.screenshot({ path: info.outputPath("water-overview.png") });
  await page.getByRole("button", { name: "Höhen", exact: true }).click();
  await page.getByLabel("Pinselmodus").selectOption("raise");
  const coast = await screen(page, [40, 40]);
  await page.mouse.move(coast.x, coast.y);
  await page.mouse.wheel(0, -900);
  await ready(page);
  await page.getByLabel("Höhenänderung (Fuß)").fill("100");
  await page.getByLabel("Höhenänderung (Fuß)").blur();
  await page.getByLabel("Pinselgröße (Pixel)").fill("30");
  await page.getByLabel("Pinselgröße (Pixel)").blur();
  await dragWorld(page, [40, 40], [43, 40]);
  await expect
    .poll(async () => (await status(page)).revision)
    .toBeGreaterThan(1);
  await ready(page);
  expect(waterAt((await terrain(page)).tiles[0].waters, [40, 40])).toBeNull();
  const raisedRevision = (await status(page)).revision;
  await page.getByLabel("Pinselmodus").selectOption("lower");
  await dragWorld(page, [40, 40], [43, 40]);
  await expect
    .poll(async () => (await status(page)).revision)
    .toBeGreaterThan(raisedRevision);
  await ready(page);
  expect(waterAt((await terrain(page)).tiles[0].waters, [40, 40])).toBeNull();
});
