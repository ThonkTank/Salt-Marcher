import type { BrushMode } from "../../src/atlas/generated/BrushMode";
import type { Intent } from "../../src/atlas/model";
import {
  calls,
  commit,
  holdResponse,
  ready,
  paintedReady,
  releaseResponse,
  screen,
  status,
  url,
} from "../support/editor";
import { expect, test } from "../support/fixture";
const raster = (page: import("@playwright/test").Page) =>
  page.getByTestId("atlas-canvas").evaluate((c: HTMLCanvasElement) => {
    const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let hash = 0;
    for (let i = 0; i < data.length; i += 16)
      hash =
        (Math.imul(hash, 31) + data[i] + data[i + 1] * 3 + data[i + 2] * 7) | 0;
    return hash;
  });
const heights = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    window.atlasCore("terrainTiles", {
      level: 0,
      tiles: [[0, 0]],
    }),
  );
const cases: Array<[BrushMode, boolean, number]> = (
  ["raise", "lower", "smooth", "flatten"] as BrushMode[]
).flatMap((mode) =>
  [false, true].map(
    (overview) => [mode, overview, 60] as [BrushMode, boolean, number],
  ),
);
cases.push(["raise", true, 500]);
for (const [mode, overview, radius] of cases) {
  test(`exact live height ${mode} ${overview ? "overview" : "near"} radius ${radius}`, async ({
    page,
  }, info) => {
    test.setTimeout(60000);
    await page.goto(url);
    await ready(page);
    await commit(page, {
      type: "terrainStroke",
      brush: {
        resolution: 8,
        mode: "land",
        radius: 10000,
        amount: 1,
        strength: 1,
        target: 10,
        points: [[0, 0]],
      },
    });
    await commit(page, {
      type: "terrainStroke",
      brush: {
        resolution: 3,
        mode: "raise",
        radius: 60,
        amount: 35,
        strength: 1,
        target: 10,
        points: [
          [40, 40],
          [100, 65],
        ],
      },
    });
    await page.reload();
    await ready(page);
    await page.getByRole("button", { name: "Höhen", exact: true }).click();
    await paintedReady(page);
    await page.getByLabel("Pinselmodus").selectOption(mode);
    await page
      .getByLabel("Pinselgröße (Pixel)", { exact: true })
      .fill(String(radius));
    await page.getByLabel("Pinselgröße (Pixel)", { exact: true }).blur();
    if (overview) {
      const p = await screen(page, [60, 50]);
      await page.mouse.move(p.x, p.y);
      await page.mouse.wheel(0, 900);
      await expect(
        page.getByRole("button", { name: "Zum Bearbeiten hineinzoomen" }),
      ).toBeVisible();
      await ready(page);
    }
    const before = await heights(page);
    const rev = (await status(page)).revision;
    const p = await screen(page, [20, 40]);
    await page.mouse.move(p.x, p.y);
    const initial = await raster(page);
    const frames: Array<{ ms: number; hash: number }> = [];
    const start = Date.now();
    await page.mouse.down();
    const seen = new Set<number>();
    for (
      let i = 0;
      i < 35 || (radius === 500 && i < 100 && seen.size < 3);
      i++
    ) {
      const along = i % 70 <= 35 ? i % 70 : 70 - (i % 70);
      const q = await screen(page, [
        20 + along * (radius / 30),
        40 + along * 0.5,
      ]);
      await page.mouse.move(q.x, q.y);
      const hash = await raster(page);
      frames.push({ ms: Date.now() - start, hash });
      if (hash !== initial) seen.add(hash);
      await page.waitForTimeout(20);
    }
    expect((await status(page)).revision).toBe(rev);
    expect(
      new Set(frames.map((f) => f.hash).filter((h) => h !== initial)).size,
    ).toBeGreaterThan(2);
    await page.mouse.up();
    await expect.poll(async () => (await status(page)).revision).toBe(rev + 1);
    await ready(page);
    const painted = await heights(page);
    const strokes = (await calls(page, "commit")).filter(
      (c) => (c.args.intent as Intent).type === "terrainStroke",
    );
    expect(strokes).toHaveLength(1);
    const intent = strokes[0].args.intent as Intent;
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    await expect.poll(async () => (await status(page)).revision).toBe(rev + 2);
    await ready(page);
    expect((await heights(page)).tiles).toEqual(before.tiles);
    // Recompute the immutable final path on the original revision and compare its exact surface.
    if (intent.type !== "terrainStroke") throw Error("missing stroke");
    const exact = await page.evaluate(
      async (intent) =>
        window.atlasCore("preview", {
          version: await window.atlasCore("status", {}),
          intent: { ...intent, view: { level: 0, tiles: [[0, 0]] } },
        }),
      intent,
    );
    if (!exact.valid) throw Error(exact.reason);
    expect(exact.terrain?.surface?.tiles).toEqual(painted.tiles);
    await page
      .getByRole("button", { name: "Wiederholen", exact: true })
      .click();
    await expect.poll(async () => (await status(page)).revision).toBe(rev + 3);
    await ready(page);
    expect((await heights(page)).tiles).toEqual(painted.tiles);
    await info.attach("live-latencies.json", {
      body: JSON.stringify({
        mode,
        overview,
        radius,
        firstVisibleMs: frames.find((f) => f.hash !== initial)?.ms,
        frames,
      }),
      contentType: "application/json",
    });
  });
}
for (const cancel of [
  "escape",
  "blur",
  "pointercancel",
  "tool",
  "new",
  "unmount",
] as const) {
  test(`held height preview cannot reappear after ${cancel}`, async ({
    page,
  }) => {
    await page.goto(url);
    await ready(page);
    await page.getByRole("button", { name: "Höhen", exact: true }).click();
    await paintedReady(page);
    const p = await screen(page, [30, 30]);
    await page.mouse.move(p.x, p.y);
    await holdResponse(page, "preview");
    await page.mouse.down();
    await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
    await page.mouse.move(p.x + 30, p.y + 10);
    expect((await calls(page, "preview")).length).toBe(1);
    if (cancel === "escape") await page.keyboard.press("Escape");
    else if (cancel === "blur")
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    else if (cancel === "pointercancel")
      await page
        .getByTestId("atlas-canvas")
        .dispatchEvent("pointercancel", { pointerId: 1 });
    else if (cancel === "unmount")
      await page.evaluate(() => window.atlasUnmount?.());
    else
      await page
        .getByRole("button", {
          name: cancel === "tool" ? "Auswahl" : "Neu",
          exact: true,
        })
        .evaluate((b: HTMLButtonElement) => b.click());
    await page.mouse.up();
    await releaseResponse(page);
    if (cancel === "unmount")
      await page.evaluate(() => window.atlasRemount?.());
    await ready(page);
    expect((await status(page)).revision).toBe(0);
    expect(await calls(page, "commit")).toHaveLength(0);
    expect(Math.max(...(await heights(page)).tiles[0].heights)).toBe(-100);
  });
}

test("held old height result coalesces movement and cannot replace a new stroke", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Höhen", exact: true }).click();
  await paintedReady(page);
  await holdResponse(page, "preview");
  let p = await screen(page, [20, 30]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  for (let i = 1; i <= 5; i++) await page.mouse.move(p.x + i * 10, p.y);
  expect(await calls(page, "preview")).toHaveLength(1);
  await page.mouse.up();
  await expect.poll(async () => (await status(page)).revision).toBe(1);
  await ready(page);
  p = await screen(page, [80, 90]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 30, p.y + 10);
  await releaseResponse(page);
  await expect
    .poll(async () => (await calls(page, "preview")).length)
    .toBeGreaterThan(1);
  await page.mouse.up();
  await expect.poll(async () => (await status(page)).revision).toBe(2);
  expect(await calls(page, "commit")).toHaveLength(2);
});
