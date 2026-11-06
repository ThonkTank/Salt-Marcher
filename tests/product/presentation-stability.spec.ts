import { expect, test } from "../support/fixture";
import { commit, seedParcels, url } from "../support/editor";

declare global {
  interface Window {
    regionSessionProbe?: ReturnType<
      typeof import("../support/regionSessionProbe").regionSessionProbe
    >;
    canvasProbe?: ReturnType<
      typeof import("../support/canvasProbe").canvasProbe
    >;
  }
}
const frames = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

test("idle hover keeps the prepared scene and base while the brush overlay follows, including interiors", async ({
  page,
}) => {
  await page.goto(url);
  const setup = await seedParcels(page);
  const region = await commit(page, {
    type: "regionEdit",
    action: { kind: "create", name: "Hoverland", rankId: "builtin-rank-3" },
  });
  await commit(page, {
    type: "regionStroke",
    id: region.regions![0].id,
    points: [
      [0, 0],
      [80, 0],
    ],
    radius: 35,
    erase: false,
  });
  await page.evaluate(async () => {
    const path = "/tests/support/canvasProbe.tsx";
    const { canvasProbe } = await import(/* @vite-ignore */ path);
    window.canvasProbe = canvasProbe();
  });
  await expect
    .poll(() => page.evaluate(() => window.canvasProbe!.ready()))
    .toBe(true);
  await page.evaluate(() => window.canvasProbe!.chooseTerrain());
  await frames(page);
  await expect
    .poll(() => page.evaluate(() => window.canvasProbe!.ready()))
    .toBe(true);
  await frames(page);
  const before = await page.evaluate(() => window.canvasProbe!.baseline());
  const positions: Array<{ image: string; point: unknown }> = [];
  for (const [x, y] of [
    [250, 220],
    [300, 240],
    [350, 260],
  ]) {
    await page.mouse.move(x, y);
    await frames(page);
    const state = await page.evaluate(() => window.canvasProbe!.snapshot());
    positions.push({ image: state.overlayImage, point: state.cursor?.point });
  }
  const after = await page.evaluate(() => window.canvasProbe!.snapshot());
  expect(after.sameScene).toBe(true);
  expect(after.renders).toBeGreaterThan(before.renders);
  expect(after.base).toBe(before.base);
  expect(after.measures).toBe(before.measures);
  expect(after.overlay).toBeGreaterThan(before.overlay);
  expect(new Set(positions.map((p) => p.image)).size).toBe(3);
  expect(new Set(positions.map((p) => JSON.stringify(p.point))).size).toBe(3);
  expect(after.overlayText.some((text) => text.endsWith(" Fuß"))).toBe(true);
  await page.evaluate(
    (id) => window.canvasProbe!.openHouse(id),
    setup.house.id,
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.canvasProbe!.ready() &&
          window.canvasProbe!.snapshot().interior,
      ),
    )
    .toBe(true);
  await frames(page);
  const inner = await page.evaluate(() => window.canvasProbe!.baseline());
  for (const [x, y] of [
    [250, 250],
    [310, 270],
    [360, 290],
  ]) {
    await page.mouse.move(x, y);
    await frames(page);
  }
  const innerAfter = await page.evaluate(() => window.canvasProbe!.snapshot());
  expect(innerAfter.sameScene).toBe(true);
  expect(innerAfter.renders).toBeGreaterThan(inner.renders);
  expect(innerAfter.base).toBe(inner.base);
  expect(innerAfter.measures).toBe(inner.measures);
  await page.evaluate(() => window.canvasProbe!.close());
});

