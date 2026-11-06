import {
  calls,
  commit,
  dragWorld,
  ready,
  scene,
  screen,
  selectObject,
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
test("height brush previews, commits once, cancels and survives undo/redo", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Höhen", exact: true }).click();
  await expect(page.getByLabel("Pinselmodus")).toHaveValue("land");
  await dragWorld(page, [20, 30], [50, 30], false);
  await expect
    .poll(async () =>
      (await calls(page, "preview")).some(
        (c) =>
          (c.args.intent as { type?: string } | undefined)?.type ===
          "terrainStroke",
      ),
    )
    .toBe(true);
  await expect.poll(async () => (await status(page)).revision).toBe(0);
  await page.mouse.up();
  await expect.poll(async () => (await status(page)).revision).toBe(1);
  await ready(page);
  const raised = (await terrain(page)).tiles[0].heights;
  expect(Math.max(...raised)).toBe(10);
  expect(
    (await calls(page, "commit")).filter(
      (c) =>
        (c.args.intent as { type?: string } | undefined)?.type ===
        "terrainStroke",
    ),
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await ready(page);
  expect(Math.max(...(await terrain(page)).tiles[0].heights)).toBe(-100);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await ready(page);
  expect((await terrain(page)).tiles[0].heights).toEqual(raised);
  const rev = (await status(page)).revision;
  await dragWorld(page, [20, 30], [70, 40], false);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect((await status(page)).revision).toBe(rev);
  await page.getByLabel("Pinselmodus").selectOption("lower");
  await dragWorld(page, [20, 30], [50, 30]);
  await expect.poll(async () => (await status(page)).revision).toBe(rev + 1);
  await ready(page);
  expect(Math.max(...(await terrain(page)).tiles[0].heights)).toBeLessThan(
    Math.max(...raised),
  );
});
test("water allows flooded building and foundation edits; brush works in overview", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Höhen", exact: true }).click();
  await page.getByRole("button", { name: "Gewässer", exact: true }).click();
  await dragWorld(page, [40, 40], [50, 40]);
  await expect
    .poll(async () => (await terrain(page)).tiles[0].waters.length)
    .toBeGreaterThan(0);
  await ready(page);
  const made = await commit(page, {
    type: "createHouse",
    parcelId: null,
    transform: { x: 40, y: 40, angle: 0 },
    width: 4,
    depth: 4,
  });
  expect(made.valid).toBe(true);
  // The next UI edit refreshes status through the shared queue, so reload the view after a direct fixture commit.
  await page.reload();
  await ready(page);
  const house = (await scene(page)).objects.find((o) => o.kind === "house");
  expect(house?.kind).toBe("house");
  await page.getByRole("button", { name: "Höhen", exact: true }).click();
  const p = await screen(page, [40, 40]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.wheel(0, 1300);
  // Wheel dispatch returns before the camera changes; wait for the requested
  // overview before testing readiness and admitting the brush gesture.
  await expect(
    page.getByRole("button", { name: "Zum Bearbeiten hineinzoomen" }),
  ).toBeVisible();
  await ready(page);
  const rev = (await status(page)).revision;
  await dragWorld(page, [40, 40], [80, 40]);
  await expect.poll(async () => (await status(page)).revision).toBe(rev + 1);
});

test("relief, coast and adjustable house foundation are visible", async ({
  page,
}, testInfo) => {
  await page.goto(url);
  await ready(page);
  await commit(page, {
    type: "terrainStroke",
    brush: {
      mode: "raise",
      radius: 65,
      amount: 30,
      strength: 0.25,
      target: 10,
      points: [
        [45, 55],
        [75, 55],
      ],
    },
  });
  await commit(page, {
    type: "waterStroke",
    brush: {
      mode: "lower",
      radius: 55,
      amount: 20,
      strength: 0.25,
      target: 10,
      points: [
        [150, 90],
        [180, 90],
      ],
    },
  });
  await commit(page, {
    type: "createHouse",
    parcelId: null,
    transform: { x: 55, y: 55, angle: 0 },
    width: 4,
    depth: 4,
  });
  await page.reload();
  await ready(page);
  const p = await screen(page, [65, 65]);
  await selectObject(page, "⌂ Haus 1");
  await expect(page.getByLabel("Fundamenthöhe (Fuß)")).toHaveValue("1");
  await page.getByLabel("Fundamenthöhe (Fuß)").fill("3");
  await page.getByLabel("Fundamenthöhe (Fuß)").blur();
  await ready(page);
  await expect
    .poll(async () => {
      const h = (await scene(page)).objects.find((o) => o.kind === "house");
      return h?.kind === "house" ? h.foundation.height : null;
    })
    .toBe(3);
  await page.getByLabel("Geländeübergang (Fuß)").fill("20");
  await page.getByLabel("Geländeübergang (Fuß)").blur();
  await ready(page);
  await page.getByRole("button", { name: "Höhen", exact: true }).click();
  await page.mouse.move(p.x + 100, p.y - 70);
  await page.screenshot({ path: testInfo.outputPath("relief-foundation.png") });
  for (const mode of ["smooth", "flatten"]) {
    await page.getByLabel("Pinselmodus").selectOption(mode);
    const revision = (await status(page)).revision;
    await dragWorld(page, [35, 55], [65, 55]);
    await expect
      .poll(async () => (await status(page)).revision)
      .toBe(revision + 1);
    await ready(page);
  }
});
