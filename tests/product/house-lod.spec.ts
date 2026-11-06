import type { Page } from "@playwright/test";
import { expect, test } from "../support/fixture";
import {
  calls,
  clearCalls,
  commit,
  paintedReady,
  selectObject,
  status,
  url,
} from "../support/editor";

async function camera(page: Page) {
  await paintedReady(page);
  return page
    .getByTestId("atlas-canvas")
    .evaluate((canvas: HTMLCanvasElement) => {
      const t = canvas.getContext("2d")!.getTransform(),
        d = devicePixelRatio || 1;
      return {
        x: t.e / d,
        y: t.f / d,
        scale: t.a / d,
        width: canvas.clientWidth,
        height: canvas.clientHeight,
      };
    });
}

test("free exact double click navigates around its anchor without a write and interior entry preserves camera", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 620 });
  await page.goto(url);
  const initial = await camera(page);
  const cx = (initial.width / 2 - initial.x) / initial.scale;
  const cy = (initial.height / 2 - initial.y) / initial.scale;
  expect(
    (
      await commit(page, {
        type: "createHouse",
        parcelId: null,
        transform: { x: cx, y: cy, angle: 0 },
        width: 1,
        depth: 1,
      })
    ).valid,
  ).toBe(true);
  await page.reload();
  await paintedReady(page);
  await page.getByLabel("Ansichtsmaßstab").selectOption({ label: "Haus" });
  await paintedReady(page);
  await selectObject(page, "⌂ Haus 1");
  const before = await camera(page);
  expect(before.scale).toBeCloseTo(304.8 / 45, 5);
  const canvas = page.getByTestId("atlas-canvas");
  const box = (await canvas.boundingBox())!;
  const px = Math.round(before.width * 0.75),
    py = Math.round(before.height * 0.7);
  const world = [
    (px - before.x) / before.scale,
    (py - before.y) / before.scale,
  ];
  const prior = await status(page);
  await clearCalls(page);
  await page.mouse.dblclick(box.x + px, box.y + py);
  await expect(page.locator(".atlas-map-title")).toHaveText("Atlas · Raum");
  const after = await camera(page);
  expect(after.scale).toBeCloseTo(25.6, 5);
  expect(after.x + world[0] * after.scale).toBeCloseTo(px, 4);
  expect(after.y + world[1] * after.scale).toBeCloseTo(py, 4);
  const current = await status(page);
  expect([current.revision, current.canUndo, current.canRedo]).toEqual([
    prior.revision,
    prior.canUndo,
    prior.canRedo,
  ]);
  expect(await calls(page, "commit")).toEqual([]);
  await selectObject(page, "⌂ Haus 1");
  await page.getByRole("button", { name: "Innen öffnen", exact: true }).click();
  await expect(page.locator(".atlas-map-title")).toHaveText(
    "Haus 1 · Geschoss 0",
  );
  expect(await camera(page)).toEqual(after);
  await page
    .getByRole("button", { name: "Zur Atlasansicht", exact: true })
    .click();
  await expect(page.locator(".atlas-map-title")).toHaveText("Atlas · Raum");
  expect(await camera(page)).toEqual(after);
});