test("region and river projections retain identity only while their inputs remain stable", async ({
  page,
}) => {
  await page.goto(url);
  const created = await commit(page, {
    type: "regionEdit",
    action: { kind: "create", name: "Projection", rankId: "builtin-rank-3" },
  });
  await commit(page, {
    type: "regionStroke",
    id: created.regions![0].id,
    points: [
      [0, 0],
      [80, 0],
    ],
    radius: 35,
    erase: false,
  });
  await page.evaluate(async () => {
    const path = "/tests/support/layerProbe.tsx";
    const { layerProbe } = await import(/* @vite-ignore */ path);
    window.layerProbe = layerProbe(await window.atlasCore("status", {}));
    window.layerProbe!.render(true);
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.layerProbe!.snapshot().regions.fresh &&
          window.layerProbe!.snapshot().rivers.fresh,
      ),
    )
    .toBe(true);
  await page.evaluate(() => {
    window.layerProbe!.mark();
    window.layerProbe!.render(true);
  });
  await frames(page);
  expect(await page.evaluate(() => window.layerProbe!.references())).toEqual({
    ranks: true,
    summaries: true,
    displayed: true,
    markers: true,
    relations: true,
    views: true,
    handles: true,
    innerViews: true,
  });
  await page.evaluate(() => window.layerProbe!.render(false));
  await frames(page);
  await page.evaluate(() => {
    window.layerProbe!.mark();
    window.layerProbe!.render(false);
  });
  await frames(page);
  expect(await page.evaluate(() => window.layerProbe!.references())).toEqual({
    ranks: true,
    summaries: true,
    displayed: true,
    markers: true,
    relations: true,
    views: true,
    handles: true,
    innerViews: true,
  });
  await page.evaluate(() =>
    window.layerProbe!.render(true, false, undefined, 1),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.layerProbe!.snapshot().regions.fresh &&
          window.layerProbe!.snapshot().rivers.fresh,
      ),
    )
    .toBe(true);
  await page.evaluate(() => window.layerProbe!.mark());
  await commit(page, {
    type: "regionEdit",
    action: {
      kind: "create",
      name: "New projection",
      rankId: "builtin-rank-3",
    },
  });
  await page.evaluate(async () =>
    window.layerProbe!.render(
      true,
      false,
      await window.atlasCore("status", {}),
      1,
    ),
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        window
          .layerProbe!.snapshot()
          .regions.summaries.some((s) => s.name === "New projection"),
      ),
    )
    .toBe(true);
  expect(
    (await page.evaluate(() => window.layerProbe!.references())).summaries,
  ).toBe(false);
  await page.evaluate(() => window.layerProbe!.close());
});

test("real layer, region rank and catalog changes redraw visible map content", async ({
  page,
}) => {
  await page.goto(url);
  for (const [name, rankId, y] of [
    ["First region", "builtin-rank-3", 20],
    ["Second region", "builtin-rank-4", 70],
  ] as const) {
    const created = await commit(page, {
      type: "regionEdit",
      action: { kind: "create", name, rankId },
    });
    await commit(page, {
      type: "regionStroke",
      id: created.regions![0].id,
      points: [
        [0, y],
        [80, y],
      ],
      radius: 35,
      erase: false,
    });
  }
  await page.evaluate(async () => {
    const path = "/tests/support/canvasProbe.tsx";
    const { canvasProbe } = await import(/* @vite-ignore */ path);
    window.canvasProbe = canvasProbe();
  });
  await expect
    .poll(() => page.evaluate(() => window.canvasProbe!.ready()))
    .toBe(true);
  await frames(page);
  await page.evaluate(() => window.canvasProbe!.chooseRegions());
  await expect
    .poll(() => page.evaluate(() => window.canvasProbe!.ready()))
    .toBe(true);
  await frames(page);
  const first = await page.evaluate(() => window.canvasProbe!.snapshot());
  expect(first.baseText).toContain("First region");
  await page.evaluate(() => {
    window.canvasProbe!.clearText();
    window.canvasProbe!.chooseRank("builtin-rank-4");
  });
  await expect
    .poll(() => page.evaluate(() => window.canvasProbe!.ready()))
    .toBe(true);
  await frames(page);
  const second = await page.evaluate(() => window.canvasProbe!.snapshot());
  expect(second.base).toBeGreaterThan(first.base);
  expect(second.baseImage).not.toBe(first.baseImage);
  expect(second.baseText).toContain("Second region");
  await page.evaluate(() => window.canvasProbe!.chooseTerrain());
  await expect
    .poll(() => page.evaluate(() => window.canvasProbe!.ready()))
    .toBe(true);
  await frames(page);
  const beforeCatalog = await page.evaluate(() =>
    window.canvasProbe!.snapshot(),
  );
  await page.evaluate(async () => {
    const catalog = structuredClone(window.canvasProbe!.catalog()!);
    catalog.categories[0].visible = false;
    await window.canvasProbe!.commit({
      type: "regionEdit",
      action: { kind: "catalog", catalog },
    });
  });
  await expect
    .poll(() => page.evaluate(() => window.canvasProbe!.ready()))
    .toBe(true);
  await frames(page);
  const afterCatalog = await page.evaluate(() =>
    window.canvasProbe!.snapshot(),
  );
  expect(afterCatalog.base).toBeGreaterThan(beforeCatalog.base);
  expect(afterCatalog.baseImage).not.toBe(beforeCatalog.baseImage);
  await page.evaluate(async () =>
    window.canvasProbe!.commit({
      type: "riverEdit",
      action: {
        kind: "put",
        id: null,
        name: "Arriving river",
        nodes: [
          { id: "", point: [0, 90], width: 20 },
          { id: "", point: [100, 90], width: 20 },
        ],
        settings: {
          tolerance: 0.1,
          roughness: 0.5,
          meander: 40,
          sourceFade: true,
          seed: 1,
        },
        reverse: false,
        automatic: true,
        snap: 0,
      },
      view: { tiles: [[0, 0]], level: 0 },
    }),
  );
  await expect
    .poll(() => page.evaluate(() => window.canvasProbe!.ready()))
    .toBe(true);
  await frames(page);
  const afterRiver = await page.evaluate(() => window.canvasProbe!.snapshot());
  expect(afterRiver.base).toBeGreaterThan(afterCatalog.base);
  expect(afterRiver.baseImage).not.toBe(afterCatalog.baseImage);
  await page.evaluate(() => window.canvasProbe!.close());
});

