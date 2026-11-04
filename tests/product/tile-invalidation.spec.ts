import type { Page } from "@playwright/test";
import type { Intent, Status } from "../../src/atlas/model";
import { commit, history as coreHistory } from "../support/editor";
import { expect, test } from "../support/fixture";

async function start(page: Page) {
  await page.goto("http://127.0.0.1:1420/tests/support/atlas.html");
  const setup = await page.evaluate(async () => {
    const result = await window.atlasCore<{ objects: { id: string }[] }>(
      "commit",
      {
        version: await window.atlasCore("status", {}),
        intent: {
          type: "createHouse",
          parcelId: null,
          transform: { x: 0, y: 0, angle: 0 },
          width: 130,
          depth: 4,
        },
      },
    );
    return {
      active: result.objects[0].id,
      status: await window.atlasCore<Status>("status", {}),
    };
  });
  await page.goto(
    "http://127.0.0.1:1420/tests/support/atlas.html?presentation",
  );
  await page.evaluate(
    (input) =>
      window.atlasPresentationSet({ ...input, bounds: [0, 0, 700, 20] }),
    setup,
  );
  await expect(page.locator("output")).toHaveText("fresh");
  return setup.active;
}
async function publish(page: Page, status: Status) {
  await page.evaluate((s) => {
    window.atlasCalls = [];
    window.atlasPresentationSet({ status: s });
  }, status);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.atlasPresentation.fresh &&
          window.atlasPresentation.value?.scene.status.revision,
      ),
    )
    .toBe(status.revision);
}
async function edit(page: Page, intent: Intent) {
  return (await commit(page, intent)).status;
}
const tileCalls = (page: Page) =>
  page.evaluate(() =>
    window.atlasCalls
      .filter((c) => c.cmd === "interiorTile")
      .map((c) => c.args.bounds as number[]),
  );

test("cell and halo changes refetch on commit, undo and redo while other tiles survive", async ({
  page,
}) => {
  const active = await start(page);
  for (const step of ["commit", "undo", "redo"]) {
    const status =
      step === "commit"
        ? await edit(page, {
            type: "room",
            buildingId: active,
            intent: { kind: "erase", floor: 0, cells: [[128, 2]] },
          })
        : await page.evaluate(async (redo) => {
            await window.atlasCore("history", {
              version: await window.atlasCore("status", {}),
              redo,
            });
            return window.atlasCore<Status>("status", {});
          }, step === "redo");
    await publish(page, status);
    const calls = await tileCalls(page);
    expect(calls.some((b) => b[0] === 0 && b[1] === 0)).toBe(true);
    expect(calls.some((b) => b[0] === 128 && b[1] === 0)).toBe(true);
    expect(calls.some((b) => b[0] === -128)).toBe(false);
    expect(
      await page.evaluate(() =>
        window.atlasPresentation.value!.detail!.cells.some(
          (c) => c.x === 128 && c.y === 2,
        ),
      ),
    ).toBe(step === "undo");
    expect(
      await page.evaluate(() =>
        window.atlasPresentation.value!.detail!.cells.some(
          (c) => c.x === 127 && c.y === 2,
        ),
      ),
    ).toBe(true);
  }
});

