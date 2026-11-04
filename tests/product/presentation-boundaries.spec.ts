import type { Page } from "@playwright/test";
import type { Status } from "../../src/atlas/model";
import {
  calls,
  commit,
  history,
  metadata,
  rectangle,
  seedHouse,
  status,
  url,
} from "../support/editor";
import { expect, test } from "../support/fixture";

async function presentation(page: Page) {
  await page.goto(url);
  const house = await seedHouse(page, 260, 4, [-2, -1, 0, 1]);
  await page.goto(`${url}?presentation`);
  await page.evaluate(
    ({ active, status }) =>
      window.atlasPresentationSet({
        active,
        status,
        floor: 0,
        lower: true,
        bounds: [0, 0, 1300, 20],
      }),
    { active: house.id, status: await status(page) },
  );
  await expect(page.locator("output")).toHaveText("fresh");
  return house;
}
async function publish(page: Page, value: Status) {
  await page.evaluate((status) => {
    window.atlasCalls = [];
    window.atlasPresentationSet({ status });
  }, value);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.atlasPresentation.fresh &&
          window.atlasPresentation.value!.scene.status.revision,
      ),
    )
    .toBe(value.revision);
}
const detail = (page: Page) =>
  page.evaluate(() => {
    const d = window.atlasPresentation.value?.detail;
    return (
      d && {
        cells: d.cells,
        lower: d.lower,
        rooms: d.rooms,
        connections: d.connections,
      }
    );
  });

for (const resource of ["scene", "interiorMetadata", "interiorTile"] as const) {
  test(`failed ${resource} keeps the complete old interior and retries coherently`, async ({
    page,
  }) => {
    await presentation(page);
    const before = await detail(page);
    await page.evaluate((cmd) => {
      window.atlasFailRead = cmd;
      window.atlasPresentation.retry();
    }, resource);
    await expect(page.locator("output")).toContainText(`${resource} failed`);
    expect(await detail(page)).toEqual(before);
    expect(await page.evaluate(() => window.atlasPresentation.fresh)).toBe(
      false,
    );
    await page.evaluate(() => window.atlasPresentation.retry());
    await expect(page.locator("output")).toHaveText("fresh");
    expect(await detail(page)).toEqual(before);
    expect(
      await page.evaluate(
        () =>
          window.atlasPresentation.value!.detail!.status.revision ===
          window.atlasPresentation.value!.scene.status.revision,
      ),
    ).toBe(true);
  });
}

test("a failed lower target can be disabled; empty floors and return A after held B retain coherent data", async ({
  page,
}) => {
  const house = await presentation(page);
  await page.evaluate(() => {
    window.atlasFailRead = "interiorTile";
    window.atlasPresentationSet({ floor: 4 });
  });
  await expect(page.locator("output")).toContainText("interiorTile failed");
  await page.evaluate(() => window.atlasPresentationSet({ lower: false }));
  await expect(page.locator("output")).toHaveText("fresh");
  expect(await detail(page)).toMatchObject({ cells: [], lower: [] });
  await page.evaluate(() => {
    window.atlasHold = { cmd: "interiorTile", floor: 3 };
    window.atlasPresentationSet({ floor: 3, lower: true });
  });
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await commit(page, {
    type: "room",
    buildingId: house.id,
    intent: { kind: "erase", floor: 0, cells: [[1, 1]] },
  });
  const changed = await status(page);
  await page.evaluate(
    (status) => window.atlasPresentationSet({ status, floor: 0 }),
    changed,
  );
  await expect(page.locator("output")).toHaveText("fresh");
  expect((await detail(page))!.cells.some((c) => c.x === 1 && c.y === 1)).toBe(
    false,
  );
  await page.evaluate(() => window.atlasRelease?.());
  await expect.poll(() => page.evaluate(() => window.atlasReadActive)).toBe(0);
  expect((await detail(page))!.cells.some((c) => c.x === 1 && c.y === 1)).toBe(
    false,
  );
});

