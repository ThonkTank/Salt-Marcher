import {
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
  await expect
    .poll(async () => (await status(page)).revision)
    .toBeGreaterThan(rev);
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
      .toBeGreaterThan(revision);
    await ready(page);
  }
});