test("metadata, transform, floors, deep projection and revision gaps use the right tiles", async ({
  page,
}) => {
  const active = await start(page);
  await page.evaluate(() => {
    (window as any).transformAggregate = window.atlasPresentation.value!.detail;
  });
  const room = await page.evaluate(
    () => window.atlasPresentation.value!.detail!.rooms[0].id,
  );
  await publish(
    page,
    await edit(page, {
      type: "room",
      buildingId: active,
      intent: { kind: "rename", roomId: room, name: "Renamed" },
    }),
  );
  expect(await tileCalls(page)).toHaveLength(0);
  expect(
    await page.evaluate(() =>
      window.atlasPresentation.value!.detail!.rooms.some(
        (r) => r.name === "Renamed",
      ),
    ),
  ).toBe(true);
  await publish(
    page,
    await edit(page, {
      type: "transformHouse",
      id: active,
      transform: { x: 5, y: 0, angle: 0 },
    }),
  );
  expect(await tileCalls(page)).toHaveLength(0);
  expect(
    await page.evaluate(() =>
      window.atlasPresentation.value!.detail!.cells.some(
        (c) => c.x === 0 && c.y === 0,
      ),
    ),
  ).toBe(true);

  expect(
    await page.evaluate(() => {
      const before = (window as any).transformAggregate;
      const detail = window.atlasPresentation.value!.detail!;
      return (
        detail.cells === before.cells &&
        detail.lower === before.lower &&
        detail.bounds === before.bounds
      );
    }),
  ).toBe(true);

  // Build two lower levels and view above them; deleting the nearer level must reveal the deeper one.
  for (const floor of [-2, -1])
    await edit(page, {
      type: "room",
      buildingId: active,
      intent: { kind: "draw", floor, cells: [[1, 1]] },
    });
  const current = await page.evaluate(() =>
    window.atlasCore<Status>("status", {}),
  );
  await page.evaluate(
    (status) => window.atlasPresentationSet({ status, floor: 1, lower: true }),
    current,
  );
  await expect(page.locator("output")).toHaveText("fresh");
  // Floor 0 is nearer than both basements at this coordinate.
  await publish(
    page,
    await edit(page, {
      type: "room",
      buildingId: active,
      intent: { kind: "erase", floor: 0, cells: [[1, 1]] },
    }),
  );
  expect(
    await page.evaluate(
      () =>
        window.atlasPresentation.value!.detail!.lower.find(
          (c) => c.x === 1 && c.y === 1,
        )?.floor,
    ),
  ).toBe(-1);
  await publish(
    page,
    await edit(page, {
      type: "room",
      buildingId: active,
      intent: { kind: "erase", floor: -1, cells: [[1, 1]] },
    }),
  );
  expect((await tileCalls(page)).length).toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () =>
        window.atlasPresentation.value!.detail!.lower.find(
          (c) => c.x === 1 && c.y === 1,
        )?.floor,
    ),
  ).toBe(-2);
  await publish(
    page,
    await edit(page, {
      type: "room",
      buildingId: active,
      intent: { kind: "draw", floor: 2, cells: [[1, 1]] },
    }),
  );
  expect(await tileCalls(page)).toHaveLength(0);
  expect(
    await page.evaluate(
      () =>
        window.atlasPresentation.value!.detail!.lower.find(
          (c) => c.x === 1 && c.y === 1,
        )?.floor,
    ),
  ).toBe(-2);
  await page.evaluate(() => window.atlasPresentationSet({ lower: false }));
  await expect(page.locator("output")).toHaveText("fresh");
  await publish(
    page,
    await edit(page, {
      type: "room",
      buildingId: active,
      intent: { kind: "erase", floor: -2, cells: [[1, 1]] },
    }),
  );
  expect(await tileCalls(page)).toHaveLength(0);
  expect(
    await page.evaluate(() => window.atlasPresentation.value!.detail!.lower),
  ).toHaveLength(0);
  await edit(page, { type: "rename", id: active, name: "One" });
  const gap = await edit(page, { type: "rename", id: active, name: "Two" });
  await publish(page, gap);
  expect((await tileCalls(page)).length).toBeGreaterThan(0);
});

test("room reassignment refreshes unchanged occupancy and retry discards promoted entries", async ({
  page,
}) => {
  const active = await start(page);
  await publish(
    page,
    await edit(page, {
      type: "room",
      buildingId: active,
      intent: { kind: "draw", floor: 0, cells: [[130, 2]] },
    }),
  );
  const before = await page.evaluate(() => {
    const cells = window.atlasPresentation.value!.detail!.cells;
    return {
      original: cells.find((c) => c.x === 129 && c.y === 2)!.roomId,
      target: cells.find((c) => c.x === 130 && c.y === 2)!.roomId,
    };
  });
  expect(before.original).not.toBe(before.target);
  await publish(
    page,
    await edit(page, {
      type: "room",
      buildingId: active,
      intent: {
        kind: "assign",
        floor: 0,
        cells: [[129, 2]],
        roomId: before.target,
      },
    }),
  );
  expect((await tileCalls(page)).some((b) => b[0] === 128 && b[1] === 0)).toBe(
    true,
  );
  expect(
    await page.evaluate(
      () =>
        window.atlasPresentation.value!.detail!.cells.find(
          (c) => c.x === 129 && c.y === 2,
        )?.roomId,
    ),
  ).toBe(before.target);
  await page.evaluate(() => {
    window.atlasCalls = [];
    window.atlasPresentation.retry();
  });
  await expect
    .poll(async () => (await tileCalls(page)).length)
    .toBeGreaterThan(0);
  await expect(page.locator("output")).toHaveText("fresh");
  expect(
    await page.evaluate(
      () =>
        window.atlasPresentation.value!.detail!.cells.find(
          (c) => c.x === 129 && c.y === 2,
        )?.roomId,
    ),
  ).toBe(before.target);
});

