import { settled } from "../support/editor";
import type { Page } from "@playwright/test";
import {
  authorSnapshot,
  calls,
  clearCalls,
  commit,
  dragWorld,
  holdResponse,
  metadata,
  openHouse,
  ready,
  rectangle,
  releaseResponse,
  screen,
  seedHouse,
  selectRoom,
  status,
  tile,
  url,
} from "../support/editor";
import { expect, test } from "../support/fixture";
import { redPixelCount } from "../support/pixels";

async function setup(page: Page, neighbor = false) {
  await page.goto(url);
  const house = await seedHouse(page, 4, 3, [-1, 0, 1]);
  if (neighbor) {
    await commit(page, {
      type: "room",
      buildingId: house.id,
      intent: { kind: "draw", floor: 0, cells: rectangle(2, 3, 4, 0) },
    });
    await commit(page, {
      type: "connection",
      buildingId: house.id,
      intent: {
        action: "createOpening",
        floor: 0,
        x: 4,
        y: 1,
        axis: "vertical",
        kind: "door",
      },
    });
  }
  await openHouse(page, house);
  const room = await selectRoom(page, house.id);
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  await clearCalls(page);
  return { house, room };
}
async function begin(page: Page) {
  const p = await screen(page, [7.5, 7.5]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  return p;
}
async function end(page: Page, dx: number, dy: number, release = true) {
  const p = await screen(page, [7.5 + dx * 5, 7.5 + dy * 5]);
  await page.mouse.move(p.x, p.y);
  if (release) await page.mouse.up();
}

test("selected room self-overlap and separated endpoints retain one house, primary room identity, and exact repeated history", async ({
  page,
}) => {
  const { house, room } = await setup(page, true);
  const before = await authorSnapshot(page, house.id),
    rev = (await status(page)).revision;
  await begin(page);
  await end(page, 0, 1);
  await expect.poll(async () => (await status(page)).revision).toBe(rev + 1);
  await ready(page);
  expect(
    (await tile(page, house.id)).cells.filter((c) => c.roomId === room.id),
  ).toEqual(
    rectangle(4, 3, 0, 1).map(([x, y]) => ({
      floor: 0,
      x,
      y,
      roomId: room.id,
    })),
  );
  expect((await metadata(page, house.id)).rooms).toContainEqual(room);
  expect(
    (await metadata(page, house.id)).connections.find(
      (c) => c.type === "opening" && c.toRoom !== null,
    ),
  ).toEqual(
    before.connections.find((c) => c.type === "opening" && c.toRoom !== null),
  );
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await ready(page);
  expect(await authorSnapshot(page, house.id)).toEqual(before);
  await selectRoom(page, house.id);
  await begin(page);
  await end(page, 0, 4, false);
  const preview = await page.evaluate(
    async ({ id, room }) =>
      window.atlasCore("preview", {
        version: await window.atlasCore("status", {}),
        intent: {
          type: "room",
          buildingId: id,
          intent: { kind: "move", roomId: room, dx: 0, dy: 4 },
        },
      }),
    { id: house.id, room: room.id },
  );
  expect(preview.valid).toBe(true);
  expect(preview.removedConnections).toContainEqual({
    buildingId: house.id,
    connection: before.connections.find(
      (c) => c.type === "opening" && c.toRoom !== null,
    ),
  });
  await expect.poll(() => redPixelCount(page)).toBeGreaterThan(0);
  await page.mouse.up();
  await expect
    .poll(async () =>
      (await metadata(page, house.id)).connections.some(
        (c) => c.type === "opening" && c.toRoom !== null,
      ),
    )
    .toBe(false);
  await ready(page);
  const moved = await authorSnapshot(page, house.id);
  expect(moved.objects.filter((o) => o.kind === "house")).toHaveLength(1);
  expect(moved.rooms.map((r) => r.buildingId)).toEqual(
    moved.rooms.map(() => house.id),
  );
  expect(
    moved.connections.find((c) => c.type === "opening" && c.toRoom === null),
  ).toMatchObject({ fromRoom: room.id, y: 4, offset: 0.5 });
  await expect(
    page.getByRole("button", { name: `${room.name} · G 0`, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    await ready(page);
    expect(await authorSnapshot(page, house.id)).toEqual(before);
    await page
      .getByRole("button", { name: "Wiederholen", exact: true })
      .click();
    await ready(page);
    expect(await authorSnapshot(page, house.id)).toEqual(moved);
  }
});

test("room collision paints a rejected candidate and changes neither author data nor history", async ({
  page,
}) => {
  const { house } = await setup(page, true),
    before = await authorSnapshot(page, house.id),
    rev = (await status(page)).revision;
  await begin(page);
  await end(page, 2, 0, false);
  await expect.poll(async () => (await calls(page, "preview")).length).toBe(1);
  await expect.poll(() => redPixelCount(page)).toBeGreaterThan(0);
  await page.mouse.up();
  await expect(page.getByRole("status")).toContainText("Room move collision");
  expect(await authorSnapshot(page, house.id)).toEqual(before);
  expect((await status(page)).revision).toBe(rev);
});

test("room threshold, return to origin and release-only displacement create at most one write", async ({
  page,
}) => {
  const { house, room } = await setup(page);
  const p = await screen(page, [9.8, 7.5]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 2, p.y);
  expect(await calls(page, "preview")).toHaveLength(0);
  await page.mouse.move(p.x + 8, p.y);
  await expect.poll(async () => (await calls(page, "preview")).length).toBe(1);
  await page.mouse.move(p.x, p.y);
  await page.mouse.up();
  expect(await calls(page, "commit")).toHaveLength(0);
  const start = await begin(page),
    release = await screen(page, [17.5, 12.5]);
  await page.getByTestId("atlas-canvas").evaluate(
    (canvas, end) =>
      canvas.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          pointerId: 1,
          clientX: end.x,
          clientY: end.y,
        }),
      ),
    release,
  );
  await page.mouse.up();
  await expect.poll(async () => (await calls(page, "commit")).length).toBe(1);
  expect((await calls(page, "commit"))[0].args.intent).toMatchObject({
    type: "room",
    buildingId: house.id,
    intent: { kind: "move", roomId: room.id, dx: 2, dy: 1 },
  });
  expect(start.x).toBeLessThan(release.x);
});

