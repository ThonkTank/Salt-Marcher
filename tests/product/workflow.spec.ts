import { selectObject, commit, clickWorld } from "../support/editor";
import {
  calls,
  clearCalls,
  ready,
  scene,
  screen,
  seedRoad,
  url,
} from "../support/editor";
import { expect, test } from "../support/fixture";

test("normal pointer capture release and subsequent Blur preserve an admitted area commit", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await commit(page, {
    type: "createArea",
    area: {
      material: "earth",
      points: [
        [0, 0],
        [50, 0],
        [50, 40],
      ],
    },
  });
  await page.reload();
  await ready(page);
  const s = await screen(page, [30, 10]);
  await page.mouse.click(s.x, s.y); // select tool is explicit below
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  await clickWorld(page, [30, 10]);
  await ready(page);
  await clearCalls(page);
  await page.evaluate(() => {
    window.atlasHold = { cmd: "commit" };
  });
  const start = await screen(page, [50, 0]);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 20, start.y + 20);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.evaluate(() => window.atlasRelease?.());
  await expect.poll(async () => (await calls(page, "commit")).length).toBe(1);
});

test("pointercancel rolls a new road back to its last completed node", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Straße", exact: true }).click();
  await page.getByLabel("Rauheit", { exact: true }).fill("0");
  await page.getByLabel("Rauheit", { exact: true }).blur();
  const first = await screen(page, [0, 0]),
    cancelled = await screen(page, [50, 30]),
    last = await screen(page, [80, 0]);
  await page.mouse.click(first.x, first.y);
  await page.mouse.move(cancelled.x, cancelled.y);
  await page.mouse.down();
  await page.mouse.move(cancelled.x + 15, cancelled.y + 20);
  await page
    .getByTestId("atlas-canvas")
    .dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  await page.keyboard.press("Enter");
  expect(await calls(page, "commit")).toHaveLength(0);
  await page.mouse.click(last.x, last.y);

  await page.keyboard.press("Enter");
  await expect.poll(async () => (await calls(page, "commit")).length).toBe(1);
  const road = (await scene(page)).objects.find((o) => o.kind === "road")!;
  expect(road.kind === "road" && road.nodes.map((n) => n.point)).toEqual([
    [0, 0],
    [80, 0],
  ]);
});

test("pan after final pointerup preserves the admitted commit", async ({
  page,
}) => {
  await page.goto(url);
  await seedRoad(page, false, 90);
  await page.reload();
  await ready(page);
  await selectObject(page, "↝ Testweg");
  await ready(page);
  await clearCalls(page);
  await page.evaluate(() => {
    window.atlasHold = { cmd: "commit" };
  });
  const start = await screen(page, [90, 0]);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 20, start.y + 30);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await page.keyboard.down("Space");
  const pan = await screen(page, [30, 20]);
  await page.mouse.move(pan.x, pan.y);
  await page.mouse.down();
  await page.mouse.move(pan.x + 30, pan.y + 20);
  await page.mouse.up();
  await page.keyboard.up("Space");
  await page.evaluate(() => window.atlasRelease?.());
  await expect.poll(async () => (await calls(page, "commit")).length).toBe(1);
});
