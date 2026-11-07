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
  const snapshot = await page
    .getByTestId("atlas-canvas")
    .evaluate((canvas: HTMLCanvasElement) => {
      const t = canvas.getContext("2d")!.getTransform(),
        d = devicePixelRatio || 1;
      return {
        x: t.e / d,
        y: t.f / d,
        scale: t.a / d,
        dpr: d,
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        pixelWidth: canvas.width,
        pixelHeight: canvas.height,
      };
    });
  expect(snapshot.width).toBeGreaterThan(0);
  expect(snapshot.height).toBeGreaterThan(0);
  expect(
    Math.abs(snapshot.pixelWidth - snapshot.width * snapshot.dpr),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(snapshot.pixelHeight - snapshot.height * snapshot.dpr),
  ).toBeLessThanOrEqual(1);
  return snapshot;
}

// Viewport size follows the inspector layout; Camera owns only this transform.
function transform(snapshot: Awaited<ReturnType<typeof camera>>) {
  return { x: snapshot.x, y: snapshot.y, scale: snapshot.scale };
}

// Canvas matrix components may be Float32-quantized. Propagate their half-ULP
// bounds through the screen-to-world and world-to-screen transformations.
function expectAnchor(
  before: Awaited<ReturnType<typeof camera>>,
  after: Awaited<ReturnType<typeof camera>>,
  axis: "x" | "y",
  p: number,
) {
  const halfUlp = (v: number, dpr: number) =>
    (v === 0
      ? 2 ** -150
      : Math.max(2 ** -150, 2 ** (Math.floor(Math.log2(Math.abs(v))) - 24))) /
    dpr;
  const ubTranslation = halfUlp(before[axis] * before.dpr, before.dpr);
  const ubScale = halfUlp(before.scale * before.dpr, before.dpr);
  const uaTranslation = halfUlp(after[axis] * after.dpr, after.dpr);
  const uaScale = halfUlp(after.scale * after.dpr, after.dpr);
  const w = (p - before[axis]) / before.scale;
  const denominator = Math.abs(before.scale) - ubScale;
  expect(
    [w, denominator, ubTranslation, ubScale, uaTranslation, uaScale].every(
      Number.isFinite,
    ),
  ).toBe(true);
  expect(denominator).toBeGreaterThan(0);
  const worldError = (ubTranslation + Math.abs(w) * ubScale) / denominator;
  const budget =
    uaTranslation +
    Math.abs(w) * uaScale +
    (Math.abs(after.scale) + uaScale) * worldError +
    1e-10;
  const error = Math.abs(after[axis] + w * after.scale - p);
  expect(Number.isFinite(budget) && Number.isFinite(error)).toBe(true);
  expect(budget).toBeLessThan(0.001);
  expect(error).toBeLessThanOrEqual(budget);
}

for (const { title, start, startScale, target, targetScale } of [
  {
    title:
      "free exact double click navigates around its anchor without a write and interior entry preserves camera",
    start: "Haus",
    startScale: 304.8 / 45,
    target: "Raum",
    targetScale: 25.6,
  },
  {
    title:
      "free parcel double click navigates around its anchor without a write and interior entry preserves camera",
    start: "Grundstück",
    startScale: 304.8 / 180,
    target: "Haus",
    targetScale: 304.8 / 45,
  },
])
  test(title, async ({ page }) => {
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
    await page.getByLabel("Ansichtsmaßstab").selectOption({ label: start });
    await paintedReady(page);
    await selectObject(page, "⌂ Haus 1");
    const before = await camera(page);
    expect(before.scale).toBeCloseTo(startScale, 5);
    const canvas = page.getByTestId("atlas-canvas");
    const box = (await canvas.boundingBox())!;
    const px = Math.round(before.width * 0.75),
      py = Math.round(before.height * 0.7);
    const prior = await status(page);
    await clearCalls(page);
    await page.mouse.dblclick(box.x + px, box.y + py);
    await expect(page.locator(".atlas-map-title")).toHaveText(
      `Atlas · ${target}`,
    );
    const after = await camera(page);
    expect(after.scale).toBeCloseTo(targetScale, 5);
    expectAnchor(before, after, "x", px);
    expectAnchor(before, after, "y", py);
    const current = await status(page);
    expect([current.revision, current.canUndo, current.canRedo]).toEqual([
      prior.revision,
      prior.canUndo,
      prior.canRedo,
    ]);
    expect(await calls(page, "commit")).toEqual([]);
    await selectObject(page, "⌂ Haus 1");
    const beforeOpen = await camera(page);
    expect(transform(beforeOpen)).toEqual(transform(after));
    await page
      .getByRole("button", { name: "Innen öffnen", exact: true })
      .click();
    await expect(page.locator(".atlas-map-title")).toHaveText(
      "Haus 1 · Geschoss 0",
    );
    expect(transform(await camera(page))).toEqual(transform(beforeOpen));
    await page
      .getByRole("button", { name: "Zur Atlasansicht", exact: true })
      .click();
    await expect(page.locator(".atlas-map-title")).toHaveText(
      `Atlas · ${target}`,
    );
    expect(transform(await camera(page))).toEqual(transform(beforeOpen));
  });

test("free double click uses current anchor geometry while an expanded viewport read is held", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 620 });
  await page.goto(url);
  await paintedReady(page);
  await page.getByLabel("Ansichtsmaßstab").selectOption({ label: "Haus" });
  await paintedReady(page);
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  await page.evaluate(() => {
    window.atlasHold = { cmd: "scene" };
  });
  await page.setViewportSize({ width: 1440, height: 620 });
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  expect(await page.evaluate(() => window.atlasPaint?.dataReady)).toBe(false);
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator(".atlas-map-title")).toHaveText("Atlas · Raum");
  expect((await status(page)).revision).toBe(0);
  expect(await calls(page, "commit")).toEqual([]);
  await page.evaluate(() => window.atlasRelease!());
  await paintedReady(page);
});
