import { showObjects } from "../support/editor";
import { selectObject } from "../support/editor";
import type { Page } from "@playwright/test";
import {
  calls,
  clearCalls,
  clickWorld,
  commit,
  dragWorld,
  holdResponse,
  metadata,
  openHouse,
  ready,
  releaseResponse,
  scene,
  screen,
  seedHouse,
  selectRoom,
  status,
  url,
} from "../support/editor";
import { expect, test } from "../support/fixture";

async function setup(page: Page, width = 4) {
  await page.goto(url);
  const house = await seedHouse(page, width, 4, [-1, 0, 1]);
  await openHouse(page, house);
  const room = await selectRoom(page, house.id);
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  await clearCalls(page);
  return { house, room };
}

test("confirmed room move blocks another drag until current geometry data arrives", async ({
  page,
}) => {
  const { house } = await setup(page);
  const before = (await status(page)).revision;
  // Capture the already drawn camera before intentionally blocking fresh geometry.
  const blockedStart = await screen(page, [7.5, 7.5]);
  const blockedEnd = await screen(page, [37.5, 7.5]);
  await holdResponse(page, "interiorTile");
  await dragWorld(page, [7.5, 7.5], [7.5, 37.5]);
  await expect.poll(async () => (await status(page)).revision).toBe(before + 1);
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await expect(page.getByText("Ansicht wird geladen …")).toBeVisible();
  await page.mouse.move(blockedStart.x, blockedStart.y);
  await page.mouse.down();
  await page.mouse.move(blockedEnd.x, blockedEnd.y);
  await page.mouse.up();
  expect(await calls(page, "commit")).toHaveLength(1);
  await releaseResponse(page);
  await ready(page);
  await selectRoom(page, house.id);
  await dragWorld(page, [7.5, 37.5], [12.5, 37.5]);
  await expect.poll(async () => (await calls(page, "commit")).length).toBe(2);
});

test("same-range camera changes keep loaded room geometry editable", async ({
  page,
}) => {
  await setup(page, 130);
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 180);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(box.x + 88, box.y + 180);
  await page.mouse.up({ button: "middle" });
  await ready(page);
  await dragWorld(page, [7.5, 7.5], [7.5, 32.5]);
  await expect.poll(async () => (await calls(page, "commit")).length).toBe(1);
});