test("aggregate identity follows tile geometry while metadata and camera remain fresh", async ({
  page,
}) => {
  const active = await start(page);
  await page.evaluate(() => {
    (window as any).aggregateBefore = window.atlasPresentation.value!.detail;
  });
  const room = await page.evaluate(
    () => window.atlasPresentation.value!.detail!.rooms[0].id,
  );
  await publish(
    page,
    await edit(page, {
      type: "room",
      buildingId: active,
      intent: { kind: "rename", roomId: room, name: "Aggregate rename" },
    }),
  );
  expect(
    await page.evaluate(() => {
      const before = (window as any).aggregateBefore;
      const detail = window.atlasPresentation.value!.detail!;
      return (
        detail.cells === before.cells &&
        detail.lower === before.lower &&
        detail.bounds === before.bounds &&
        detail.rooms.some((r) => r.name === "Aggregate rename")
      );
    }),
  ).toBe(true);
  const undone = await page.evaluate(async () => {
    await window.atlasCore("history", {
      version: await window.atlasCore("status", {}),
      redo: false,
    });
    return window.atlasCore<Status>("status", {});
  });
  await publish(page, undone);
  expect(
    await page.evaluate(
      () =>
        window.atlasPresentation.value!.detail!.cells ===
        (window as any).aggregateBefore.cells,
    ),
  ).toBe(true);
  await page.evaluate(() =>
    window.atlasPresentationSet({ bounds: [21, 0, 721, 20] }),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.atlasPresentation.fresh &&
          window.atlasPresentation.value!.bounds[2] >= 740,
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () =>
        window.atlasPresentation.value!.detail!.cells ===
        (window as any).aggregateBefore.cells,
    ),
  ).toBe(true);
  await page.evaluate(() =>
    window.atlasPresentationSet({ bounds: [700, 0, 1400, 20] }),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.atlasPresentation.fresh &&
          window.atlasPresentation.value!.bounds[0] > 0,
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () =>
        window.atlasPresentation.value!.detail!.cells !==
        (window as any).aggregateBefore.cells,
    ),
  ).toBe(true);
  await page.evaluate(() =>
    window.atlasPresentationSet({ bounds: [0, 0, 700, 20] }),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.atlasPresentation.fresh &&
          window.atlasPresentation.value!.bounds[0] < 0,
      ),
    )
    .toBe(true);
  // A/B/A must reuse the validated original tile arrays and aggregate.
  expect(
    await page.evaluate(
      () =>
        window.atlasPresentation.value!.detail!.cells ===
        (window as any).aggregateBefore.cells,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    (window as any).aggregateBefore = window.atlasPresentation.value!.detail;
  });
  await publish(
    page,
    await edit(page, {
      type: "room",
      buildingId: active,
      intent: { kind: "erase", floor: 0, cells: [[128, 2]] },
    }),
  );
  expect(
    await page.evaluate(
      () =>
        window.atlasPresentation.value!.detail!.cells !==
          (window as any).aggregateBefore.cells &&
        !window.atlasPresentation.value!.detail!.cells.some(
          (c) => c.x === 128 && c.y === 2,
        ),
    ),
  ).toBe(true);
});

