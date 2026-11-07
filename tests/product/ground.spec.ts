import { test, expect } from "../support/fixture";
import {
  ready,
  paintedReady,
  commit,
  url,
  screen,
  status,
  calls,
  dragWorld,
} from "../support/editor";
import type { GroundResponse } from "../../src/atlas/generated/GroundResponse";
const ground = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    window.atlasCore("groundTiles", {
      level: 0,
      tiles: [
        [0, 0],
        [1, 0],
      ],
    }),
  );
const pixels = (tile: GroundResponse["tiles"][number]) =>
  Array.from(atob(tile.pixels), (c) => c.charCodeAt(0));
const canvasPixel = (
  page: import("@playwright/test").Page,
  p: { x: number; y: number },
) =>
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
const alpha = (view: GroundResponse) =>
  view.tiles
    .flatMap((t) => pixels(t).filter((_, i) => i % 4 === 3))
    .reduce((a, b) => a + b, 0);

test("ground holds build color, preview matches commit, local erase and history", async ({
  page,
}) => {
  await page.goto(url);
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
  await ready(page);
  const base = (await status(page)).revision;
  await page.getByRole("button", { name: "Boden", exact: true }).click();
  await page.getByLabel("Deckkraft (%)", { exact: true }).fill("50");
  await page.getByLabel("Deckkraft (%)", { exact: true }).blur();
  await page.getByRole("button", { name: "Stein", exact: true }).click();
  const p = await screen(page, [30, 30]);
  await page.mouse.move(p.x, p.y);
  const beforePixel = await canvasPixel(page, p);
  await page.mouse.down();
  await expect
    .poll(
      async () =>
        (await calls(page, "preview")).filter(
          (c) => (c.args.intent as { type: string }).type === "groundStroke",
        ).length,
    )
    .toBeGreaterThan(1);
  await expect.poll(() => canvasPixel(page, p)).not.toEqual(beforePixel);
  expect((await status(page)).revision).toBe(base);
  expect(alpha(await ground(page))).toBe(0);
  await page.mouse.up();
  await expect.poll(async () => (await status(page)).revision).toBe(base + 1);
  await ready(page);
  const painted = await ground(page);
  expect(alpha(painted)).toBeGreaterThan(0);
  expect(
    Math.max(...pixels(painted.tiles[0]).filter((_, i) => i % 4 === 3)),
  ).toBeLessThanOrEqual(128);
  const commits = (await calls(page, "commit")).filter(
    (c) => (c.args.intent as { type: string }).type === "groundStroke",
  );
  expect(commits).toHaveLength(1);
  expect(commits[0].args.intent).toMatchObject({
    brush: { color: [170, 169, 163], opacity: 0.5 },
  });
  await page.getByRole("button", { name: "Radieren", exact: true }).click();
  await page.getByLabel("Pinselgröße (Pixel)", { exact: true }).fill("10");
  await page.getByLabel("Pinselgröße (Pixel)", { exact: true }).blur();
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.up();
  await expect.poll(async () => (await status(page)).revision).toBe(base + 2);
  await ready(page);
  const erased = await ground(page);
  expect(alpha(erased)).toBeLessThan(alpha(painted));
  expect(alpha(erased)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await ready(page);
  expect((await ground(page)).tiles).toEqual(painted.tiles);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await ready(page);
  expect((await ground(page)).tiles).toEqual(erased.tiles);
});

test("ground aborts, shortcuts, pipette, tips, overview and file roundtrip", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Boden", exact: true }).click();
  await page.getByRole("button", { name: "Wolkig", exact: true }).click();
  await dragWorld(page, [25, 25], [65, 25], false);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect((await status(page)).revision).toBe(0);
  await dragWorld(page, [25, 25], [65, 25], false);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.up();
  expect((await status(page)).revision).toBe(0);
  await dragWorld(page, [25, 25], [65, 25], false);
  await page
    .getByTestId("atlas-canvas")
    .dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  expect((await status(page)).revision).toBe(0);
  await page.getByRole("button", { name: "Hart", exact: true }).click();
  await dragWorld(page, [25, 25], [65, 25]);
  await expect.poll(async () => (await status(page)).revision).toBe(1);
  await ready(page);
  await page.keyboard.press("]");
  await expect(
    page.getByLabel("Pinselgröße (Pixel)", { exact: true }),
  ).toHaveValue("88");
  await page.getByRole("button", { name: "Pipette", exact: true }).click();
  const p = await screen(page, [30, 25]);
  await page.mouse.click(p.x, p.y);
  await expect(
    page.getByRole("button", { name: "Pipette", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  expect((await status(page)).revision).toBe(1);
  const saved = (await ground(page)).tiles;
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect.poll(async () => (await status(page)).dirty).toBe(false);
  await page.getByRole("button", { name: "Öffnen", exact: true }).click();
  await ready(page);
  expect((await ground(page)).tiles).toEqual(saved);
  await page.getByRole("button", { name: "Boden", exact: true }).click();
  await page.mouse.move(p.x, p.y);
  await page.mouse.wheel(0, 1300);
  await expect(
    page.getByRole("button", { name: "Zum Bearbeiten hineinzoomen" }),
  ).toBeVisible();
  await ready(page);
  await dragWorld(page, [25, 25], [65, 25]);
  await expect.poll(async () => (await status(page)).revision).toBe(1);
});

test("ground final pointerup commits once while an obsolete preview is held", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Boden", exact: true }).click();
  await page.evaluate(() => {
    window.atlasHold = { cmd: "preview" };
  });
  await dragWorld(page, [25, 25], [65, 25], false);
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await page.mouse.up();
  await expect.poll(async () => (await status(page)).revision).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.evaluate(() => window.atlasRelease?.());
  await ready(page);
  expect(
    (await calls(page, "commit")).filter(
      (c) => (c.args.intent as { type: string }).type === "groundStroke",
    ),
  ).toHaveLength(1);
  expect(alpha(await ground(page))).toBeGreaterThan(0);
});

for (const navigation of ["preset", "wheel"] as const) {
  test(`ground paints and erases at world scale via ${navigation}`, async ({
    page,
  }) => {
    await page.goto(url);
    await paintedReady(page);
    await commit(page, {
      type: "terrainStroke",
      brush: {
        mode: "land",
        resolution: 19,
        radius: 40_000_000,
        amount: 1,
        strength: 1,
        target: 10,
        points: [[0, 0]],
      },
    });
    await page.reload();
    await paintedReady(page);
    await page.getByLabel("Ansichtsmaßstab").selectOption({ label: "Welt" });
    await paintedReady(page);
    await page.getByRole("button", { name: "Boden", exact: true }).click();
    await paintedReady(page);
    let p = await screen(page, [0, 0]);
    if (navigation === "wheel") {
      const camera = await page.evaluate(
        () => window.atlasPaint!.cameraGeneration,
      );
      await page.mouse.move(p.x, p.y);
      await page.mouse.wheel(0, 1500);
      // wheel() can return before the event updates the camera. Waiting only
      // for a painted frame could accept the preceding frame and stale coordinates.
      await expect
        .poll(() => page.evaluate(() => window.atlasPaint!.cameraGeneration))
        .toBeGreaterThan(camera);
      await paintedReady(page);
      p = await screen(page, [0, 0]);
    }
    await page.getByRole("button", { name: "Erde", exact: true }).click();
    const before = await canvasPixel(page, p);
    expect(before).not.toEqual([134, 184, 198, 255]);
    const revision = (await status(page)).revision;
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await expect.poll(() => canvasPixel(page, p)).not.toEqual(before);
    await page.mouse.move(p.x + 25, p.y + 15, { steps: 8 });
    await page.mouse.up();
    await expect
      .poll(async () => (await status(page)).revision)
      .toBe(revision + 1);
    await paintedReady(page);
    const painted = await canvasPixel(page, p);
    expect(painted).not.toEqual(before);
    const edits = (await calls(page, "commit")).filter(
      (c) => (c.args.intent as { type: string }).type === "groundStroke",
    );
    expect(edits.at(-1)?.args.intent).toMatchObject({
      brush: { resolution: expect.any(Number) },
    });
    await page.keyboard.press("Control+z");
    await paintedReady(page);
    await expect.poll(() => canvasPixel(page, p)).toEqual(before);
    await page.keyboard.press("Control+Shift+z");
    await paintedReady(page);
    await expect.poll(() => canvasPixel(page, p)).toEqual(painted);
    await page.getByRole("button", { name: "Radieren", exact: true }).click();
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await expect.poll(() => canvasPixel(page, p)).not.toEqual(painted);
    await page.mouse.up();
    await expect
      .poll(async () => (await status(page)).revision)
      .toBeGreaterThan(revision + 1);
  });
}