test("deleting the contextual house clears primary room and keeps exterior context through undo", async ({
  page,
}) => {
  const { house, room } = await setup(page);
  await page.keyboard.press("Delete");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Löschen bestätigen", exact: true })
    .click();
  await expect
    .poll(async () =>
      (await scene(page)).objects.some((o) => o.id === house.id),
    )
    .toBe(false);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await ready(page);
  await expect(page.getByLabel("Geschoss", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: `${room.name} · G 0`, exact: true }),
  ).toHaveCount(0);
  await showObjects(page);
  await expect(
    page.getByRole("button", { name: `⌂ ${house.name}`, exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("DPR resize during pending connection preserves focus, lower composition and canvas resolution", async ({
  page,
}) => {
  const { house } = await setup(page);
  await page.getByRole("button", { name: "Tür", exact: true }).click();
  await holdResponse(page, "commit");
  await clickWorld(page, [0, 7.5]);
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  const input = page.getByLabel("Geschoss", { exact: true });
  await input.focus();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 960,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await releaseResponse(page);
  await expect(input).toBeFocused();
  await ready(page);
  const size = await page
    .getByTestId("atlas-canvas")
    .evaluate((c: HTMLCanvasElement) => ({
      width: c.width,
      css: c.getBoundingClientRect().width,
      dpr: devicePixelRatio,
    }));
  expect(size.dpr).toBe(2);
  expect(size.width).toBe(Math.round(size.css * 2));
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  await expect(page.getByLabel("Untere Geschosse anzeigen")).toBeChecked();
  expect(
    (await metadata(page, house.id)).connections.some(
      (c) => c.type === "opening" && c.x === 0 && c.y === 1,
    ),
  ).toBe(true);
  await cdp.detach();
});

test("isolated upper roof remains visible after movement while basement stays outside roof contours", async ({
  page,
}) => {
  await page.goto(url);
  const house = await seedHouse(page, 2, 2, [-1, 0]);
  await commit(page, {
    type: "room",
    buildingId: house.id,
    intent: {
      kind: "draw",
      floor: 2,
      cells: [
        [8, 0],
        [9, 0],
        [8, 1],
        [9, 1],
      ],
    },
  });
  await commit(page, {
    type: "room",
    buildingId: house.id,
    intent: {
      kind: "erase",
      floor: 0,
      cells: [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ],
    },
  });
  await commit(page, { type: "roof", id: house.id, roof: "#123456" });
  await page.reload();
  await ready(page);
  const roof = (await scene(page)).objects.find((o) => o.id === house.id)!;
  expect(roof).toMatchObject({
    kind: "house",
    roof: "#123456",
    contours: [
      [
        [8, 0],
        [10, 0],
        [10, 2],
        [8, 2],
      ],
    ],
  });
  const pixel = async (world: [number, number]) => {
    const p = await screen(page, world),
      box = (await page.getByTestId("atlas-canvas").boundingBox())!;
    return page
      .getByTestId("atlas-canvas")
      .evaluate(
        (c: HTMLCanvasElement, p) =>
          [
            ...c
              .getContext("2d")!
              .getImageData(
                Math.round(p.x * devicePixelRatio),
                Math.round(p.y * devicePixelRatio),
                1,
                1,
              ).data,
          ].slice(0, 3),
        { x: p.x - box.x, y: p.y - box.y },
      );
  };
  // Sample inside a roof face, away from the decorative hip lines. Its blue
  // authored pigment remains visible under shading and must move unchanged.
  const roofPixel = await pixel([47.5, 6.25]);
  expect(roofPixel[2]).toBeGreaterThan(roofPixel[1]);
  expect(roofPixel[1]).toBeGreaterThan(roofPixel[0]);
  expect(await pixel([7.5, 6.25])).not.toEqual(roofPixel);
  await selectObject(page, "⌂ Haus 1");
  await dragWorld(page, [47.5, 7.5], [67.5, 7.5]);
  await ready(page);
  await expect
    .poll(async () =>
      (await scene(page)).objects.find((o) => o.id === house.id),
    )
    .toMatchObject({ transform: { x: 20, y: 0, angle: 0 } });
  // Selection tint is separate from the shaded roof drawing.
  await clickWorld(page, [100, 100]);
  await ready(page);
  await expect.poll(() => pixel([67.5, 6.25])).toEqual(roofPixel);
  expect(await pixel([47.5, 6.25])).not.toEqual(roofPixel);
});

test("whole-house long drag uses one transform candidate, keeps the base fixed and cancels without rectangle allocation", async ({
  page,
}) => {
  await page.goto(url);
  const house = await seedHouse(page, 4, 4, [0]);
  await page.reload();
  await ready(page);
  await selectObject(page, `⌂ ${house.name}`);
  await ready(page);
  const before = await page
    .getByTestId("atlas-canvas")
    .evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await dragWorld(page, [7.5, 7.5], [12.5, 7.5], false);
  await page.getByTestId("atlas-canvas").dispatchEvent("pointermove", {
    pointerId: 1,
    clientX: 100000,
    clientY: 100000,
  });
  await expect
    .poll(async () => (await calls(page, "preview")).length)
    .toBeGreaterThan(0);
  const request = (await calls(page, "preview")).at(-1)!.args.intent;
  expect(request).toMatchObject({ type: "transformHouse", id: house.id });
  expect(request).not.toHaveProperty("cells");
  expect(
    await page
      .getByTestId("atlas-canvas")
      .evaluate((c: HTMLCanvasElement) => c.toDataURL()),
  ).toBe(before);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await calls(page, "commit")).toHaveLength(0);
});

test("foreign revision learned through Save cancels a captured room move instead of rebasing its intent", async ({
  page,
}) => {
  const { house } = await setup(page);
  await dragWorld(page, [7.5, 7.5], [7.5, 37.5], false);
  await commit(page, { type: "roof", id: house.id, roof: "#654321" });
  await page.keyboard.press("Control+s");
  await expect.poll(async () => (await status(page)).dirty).toBe(false);
  await page.mouse.up();
  await ready(page);
  expect(await calls(page, "commit")).toHaveLength(0);
  expect(
    (await scene(page)).objects.find((o) => o.id === house.id),
  ).toMatchObject({ roof: "#654321" });
});

test("offrange room edits retain one confirmed revision while navigation waits for matching tiles", async ({
  page,
}) => {
  await setup(page, 130);
  const initial = await status(page);
  await page.getByRole("button", { name: "Raum", exact: true }).click();
  // Final release is outside the CSS surface; pointer capture still submits its
  // exact local cell, without changing the bounded view to follow that pointer.
  const a = await screen(page, [652.5, 7.5]);
  const canvas = page.getByTestId("atlas-canvas");
  await canvas.dispatchEvent("pointerdown", {
    pointerId: 1,
    button: 0,
    clientX: a.x,
    clientY: a.y,
  });
  await canvas.dispatchEvent("pointerup", {
    pointerId: 1,
    button: 0,
    clientX: a.x,
    clientY: a.y,
  });
  await expect
    .poll(async () => (await status(page)).revision)
    .toBe(initial.revision + 1);
  await ready(page);
  const confirmed = await status(page);
  const box = (await canvas.boundingBox())!;
  await canvas.dispatchEvent("pointerdown", {
    pointerId: 1,
    button: 1,
    clientX: box.x + 200,
    clientY: box.y + 160,
  });
  await canvas.dispatchEvent("pointermove", {
    pointerId: 1,
    buttons: 4,
    clientX: box.x - 1300,
    clientY: box.y + 160,
  });
  await canvas.dispatchEvent("pointerup", {
    pointerId: 1,
    button: 1,
    clientX: box.x - 1300,
    clientY: box.y + 160,
  });
  await expect(page.getByText("Ansicht wird geladen …")).toBeVisible();
  expect((await status(page)).revision).toBe(confirmed.revision);
  await ready(page);
  expect((await status(page)).revision).toBe(confirmed.revision);
  expect(
    (await calls(page, "interiorTile")).some(
      (c) => (c.args.bounds as number[])[0] === 128,
    ),
  ).toBe(true);
  expect(await calls(page, "commit")).toHaveLength(1);
});
