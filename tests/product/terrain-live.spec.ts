import {
  calls,
  holdResponse,
  releaseResponse,
  commit,
  ready,
  paintedReady,
  screen,
  status,
  settled,
  url,
} from "../support/editor";
import { expect, test } from "../support/fixture";

for (const mode of [
  "land",
  "sea",
  "raise",
  "lower",
  "smooth",
  "flatten",
] as const) {
  test(`direct height ${mode} writes while dragging and undoes as one action`, async ({
    page,
  }) => {
    await page.goto(url);
    await ready(page);
    if (mode !== "land") {
      await commit(page, {
        type: "terrainStroke",
        brush: {
          resolution: 2,
          mode: "land",
          radius: 1000,
          amount: 1,
          strength: 1,
          target: 10,
          points: [[0, 0]],
        },
      });
      if (mode === "smooth" || mode === "flatten")
        await commit(page, {
          type: "terrainStroke",
          brush: {
            resolution: 0,
            mode: "raise",
            radius: 30,
            amount: 50,
            strength: 1,
            target: 10,
            points: [[10, 10]],
          },
        });
    }
    if (mode !== "land") {
      await page.reload();
      await ready(page);
    }
    await page.getByRole("button", { name: "Höhen", exact: true }).click();
    await paintedReady(page);
    await page.getByLabel("Pinselmodus").selectOption(mode);
    const before = await status(page);
    const read = () =>
      page.evaluate(() =>
        window.atlasCore("terrainTiles", {
          level: 0,
          tiles: [
            [0, 0],
            [-1, 0],
            [0, -1],
            [-1, -1],
          ],
        }),
      );
    const initial = (await read()).tiles;
    const p = await screen(page, [10, 10]);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await expect
      .poll(async () => (await status(page)).revision)
      .toBeGreaterThan(before.revision);
    await page.mouse.move(p.x + 100, p.y + 20, { steps: 12 });
    await expect
      .poll(async () => (await calls(page, "appendTerrainStroke")).length)
      .toBeGreaterThan(0);
    await page.mouse.up();
    await expect
      .poll(async () => (await calls(page, "endTerrainStroke")).length)
      .toBe(1);
    await settled(page);
    const after = (await read()).tiles;
    expect(after).not.toEqual(initial);
    expect(await calls(page, "preview")).toHaveLength(0);
    expect(await calls(page, "beginTerrainStroke")).toHaveLength(1);
    expect(await calls(page, "endTerrainStroke")).toHaveLength(1);
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    await ready(page);
    expect((await read()).tiles).toEqual(initial);
    await page
      .getByRole("button", { name: "Wiederholen", exact: true })
      .click();
    await ready(page);
    expect((await read()).tiles).toEqual(after);
  });
}
for (const end of [
  "escape",
  "blur",
  "pointercancel",
  "tool",
  "unmount",
] as const) {
  test(`direct land keeps confirmed paint on ${end}`, async ({ page }) => {
    await page.goto(url);
    await ready(page);
    await page.getByRole("button", { name: "Höhen", exact: true }).click();
    await paintedReady(page);
    const p = await screen(page, [0, 0]);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await expect
      .poll(async () => (await status(page)).revision)
      .toBeGreaterThan(0);
    if (end === "escape") await page.keyboard.press("Escape");
    else if (end === "blur")
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    else if (end === "pointercancel")
      await page
        .getByTestId("atlas-canvas")
        .dispatchEvent("pointercancel", { pointerId: 1 });
    else if (end === "tool")
      await page
        .getByRole("button", { name: "Auswahl", exact: true })
        .evaluate((b: HTMLButtonElement) => b.click());
    else await page.evaluate(() => window.atlasUnmount?.());
    await page.mouse.up();
    if (end === "unmount") await page.evaluate(() => window.atlasRemount?.());
    await ready(page);
    expect((await status(page)).dirty).toBe(true);
    expect(await calls(page, "endTerrainStroke")).toHaveLength(1);
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    await ready(page);
    expect((await status(page)).dirty).toBe(false);
  });
}

test("direct land paints intermediate states before pointerup", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Höhen", exact: true }).click();
  await paintedReady(page);
  const p = await screen(page, [10, 10]);
  const pixels = () =>
    page
      .getByTestId("atlas-canvas")
      .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  const initial = await pixels();
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await expect
    .poll(async () => (await status(page)).revision)
    .toBeGreaterThan(0);
  await paintedReady(page);
  const first = await pixels(),
    revision = (await status(page)).revision;
  expect(first).not.toBe(initial);
  await page.mouse.move(p.x + 100, p.y + 20, { steps: 12 });
  await expect
    .poll(async () => (await status(page)).revision)
    .toBeGreaterThan(revision);
  await paintedReady(page);
  expect(await pixels()).not.toBe(first);
  expect(await calls(page, "endTerrainStroke")).toHaveLength(0);
  await page.mouse.up();
  await settled(page);
  await paintedReady(page);
});