test("offscreen active house summary and detail follow changes and history", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:1420/tests/support/atlas.html");
  const setup = await page.evaluate(async () => {
    const create = async (x: number) =>
      window.atlasCore<{ objects: { id: string }[] }>("commit", {
        version: await window.atlasCore("status", {}),
        intent: {
          type: "createHouse",
          parcelId: null,
          transform: { x, y: 0, angle: 0 },
          width: 2,
          depth: 2,
        },
      });
    const active = (await create(0)).objects[0].id;
    const other = (await create(200)).objects[0].id;
    return {
      active,
      other,
      status: await window.atlasCore<Status>("status", {}),
    };
  });
  await page.goto(
    "http://127.0.0.1:1420/tests/support/atlas.html?presentation",
  );
  await page.evaluate(
    ({ active, status }) =>
      window.atlasPresentationSet({
        active,
        status,
        bounds: [1000, 1000, 1100, 1100],
      }),
    setup,
  );
  await expect(page.locator("output")).toHaveText("fresh");
  await page.evaluate(() => {
    (window as any).offscreenCells =
      window.atlasPresentation.value!.detail!.cells;
  });
  const snapshot = () =>
    page.evaluate((id) => {
      const value = window.atlasPresentation.value!;
      const house = value.scene.objects.find(
        (o) => o.kind === "house" && o.id === id,
      );
      return {
        house,
        detail: value.detail && {
          id: value.detail.buildingId,
          revision: value.detail.status.revision,
          cells: value.detail.cells.length,
        },
        reused: value.detail?.cells === (window as any).offscreenCells,
        sceneRevision: value.scene.status.revision,
      };
    }, setup.active);
  const scenes = () =>
    page.evaluate(
      () => window.atlasCalls.filter((c) => c.cmd === "scene").length,
    );
  const history = (redo: boolean) => coreHistory(page, redo);
  const expectHouse = async (
    expected: Record<string, unknown>,
    status: Status,
  ) => {
    const result = await snapshot();
    expect(result.house).toMatchObject(expected);
    expect(result.detail).toEqual({
      id: setup.active,
      revision: status.revision,
      cells: 0,
    });
    expect(result.sceneRevision).toBe(status.revision);
  };

  let status = await edit(page, {
    type: "rename",
    id: setup.active,
    name: "Changed outside viewport",
  });
  await publish(page, status);
  await expectHouse({ name: "Changed outside viewport" }, status);
  expect(await scenes()).toBe(1);
  expect(await tileCalls(page)).toHaveLength(0);
  expect((await snapshot()).reused).toBe(true);

  const room = await page.evaluate(
    () => window.atlasPresentation.value!.detail!.rooms[0].id,
  );
  status = await edit(page, {
    type: "room",
    buildingId: setup.active,
    intent: { kind: "rename", roomId: room, name: "Offscreen room" },
  });
  await publish(page, status);
  await expectHouse({ name: "Changed outside viewport" }, status);
  expect(await scenes()).toBe(0);
  expect(await tileCalls(page)).toHaveLength(0);
  expect((await snapshot()).reused).toBe(true);
  expect(
    await page.evaluate(() =>
      window.atlasPresentation.value!.detail!.rooms.some(
        (r) => r.name === "Offscreen room",
      ),
    ),
  ).toBe(true);

  status = await edit(page, {
    type: "roof",
    id: setup.active,
    roof: "#123456",
  });
  await publish(page, status);
  await expectHouse({ roof: "#123456" }, status);
  expect(await scenes()).toBe(1);
  expect(await tileCalls(page)).toHaveLength(0);

  status = await edit(page, {
    type: "transformHouse",
    id: setup.active,
    transform: { x: 5, y: 0, angle: 0 },
  });
  await publish(page, status);
  await expectHouse({ transform: { x: 5, y: 0, angle: 0 } }, status);
  expect(await scenes()).toBe(1);
  expect(await tileCalls(page)).toHaveLength(0);
  expect((await snapshot()).reused).toBe(true);
  status = await history(false);
  await publish(page, status);
  await expectHouse({ transform: { x: 0, y: 0, angle: 0 } }, status);
  expect(await scenes()).toBe(1);
  status = await history(true);
  await publish(page, status);
  await expectHouse({ transform: { x: 5, y: 0, angle: 0 } }, status);
  expect(await scenes()).toBe(1);

  status = await edit(page, {
    type: "rename",
    id: setup.other,
    name: "Other changed",
  });
  await publish(page, status);
  await expectHouse(
    { name: "Changed outside viewport", transform: { x: 5, y: 0, angle: 0 } },
    status,
  );
  expect(await scenes()).toBe(0);
  expect(await tileCalls(page)).toHaveLength(0);
  expect((await snapshot()).reused).toBe(true);

  status = await edit(page, { type: "delete", id: setup.active });
  await publish(page, status);
  expect(await scenes()).toBe(1);
  expect(await snapshot()).toMatchObject({
    house: undefined,
    detail: null,
    sceneRevision: status.revision,
  });
  status = await history(false);
  await publish(page, status);
  expect(await scenes()).toBe(1);
  await expectHouse(
    {
      name: "Changed outside viewport",
      roof: "#123456",
      transform: { x: 5, y: 0, angle: 0 },
    },
    status,
  );
  status = await history(true);
  await publish(page, status);
  expect(await scenes()).toBe(1);
  expect(await snapshot()).toMatchObject({
    house: undefined,
    detail: null,
    sceneRevision: status.revision,
  });
});

