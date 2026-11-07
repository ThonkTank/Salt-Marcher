import { test, expect } from "../support/fixture";
import {
  paintedReady,
  commit,
  url,
  screen,
  status,
  calls,
  dragWorld,
} from "../support/editor";
import type { Page } from "@playwright/test";
import type { LandscapeResponse } from "../../src/atlas/generated/LandscapeResponse";

const landscape = (page: Page, level = 0) =>
  page.evaluate(
    (level) =>
      window.atlasCore("landscapeTiles", {
        level,
        tiles: [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ],
      }),
    level,
  );
const coverage = (view: LandscapeResponse) =>
  view.tiles.reduce(
    (total, t) =>
      total +
      Array.from(atob(t.pixels), (c) => c.charCodeAt(0)).reduce(
        (a, b) => a + b,
        0,
      ),
    0,
  );
const pixel = (page: Page, p: { x: number; y: number }) =>
  page.getByTestId("atlas-canvas").evaluate((canvas: HTMLCanvasElement, p) => {
    const r = canvas.getBoundingClientRect();
    return Array.from(
      canvas
        .getContext("2d")!
        .getImageData(
          Math.floor(((p.x - r.left) * canvas.width) / r.width),
          Math.floor(((p.y - r.top) * canvas.height) / r.height),
          1,
          1,
        ).data,
    );
  }, p);
async function land(page: Page, world = false) {
  await page.goto(url);
  await commit(page, {
    type: "terrainStroke",
    brush: {
      mode: "land",
      resolution: world ? 19 : 8,
      radius: world ? 40_000_000 : 10000,
      amount: 1,
      strength: 1,
      target: 10,
      points: [[0, 0]],
    },
  });
  await page.reload();
  await paintedReady(page);
}

