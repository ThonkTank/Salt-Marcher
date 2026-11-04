import type { Page } from "@playwright/test";
import {
  authorSnapshot,
  calls,
  clearCalls,
  commit,
  history,
  metadata,
  openHouse,
  ready,
  screen,
  seedHouse,
  setFloor,
  status,
  url,
} from "../support/editor";
import { expect, test } from "../support/fixture";
import { redPixelCount } from "../support/pixels";

async function setup(page: Page, width = 8, depth = 8) {
  await page.goto(url);
  const house = await seedHouse(page, width, depth, [-1, 0, 1]);
  await openHouse(page, house);
  await page.getByRole("button", { name: "Treppe", exact: true }).click();
  await clearCalls(page);
  return house;
}
const stairs = async (page: Page, id: string) =>
  (await metadata(page, id)).connections.filter((c) => c.type === "stairs");
async function begin(page: Page, x = 2, y = 2) {
  const p = await screen(page, [5 * (x + 0.5), 5 * (y + 0.5)]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
}
async function move(page: Page, x: number, y: number) {
  const p = await screen(page, [5 * (x + 0.5), 5 * (y + 0.5)]);
  await page.mouse.move(p.x, p.y);
}

for (const [travel, dx, dy, direction] of [
  ["up", 1, 0, "east"],
  ["down", 0, -1, "south"],
] as const) {
  test(`physical stair ${travel}: pointer gesture commits once and undo restores author data`, async ({
    page,
  }) => {
    const house = await setup(page);
    await setFloor(page, travel === "up" ? 0 : 1);
    await page.getByLabel("Richtung").selectOption(travel);
    const before = await authorSnapshot(page, house.id);
    const beforeStatus = await status(page);
    await clearCalls(page);
    await begin(page);
    await move(page, 2 + 2 * dx, 2 + 2 * dy);
    await page.mouse.up();
    await expect
      .poll(async () => (await stairs(page, house.id)).length)
      .toBe(1);
    const [run] = await stairs(page, house.id);
    expect(run).toMatchObject({
      floor: 0,
      x: 2 + (travel === "down" ? 2 * dx : 0),
      y: 2 + (travel === "down" ? 2 * dy : 0),
      direction,
      length: 3,
      offset: 0,
    });
    const rooms = (await metadata(page, house.id)).rooms;
    expect(run.fromRoom).toBe(rooms.find((r) => r.floor === 0)!.id);
    expect(run.toRoom).toBe(rooms.find((r) => r.floor === 1)!.id);
    expect(await calls(page, "commit")).toHaveLength(1);
    expect((await status(page)).revision).toBe(beforeStatus.revision + 1);
    await history(page);
    expect(await authorSnapshot(page, house.id)).toEqual(before);
  });
}

test("stair click is empty; dominant-axis ties retain the last axis and final pointerup is authoritative", async ({
  page,
}) => {
  const house = await setup(page);
  await begin(page, 1, 1);
  await page.mouse.up();
  expect(await calls(page, "commit")).toHaveLength(0);
  await begin(page, 1, 1);
  for (const [x, y, direction, length] of [
    [3, 3, "east", 3],
    [2, 4, "south", 4],
    [3, 3, "south", 3],
    [4, 2, "east", 4],
    [3, 3, "east", 3],
  ] as const) {
    await move(page, x, y);
    await expect
      .poll(async () => {
        const previews = await calls(page, "preview");
        return (previews.at(-1)?.args.intent as any)?.intent;
      })
      .toMatchObject({ direction, length });
  }
  await page.mouse.up();
  await expect.poll(async () => (await stairs(page, house.id)).length).toBe(1);
  expect((await stairs(page, house.id))[0]).toMatchObject({
    x: 1,
    y: 1,
    direction: "east",
    length: 3,
  });
});

test("ordinary focus preserves stair drag while travel change revokes its captured geometry", async ({
  page,
}) => {
  const house = await setup(page);
  await begin(page, 1, 2);
  await move(page, 3, 2);
  await page.getByLabel("Geschoss", { exact: true }).focus();
  await page.mouse.up();
  await expect.poll(async () => (await stairs(page, house.id)).length).toBe(1);
  await ready(page);
  await clearCalls(page);
  await begin(page, 1, 4);
  await move(page, 3, 4);
  await page.getByLabel("Richtung").selectOption("down");
  await page.mouse.up();
  expect(await calls(page, "commit")).toHaveLength(0);
  expect(await stairs(page, house.id)).toHaveLength(1);
});

test("physical stairs are selectable on each floor, jump respects the displayed side, and deletion history and file preserve exact author data", async ({
  page,
}) => {
  const house = await setup(page);
  await begin(page, 1, 2);
  await move(page, 3, 2);
  await page.mouse.up();
  await expect.poll(async () => (await stairs(page, house.id)).length).toBe(1);
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  await ready(page);
  const before = await authorSnapshot(page, house.id);
  for (const floor of [0, 1]) {
    await setFloor(page, floor);
    const p = await screen(page, [12.5, 12.5]);
    await page.mouse.click(p.x, p.y);
    await expect(
      page.getByRole("button", { name: "Treppe · G 0", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", { name: "Zur anderen Seite", exact: true })
      .click();
    await ready(page);
    await expect(page.getByLabel("Geschoss", { exact: true })).toHaveValue(
      String(1 - floor),
    );
  }
  await page
    .getByRole("button", { name: "Verbindung löschen", exact: true })
    .click();
  await expect.poll(async () => (await stairs(page, house.id)).length).toBe(0);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await ready(page);
  expect(await authorSnapshot(page, house.id)).toEqual(before);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await ready(page);
  expect(await stairs(page, house.id)).toHaveLength(0);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await ready(page);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect.poll(async () => (await status(page)).dirty).toBe(false);
  await page.getByRole("button", { name: "Neu", exact: true }).click();
  await ready(page);
  await page.getByRole("button", { name: "Öffnen", exact: true }).click();
  await ready(page);
  expect(await authorSnapshot(page, house.id)).toEqual(before);
});

test("invalid whole stair footprint paints red and displays the backend reason before release", async ({
  page,
}) => {
  const house = await setup(page);
  await commit(page, {
    type: "room",
    buildingId: house.id,
    intent: { kind: "erase", floor: 1, cells: [[2, 2]] },
  });
  await openHouse(page, house);
  await page.getByRole("button", { name: "Treppe", exact: true }).click();
  const response = await page.evaluate(
    async (id) =>
      window.atlasCore<any>("preview", {
        version: await window.atlasCore("status", {}),
        intent: {
          type: "connection",
          buildingId: id,
          intent: {
            action: "createStairs",
            floor: 0,
            x: 1,
            y: 2,
            direction: "east",
            length: 3,
          },
        },
      }),
    house.id,
  );
  expect(response.valid).toBe(false);
  const before = await authorSnapshot(page, house.id);
  const version = await status(page);
  await clearCalls(page);
  await begin(page, 1, 2);
  await move(page, 3, 2);
  await expect.poll(async () => (await calls(page, "preview")).length).toBe(1);
  await expect(
    page.getByRole("status", { name: "Aktionsstatus" }),
  ).toContainText(response.reason);
  await expect.poll(() => redPixelCount(page)).toBeGreaterThan(0);
  await page.mouse.up();
  await expect(page.getByRole("status")).toContainText(response.reason);
  expect(await authorSnapshot(page, house.id)).toEqual(before);
  expect((await status(page)).revision).toBe(version.revision);
});