test("held metadata blocks publication of newly committed cells; failure retries with one coherent revision", async ({
  page,
}) => {
  const house = await presentation(page),
    before = await detail(page);
  const next = (
    await commit(page, {
      type: "room",
      buildingId: house.id,
      intent: { kind: "draw", floor: 0, cells: [[260, 1]] },
    })
  ).status;
  await page.evaluate((status) => {
    window.atlasHold = { cmd: "interiorMetadata" };
    window.atlasPresentationSet({ status });
  }, next);
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  expect(await page.evaluate(() => window.atlasPresentation.fresh)).toBe(false);
  expect(await detail(page)).toEqual(before);
  await page.evaluate(() => {
    window.atlasFailRead = "interiorMetadata";
    window.atlasRelease?.();
  });
  await expect(page.locator("output")).toContainText("interiorMetadata failed");
  expect(await detail(page)).toEqual(before);
  await page.evaluate(() => window.atlasPresentation.retry());
  await expect(page.locator("output")).toHaveText("fresh");
  expect((await detail(page))!.cells).toContainEqual(
    expect.objectContaining({ x: 260, y: 1 }),
  );
  expect(
    await page.evaluate(
      () => window.atlasPresentation.value!.detail!.status.revision,
    ),
  ).toBe(next.revision);
});

test("large house metadata and visible tiles stay bounded with many independent rooms and connections", async ({
  page,
}) => {
  await page.goto(url);
  const house = await seedHouse(page, 1, 1, [0]);
  for (let i = 0; i < 20; i++) {
    await commit(page, {
      type: "room",
      buildingId: house.id,
      intent: { kind: "draw", floor: 1, cells: [[i * 3, 140]] },
    });
    await commit(page, {
      type: "connection",
      buildingId: house.id,
      intent: {
        action: "createOpening",
        floor: 1,
        x: i * 3,
        y: 140,
        axis: "horizontal",
        kind: "door",
      },
    });
  }
  // Author small disconnected rooms first, then grow the large ground floor once.
  await commit(page, {
    type: "room",
    buildingId: house.id,
    intent: { kind: "draw", floor: 0, cells: rectangle(128, 128) },
  });
  const meta = await metadata(page, house.id);
  expect(meta.rooms).toHaveLength(21);
  expect(meta.connections).toHaveLength(21);
  expect(meta).not.toHaveProperty("cells");
  expect(meta.rooms.every((r) => r.buildingId === house.id)).toBe(true);
  const result = await page.evaluate(
    (buildingId) =>
      window.atlasCore<any>("interiorTile", {
        buildingId,
        floor: 0,
        bounds: [0, 0, 15, 15],
        includeLower: true,
      }),
    house.id,
  );
  expect(result.cells).toHaveLength(289); // inclusive core plus the SQL halo at x/y=16
  expect(
    result.cells.every((c: { x: number; y: number }) => c.x <= 16 && c.y <= 16),
  ).toBe(true);
  expect(JSON.stringify(result).length).toBeLessThan(25000);
});

test("no-op history leaves a held tile request and confirmed revision intact", async ({
  page,
}) => {
  await presentation(page);
  await page.evaluate(() => {
    window.atlasCalls = [];
    window.atlasHold = { cmd: "interiorTile" };
    window.atlasPresentationSet({ bounds: [2000, 0, 2100, 20] });
  });
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  const before = await status(page),
    count = (await calls(page, "interiorTile")).length;
  expect(before.canRedo).toBe(false);
  const result = await history(page, true);
  expect(result.revision).toBe(before.revision);
  await page.evaluate(
    (status) => window.atlasPresentationSet({ status }),
    result,
  );
  expect((await calls(page, "interiorTile")).length).toBe(count);
  await page.evaluate(() => window.atlasRelease?.());
  await expect(page.locator("output")).toHaveText("fresh");
  expect((await calls(page, "interiorTile")).length).toBe(count);
});

test("lower history invalidates retained bounds while a target floor still owns held tiles", async ({
  page,
}) => {
  const house = await presentation(page),
    before = await detail(page);
  await page.evaluate(() => {
    window.atlasHold = { cmd: "interiorTile", floor: 3 };
    window.atlasPresentationSet({ floor: 3 });
  });
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await commit(page, {
    type: "room",
    buildingId: house.id,
    intent: { kind: "erase", floor: 1, cells: [[128, 2]] },
  });
  const undone = await history(page);
  await page.evaluate(
    (status) => window.atlasPresentationSet({ status }),
    undone,
  );
  expect(await detail(page)).toEqual(before);
  await page.evaluate(() => window.atlasRelease?.());
  await expect(page.locator("output")).toHaveText("fresh");
  expect(
    (await detail(page))!.lower.find((c) => c.x === 128 && c.y === 2)?.floor,
  ).toBe(1);
  await publish(page, await history(page, true));
  expect(
    (await detail(page))!.lower.find((c) => c.x === 128 && c.y === 2)?.floor,
  ).toBe(0);
});