test("road ghost, terrain preview, camera and viewport changes redraw the affected canvases", async ({
  page,
}) => {
  await page.goto(url);
  const region = await commit(page, {
    type: "regionEdit",
    action: { kind: "create", name: "Obstacle", rankId: "builtin-rank-3" },
  });
  await commit(page, {
    type: "regionStroke",
    id: region.regions![0].id,
    points: [
      [0, 30],
      [80, 30],
    ],
    radius: 35,
    erase: false,
  });
  await page.evaluate(async () => {
    const path = "/tests/support/canvasProbe.tsx";
    const { canvasProbe } = await import(/* @vite-ignore */ path);
    window.canvasProbe = canvasProbe();
  });
  await expect
    .poll(() => page.evaluate(() => window.canvasProbe!.ready()))
    .toBe(true);
  await frames(page);
  const anchor = await page.evaluate(async (id) => {
    const response = await window.atlasCore("regions", {
      version: await window.atlasCore("status", {}),
      bounds: null,
      ids: [],
      rankIds: [],
      detail: null,
      scale: 1,
      exact: false,
    });
    return response.summaries.find((summary) => summary.id === id)!.anchor;
  }, region.regions![0].id);
  await page.evaluate(() => window.canvasProbe!.chooseRoad());
  await frames(page);
  const beforeGhost = await page.evaluate(() => window.canvasProbe!.snapshot());
  expect(beforeGhost.baseText).toContain("Obstacle");
  await page.mouse.click(600, 400);
  await page.mouse.move(160 + anchor[0] * 3.2, 120 + anchor[1] * 3.2);
  await frames(page);
  const ghost1 = await page.evaluate(() => window.canvasProbe!.snapshot());
  await page.mouse.move(500, 400);
  await frames(page);
  const ghost2 = await page.evaluate(() => window.canvasProbe!.snapshot());
  expect(ghost1.draft).toBeTruthy();
  expect(ghost1.base).toBeGreaterThan(beforeGhost.base);
  expect(ghost1.draft?.kind).toBe("road");
  if (ghost1.draft?.kind !== "road") throw Error("missing road ghost");
  const ghostPoint = ghost1.draft.nodes.at(-1)!.point;
  // DOM pointer coordinates may be rounded to whole CSS pixels; the ghost
  // must still cover the anchor with its 12-pixel label obstacle.
  expect(
    Math.hypot(ghostPoint[0] - anchor[0], ghostPoint[1] - anchor[1]) * 3.2,
  ).toBeLessThan(2);
  expect(ghost2.draft).not.toEqual(ghost1.draft);
  expect(ghost2.overlayImage).not.toBe(ghost1.overlayImage);
  expect(ghost2.base).toBeGreaterThan(ghost1.base);
  expect(ghost2.measures).toBeGreaterThan(ghost1.measures);
  expect(ghost1.baseText).not.toContain("Obstacle");
  expect(ghost2.baseText).toContain("Obstacle");
  await page.evaluate(() => window.canvasProbe!.chooseTerrain());
  await expect
    .poll(() => page.evaluate(() => window.canvasProbe!.ready()))
    .toBe(true);
  await frames(page);
  const beforePreview = await page.evaluate(() =>
    window.canvasProbe!.snapshot(),
  );
  await page.mouse.move(420, 320);
  await page.mouse.down();
  await page.mouse.move(460, 320);
  await expect
    .poll(() =>
      page.evaluate(() => window.canvasProbe!.snapshot().preview?.valid),
    )
    .toBe(true);
  await frames(page);
  const preview = await page.evaluate(() => window.canvasProbe!.snapshot());
  expect(preview.base).toBeGreaterThan(beforePreview.base);
  expect(preview.baseImage).not.toBe(beforePreview.baseImage);
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.canvasProbe!.ready()))
    .toBe(true);
  await frames(page);
  const beforeZoom = await page.evaluate(() => window.canvasProbe!.snapshot());
  await page.evaluate(() => window.canvasProbe!.zoom(4));
  await expect
    .poll(() => page.evaluate(() => window.canvasProbe!.ready()))
    .toBe(true);
  await frames(page);
  const zoomed = await page.evaluate(() => window.canvasProbe!.snapshot());
  expect(zoomed.base).toBeGreaterThan(beforeZoom.base);
  expect(zoomed.baseImage).not.toBe(beforeZoom.baseImage);
  await page.evaluate(() => window.canvasProbe!.resize(700, 500));
  await expect
    .poll(() => page.evaluate(() => window.canvasProbe!.snapshot().canvasWidth))
    .toBe(700);
  await frames(page);
  const resized = await page.evaluate(() => window.canvasProbe!.snapshot());
  expect(resized.base).toBeGreaterThan(zoomed.base);
  await page.evaluate(() => {
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 2,
    });
    window.dispatchEvent(new Event("resize"));
  });
  await expect
    .poll(() => page.evaluate(() => window.canvasProbe!.snapshot().canvasWidth))
    .toBe(1400);
  await frames(page);
  const scaled = await page.evaluate(() => window.canvasProbe!.snapshot());
  expect(scaled.base).toBeGreaterThan(resized.base);
  await page.evaluate(() => {
    Reflect.deleteProperty(window, "devicePixelRatio");
    window.canvasProbe!.close();
  });
});

