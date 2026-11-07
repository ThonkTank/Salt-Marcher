import { test, expect } from "../support/fixture";
import type { Page } from "@playwright/test";
import { viewScale } from "../../src/atlas/lod";
import {
  ready,
  history,
  paintedReady,
  settled,
  status,
  scene,
  calls,
  clearCalls,
  url,
} from "../support/editor";

test.use({ viewport: { width: 900, height: 620 } });

async function scale(page: Page) {
  return page
    .getByTestId("atlas-canvas")
    .evaluate(
      (canvas: HTMLCanvasElement) =>
        canvas.getContext("2d")!.getTransform().a / (devicePixelRatio || 1),
    );
}
async function wheelTo(page: Page, start: number, target: number) {
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -Math.log(target / start) / 0.0015);
  await paintedReady(page);
}
async function gesture(page: Page) {
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 30, y + 20, { steps: 4 });
  await page.mouse.up();
  await settled(page);
}
test("parcel name and actual scale share editing restrictions and hysteresis", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByLabel("Ansichtsmaßstab").selectOption({ label: "Stadt" });
  await paintedReady(page);
  await wheelTo(page, viewScale(6), 1.275);
  await expect(page.getByLabel("Ansichtsmaßstab")).toHaveValue("2");
  expect(await scale(page)).toBeGreaterThan(1.27);
  expect(await scale(page)).toBeLessThan(1.28);
  const before = await status(page),
    objects = (await scene(page)).objects;
  for (const tool of ["Haus", "Landschaft"]) {
    await page.getByRole("button", { name: tool, exact: true }).click();
    await paintedReady(page);
    await expect(page.locator(".atlas-map-help > span")).toContainText(
      `${tool} · Für diese Bearbeitung hineinzoomen.`,
    );
    await expect(page.locator(".atlas-map-help > span")).not.toContainText(
      "Ziehen: Zeichnen",
    );
    await expect(
      page.getByRole("button", { name: "Zum Bearbeiten hineinzoomen" }),
    ).toBeVisible();
    await clearCalls(page);
    await gesture(page);
    expect(await calls(page, "commit")).toHaveLength(0);
    expect(await status(page)).toEqual(before);
    expect((await scene(page)).objects).toEqual(objects);
  }
  await page.getByRole("button", { name: "Boden", exact: true }).click();
  await paintedReady(page);
  await expect(page.locator(".atlas-map-help > span")).toContainText(
    "Boden malen",
  );
  await expect(page.locator(".atlas-navigation")).not.toContainText(
    "Lokales Detailwerkzeug",
  );
  await clearCalls(page);
  await gesture(page);
  await expect
    .poll(async () => (await status(page)).revision)
    .toBe(before.revision + 1);
  expect(
    (await calls(page, "commit")).filter(
      (c) => c.args.intent.type === "groundStroke",
    ),
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await settled(page);
  expect((await scene(page)).objects).toEqual(objects);
  await page.getByRole("button", { name: "Fluss", exact: true }).click();
  await expect(page.locator(".atlas-overview-hint")).toContainText(
    "Flussplanung",
  );
  await expect(page.locator(".atlas-overview-hint")).not.toContainText(
    "Straßenplanung",
  );
  await page.getByRole("button", { name: "Haus", exact: true }).click();
  await expect(page.locator(".atlas-map-help > span")).toContainText(
    "hineinzoomen",
  );
  await page
    .getByRole("button", { name: "Zum Bearbeiten hineinzoomen" })
    .click();
  await paintedReady(page);
  await expect(page.locator(".atlas-map-help > span")).toContainText(
    "Ziehen: Zeichnen",
  );
  await wheelTo(page, await scale(page), 1.275);
  await expect(page.getByLabel("Ansichtsmaßstab")).toHaveValue("2");
  await expect(page.locator(".atlas-map-help > span")).toContainText(
    "Ziehen: Zeichnen",
  );
  await page.getByRole("button", { name: "Landschaft", exact: true }).click();
  await expect(page.locator(".atlas-map-help > span")).toContainText(
    "Ziehen: Zeichnen",
  );
});

test("first house gesture at named parcel scale commits once and restores history", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page
    .getByLabel("Ansichtsmaßstab")
    .selectOption({ label: "Grundstück" });
  await paintedReady(page);
  await expect(page.locator(".atlas-map-title")).toHaveText(
    "Atlas · Grundstück",
  );
  expect(await scale(page)).toBeCloseTo(304.8 / 180, 5);
  const before = await status(page);
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  await page.getByRole("button", { name: "Haus", exact: true }).click();
  await page.mouse.move(box.x + 200, box.y + 160);
  await page.mouse.down();
  await page.mouse.move(box.x + 264, box.y + 224);
  await page.mouse.up();
  await expect.poll(async () => (await scene(page)).objects.length).toBe(1);
  expect((await scene(page)).objects[0].kind).toBe("house");
  expect((await status(page)).revision).toBe(before.revision + 1);
  expect(await calls(page, "commit")).toHaveLength(1);
  await history(page);
  expect((await scene(page)).objects).toEqual([]);
  expect((await status(page)).canUndo).toBe(false);
  await history(page, true);
  expect((await scene(page)).objects).toHaveLength(1);
});
