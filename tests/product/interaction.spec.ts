import { selectObject, finishRoad } from "../support/editor";
import type { Scene } from "../../src/atlas/model";
import { expect, test } from "../support/fixture";

import { url } from "../support/editor";

test("road options update preview and commit despite delayed old preview", async ({
  page,
}) => {
  await page.goto(url);
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  await page.getByRole("button", { name: "Straße", exact: true }).click();
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  await page.mouse.click(box.x + 100, box.y + 200);
  await page.evaluate(() => {
    window.atlasHold = { cmd: "preview" };
  });
  await page.mouse.click(box.x + 400, box.y + 200);
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await page.getByLabel("Straßenbreite (Fuß)").fill("30");
  await page.getByLabel("Straßenbreite (Fuß)").blur();
  await page.getByLabel("Material").selectOption("stone");
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(
      () => window.atlasCalls.filter((c) => c.cmd === "preview").length,
    ),
  ).toBe(1);
  const canvas = page.locator("canvas.atlas-overlay");
  const beforeRelease = await canvas.evaluate((c: HTMLCanvasElement) =>
    c.toDataURL(),
  );
  await page.evaluate(() => window.atlasRelease!());
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.atlasCalls.some(
          (c) =>
            c.cmd === "preview" &&
            (c.args.intent as any).road?.width === 30 &&
            (c.args.intent as any).road?.material === "stone",
        ),
      ),
    )
    .toBe(true);
  await expect
    .poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL()))
    .not.toBe(beforeRelease);
  await finishRoad(page);
  await expect
    .poll(() =>
      page.evaluate(() => window.atlasCalls.some((c) => c.cmd === "commit")),
    )
    .toBe(true);
  const intent = await page.evaluate(
    () => window.atlasCalls.find((c) => c.cmd === "commit")!.args.intent as any,
  );
  expect(intent.road).toMatchObject({ width: 30, material: "stone" });
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (
            await window.atlasCore<Scene>("scene", {
              context: { kind: "exterior" },
              bounds: [-1000, -1000, 1000, 1000],
            })
          ).objects,
      ),
    )
    .toContainEqual(
      expect.objectContaining({ kind: "road", width: 30, material: "stone" }),
    );
});

test("terrain material updates preview and commit", async ({ page }) => {
  await page.goto(url);
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  await page.getByRole("button", { name: "Gelände", exact: true }).click();
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  for (const [x, y] of [
    [100, 100],
    [300, 100],
    [300, 300],
  ])
    await page.mouse.click(box.x + x, box.y + y);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.atlasCalls.some(
          (c) =>
            c.cmd === "preview" &&
            (c.args.intent as any).area?.material === "earth",
        ),
      ),
    )
    .toBe(true);
  await page.getByLabel("Material").selectOption("stone");
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.atlasCalls.some(
          (c) =>
            c.cmd === "preview" &&
            (c.args.intent as any).area?.material === "stone",
        ),
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Übernehmen" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.atlasCalls.some(
          (c) =>
            c.cmd === "commit" &&
            (c.args.intent as any).area?.material === "stone",
        ),
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (
            await window.atlasCore<Scene>("scene", {
              context: { kind: "exterior" },
              bounds: [-1000, -1000, 1000, 1000],
            })
          ).objects,
      ),
    )
    .toContainEqual(
      expect.objectContaining({ kind: "area", material: "stone" }),
    );
});