test("accepted room move remains immutable through selection and tool changes while a later draw queues", async ({
  page,
}) => {
  const { house, room } = await setup(page, true);
  await holdResponse(page, "commit");
  await begin(page);
  await end(page, 0, 4);
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await selectRoom(page, house.id, 0, 1);
  await page.getByRole("button", { name: "Raum", exact: true }).click();
  await dragWorld(page, [42.5, 2.5], [47.5, 2.5]);
  expect(await calls(page, "commit")).toHaveLength(1);
  await releaseResponse(page);
  await expect.poll(async () => (await calls(page, "commit")).length).toBe(2);
  const commits = await calls(page, "commit");
  expect(commits[0].args.intent).toMatchObject({
    intent: { kind: "move", roomId: room.id, dx: 0, dy: 4 },
  });
  expect(commits[1].args.intent).toMatchObject({
    intent: {
      kind: "draw",
      cells: [
        [8, 0],
        [9, 0],
      ],
    },
  });
  expect(commits[1].args.version.revision).toBe(
    commits[0].args.version.revision + 1,
  );
  await ready(page);
  expect((await tile(page, house.id)).cells).toContainEqual(
    expect.objectContaining({ x: 8, y: 0 }),
  );
});

test("repeated motion within the same snapped room displacement does not duplicate a preview", async ({
  page,
}) => {
  await page.clock.install();
  await setup(page);
  const p = await screen(page, [9.8, 7.5]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 8, p.y);
  await expect.poll(async () => (await calls(page, "preview")).length).toBe(1);
  await page.mouse.move(p.x + 9, p.y);
  await page.clock.runFor(130);
  await settled(page);
  expect(await calls(page, "preview")).toHaveLength(1);
  await page.keyboard.press("Escape");
  await page.mouse.up();
});
