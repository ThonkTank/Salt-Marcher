import type { Page } from "@playwright/test";
import { expect, test } from "../support/fixture";
import {
  calls,
  clearCalls,
  commit,
  dragWorld,
  ready,
  selectObject,
  settled,
  status,
  url,
} from "../support/editor";

// Transport readiness precedes the scheduled Canvas paint. Read actual transforms.
async function paintedCamera(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  return page
    .getByTestId("atlas-canvas")
    .evaluate((canvas: HTMLCanvasElement) => {
      const t = canvas.getContext("2d")!.getTransform(),
        d = devicePixelRatio || 1;
      return {
        x: t.e / d,
        y: t.f / d,
        scale: t.a / d,
        width: canvas.clientWidth,
        height: canvas.clientHeight,
      };
    });
}
async function roomView(page: Page) {
  await page.getByLabel("Ansichtsmaßstab").selectOption({ label: "Raum" });
  await ready(page);
  await expect
    .poll(async () => (await paintedCamera(page)).scale)
    .toBeCloseTo(25.6, 5);
}
const smallTip =
  "Kleine Pinsel können zwischen den Rasterpunkten ohne Höhenänderung bleiben. Pinsel vergrößern oder den Strich versetzen.";
const terrain = (page: Page, x: number, y: number) =>
  page.evaluate(
    ({ x, y }) =>
      window.atlasCore("terrainTiles", {
        level: 0,
        tiles: [[Math.floor(x / 160), Math.floor(y / 160)]],
      }),
    { x, y },
  );

test("named Raum keeps exterior tools and explicit owner entry/leave preserves camera", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 900, height: 620 });
  await page.goto(url);
  await ready(page);
  const initial = await paintedCamera(page);
  const cx = (initial.width / 2 - initial.x) / initial.scale;
  const cy = (initial.height / 2 - initial.y) / initial.scale;
  for (const x of [cx - 6, cx + 2]) {
    expect(
      (
        await commit(page, {
          type: "createHouse",
          parcelId: null,
          transform: { x, y: cy - 2.5, angle: 0 },
          width: 1,
          depth: 1,
        })
      ).valid,
    ).toBe(true);
  }
  await page.reload();
  await ready(page);
  await paintedCamera(page);
  await clearCalls(page);
  await roomView(page);
  await expect(page.locator(".atlas-map-title")).toHaveText("Atlas · Raum");
  await expect(page.getByLabel("Atlaskarte", { exact: true })).toBeVisible();
  const toolbar = page.locator(".atlas-tools");
  await expect(toolbar.getByRole("button")).toHaveCount(9);
  for (const name of [
    "Auswahl",
    "Straße",
    "Fluss",
    "Gewässer",
    "Boden",
    "Höhen",
    "Landschaft",
    "Regionen",
    "Haus",
  ])
    await expect(
      toolbar.getByRole("button", { name, exact: true }),
    ).toBeEnabled();
  for (const name of ["Raum", "Radieren", "Zuweisen", "Tür", "Treppe"])
    await expect(
      toolbar.getByRole("button", { name, exact: true }),
    ).toHaveCount(0);
  expect(await calls(page, "interiorTile")).toEqual([]);
  expect(await calls(page, "interiorMetadata")).toEqual([]);
  await page.getByText("Hilfe", { exact: true }).click();
  await expect(
    page.getByText(
      "Haus oder Parzelle auswählen und doppelklicken: Innenraum öffnen.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("room-exterior-help-900x620.png"),
  });
  const selectedRoofPixel = () =>
    page.getByTestId("atlas-canvas").evaluate(
      (canvas: HTMLCanvasElement, point: [number, number]) => {
        const context = canvas.getContext("2d")!;
        const pixel = new DOMPoint(...point).matrixTransform(
          context.getTransform(),
        );
        return [
          ...context.getImageData(
            Math.floor(pixel.x),
            Math.floor(pixel.y),
            1,
            1,
          ).data,
        ];
      },
      [cx - 3.5, cy] as [number, number],
    );
  const unselectedRoof = await selectedRoofPixel();
  await selectObject(page, "⌂ Haus 1");
  const before = await paintedCamera(page);
  expect(await selectedRoofPixel()).not.toEqual(unselectedRoof);
  const neighborPixel = () =>
    page.getByTestId("atlas-canvas").evaluate(
      (canvas: HTMLCanvasElement, point: [number, number]) => {
        const context = canvas.getContext("2d")!,
          transform = context.getTransform();
        const pixel = new DOMPoint(...point).matrixTransform(transform);
        return [
          ...context.getImageData(
            Math.floor(pixel.x),
            Math.floor(pixel.y),
            1,
            1,
          ).data,
        ];
      },
      [cx + 4.5, cy - 1.5] as [number, number],
    );
  const roof = await neighborPixel();
  await page.getByRole("button", { name: "Innen öffnen", exact: true }).click();
  await ready(page);
  await expect(page.locator(".atlas-map-title")).toHaveText(
    "Haus 1 · Geschoss 0",
  );
  await expect(page.getByLabel("Geschoss", { exact: true })).toHaveValue("0");
  expect(await paintedCamera(page)).toEqual(before);
  expect(await neighborPixel()).toEqual(roof);
  await expect(toolbar.getByRole("button")).toHaveCount(6);
  for (const name of [
    "Auswahl",
    "Raum",
    "Radieren",
    "Zuweisen",
    "Tür",
    "Treppe",
  ])
    await expect(
      toolbar.getByRole("button", { name, exact: true }),
    ).toBeEnabled();
  await expect(
    page.getByText(
      "Raum auswählen und ziehen: Raum bewegen. Türen und Treppen anklicken: Verbindung auswählen.",
      { exact: true },
    ),
  ).toBeVisible();
  expect((await calls(page, "interiorTile")).length).toBeGreaterThan(0);
  await page.screenshot({
    path: info.outputPath("room-interior-help-900x620.png"),
  });
  await page
    .getByRole("button", { name: "Zur Atlasansicht", exact: true })
    .click();
  await ready(page);
  expect(await paintedCamera(page)).toEqual(before);
  await expect(page.locator(".atlas-map-title")).toHaveText("Atlas · Raum");
});