for (const level of [0, 3])
  test(`incremental coast rasters equal a fresh render including reverse history at LOD ${level}`, async ({
    page,
  }) => {
    await page.goto(url);
    await ready(page);
    const result = await page.evaluate(async (level) => {
      const factor = 2 ** level;
      const modulePath = "/src/atlas/terrainView.ts";
      const { TerrainPainter } = (await import(
        /* @vite-ignore */ modulePath
      )) as typeof import("../../src/atlas/terrainView");
      const painter = new TerrainPainter();
      const draw = (
        view: Awaited<ReturnType<typeof read>>,
        painter: InstanceType<typeof TerrainPainter>,
      ) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 512;
        const c = canvas.getContext("2d")!;
        c.setTransform(3.2 / factor, 0, 0, 3.2 / factor, 0, 0);
        painter.paint(c, view, 3.2 / factor, false);
        painter.paint(c, view, 3.2 / factor, false, undefined, true);
        return c.getImageData(0, 0, 512, 512).data;
      };
      const read = () =>
        window.atlasCore("terrainTiles", { level, tiles: [[0, 0]] });
      const before = await read();
      draw(before, painter);
      const views = [before];
      for (const [mode, x] of [
        ["land", 40],
        ["land", 65],
        ["sea", 40],
      ] as const) {
        await window.atlasCore("commit", {
          version: await window.atlasCore("status", {}),
          intent: {
            type: "terrainStroke",
            brush: {
              resolution: level,
              mode,
              radius: (mode === "sea" ? 8 : 22) * factor,
              amount: 1,
              strength: 1,
              target: 10,
              points: [[x * factor, 40 * factor]],
            },
          },
        });
        views.push(await read());
      }
      return [...views.slice(1), ...views.slice(0, -1).reverse()].map(
        (view) => {
          const incremental = draw(view, painter),
            fresh = draw(view, new TerrainPainter());
          let maximum = 0,
            at = 0,
            different = 0;
          for (let i = 0; i < fresh.length; i++) {
            const delta = Math.abs(fresh[i] - incremental[i]);
            if (delta > maximum) at = i;
            maximum = Math.max(maximum, delta);
            if (delta) different++;
          }
          return {
            maximum,
            different,
            x: Math.floor(at / 4) % 512,
            y: Math.floor(at / 2048),
            fresh: Array.from(fresh.slice(at - (at % 4), at - (at % 4) + 4)),
            incremental: Array.from(
              incremental.slice(at - (at % 4), at - (at % 4) + 4),
            ),
          };
        },
      );
    }, level);
    expect(result.filter((v) => v.maximum > 1)).toEqual([]);
  });

test("world land follows a continuous stroke before release", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByLabel("Ansichtsmaßstab").selectOption({ label: "Welt" });
  await page.getByRole("button", { name: "Höhen", exact: true }).click();
  await paintedReady(page);
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  // Sample only the base canvas: cursor/overlay movement cannot satisfy this test.
  const row = () =>
    page.getByTestId("atlas-canvas").evaluate((canvas: HTMLCanvasElement) => {
      const ratio = canvas.width / canvas.getBoundingClientRect().width;
      const pixels = canvas
        .getContext("2d")!
        .getImageData(0, Math.floor(canvas.height / 2), canvas.width, 1).data;
      return Array.from({ length: 81 }, (_, i) => {
        const x = Math.floor(canvas.width / 2 + (-160 + i * 4) * ratio) * 4;
        return Array.from(pixels.slice(x, x + 4)).join(",");
      });
    });
  const initial = await row();
  const counts = new Set<number>();
  await page.mouse.move(box.x + box.width / 2 - 160, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 80; i++) {
    await page.mouse.move(
      box.x + box.width / 2 - 160 + i * 4,
      box.y + box.height / 2 + Math.sin(i / 8) * 20,
    );
    await page.waitForTimeout(25);
    if (i % 10 === 0) {
      const pixels = await row();
      counts.add(pixels.filter((v, j) => v !== initial[j]).length);
    }
  }
  const beforeRelease = [...counts].filter((n) => n > 0);
  await page.mouse.up();
  await settled(page);
  await paintedReady(page);
  expect(beforeRelease.length).toBeGreaterThan(2);
  const final = await row();
  expect(final.filter((v, j) => v !== initial[j]).length).toBe(81);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await settled(page);
  await paintedReady(page);
  expect(await row()).toEqual(initial);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await settled(page);
  await paintedReady(page);
  expect(await row()).toEqual(final);
});

for (const held of ["beginTerrainStroke", "appendTerrainStroke"]) {
  test(`direct height has no draft actions while ${held} is pending`, async ({
    page,
  }) => {
    await page.goto(url);
    await ready(page);
    await page.getByRole("button", { name: "Höhen", exact: true }).click();
    await paintedReady(page);
    const p = await screen(page, [10, 10]);
    await holdResponse(page, held);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + 100, p.y + 20, { steps: 20 });
    await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
    await expect(
      page.getByRole("region", { name: "Planung abschließen" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Übernehmen", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Abbrechen", exact: true }),
    ).toHaveCount(0);
    expect(await calls(page, "preview")).toHaveLength(0);
    await page.mouse.up();
    expect(await calls(page, "endTerrainStroke")).toHaveLength(0);
    await releaseResponse(page);
    await settled(page);
    await expect
      .poll(async () => (await calls(page, "endTerrainStroke")).length)
      .toBe(1);
    expect(await calls(page, "appendTerrainStroke")).not.toHaveLength(0);
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    await ready(page);
    await expect(
      page.getByRole("button", { name: "Rückgängig", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Wiederholen", exact: true }),
    ).toBeEnabled();
  });
}
