import { test, expect } from "../support/fixture";
import {
  url,
  ready,
  calls,
  clearCalls,
  scene,
  status,
  clickWorld,
  dragWorld,
  screen,
} from "../support/editor";
import type { Road } from "../../src/atlas/model";

async function overview(page: import("@playwright/test").Page) {
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 700);
  await expect(
    page.getByRole("button", { name: "Zum Bearbeiten hineinzoomen" }),
  ).toBeVisible();
  await ready(page);
}
async function road(page: import("@playwright/test").Page) {
  return (await scene(page)).objects.find((o): o is Road => o.kind === "road")!;
}
test("overview draws rough roads with optional population, preserves draft across zoom and commits fixed points", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await overview(page);
  await clearCalls(page);
  await page.getByRole("button", { name: "Straße", exact: true }).click();
  await page.getByLabel("Bebauung", { exact: true }).selectOption("parcels");
  await clickWorld(page, [0, 0]);
  await clickWorld(page, [300, 0]);
  await expect(
    page.getByRole("button", { name: "Übernehmen", exact: true }),
  ).toBeEnabled();
  expect(await calls(page, "scene")).toHaveLength(0);
  expect(await calls(page, "interiorTile")).toHaveLength(0);
  await page.screenshot({ path: test.info().outputPath("overview-road.png") });
  await page
    .getByRole("button", { name: "Zum Bearbeiten hineinzoomen" })
    .click();
  await ready(page);
  await expect(page.getByLabel("Rauheit", { exact: true })).toHaveValue("0.33");
  await page.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect.poll(async () => (await status(page)).revision).toBe(1);
  const r = await road(page);
  expect(r.nodes.length).toBeGreaterThan(2);
  expect(r.nodes[0].point[0]).toBeCloseTo(0, 3);
  expect(r.nodes[0].point[1]).toBeCloseTo(0, 3);
  expect(r.nodes.at(-1)?.point[0]).toBeCloseTo(300, 3);
  expect((await scene(page)).objects.some((o) => o.kind === "parcel")).toBe(
    true,
  );
  expect((await scene(page)).objects.some((o) => o.kind === "house")).toBe(
    false,
  );
});
test("overview selects exact header, moves point with handles, inserts and deletes node and edits roughness explicitly", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Straße", exact: true }).click();
  await page.getByLabel("Bebauung", { exact: true }).selectOption("none");
  await page.getByLabel("Rauheit", { exact: true }).fill("0");
  await page.getByLabel("Rauheit", { exact: true }).press("Enter");
  await clickWorld(page, [0, 0]);
  await clickWorld(page, [180, 0]);
  await page.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect.poll(async () => (await status(page)).revision).toBe(1);
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  await clearCalls(page);
  await overview(page);
  await clickWorld(page, [90, 0]);
  await ready(page);
  await expect(
    page.getByRole("button", { name: "Verlauf aufrauen" }),
  ).toBeVisible();
  expect((await calls(page, "roadHeader")).length).toBeGreaterThan(0);
  expect(await calls(page, "scene")).toHaveLength(0);
  const before = await road(page);
  await dragWorld(page, [0, 0], [0, 40]);
  await expect.poll(async () => (await status(page)).revision).toBe(2);
  const moved = await road(page);
  expect(moved.nodes[0].point[0]).toBeCloseTo(0, 3);
  expect(moved.nodes[0].point[1]).toBeCloseTo(40, 3);
  expect(moved.nodes[0].outgoing![0] - moved.nodes[0].point[0]).toBeCloseTo(
    before.nodes[0].outgoing![0] - before.nodes[0].point[0],
    3,
  );
  expect(moved.nodes[0].outgoing![1] - moved.nodes[0].point[1]).toBeCloseTo(
    before.nodes[0].outgoing![1] - before.nodes[0].point[1],
    3,
  );
  const q = await screen(page, [90, 20]);
  await page.mouse.dblclick(q.x, q.y);
  await expect.poll(async () => (await road(page)).nodes.length).toBe(3);
  const inserted = (await road(page)).nodes[1];
  await clickWorld(page, inserted.point);
  await expect(
    page.getByRole("button", { name: "Kurvengriffe anlegen" }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Verlaufspunkt löschen" }).click();
  await expect.poll(async () => (await road(page)).nodes.length).toBe(2);
  await page.getByRole("button", { name: "Verlauf aufrauen" }).click();
  await page.getByLabel("Rauheit", { exact: true }).fill("0.5");
  await page.getByLabel("Rauheit", { exact: true }).press("Enter");
  await expect(
    page.getByRole("button", { name: "Übernehmen", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect
    .poll(async () => (await road(page)).nodes.length)
    .toBeGreaterThan(2);
});

test("overview variation cancels cleanly and right click commits houses without the hover endpoint", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await overview(page);
  await page.getByRole("button", { name: "Straße", exact: true }).click();
  await clickWorld(page, [0, 0]);
  await clickWorld(page, [300, 0]);
  await page
    .getByRole("button", { name: "Neue Variation", exact: true })
    .click();
  await expect
    .poll(async () => {
      const intent = (await calls(page, "preview")).at(-1)?.args.intent as
        { roughness?: { seed: number } } | undefined;
      return intent?.roughness?.seed;
    })
    .toBe(2);
  await page.getByTestId("atlas-canvas").focus();
  await page.keyboard.press("Escape");
  expect((await status(page)).revision).toBe(0);
  await clickWorld(page, [0, 0]);
  await clickWorld(page, [300, 0]);
  const ghost = await screen(page, [400, 100]);
  await page.mouse.move(ghost.x, ghost.y);
  await page.mouse.click(ghost.x, ghost.y, { button: "right" });
  await expect.poll(async () => (await status(page)).revision).toBe(1);
  const objects = (await scene(page)).objects;
  const r = objects.find((o): o is Road => o.kind === "road")!;
  expect(r.nodes.at(-1)!.point[0]).toBeCloseTo(300, 3);
  expect(r.nodes.at(-1)!.point[1]).toBeCloseTo(0, 3);
  expect(objects.some((o) => o.kind === "house")).toBe(true);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect.poll(async () => (await scene(page)).objects.length).toBe(0);
});