test("landscape coverage previews, erases locally, cancels and survives history/file boundaries", async ({
  page,
}) => {
  await land(page);
  await page.getByRole("button", { name: "Landschaft", exact: true }).click();
  await expect(page.getByLabel("Landschaftsart")).toHaveValue("forest");
  const base = (await status(page)).revision;
  await dragWorld(page, [25, 30], [80, 35], false);
  await expect
    .poll(async () =>
      (await calls(page, "preview")).some(
        (c) => (c.args.intent as { type: string }).type === "landscapeStroke",
      ),
    )
    .toBe(true);
  expect(coverage(await landscape(page))).toBe(0);
  await page.mouse.up();
  await expect.poll(async () => (await status(page)).revision).toBe(base + 1);
  await paintedReady(page);
  const painted = await landscape(page);
  expect(coverage(painted)).toBeGreaterThan(0);
  const edits = (await calls(page, "commit")).filter(
    (c) => (c.args.intent as { type: string }).type === "landscapeStroke",
  );
  expect(edits).toHaveLength(1);
  await page.getByLabel("Auftrag", { exact: true }).selectOption("erase");
  await page.getByLabel("Pinselgröße (Pixel)", { exact: true }).fill("16");
  await page.getByLabel("Pinselgröße (Pixel)", { exact: true }).blur();
  const p = await screen(page, [45, 32]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.up();
  await expect.poll(async () => (await status(page)).revision).toBe(base + 2);
  await paintedReady(page);
  const erased = await landscape(page);
  expect(coverage(erased)).toBeLessThan(coverage(painted));
  expect(coverage(erased)).toBeGreaterThan(0);
  await page.keyboard.press("Control+z");
  await paintedReady(page);
  expect((await landscape(page)).tiles).toEqual(painted.tiles);
  await page.keyboard.press("Control+Shift+z");
  await paintedReady(page);
  expect((await landscape(page)).tiles).toEqual(erased.tiles);
  const afterHistory = (await status(page)).revision;
  await dragWorld(page, [30, 80], [80, 90], false);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect((await status(page)).revision).toBe(afterHistory);
  await dragWorld(page, [30, 80], [80, 90], false);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.up();
  expect((await status(page)).revision).toBe(afterHistory);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect.poll(async () => (await status(page)).dirty).toBe(false);
  await page.getByRole("button", { name: "Öffnen", exact: true }).click();
  await paintedReady(page);
  expect((await landscape(page)).tiles).toEqual(erased.tiles);
});

for (const label of ["Straßenzug", "Welt"])
  test(`landscape paints visible coverage at ${label} without creating scenery objects`, async ({
    page,
  }) => {
    await land(page, true);
    await page.getByLabel("Ansichtsmaßstab").selectOption({ label });
    await paintedReady(page);
    await page.getByRole("button", { name: "Landschaft", exact: true }).click();
    await paintedReady(page);
    const p = await screen(page, [0, 0]);
    const before = await pixel(page, p),
      base = (await status(page)).revision;
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await expect.poll(() => pixel(page, p)).not.toEqual(before);
    // Let the held brush establish enough coverage to inspect scale symbols,
    // rather than releasing at the first nearly transparent preview pixel.
    await expect
      .poll(async () => before[0] - (await pixel(page, p))[0])
      .toBeGreaterThan(30);
    await page.mouse.move(p.x + 35, p.y + 15, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await status(page)).revision).toBe(base + 1);
    await paintedReady(page);
    const painted = await pixel(page, p);
    expect(painted).not.toEqual(before);
    await page.keyboard.press("Control+z");
    await expect.poll(async () => (await status(page)).revision).toBe(base + 2);
    await paintedReady(page);
    expect(await pixel(page, p)).toEqual(before);
    await page.keyboard.press("Control+Shift+z");
    await expect.poll(async () => (await status(page)).revision).toBe(base + 3);
    await paintedReady(page);
    expect(await pixel(page, p)).toEqual(painted);
    if (label === "Welt") {
      // Preset zoom keeps the viewport center. Center the authored anchor first
      // so later pixel checks cannot accidentally sample transparent offscreen data.
      const origin = await screen(page, [0, 0]);
      const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
      await page.mouse.move(origin.x, origin.y);
      await page.mouse.down({ button: "middle" });
      await page.mouse.move(
        Math.round(box.x + box.width / 2),
        Math.round(box.y + box.height / 2),
      );
      await page.mouse.up({ button: "middle" });
      await paintedReady(page);
      // Follow the same world anchor through the representation bands. The
      // source coverage must survive independently of generated detail symbols.
      for (const view of ["Umland", "Dorf / Stadtteil", "Grundstück", "Welt"]) {
        await page.getByLabel("Ansichtsmaßstab").selectOption({ label: view });
        await paintedReady(page);
        const anchor = await screen(page, [0, 0]);
        expect(anchor.x).toBeGreaterThan(box.x);
        expect(anchor.x).toBeLessThan(box.x + box.width);
        expect(anchor.y).toBeGreaterThan(box.y);
        expect(anchor.y).toBeLessThan(box.y + box.height);
        expect(await pixel(page, anchor)).not.toEqual(before);
        if (view === "Dorf / Stadtteil" || view === "Grundstück")
          await page.screenshot({
            path: test
              .info()
              .outputPath(
                view === "Grundstück"
                  ? "landscape-near.png"
                  : "landscape-middle.png",
              ),
          });
      }
      expect(await pixel(page, await screen(page, [0, 0]))).toEqual(painted);
    }
    const result = await page.evaluate(() =>
      window.atlasCore("scene", {
        context: { kind: "exterior" },
        bounds: [-100, -100, 100, 100],
      }),
    );
    expect(result.objects.filter((o) => o.kind === "scenery")).toHaveLength(0);
  });

test("ocean masks landscape authors and later land reveals them", async ({
  page,
}) => {
  await page.goto(url);
  await paintedReady(page);
  const p = await screen(page, [50, 50]);
  const ocean = await pixel(page, p);
  await commit(page, {
    type: "landscapeStroke",
    brush: {
      resolution: 0,
      biome: "forest",
      mode: "paint",
      diameter: 100,
      density: 1,
      points: [
        [50, 50, 0],
        [50, 50, 1000],
      ],
    },
  });
  const stored = await landscape(page);
  expect(coverage(stored)).toBeGreaterThan(0);
  await page.reload();
  await paintedReady(page);
  expect(await pixel(page, await screen(page, [50, 50]))).toEqual(ocean);
  await commit(page, {
    type: "terrainStroke",
    brush: {
      mode: "land",
      resolution: 8,
      radius: 10000,
      amount: 1,
      strength: 1,
      target: 10,
      points: [[0, 0]],
    },
  });
  await page.reload();
  await paintedReady(page);
  expect(await pixel(page, await screen(page, [50, 50]))).not.toEqual(ocean);
  expect((await landscape(page)).tiles).toEqual(stored.tiles);
});
