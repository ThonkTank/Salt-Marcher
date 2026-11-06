import { test, expect } from "../support/fixture";
import {
  ready,
  url,
  commit,
  scene,
  status,
  clickWorld,
  screen,
  calls,
} from "../support/editor";
import type { Intent, Road } from "../../src/atlas/model";
const road = async (page: import("@playwright/test").Page) =>
  (await scene(page)).objects.find((o): o is Road => o.kind === "road")!;
test("terrain following defaults on, routes around relief, preserves committed road through zoom and history", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await commit(page, {
    type: "terrainStroke",
    brush: {
      mode: "raise",
      radius: 45,
      amount: 50,
      strength: 1,
      target: 10,
      points: [[170, 80]],
    },
  });
  await page.reload();
  await ready(page);
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 700);
  await ready(page);
  await page.getByRole("button", { name: "Straße", exact: true }).click();
  await expect(
    page.getByLabel("Gelände folgen", { exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel("Spielraum (%)", { exact: true })).toHaveValue(
    "10",
  );
  await page.getByLabel("Spielraum (%)", { exact: true }).fill("30");
  await page.getByLabel("Spielraum (%)", { exact: true }).blur();
  await page.getByLabel("Bebauung", { exact: true }).selectOption("none");
  await page.getByLabel("Rauheit", { exact: true }).fill("0");
  await page.getByLabel("Rauheit", { exact: true }).blur();
  await clickWorld(page, [20, 80]);
  await clickWorld(page, [320, 80]);
  await expect(
    page.getByRole("button", { name: "Übernehmen", exact: true }),
  ).toBeEnabled();
  const p = await screen(page, [0, 0]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.wheel(0, 900);
  await ready(page);
  await page.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect.poll(async () => (await status(page)).revision).toBe(2);
  await ready(page);
  const r = await road(page);
  expect(r.path.some((p) => Math.abs(p[1] - 80) > 15)).toBe(true);
  const acceptedIntent = (await calls(page, "commit")).at(-1)?.args
    .intent as Intent;
  if (acceptedIntent.type !== "createRoad") throw Error("missing road intent");
  expect(r.nodes[0].point).toEqual(acceptedIntent.road.nodes[0].point);
  expect(r.nodes.at(-1)?.point).toEqual(
    acceptedIntent.road.nodes.at(-1)?.point,
  );
  expect(r.nodes[0].point[0]).toBeCloseTo(20, 3);
  expect(r.nodes.at(-1)?.point[0]).toBeCloseTo(320, 3);
  expect(r.sections).toHaveLength(1);
  expect((await calls(page, "commit")).at(-1)?.args.intent).toMatchObject({
    type: "createRoad",
    terrainFollow: { tolerance: 0.3 },
  });
  await page.mouse.wheel(0, -900);
  await ready(page);
  expect(await road(page)).toEqual(r);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect.poll(async () => (await status(page)).revision).toBe(3);
  await ready(page);
  expect(await road(page)).toBeUndefined();
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await expect.poll(async () => (await status(page)).revision).toBe(4);
  await ready(page);
  expect(await road(page)).toEqual(r);
  await page.getByRole("button", { name: "Straße", exact: true }).click();
  await page.getByLabel("Gelände folgen", { exact: true }).uncheck();
  await expect(page.getByLabel("Spielraum (%)", { exact: true })).toHaveCount(
    0,
  );
  await clickWorld(page, [20, 220]);
  await clickWorld(page, [320, 220]);
  await page.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect.poll(async () => (await status(page)).revision).toBe(5);
  expect(
    (
      (await calls(page, "commit")).at(-1)?.args.intent as {
        terrainFollow?: unknown;
      }
    ).terrainFollow,
  ).toBeUndefined();
});
