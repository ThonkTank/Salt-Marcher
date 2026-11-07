import type { Page } from "@playwright/test";
import {
  authorSnapshot,
  clickWorld,
  commit,
  holdResponse,
  metadata,
  openHouse,
  ready,
  releaseResponse,
  seedHouse,
  status,
  url,
} from "../support/editor";
import { expect, test } from "../support/fixture";

async function setup(page: Page) {
  await page.goto(url);
  const house = await seedHouse(page, 4, 4, [-1, 0, 1]);
  await commit(page, {
    type: "room",
    buildingId: house.id,
    intent: {
      kind: "draw",
      floor: 0,
      cells: [
        [4, 1],
        [4, 2],
        [5, 1],
        [5, 2],
      ],
    },
  });
  await openHouse(page, house);
  return house;
}

test("inner door and passage create convert unchanged delete preserve room owners and exact history and file", async ({
  page,
}) => {
  const house = await setup(page);
  await commit(page, {
    type: "connection",
    buildingId: house.id,
    intent: {
      action: "createStairs",
      floor: 0,
      x: 1,
      y: 1,
      direction: "east",
      length: 2,
    },
  });
  await openHouse(page, house);
  const before = await authorSnapshot(page, house.id);
  await page.getByRole("button", { name: "Tür", exact: true }).click();
  await clickWorld(page, [20, 7.5]);
  await expect
    .poll(
      async () =>
        (await metadata(page, house.id)).connections.filter(
          (c) => c.type === "opening" && c.toRoom !== null,
        ).length,
    )
    .toBe(1);
  const opening = (await metadata(page, house.id)).connections.find(
    (c) => c.type === "opening" && c.toRoom !== null,
  )!;
  expect(opening).toMatchObject({
    type: "opening",
    kind: "door",
    axis: "vertical",
    x: 4,
    y: 1,
    floor: 0,
    offset: 0,
  });
  const withDoor = await authorSnapshot(page, house.id);
  expect(withDoor.rooms).toEqual(before.rooms);
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  await ready(page);
  await clickWorld(page, [20, 7.5]);
  await page
    .getByRole("button", { name: "Tür / Durchgang umwandeln", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await metadata(page, house.id)).connections.find(
          (c) => c.id === opening.id,
        )?.type === "opening" &&
        (await metadata(page, house.id)).connections.find(
          (c) => c.id === opening.id,
        ),
    )
    .toMatchObject({ id: opening.id, kind: "passage", offset: 0 });
  const passage = await authorSnapshot(page, house.id),
    rev = (await status(page)).revision;
  const unchanged = await commit(page, {
    type: "connection",
    buildingId: house.id,
    intent: { action: "convert", connectionId: opening.id, kind: "passage" },
  });
  expect(unchanged.changed).toBe(false);
  expect((await status(page)).revision).toBe(rev);
  expect(await authorSnapshot(page, house.id)).toEqual(passage);
  await page
    .getByRole("button", { name: "Verbindung löschen", exact: true })
    .click();
  await expect
    .poll(async () =>
      (await metadata(page, house.id)).connections.some(
        (c) => c.id === opening.id,
      ),
    )
    .toBe(false);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await ready(page);
  expect(await authorSnapshot(page, house.id)).toEqual(passage);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await ready(page);
  expect(await authorSnapshot(page, house.id)).toEqual(withDoor);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await ready(page);
  expect(await authorSnapshot(page, house.id)).toEqual(passage);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect.poll(async () => (await status(page)).dirty).toBe(false);
  await page.getByRole("button", { name: "Neu", exact: true }).click();
  await ready(page);
  await page.getByRole("button", { name: "Öffnen", exact: true }).click();
  await ready(page);
  expect(await authorSnapshot(page, house.id)).toEqual(passage);
});

test("retained stair inspector jump uses displayed floor while a target floor is held", async ({
  page,
}) => {
  const house = await setup(page);
  await commit(page, {
    type: "connection",
    buildingId: house.id,
    intent: {
      action: "createStairs",
      floor: 0,
      x: 1,
      y: 1,
      direction: "east",
      length: 2,
    },
  });
  await openHouse(page, house);
  await page.getByRole("button", { name: "Treppe · G 0", exact: true }).click();
  await ready(page);
  await holdResponse(page, "interiorTile", 1);
  await page.getByLabel("Geschoss", { exact: true }).fill("1");
  await page.getByLabel("Geschoss", { exact: true }).blur();
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await expect(
    page.getByRole("button", { name: "Treppe · G 0", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Zur anderen Seite", exact: true })
    .click();
  await releaseResponse(page);
  await ready(page);
  await expect(page.getByLabel("Geschoss", { exact: true })).toHaveValue("1");
});
