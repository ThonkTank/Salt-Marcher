import { showObjects } from "../support/editor";
import { selectObject } from "../support/editor";
import type { Page } from "@playwright/test";
import {
  calls,
  clearCalls,
  clickWorld,
  commit,
  metadata,
  openHouse,
  ready,
  releaseResponse,
  scene,
  seedHouse,
  selectRoom,
  status,
  tile,
  url,
} from "../support/editor";
import { expect, test } from "../support/fixture";

async function hook(page: Page) {
  await page.goto(`${url}?hook`);
  await expect
    .poll(() => page.evaluate(() => !!window.atlasHook.status))
    .toBe(true);
}

test("room no-op preserves redo; queued history and Save keep FIFO and save the confirmed result", async ({
  page,
}) => {
  await hook(page);
  const id = await page.evaluate(async () => {
    const created = await window.atlasHook.commit({
      type: "createHouse",
      parcelId: null,
      transform: { x: 0, y: 0, angle: 0 },
      width: 2,
      depth: 2,
    });
    const id = created!.objects[0].id;
    await window.atlasHook.commit({ type: "rename", id, name: "Saved redo" });
    await window.atlasHook.history(false);
    return id;
  });
  const before = await status(page);
  expect(before.canRedo).toBe(true);
  const room = (await metadata(page, id)).rooms[0];
  await page.evaluate(
    ({ id, room }) => {
      window.atlasCalls = [];
      window.atlasHold = { cmd: "commit" };
      const noop = window.atlasHook.commit({
        type: "room",
        buildingId: id,
        intent: { kind: "move", roomId: room, dx: 0, dy: 0 },
      });
      const redo = window.atlasHook.history(true);
      const save = window.atlasHook.document("save");
      (window as any).fifo = Promise.all([noop, redo, save]);
    },
    { id, room: room.id },
  );
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  expect((await status(page)).revision).toBe(before.revision);
  expect((await status(page)).canRedo).toBe(true);
  await releaseResponse(page);
  await page.evaluate(() => (window as any).fifo);
  expect(
    (await page.evaluate(() => window.atlasCalls))
      .filter((c) => ["commit", "history", "save"].includes(c.cmd))
      .map((c) => c.cmd),
  ).toEqual(["commit", "history", "save"]);
  expect((await status(page)).dirty).toBe(false);
  expect((await status(page)).revision).toBe(before.revision + 1);
  await page.evaluate(async () => {
    await window.atlasCore("new", {});
    await window.atlasCore("open", {});
  });
  expect((await scene(page)).objects.find((o) => o.id === id)).toMatchObject({
    name: "Saved redo",
  });
});

for (const outcome of ["lostCommit", "lostOpen", "initialStatus"] as const) {
  test(`uncertain ${outcome} refuses writes and document replacement until an explicit successful retry`, async ({
    page,
  }) => {
    if (outcome === "initialStatus")
      await page.addInitScript(() => {
        window.atlasFailStatus = true;
      });
    await page.goto(`${url}?hook`);
    if (outcome !== "initialStatus") {
      await expect
        .poll(() => page.evaluate(() => !!window.atlasHook.status))
        .toBe(true);
      await page.evaluate(async (outcome) => {
        await window.atlasHook.commit({
          type: "createHouse",
          parcelId: null,
          transform: { x: 0, y: 0, angle: 0 },
          width: 2,
          depth: 2,
        });
        if (outcome === "lostOpen") {
          await window.atlasHook.document("save");
          window.atlasFailFile = "open";
        } else window.atlasFailCommit = true;
        window.atlasFailStatus = true;
        if (outcome === "lostOpen") await window.atlasHook.document("open");
        else
          await window.atlasHook.commit({
            type: "createHouse",
            parcelId: null,
            transform: { x: 100, y: 0, angle: 0 },
            width: 2,
            depth: 2,
          });
      }, outcome);
    }
    await expect
      .poll(() => page.evaluate(() => window.atlasHook.uncertain))
      .toBe(true);
    const before = (await calls(page, "commit")).length;
    await page.evaluate(() => window.atlasHook.document("new"));
    expect(await calls(page, "new")).toHaveLength(0);
    expect(
      await page.evaluate(() =>
        window.atlasHook.commit({
          type: "createHouse",
          parcelId: null,
          transform: { x: 200, y: 0, angle: 0 },
          width: 2,
          depth: 2,
        }),
      ),
    ).toBeNull();
    await page.evaluate(() => window.atlasHook.reconcile());
    expect(await page.evaluate(() => window.atlasHook.uncertain)).toBe(true);
    await page.evaluate(() => {
      window.atlasFailStatus = false;
    });
    await page.evaluate(() => window.atlasHook.reconcile());
    await expect
      .poll(() => page.evaluate(() => window.atlasHook.uncertain))
      .toBe(false);
    expect(await page.evaluate(() => window.atlasHook.status)).toEqual(
      await status(page),
    );
    expect(await calls(page, "commit")).toHaveLength(before);
  });
}

