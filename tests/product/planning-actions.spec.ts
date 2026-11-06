import { test, expect } from "../support/fixture";
import {
  calls,
  clearCalls,
  clickWorld,
  ready,
  scene,
  screen,
  seedRoad,
  selectObject,
  status,
  url,
} from "../support/editor";

for (const kind of ["road", "population"] as const) {
  for (const finish of ["button", "enter", "right"] as const) {
    test(`${kind}: ${finish} commits the current plan once while preview is pending`, async ({
      page,
    }) => {
      await page.goto(url);
      if (kind === "population") {
        const road = await seedRoad(page, false, 160);
        await page.reload();
        await selectObject(page, `↝ ${road.name}`);
      }
      await ready(page);
      const before = await status(page);
      const objectsBefore = (await scene(page)).objects;
      await clearCalls(page);
      await page.evaluate(() => {
        window.atlasHold = { cmd: "preview" };
      });
      if (kind === "population") {
        await page
          .getByRole("button", { name: "Straße bebauen", exact: true })
          .click();
      } else {
        await page
          .getByRole("button", {
            name: "Straße",
            exact: true,
          })
          .click();
        await clickWorld(page, [0, 0]);
        await clickWorld(page, [140, 0]);
      }
      await expect
        .poll(() => page.evaluate(() => !!window.atlasHeld))
        .toBe(true);
      const actions = page.getByRole("region", { name: "Planung abschließen" });
      await expect(
        actions.getByRole("button", { name: "Übernehmen", exact: true }),
      ).toBeEnabled();
      if (finish === "button")
        await actions
          .getByRole("button", { name: "Übernehmen", exact: true })
          .click();
      else if (finish === "enter") await page.keyboard.press("Enter");
      else {
        const point = await screen(page, [20, 20]);
        await page.mouse.click(point.x, point.y, { button: "right" });
      }
      await expect
        .poll(async () => (await status(page)).revision)
        .toBe(before.revision + 1);
      await page.evaluate(() => window.atlasRelease?.());
      await ready(page);
      expect(await calls(page, "commit")).toHaveLength(1);
      await page
        .getByRole("button", { name: "Rückgängig", exact: true })
        .click();
      await expect
        .poll(async () => (await scene(page)).objects)
        .toEqual(objectsBefore);
    });
  }
}

test("field Enter applies locally and Escape restores locally without ending the road plan", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Straße", exact: true }).click();
  await clickWorld(page, [0, 0]);
  await clickWorld(page, [140, 0]);
  const width = page.getByLabel("Straßenbreite (Fuß)", { exact: true });
  await width.fill("18");
  await width.press("Enter");
  await expect(width).toHaveValue("18");
  await width.fill("25");
  await width.press("Escape");
  await expect(width).toHaveValue("18");
  expect(await calls(page, "commit")).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "Übernehmen", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  expect((await scene(page)).objects).toHaveLength(0);
});

test("Escape rolls back a dragged road point and retains the completed plan", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Straße", exact: true }).click();
  await page.getByLabel("Rauheit", { exact: true }).fill("0");
  await page.getByLabel("Rauheit", { exact: true }).press("Enter");
  await page.getByLabel("Bebauung", { exact: true }).selectOption("none");
  await clickWorld(page, [0, 0]);
  await clickWorld(page, [120, 0]);
  const start = await screen(page, [120, 0]);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, start.y + 80);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect.poll(async () => (await status(page)).revision).toBe(1);
  const road = (await scene(page)).objects.find((o) => o.kind === "road");
  expect(road?.kind === "road" && road.nodes.map((n) => n.point)).toEqual([
    [0, 0],
    [120, 0],
  ]);
});

test("name fields commit on Enter and restore on Escape without leaking editor actions", async ({
  page,
}) => {
  await page.goto(url);
  const road = await seedRoad(page, false);
  await page.reload();
  await selectObject(page, `↝ ${road.name}`);
  const name = page.getByLabel("Name", { exact: true });
  await name.fill("Neuer Weg");
  await name.press("Enter");
  await expect.poll(async () => (await status(page)).revision).toBe(2);
  await ready(page);
  await name.fill("Verworfen");
  await name.press("Escape");
  await expect(name).toHaveValue("Neuer Weg");
  expect((await status(page)).revision).toBe(2);
});