test("rapid interior clicks queue immutable intents against successive revisions", async ({
  page,
}) => {
  await page.goto(url);
  await page.evaluate(async () => {
    await window.atlasCore("commit", {
      version: await window.atlasCore("status", {}),
      intent: {
        type: "createHouse",
        parcelId: null,
        transform: { x: 0, y: 0, angle: 0 },
        width: 8,
        depth: 8,
      },
    });
  });
  await page.reload();
  await selectObject(page, "⌂ Haus 1");
  await page.getByRole("button", { name: "Innen öffnen" }).click();
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  await page.getByRole("button", { name: "Radieren", exact: true }).click();
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  await page.evaluate(() => {
    window.atlasHold = { cmd: "commit" };
    window.atlasCalls = [];
  });
  await page.mouse.click(box.x + 160 + 16 * 1.1, box.y + 120 + 16 * 1.1);
  await expect.poll(() => page.evaluate(() => window.atlasHeld)).toBe(true);
  await page.mouse.click(box.x + 160 + 16 * 2.1, box.y + 120 + 16 * 1.1);
  await page.mouse.click(box.x + 160 + 16 * 3.1, box.y + 120 + 16 * 1.1);
  await page.evaluate(() => window.atlasRelease!());
  await expect
    .poll(() =>
      page.evaluate(
        () => window.atlasCalls.filter((c) => c.cmd === "commit").length,
      ),
    )
    .toBe(3);
  const calls = await page.evaluate(() =>
    window.atlasCalls
      .filter((c) => c.cmd === "commit")
      .map((c) => ({
        revision: (c.args.version as any).revision,
        cells: (c.args.intent as any).intent.cells,
      })),
  );
  expect(calls.map((c) => c.cells)).toEqual([[[1, 1]], [[2, 1]], [[3, 1]]]);
  expect(calls.map((c) => c.revision)).toEqual([
    calls[0].revision,
    calls[0].revision + 1,
    calls[0].revision + 2,
  ]);
});

test("canvas selection prioritizes houses and visible parcels over terrain, then the newest terrain", async ({
  page,
}) => {
  const { ready, seedParcels, commit, clickWorld } =
    await import("../support/editor");
  const { toWorld } = await import("../../src/atlas/model");
  await page.goto(url);
  const { house, parcel } = await seedParcels(page);
  for (const material of ["grass", "stone"])
    await commit(page, {
      type: "createArea",
      area: {
        material,
        points: [
          [-20, -20],
          [110, -20],
          [110, 120],
          [-20, 120],
        ],
      },
    });
  await page.reload();
  await ready(page);
  // Selecting the parcel makes its boundary hittable in the select tool.
  await selectObject(page, "▱ Parzelle");
  await ready(page);
  await clickWorld(page, toWorld([0.5, 0.5], house.transform));
  await expect(
    page.getByRole("heading", { name: "Gebäude", exact: true }),
  ).toBeVisible();
  await ready(page);
  await clickWorld(page, toWorld([0, 15], parcel.frame));
  await expect(
    page.getByRole("heading", { name: "Parzelle", exact: true }),
  ).toBeVisible();
  await ready(page);
  await clickWorld(page, [100, 110]);
  await expect(
    page.getByRole("heading", { name: "Gelände", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Flächenmaterial")).toHaveValue("stone");
});

test("batched floor navigation preserves every key press", async ({ page }) => {
  const { ready, seedParcels } = await import("../support/editor");
  await page.goto(url);
  const { house } = await seedParcels(page);
  await page.reload();
  await ready(page);
  await selectObject(page, `⌂ ${house.name}`);
  await page.getByRole("button", { name: "Innen öffnen", exact: true }).click();
  await ready(page);
  await page.evaluate(() => {
    for (let i = 0; i < 2; i++)
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "PageUp", code: "PageUp" }),
      );
  });
  await expect(page.getByLabel("Geschoss", { exact: true })).toHaveValue("2");
});

for (const rapidSwitch of [false, true]) {
  test(`first house gesture after ${rapidSwitch ? "house-road-house" : "select-house"} tool switch commits once`, async ({
    page,
  }) => {
    const { ready, status, scene, history } = await import("../support/editor");
    await page.goto(url);
    await ready(page);
    const before = await status(page);
    const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
    const house = page.getByRole("button", {
      name: "Haus",
      exact: true,
    });
    if (rapidSwitch) {
      await house.click();
      await page.getByRole("button", { name: "Straße", exact: true }).click();
    }
    await house.click();
    // No readiness wait, polling, sleep or second gesture after the tool switch.
    await page.mouse.move(box.x + 200, box.y + 160);
    await page.mouse.down();
    await page.mouse.move(box.x + 264, box.y + 224);
    await page.mouse.up();
    await expect.poll(async () => (await scene(page)).objects.length).toBe(1);
    expect((await scene(page)).objects[0].kind).toBe("house");
    expect((await status(page)).revision).toBe(before.revision + 1);
    expect(
      await page.evaluate(
        () => window.atlasCalls.filter((c) => c.cmd === "commit").length,
      ),
    ).toBe(1);
    await history(page);
    expect((await scene(page)).objects).toEqual([]);
    expect((await status(page)).canUndo).toBe(false);
    await history(page, true);
    expect((await scene(page)).objects).toHaveLength(1);
  });
}