for (const operation of ["save", "cancelSave", "cancelOpen"] as const) {
  test(`held ${operation} picker preserves author history and accepts the current resized Canvas after the boundary`, async ({
    page,
  }) => {
    await page.goto(url);
    const house = await seedHouse(page, 4, 4, [0, 1]);
    await openHouse(page, house);
    if (operation === "cancelOpen") {
      await page
        .getByRole("button", { name: "Speichern", exact: true })
        .click();
      await expect.poll(async () => (await status(page)).dirty).toBe(false);
    }
    const before = await status(page),
      cells = await tile(page, house.id);
    await page.evaluate((operation) => {
      window.atlasHoldPicker = operation === "cancelOpen" ? "open" : "save";
      window.atlasCancelSave = operation === "cancelSave";
      window.atlasCancelOpen = operation === "cancelOpen";
    }, operation);
    await clearCalls(page);
    await page
      .getByRole("button", {
        name: operation === "cancelOpen" ? "Öffnen" : "Speichern",
        exact: true,
      })
      .click();
    await expect
      .poll(() => page.evaluate(() => !!window.atlasPickerHeld))
      .toBe(true);
    await expect(page.locator(".atlas-workspace")).toHaveAttribute("inert", "");
    await page.setViewportSize({ width: 1200, height: 820 });
    expect(await calls(page, "commit")).toHaveLength(0);
    await page.evaluate(() => window.atlasReleasePicker?.());
    await ready(page);
    await expect(page.locator(".atlas-workspace")).not.toHaveAttribute("inert");
    expect((await tile(page, house.id)).cells).toEqual(cells.cells);
    expect((await status(page)).sessionId).toBe(before.sessionId);
    expect((await status(page)).revision).toBe(before.revision);
    expect((await status(page)).canUndo).toBe(before.canUndo);
    if (operation !== "save")
      expect((await status(page)).dirty).toBe(before.dirty);
    await expect(page.getByLabel("Geschoss", { exact: true })).toHaveValue("0");
    const canvas = await page.getByTestId("atlas-canvas").boundingBox();
    expect(canvas!.width).toBeLessThan(900);
    expect(await calls(page, "commit")).toHaveLength(0);
  });
}

test("first interior click after idle and an explicit tool switch commits once; room selection then terrain retains its chosen tool", async ({
  page,
}) => {
  await page.goto(url);
  const house = await seedHouse(page, 4, 4, [0]);
  await openHouse(page, house);
  await selectRoom(page, house.id);
  await page.getByRole("button", { name: "Raum", exact: true }).click();
  await clearCalls(page);
  await page.waitForTimeout(120);
  await clickWorld(page, [27.5, 2.5]);
  await expect.poll(async () => (await calls(page, "commit")).length).toBe(1);
  expect((await calls(page, "commit"))[0].args.intent).toMatchObject({
    type: "room",
    intent: { kind: "draw", cells: [[5, 0]] },
  });
  await ready(page);
  await page
    .getByRole("button", { name: "Zur Dorfansicht", exact: true })
    .click();
  await page.getByRole("button", { name: "Flächen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Flächen", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

for (const kind of ["house", "room"] as const) {
  test(`Canvas selection that blurs a changed ${kind} name keeps both intentions`, async ({
    page,
  }) => {
    await page.goto(url);
    const house = await seedHouse(page, 4, 4, [0]);
    let target: string;
    if (kind === "house") {
      target = (await seedHouse(page, 4, 4, [0], 70)).id;
      await page.reload();
      await ready(page);
      await selectObject(page, "⌂ Haus 1");
    } else {
      await commit(page, {
        type: "room",
        buildingId: house.id,
        intent: {
          kind: "draw",
          floor: 0,
          cells: [
            [6, 0],
            [6, 1],
          ],
        },
      });
      target = (await metadata(page, house.id)).rooms.find(
        (r) => r.id !== "room-0",
      )!.id;
      await openHouse(page, house);
      await selectRoom(page, house.id);
    }
    const field = page.getByLabel(kind === "house" ? "Name" : "Raumname", {
      exact: true,
    });
    await clearCalls(page);
    await field.fill("Canvas blur rename");
    await clickWorld(page, kind === "house" ? [77.5, 7.5] : [32.5, 2.5]);
    await expect.poll(async () => (await calls(page, "commit")).length).toBe(1);
    await ready(page);
    if (kind === "house") {
      await showObjects(page);
      await expect(
        page.getByRole("button", { name: "⌂ Haus 2", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        (await scene(page)).objects.find((o) => o.id === house.id),
      ).toMatchObject({ name: "Canvas blur rename" });
    } else {
      const current = await metadata(page, house.id),
        selected = current.rooms.find((r) => r.id === target)!;
      await expect(
        page.getByRole("button", {
          name: `${selected.name} · G 0`,
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(current.rooms.find((r) => r.id === "room-0")).toMatchObject({
        name: "Canvas blur rename",
      });
    }
  });
}

test("new document resets an interior-only tool to exterior selection", async ({
  page,
}) => {
  await page.goto(url);
  const house = await seedHouse(page, 4, 4, [0]);
  await openHouse(page, house);
  await page.getByRole("button", { name: "Raum", exact: true }).click();
  await page.getByRole("button", { name: "Neu", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Verwerfen", exact: true })
    .click();
  await ready(page);
  await expect(
    page.getByRole("heading", { name: "Raum", exact: true }),
  ).toHaveCount(0);
});