test("automatic rank hysteresis resets before a new session and persists afterward", async ({
  page,
}) => {
  await page.goto(url);
  await page.evaluate(async () => {
    const path = "/tests/support/regionSessionProbe.tsx";
    const { regionSessionProbe } = await import(/* @vite-ignore */ path);
    window.regionSessionProbe = regionSessionProbe();
    window.regionSessionProbe!.render("one", 14);
  });
  await expect
    .poll(() => page.evaluate(() => window.regionSessionProbe!.snapshot()))
    .toEqual({ fresh: true, rankIds: ["small"] });
  await page.evaluate(() => window.regionSessionProbe!.render("one", 12.5));
  await frames(page);
  expect(
    await page.evaluate(() => window.regionSessionProbe!.snapshot().rankIds),
  ).toEqual(["small"]);
  await page.evaluate(() => window.regionSessionProbe!.render("two", 12.5));
  await expect
    .poll(() => page.evaluate(() => window.regionSessionProbe!.snapshot()))
    .toEqual({ fresh: true, rankIds: ["large"] });
  await page.evaluate(() => window.regionSessionProbe!.render("two", 12.7));
  await frames(page);
  expect(
    await page.evaluate(() => window.regionSessionProbe!.snapshot().rankIds),
  ).toEqual(["large"]);
  await page.evaluate(() => window.regionSessionProbe!.close());
});