test("held offscreen scene cannot publish stale summary or claim readiness", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:1420/tests/support/atlas.html");
  const setup = await page.evaluate(async () => {
    const result = await window.atlasCore<{ objects: { id: string }[] }>(
      "commit",
      {
        version: await window.atlasCore("status", {}),
        intent: {
          type: "createHouse",
          parcelId: null,
          transform: { x: 0, y: 0, angle: 0.4 },
          width: 2,
          depth: 2,
        },
      },
    );
    return {
      active: result.objects[0].id,
      status: await window.atlasCore<Status>("status", {}),
    };
  });
  await page.goto(
    "http://127.0.0.1:1420/tests/support/atlas.html?presentation",
  );
  await page.evaluate(
    ({ active, status }) =>
      window.atlasPresentationSet({
        active,
        status,
        bounds: [1000, 1000, 1100, 1100],
      }),
    setup,
  );
  await expect(page.locator("output")).toHaveText("fresh");
  const first = await edit(page, {
    type: "rename",
    id: setup.active,
    name: "Held",
  });
  await page.evaluate((status) => {
    window.atlasHold = { cmd: "scene" };
    window.atlasPresentationSet({ status });
  }, first);
  await expect.poll(() => page.evaluate(() => window.atlasHeld)).toBe(true);
  expect(await page.evaluate(() => window.atlasPresentation.fresh)).toBe(false);
  expect(
    await page.evaluate(
      () => window.atlasPresentation.value!.scene.status.revision,
    ),
  ).toBe(setup.status.revision);
  const second = await edit(page, {
    type: "rename",
    id: setup.active,
    name: "Newest",
  });
  await publish(page, second);
  await page.evaluate(() => window.atlasRelease?.());
  await expect.poll(() => page.evaluate(() => window.atlasReadActive)).toBe(0);
  expect(
    await page.evaluate((id) => {
      const value = window.atlasPresentation.value!;
      const house = value.scene.objects.find((o) => o.id === id);
      return {
        fresh: window.atlasPresentation.fresh,
        revision: value.scene.status.revision,
        name: house?.kind === "house" ? house.name : undefined,
        detailRevision: value.detail?.status.revision,
      };
    }, setup.active),
  ).toEqual({
    fresh: true,
    revision: second.revision,
    name: "Newest",
    detailRevision: second.revision,
  });
  expect(await page.evaluate(() => window.atlasReadMax)).toBeLessThanOrEqual(4);
});

test("offscreen cellar-only house uses its transform point for scene invalidation", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:1420/tests/support/atlas.html");
  const setup = await page.evaluate(async () => {
    const commit = async (intent: object) =>
      window.atlasCore<{ objects: { id: string }[] }>("commit", {
        version: await window.atlasCore("status", {}),
        intent,
      });
    const active = (
      await commit({
        type: "createHouse",
        parcelId: null,
        transform: { x: 0, y: 0, angle: 0.7 },
        width: 2,
        depth: 2,
      })
    ).objects[0].id;
    await commit({
      type: "room",
      buildingId: active,
      intent: { kind: "draw", floor: -1, cells: [[0, 0]] },
    });
    await commit({
      type: "room",
      buildingId: active,
      intent: {
        kind: "erase",
        floor: 0,
        cells: [
          [0, 0],
          [0, 1],
          [1, 0],
          [1, 1],
        ],
      },
    });
    return { active, status: await window.atlasCore<Status>("status", {}) };
  });
  await page.goto(
    "http://127.0.0.1:1420/tests/support/atlas.html?presentation",
  );
  await page.evaluate(
    ({ active, status }) =>
      window.atlasPresentationSet({
        active,
        status,
        bounds: [1000, 1000, 1100, 1100],
      }),
    setup,
  );
  await expect(page.locator("output")).toHaveText("fresh");
  let status = await edit(page, {
    type: "rename",
    id: setup.active,
    name: "Cellar only",
  });
  await publish(page, status);
  expect(
    await page.evaluate(
      (id) =>
        window.atlasPresentation.value!.scene.objects.find(
          (o) => o.kind === "house" && o.id === id,
        ),
      setup.active,
    ),
  ).toMatchObject({ name: "Cellar only", contours: [] });
  expect(
    await page.evaluate(
      () => window.atlasCalls.filter((c) => c.cmd === "scene").length,
    ),
  ).toBe(1);
  status = await edit(page, {
    type: "transformHouse",
    id: setup.active,
    transform: { x: 12, y: 3, angle: 1.1 },
  });
  await publish(page, status);
  expect(
    await page.evaluate(
      (id) =>
        window.atlasPresentation.value!.scene.objects.find(
          (o) => o.kind === "house" && o.id === id,
        ),
      setup.active,
    ),
  ).toMatchObject({
    name: "Cellar only",
    transform: { x: 12, y: 3, angle: 1.1 },
    contours: [],
  });
  expect(
    await page.evaluate(
      () => window.atlasPresentation.value!.detail?.status.revision,
    ),
  ).toBe(status.revision);
});