for (const tool of ["Höhen", "Gewässer"] as const) {
  test(`${tool} at Raum reports real sampling and preserves stroke/history/cancel behavior`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 900, height: 620 });
    await page.goto(url);
    await ready(page);
    await roomView(page);
    await page.getByRole("button", { name: tool, exact: true }).click();
    await ready(page);
    await paintedCamera(page);
    await expect(
      page.getByText("Durchmesser: 0,953 m · Höhenraster: 1,52 m", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText(smallTip, { exact: true })).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`${tool}-small-900x620.png`),
    });
    const camera = await paintedCamera(page);
    const x = Math.round((camera.width / 2 - camera.x) / camera.scale / 5) * 5;
    const y = Math.round((camera.height / 2 - camera.y) / camera.scale / 5) * 5;
    const original = (await terrain(page, x, y)).tiles;
    await clearCalls(page);
    await dragWorld(page, [x + 2.5, y + 2.5], [x + 2.6, y + 2.5]);
    await expect
      .poll(
        async () =>
          (await calls(page, tool === "Höhen" ? "endTerrainStroke" : "commit"))
            .length,
      )
      .toBe(1);
    await settled(page);
    const small = (await terrain(page, x, y)).tiles;
    if (tool === "Höhen") {
      // A subgrid land stroke can change spline controls without creating an island.
      expect(small.map((t) => t.heights)).not.toEqual(
        original.map((t) => t.heights),
      );
      expect(small.flatMap((t) => t.heights).every((z) => z < 0)).toBe(true);
      await page
        .getByRole("button", { name: "Rückgängig", exact: true })
        .click();
      await settled(page);
      expect((await terrain(page, x, y)).tiles).toEqual(original);
    } else {
      expect(small.map((t) => t.heights)).toEqual(
        original.map((t) => t.heights),
      );
      expect((await status(page)).revision).toBe(0);
      expect((await status(page)).canUndo).toBe(false);
    }
    expect(small[0].waters).toEqual([]);
    const revision = (await status(page)).revision;
    await page.getByLabel("Pinselgröße (Pixel)").fill("256");
    await page.getByLabel("Pinselgröße (Pixel)").blur();
    await expect(
      page.getByText("Durchmesser: 3,05 m · Höhenraster: 1,52 m", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText(smallTip, { exact: true })).toHaveCount(0);
    await clearCalls(page);
    await dragWorld(page, [x, y], [x + 0.1, y]);
    await expect
      .poll(async () => (await status(page)).revision)
      .toBeGreaterThan(revision);
    await settled(page);
    const changed = (await terrain(page, x, y)).tiles;
    expect(changed.map((t) => t.heights)).not.toEqual(
      original.map((t) => t.heights),
    );
    const commits = await calls(
      page,
      tool === "Höhen" ? "beginTerrainStroke" : "commit",
    );
    expect(commits).toHaveLength(1);
    expect(
      "intent" in commits[0].args ? commits[0].args.intent : commits[0].args,
    ).toMatchObject({
      brush: { radius: 5, resolution: 0 },
    });
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    await settled(page);
    expect((await terrain(page, x, y)).tiles).toEqual(original);
    const afterUndo = (await status(page)).revision;
    await clearCalls(page);
    await dragWorld(page, [x, y], [x + 0.2, y], false);
    await expect
      .poll(
        async () =>
          (
            await calls(
              page,
              tool === "Höhen" ? "beginTerrainStroke" : "preview",
            )
          ).length,
      )
      .toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await settled(page);
    if (tool === "Höhen") {
      expect((await status(page)).revision).toBeGreaterThan(afterUndo);
      expect((await terrain(page, x, y)).tiles).not.toEqual(original);
      await page
        .getByRole("button", { name: "Rückgängig", exact: true })
        .click();
      await settled(page);
      expect((await terrain(page, x, y)).tiles).toEqual(original);
    } else expect((await status(page)).revision).toBe(afterUndo);
    expect(await calls(page, "commit")).toEqual([]);
  });
}

