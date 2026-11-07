declare global {
  interface Window {
    parcelOldCells: import("../../src/atlas/model").Detail["cells"];
    parcelOldLower: import("../../src/atlas/model").Detail["lower"];
  }
}
import type { Page } from "@playwright/test";
import type { House, Parcel, WorldPoint } from "../../src/atlas/model";
import {
  ready,
  screen,
  seedParcels as seed,
  selectObject,
} from "../support/editor";
import { expect, test } from "../support/fixture";

import { url } from "../support/editor";
const local = (parcel: Parcel, x: number, y: number): WorldPoint => {
  const c = Math.cos(parcel.frame.angle),
    s = Math.sin(parcel.frame.angle);
  return [
    parcel.frame.x + 5 * (x * c - y * s),
    parcel.frame.y + 5 * (x * s + y * c),
  ];
};
async function drag(page: Page, a: WorldPoint, b: WorldPoint) {
  const start = await screen(page, a),
    end = await screen(page, b);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 3 });
  await page.mouse.up();
}
async function owner(page: Page, parcelId: string) {
  return page.evaluate(
    (parcelId) =>
      window.atlasCore("scene", {
        bounds: [10000, 10000, 10010, 10010],
        context: { kind: "parcel", parcelId },
        selectedId: parcelId,
      }),
    parcelId,
  );
}