test("subgrid water can extend metadata without changing a height sample", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 620 });
  await page.goto(url);
  await ready(page);
  await roomView(page);
  const camera = await paintedCamera(page);
  const x = Math.round((camera.width / 2 - camera.x) / camera.scale / 5) * 5;
  const y = Math.round((camera.height / 2 - camera.y) / camera.scale / 5) * 5;
  expect(
    (
      await commit(page, {
        type: "waterStroke",
        brush: {
          mode: "lower",
          radius: 1,
          amount: 1,
          strength: 0.25,
          target: 10,
          points: [[x, y]],
          resolution: 0,
        },
      })
    ).valid,
  ).toBe(true);
  await page.reload();
  await ready(page);
  await roomView(page);
  await page.getByRole("button", { name: "Gewässer", exact: true }).click();
  await ready(page);
  await page.getByLabel("Pinselgröße (Pixel)").fill("8");
  await page.getByLabel("Pinselgröße (Pixel)").blur();
  await expect(
    page.getByText("Durchmesser: 0,0953 m · Höhenraster: 1,52 m", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(smallTip, { exact: true })).toBeVisible();
  await paintedCamera(page);
  const before = (await terrain(page, x, y)).tiles;
  const revision = (await status(page)).revision;
  await dragWorld(page, [x + 1.05, y], [x + 1.1, y]);
  await expect
    .poll(async () => (await status(page)).revision)
    .toBe(revision + 1);
  await settled(page);
  const after = (await terrain(page, x, y)).tiles;
  expect(after.map((t) => t.heights)).toEqual(before.map((t) => t.heights));
  expect(after[0].waters).not.toEqual(before[0].waters);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await settled(page);
  expect((await terrain(page, x, y)).tiles).toEqual(before);
});