test("empty parcel remains open through first draw, last erase, Fit and rebirth; disconnected basement rooms share one owner", async ({
  page,
}) => {
  await page.goto(url);
  const setup = await seed(page, true);
  await page.reload();
  await ready(page);
  await selectObject(page, "▱ Parzelle");
  await page
    .getByRole("button", { name: "Parzelle öffnen", exact: true })
    .click();
  await ready(page);
  expect(
    await page.evaluate(
      () => window.atlasCalls.filter((c) => c.cmd === "interiorTile").length,
    ),
  ).toBe(0);
  await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  await ready(page);
  const before = await page
    .getByTestId("atlas-canvas")
    .evaluate((c: HTMLCanvasElement) => {
      const m = c.getContext("2d")!.getTransform();
      return [m.a, m.e, m.f];
    });
  await page.getByRole("button", { name: "Raum", exact: true }).click();
  await drag(
    page,
    local(setup.parcel, -3.8, 1.2),
    local(setup.parcel, -2.8, 2.2),
  );
  await expect
    .poll(async () => (await owner(page, setup.parcel.id)).contextState.houseId)
    .not.toBeNull();
  await ready(page);
  const first = (await owner(page, setup.parcel.id)).contextState.houseId!;
  await page.getByRole("button", { name: "Radieren", exact: true }).click();
  await drag(
    page,
    local(setup.parcel, -3.8, 1.2),
    local(setup.parcel, -2.8, 2.2),
  );
  await expect
    .poll(async () => (await owner(page, setup.parcel.id)).contextState.houseId)
    .toBeNull();
  await ready(page);
  await expect(
    page.getByRole("button", { name: "Zur Atlasansicht" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  await ready(page);
  const after = await page
    .getByTestId("atlas-canvas")
    .evaluate((c: HTMLCanvasElement) => {
      const m = c.getContext("2d")!.getTransform();
      return [m.a, m.e, m.f];
    });
  expect(after).toEqual(before);
  await page
    .getByRole("spinbutton", { name: "Geschoss", exact: true })
    .fill("-1");
  await page
    .getByRole("spinbutton", { name: "Geschoss", exact: true })
    .press("Enter");
  await ready(page);
  await page.getByRole("button", { name: "Raum", exact: true }).click();
  await drag(
    page,
    local(setup.parcel, -3.8, 1.2),
    local(setup.parcel, -2.8, 2.2),
  );
  await expect
    .poll(async () => (await owner(page, setup.parcel.id)).contextState.houseId)
    .not.toBeNull();
  await ready(page);
  await drag(
    page,
    local(setup.parcel, 1.2, 5.2),
    local(setup.parcel, 2.2, 6.2),
  );
  await ready(page);
  const scene = await owner(page, setup.parcel.id),
    second = scene.contextState.houseId!;
  expect(second).not.toBe(first);
  expect(scene.objects.filter((o) => o.kind === "house")).toHaveLength(1);
  const metadata = await page.evaluate(
    (buildingId) =>
      window.atlasCore("interiorMetadata", {
        buildingId,
      }),
    second,
  );
  expect(metadata.rooms).toHaveLength(2);
  expect(metadata.rooms.every((r) => r.floor === -1)).toBe(true);
  const draws = await page.evaluate(() =>
    window.atlasCalls
      .filter((c) => c.cmd === "commit")
      .map((c) => (c.args.intent as { type: string }).type),
  );
  expect(draws).toEqual([
    "createParcelHouse",
    "room",
    "createParcelHouse",
    "room",
  ]);
});

test("opening a bound house resolves its parcel and offers quarter turns instead of free rotation", async ({
  page,
}) => {
  await page.goto(url);
  const setup = await seed(page);
  await page.reload();
  await ready(page);
  await selectObject(page, `⌂ ${setup.house.name}`);
  await expect(
    page.getByRole("button", { name: "90° rechts", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("spinbutton", { name: "Drehung (Grad)" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Innen öffnen", exact: true }).click();
  await ready(page);
  await expect(
    page.getByText("IN DER PARZELLE", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Erdgeschoss · G 0", exact: true }),
  ).toBeVisible();
  const scenes = await page.evaluate(() =>
    window.atlasCalls
      .filter((c) => c.cmd === "scene")
      .map((c) => c.args.context),
  );
  expect(scenes).toContainEqual({ kind: "parcel", parcelId: setup.parcel.id });
});

test("house tool reads occupied owner explicitly, while an empty parcel stays fixed and snapped even with Alt", async ({
  page,
}) => {
  await page.goto(url);
  const setup = await seed(page);
  await page.reload();
  await ready(page);
  await page.getByRole("button", { name: "Haus", exact: true }).click();
  await drag(page, local(setup.parcel, 0, 10), local(setup.parcel, 2, 12));
  await expect(page.getByRole("status")).toContainText(
    "Parzelle bereits bebaut",
  );
  expect(
    await page.evaluate(
      () => window.atlasCalls.filter((c) => c.cmd === "commit").length,
    ),
  ).toBe(0);
  await page.evaluate(
    async (id) =>
      window.atlasCore("commit", {
        version: await window.atlasCore("status", {}),
        intent: { type: "delete", id },
      }),
    setup.house.id,
  );
  await page.reload();
  await ready(page);
  await page.getByRole("button", { name: "Haus", exact: true }).click();
  await page.keyboard.down("Alt");
  await drag(
    page,
    local(setup.parcel, -2.2, 1.2),
    local(setup.parcel, 0.8, 3.2),
  );
  await page.keyboard.up("Alt");
  await expect
    .poll(async () => (await owner(page, setup.parcel.id)).contextState.houseId)
    .not.toBeNull();
  const scene = await owner(page, setup.parcel.id),
    h = scene.objects.find((o): o is House => o.kind === "house")!;
  expect(h.placement).toEqual({
    kind: "parcel",
    parcelId: setup.parcel.id,
    gridPose: { xCells: -2, yCells: 1, quarterTurns: 0 },
  });
  const calls = await page.evaluate(() =>
    window.atlasCalls.filter((c) => c.cmd === "commit"),
  );
  expect(calls).toHaveLength(1);
  expect(calls[0].args.intent).toMatchObject({
    type: "createHouse",
    parcelId: setup.parcel.id,
    width: 3,
    depth: 2,
  });
});

for (const mode of ["context", "selection"] as const) {
  test(`${mode} A-B-A with identical camera/revision rejects both held former owners`, async ({
    page,
  }) => {
    await page.goto(`${url}?presentation`);
    const a = await seed(page, true, 10000),
      b = await seed(page, true, 11000);
    await page.evaluate(
      (status) => window.atlasPresentationSet({ status }),
      b.status,
    );
    await expect(page.locator("output")).toHaveText("fresh");
    await page.evaluate(() => {
      window.atlasSceneHeld = [];
      window.atlasSceneBarrier = true;
    });
    const set = async (parcelId: string, count: number) => {
      await page.evaluate(
        ({ mode, parcelId }) =>
          window.atlasPresentationSet(
            mode === "context"
              ? { context: { kind: "parcel", parcelId } }
              : { selectedId: parcelId },
          ),
        { mode, parcelId },
      );
      await expect
        .poll(() => page.evaluate(() => window.atlasSceneHeld.length))
        .toBe(count);
    };
    await set(a.parcel.id, 1);
    await set(b.parcel.id, 2);
    await set(a.parcel.id, 3);
    for (const index of [0, 1]) {
      await page.evaluate((i) => window.atlasSceneHeld[i].release(), index);
      await expect
        .poll(() => page.evaluate(() => window.atlasReadActive))
        .toBe(2 - index);
      expect(await page.evaluate(() => window.atlasPresentation.fresh)).toBe(
        false,
      );
    }
    await page.evaluate(() => {
      window.atlasSceneBarrier = false;
      window.atlasSceneHeld[2].release();
    });
    await expect(page.locator("output")).toHaveText("fresh");
    const state = await page.evaluate((mode) => {
      const p = window.atlasPresentation.value!;
      return {
        state:
          mode === "context" ? p.scene.contextState : p.scene.selectionState,
        objects: p.scene.objects,
        detail: p.detail,
      };
    }, mode);
    expect(state.state).toEqual({
      exists: true,
      parcelId: a.parcel.id,
      houseId: null,
    });
    expect(state.objects.some((o) => o.id === a.parcel.id)).toBe(true);
    expect(state.detail).toBeNull();
    expect(await page.evaluate(() => window.atlasReadMax)).toBeLessThanOrEqual(
      4,
    );
  });
}

test("offscreen empty owner closure refreshes on relation changes and undo without reading interior cells", async ({
  page,
}) => {
  await page.goto(`${url}?presentation`);
  const setup = await seed(page, true, 10000);
  await page.evaluate(
    ({ status, parcelId }) =>
      window.atlasPresentationSet({ status, selectedId: parcelId }),
    { status: setup.status, parcelId: setup.parcel.id },
  );
  await expect(page.locator("output")).toHaveText("fresh");
  await page.evaluate(async (parcelId) => {
    const r = await window.atlasCore("commit", {
      version: await window.atlasCore("status", {}),
      intent: {
        type: "createParcelHouse",
        parcelId,
        floor: -1,
        cells: [[0, 1]],
      },
    });
    window.atlasPresentationSet({ status: r.status });
  }, setup.parcel.id);
  await expect(page.locator("output")).toHaveText("fresh");
  await expect
    .poll(() =>
      page.evaluate(
        () => window.atlasPresentation.value?.scene.selectionState.houseId,
      ),
    )
    .not.toBeNull();
  await page.evaluate(async () => {
    const status = await window.atlasCore("history", {
      version: await window.atlasCore("status", {}),
      redo: false,
    });
    window.atlasPresentationSet({ status });
  });
  await expect(page.locator("output")).toHaveText("fresh");
  expect(
    await page.evaluate(
      () => window.atlasPresentation.value?.scene.selectionState,
    ),
  ).toEqual({ exists: true, parcelId: setup.parcel.id, houseId: null });
  expect(
    await page.evaluate(
      () =>
        window.atlasCalls.filter(
          (c) => c.cmd === "interiorTile" || c.cmd === "interiorMetadata",
        ).length,
    ),
  ).toBe(0);
});

test("pure bound movement reloads world owner headers while preserving local cell arrays", async ({
  page,
}) => {
  await page.goto(`${url}?presentation`);
  const setup = await seed(page);
  await page.evaluate(
    ({ status, parcelId }) =>
      window.atlasPresentationSet({
        status,
        context: { kind: "parcel", parcelId },
        selectedId: parcelId,
      }),
    { status: setup.status, parcelId: setup.parcel.id },
  );
  await expect(page.locator("output")).toHaveText("fresh");
  await page.evaluate(() => {
    window.parcelOldCells = window.atlasPresentation.value!.detail!.cells;
    window.parcelOldLower = window.atlasPresentation.value!.detail!.lower;
    window.atlasCalls = [];
  });
  await page.evaluate(async (house) => {
    const r = await window.atlasCore("commit", {
      version: await window.atlasCore("status", {}),
      intent: {
        type: "transformHouse",
        id: house.id,
        transform: { ...house.transform, y: house.transform.y + 5 },
      },
    });
    window.atlasPresentationSet({ status: r.status });
  }, setup.house);
  await expect(page.locator("output")).toHaveText("fresh");
  const state = await page.evaluate(() => ({
    cells:
      window.atlasPresentation.value!.detail!.cells === window.parcelOldCells,
    lower:
      window.atlasPresentation.value!.detail!.lower === window.parcelOldLower,
    calls: window.atlasCalls.map((c) => c.cmd),
    house: window.atlasPresentation.value!.scene.objects.find(
      (o) => o.kind === "house",
    ),
  }));
  expect(state.cells).toBe(true);
  expect(state.lower).toBe(true);
  expect(state.calls).toEqual(["scene"]);
  expect(state.house).toMatchObject({
    transform: { y: setup.house.transform.y + 5 },
    placement: { kind: "parcel", gridPose: { yCells: 1 } },
  });
});

test("pointerup waits for its explicit parcel owner read and Escape revokes a held first draw", async ({
  page,
}) => {
  await page.goto(url);
  const setup = await seed(page, true);
  await page.reload();
  await ready(page);
  await page.getByRole("button", { name: "Haus", exact: true }).click();
  const perform = async () => {
    await page.evaluate(() => {
      window.atlasHold = { cmd: "scene" };
      window.atlasHeld = false;
    });
    await drag(
      page,
      local(setup.parcel, -2.2, 1.2),
      local(setup.parcel, 0.8, 3.2),
    );
    await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
    expect(
      await page.evaluate(
        () => window.atlasCalls.filter((c) => c.cmd === "commit").length,
      ),
    ).toBe(0);
  };
  await perform();
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.atlasRelease!());
  await expect.poll(() => page.evaluate(() => window.atlasReadActive)).toBe(0);
  expect((await owner(page, setup.parcel.id)).contextState.houseId).toBeNull();
  await perform();
  await page.evaluate(() => window.atlasRelease!());
  await expect
    .poll(async () => (await owner(page, setup.parcel.id)).contextState.houseId)
    .not.toBeNull();
  expect(
    await page.evaluate(
      () => window.atlasCalls.filter((c) => c.cmd === "commit").length,
    ),
  ).toBe(1);
});

test("Fit during a held parcel revision reads current polygon headers before choosing its camera", async ({
  page,
}) => {
  await page.goto(url);
  const setup = await seed(page, true);
  await page.reload();
  await ready(page);
  await selectObject(page, "▱ Parzelle");
  await page
    .getByRole("button", { name: "Parzelle öffnen", exact: true })
    .click();
  await ready(page);
  await selectObject(page, "↝ Teststraße");
  await ready(page);
  await page.evaluate(() => {
    window.atlasHold = { cmd: "scene" };
    window.atlasHeld = false;
  });
  const width = page.getByRole("spinbutton", {
    name: "Breite (Fuß)",
    exact: true,
  });
  await width.fill("20");
  await width.press("Enter");
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  const scene = await owner(page, setup.parcel.id),
    parcel = scene.objects.find(
      (o): o is Parcel => o.id === setup.parcel.id && o.kind === "parcel",
    )!;
  expect(parcel.frame.y).not.toBe(setup.parcel.frame.y);
  await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  await ready(page);
  const view = await page
    .getByTestId("atlas-canvas")
    .evaluate((c: HTMLCanvasElement) => {
      const m = c.getContext("2d")!.getTransform();
      return { a: m.a, e: m.e, f: m.f, width: c.width, height: c.height };
    });
  const center = [
    (Math.min(...parcel.polygon.map((p) => p[0])) +
      Math.max(...parcel.polygon.map((p) => p[0]))) /
      2,
    (Math.min(...parcel.polygon.map((p) => p[1])) +
      Math.max(...parcel.polygon.map((p) => p[1]))) /
      2,
  ];
  expect(view.e + center[0] * view.a).toBeCloseTo(view.width / 2, 4);
  expect(view.f + center[1] * view.a).toBeCloseTo(view.height / 2, 4);
  await page.evaluate(() => window.atlasRelease!());
  await expect.poll(() => page.evaluate(() => window.atlasReadActive)).toBe(0);
});