test("exact exterior paths match independent Canvas primitives across repaint and transforms", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  const results = await page.evaluate(async () => {
    const painterModule = "/src/atlas/canvasPaint.ts";
    const cacheModule = "/src/atlas/exteriorGeometryCache.ts";
    const { shape } = await import(/* @vite-ignore */ painterModule);
    const { ExteriorGeometryCache } = await import(
      /* @vite-ignore */ cacheModule
    );
    const cache = new ExteriorGeometryCache();
    const road = {
      kind: "road",
      id: "r",
      material: "stone",
      width: 1.5,
      path: [
        [2, 2],
        [5, 4],
        [8, 2],
      ],
    };
    const area = {
      kind: "area",
      id: "a",
      material: "grass",
      points: [
        [1, 1],
        [4, 1],
        [3, 3],
      ],
    };
    const parcel = {
      kind: "parcel",
      id: "p",
      polygon: [
        [1, 1],
        [7, 1],
        [7, 6],
        [1, 6],
      ],
    };
    const house = {
      kind: "house",
      id: "h",
      roof: "#b05544",
      transform: { x: 6, y: 3, angle: Math.PI / 2 },
      contours: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
        [
          [0.2, 0.2],
          [0.8, 0.2],
          [0.8, 0.8],
          [0.2, 0.8],
        ],
      ],
    };
    const make = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 160;
      return canvas.getContext("2d")!;
    };
    const draw = (
      object: any,
      zoom: number,
      dpr: number,
      actual: boolean,
      highlight?: string,
    ) => {
      const c = make();
      c.setTransform(
        zoom * dpr,
        0,
        0,
        zoom * dpr,
        (zoom === 3 ? 30 : 38) * dpr,
        (zoom === 3 ? 16 : 22) * dpr,
      );
      if (actual) {
        if (object.kind === "house") {
          c.strokeStyle = "#8c8575";
          c.lineWidth = 4 / zoom;
          c.stroke(cache.get(object));
        }
        shape(c, object, zoom, cache, highlight);
      } else {
        c.beginPath();
        const rings =
          object.kind === "road"
            ? [object.path]
            : object.kind === "area"
              ? [object.points]
              : object.kind === "parcel"
                ? [object.polygon]
                : object.contours;
        for (const ring of rings) {
          ring.forEach(([x, y]: number[], i: number) => {
            // Independent quarter-turn for this fixture; house local cells are five feet.
            const point =
              object.kind === "house" ? [6 - 5 * y, 3 + 5 * x] : [x, y];
            if (i) c.lineTo(point[0], point[1]);
            else c.moveTo(point[0], point[1]);
          });
          if (object.kind !== "road") c.closePath();
        }
        if (object.kind === "road") {
          c.strokeStyle = highlight ?? "#aaa9a3";
          c.lineWidth = Math.max(object.width, 2 / zoom);
          c.lineCap = "round";
          c.lineJoin = "round";
          c.stroke();
        } else if (object.kind === "area") {
          c.fillStyle = highlight ?? "#9db58b";
          c.fill();
        } else if (object.kind === "parcel") {
          c.strokeStyle = highlight ?? "#857950";
          c.lineWidth = 1 / zoom;
          c.stroke();
        } else {
          c.strokeStyle = "#8c8575";
          c.lineWidth = 4 / zoom;
          c.stroke();
          c.fillStyle = highlight ?? object.roof;
          c.fill("evenodd");
          c.strokeStyle = "#514c43";
          c.lineWidth = 1 / zoom;
          c.stroke();
        }
      }
      return [...c.getImageData(0, 0, 160, 160).data];
    };
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    const comparisons: boolean[] = [];
    for (const object of [
      road,
      area,
      parcel,
      house,
      {
        ...road,
        path: [
          [2, 2],
          [8, 6],
        ],
      },
    ]) {
      for (const [zoom, dpr] of [
        [3, 1],
        [4, 2],
      ]) {
        const expected = draw(object, zoom, dpr, false, "#ffe397");
        comparisons.push(
          JSON.stringify(draw(object, zoom, dpr, true, "#ffe397")) ===
            JSON.stringify(expected),
        );
        comparisons.push(
          JSON.stringify(draw(object, zoom, dpr, true, "#ffe397")) ===
            JSON.stringify(expected),
        );
      }
    }
    return comparisons;
  });
  expect(results.every(Boolean)).toBe(true);
});
