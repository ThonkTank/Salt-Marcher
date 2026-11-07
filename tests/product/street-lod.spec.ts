import { expect, test } from "../support/fixture";
import type { Page } from "@playwright/test";
import {
  containsPolygon,
  type Intent,
  type Road,
  type WorldPoint,
} from "../../src/atlas/model";
import { viewScale } from "../../src/atlas/lod";
import {
  calls,
  clearCalls,
  clickWorld,
  dragWorld,
  commit,
  holdResponse,
  paintedReady,
  ready,
  releaseResponse,
  scene,
  screen,
  settled,
  status,
  url,
} from "../support/editor";

async function seed(page: Page, intent: Intent) {
  const result = await commit(page, intent);
  expect(result.valid).toBe(true);
  expect(result.changed).toBe(true);
  return result;
}
async function land(page: Page) {
  await seed(page, {
    type: "terrainStroke",
    brush: {
      mode: "land",
      resolution: 6,
      radius: 3000,
      amount: 1,
      strength: 1,
      target: 10,
      points: [[0, 0]],
    },
  });
}
async function road(
  page: Page,
  name: string,
  a: WorldPoint,
  b: WorldPoint,
  width: number,
  material: "earth" | "stone" = "earth",
) {
  const result = await seed(page, {
    type: "createRoad",
    road: {
      name,
      width,
      material,
      nodes: [
        { point: a, incoming: null, outgoing: null },
        { point: b, incoming: null, outgoing: null },
      ],
    },
    population: null,
  });
  const found = result.objects.find((o): o is Road => o.kind === "road");
  expect(found).toBeDefined();
  return found!;
}
async function camera(page: Page) {
  return page.getByTestId("atlas-canvas").evaluate((c: HTMLCanvasElement) => {
    const t = c.getContext("2d")!.getTransform(),
      d = devicePixelRatio || 1;
    return { x: t.e / d, y: t.f / d, scale: t.a / d };
  });
}
async function street(page: Page) {
  await page
    .getByLabel("Ansichtsmaßstab")
    .selectOption({ label: "Straßenzug" });
  await settled(page);
  await paintedReady(page);
  const scale = (await camera(page)).scale;
  // DOMMatrix stores the painted scale at float precision; reference width is 1000 CSS px.
  expect(scale).toBeCloseTo(viewScale(3), 6);
  expect(304.8 / scale).toBeCloseTo(450, 4);
  await expect(page.locator(".atlas-map-title")).toContainText("Straßenzug");
}
// Device pixels are sampled using the actual painted world transform, including DPR.
async function patch(
  page: Page,
  point: WorldPoint,
  radius = 2,
  overlay = false,
) {
  const transform = await camera(page);
  return page.getByTestId(overlay ? "atlas-overlay" : "atlas-canvas").evaluate(
    (c: HTMLCanvasElement, { point, radius, transform }) => {
      const d = devicePixelRatio || 1;
      const x = Math.round((transform.x + point[0] * transform.scale) * d),
        y = Math.round((transform.y + point[1] * transform.scale) * d);
      if (
        x - radius < 0 ||
        y - radius < 0 ||
        x + radius >= c.width ||
        y + radius >= c.height
      )
        throw Error(`offscreen probe ${point}`);
      return Array.from(
        c
          .getContext("2d")!
          .getImageData(x - radius, y - radius, 2 * radius + 1, 2 * radius + 1)
          .data,
      );
    },
    { point, radius, transform },
  );
}
function hasColor(data: number[], color: number[]) {
  return data.some(
    (_, i) =>
      i % 4 === 0 &&
      color.every((v, j) => data[i + j] === v) &&
      data[i + 3] === 255,
  );
}
async function mapFeature(page: Page, id: string) {
  const requests = await calls(page, "mapTiles");
  expect(requests.length).toBeGreaterThan(0);
  const responses = await page.evaluate(async (requests) => {
    const output = [];
    for (const request of requests)
      output.push(await window.atlasCore("mapTiles", request.args));
    return output;
  }, requests);
  const feature = responses
    .flatMap((r) => r.tiles.flatMap((t) => t.features))
    .find((f) => f.id === id);
  expect(feature).toBeDefined();
  return feature!;
}
async function doubleWorld(page: Page, point: WorldPoint) {
  const q = await screen(page, point);
  await page.mouse.dblclick(q.x, q.y);
}
async function noInterior(page: Page) {
  expect(await calls(page, "interiorMetadata")).toHaveLength(0);
  expect(await calls(page, "interiorTile")).toHaveLength(0);
}

test("invisible real 5/2 road releases click, pan and anchored zoom; real 5/12 stays visible", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await land(page);
  const visible = await road(
    page,
    "Sichtbar",
    [-180, 150],
    [180, 150],
    12,
    "stone",
  );
  const wideShort = await road(
    page,
    "Kurz breit",
    [-120, -100],
    [-115, -100],
    12,
    "stone",
  );
  await page.reload();
  await ready(page);
  await street(page);
  const before = await patch(page, [2.5, 0]),
    origin = await camera(page);
  const hidden = await road(page, "Unsichtbar", [0, 0], [5, 0], 2);
  await page.reload();
  await ready(page);
  await street(page);
  expect(await camera(page)).toEqual(origin);
  expect(await patch(page, [2.5, 0])).toEqual(before);
  const feature = await mapFeature(page, hidden.id);
  expect(
    (feature.rank / Math.max(1, feature.width)) * origin.scale,
  ).toBeLessThan(8);
  const wide = await mapFeature(page, wideShort.id);
  expect((wide.rank / wide.width) * origin.scale).toBeGreaterThan(8);
  expect(hasColor(await patch(page, [-117.5, -100], 1), [170, 169, 163])).toBe(
    true,
  );
  expect(hasColor(await patch(page, [-130, 150], 1), [170, 169, 163])).toBe(
    true,
  );
  const authors = (await scene(page)).objects,
    revision = (await status(page)).revision;
  await clearCalls(page);
  await clickWorld(page, [2.5, 0]);
  await settled(page);
  expect(await calls(page, "roadHeader")).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "Verlauf aufrauen", exact: true }),
  ).toHaveCount(0);
  const q = await screen(page, [2.5, 0]);
  await page.mouse.move(q.x, q.y);
  await page.mouse.down();
  await page.mouse.move(q.x + 35, q.y + 20);
  await page.mouse.up();
  await paintedReady(page);
  const moved = await camera(page);
  expect(moved.x - origin.x).toBeCloseTo(35, 8);
  expect(moved.y - origin.y).toBeCloseTo(20, 8);
  expect(moved.scale).toBe(origin.scale);
  await page.mouse.move(q.x + 35, q.y + 20);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(q.x, q.y);
  await page.mouse.up({ button: "middle" });
  await paintedReady(page);
  expect(await camera(page)).toEqual(origin);
  const anchor = await screen(page, [2.5, 0]);
  await doubleWorld(page, [2.5, 0]);
  await settled(page);
  await paintedReady(page);
  expect((await camera(page)).scale).toBeCloseTo(1.28, 6);
  const after = await screen(page, [2.5, 0]);
  expect(Math.abs(after.x - anchor.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.y - anchor.y)).toBeLessThanOrEqual(1);
  expect(await calls(page, "commit")).toHaveLength(0);
  expect((await scene(page)).objects).toEqual(authors);
  expect((await status(page)).revision).toBe(revision);
  await street(page);
  await clearCalls(page);
  await clickWorld(page, [-130, 150]);
  await settled(page);
  expect(
    (await calls(page, "roadHeader")).some((c) => c.args.roadId === visible.id),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Verlauf aufrauen", exact: true }),
  ).toBeVisible();
  expect(await calls(page, "scene")).toHaveLength(0);
  await noInterior(page);
  expect((await scene(page)).objects).toEqual(authors);
  expect((await status(page)).revision).toBe(revision);
});

test("selected subthreshold road retains exact drawing and one edit/undo after held header", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await land(page);
  const selected = await road(page, "Kurz exakt", [0, 0], [9, 0], 2);
  await page.reload();
  await ready(page);
  await paintedReady(page);
  await clickWorld(page, [4.5, 0]);
  await settled(page);
  await expect(
    page.getByRole("button", { name: "Verlauf aufrauen", exact: true }),
  ).toBeVisible();
  const original = (await scene(page)).objects,
    revision = (await status(page)).revision;
  await clearCalls(page);
  await holdResponse(page, "roadHeader");
  try {
    await page
      .getByLabel("Ansichtsmaßstab")
      .selectOption({ label: "Straßenzug" });
    await expect.poll(() => page.evaluate(() => window.atlasHeld)).toBe(true);
    await expect(
      page.getByText("Ansicht wird geladen …", { exact: true }),
    ).toBeVisible();
    expect(
      (await calls(page, "roadHeader")).some(
        (c) => c.args.roadId === selected.id,
      ),
    ).toBe(true);
    // Exercise blocked input against the actually drawn, deliberately stale view.
    const blocked = await screen(page, [4.5, 0], "displayed");
    await page.mouse.dblclick(blocked.x, blocked.y);
    expect(await calls(page, "commit")).toHaveLength(0);
    expect((await scene(page)).objects).toEqual(original);
    expect((await status(page)).revision).toBe(revision);
  } finally {
    await releaseResponse(page);
  }
  await settled(page);
  expect(await calls(page, "commit")).toHaveLength(0);
  await street(page);
  const feature = await mapFeature(page, selected.id);
  expect((feature.rank / feature.width) * viewScale(3)).toBeLessThan(8);
  // Exact selected stroke is visible even though its normal tile representative is hidden.
  expect(hasColor(await patch(page, [4.5, 0], 1), [211, 193, 154])).toBe(true);
  const plus: WorldPoint = [9 + 22 / viewScale(3), 0];
  expect(
    (await patch(page, plus, 2, true)).some((v, i) => i % 4 === 3 && v > 0),
  ).toBe(true);
  expect(
    (await patch(page, [plus[0], 25 / viewScale(3)], 1, true)).filter(
      (_, i) => i % 4 === 3,
    ),
  ).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const beforeCommits = (await calls(page, "commit")).length;
  await doubleWorld(page, [4.5, 0]);
  await settled(page);
  await paintedReady(page);
  const writes = (await calls(page, "commit")).slice(beforeCommits);
  expect(writes).toHaveLength(1);
  expect(writes[0].args.intent).toMatchObject({
    type: "insertRoadNode",
    roadId: selected.id,
    afterNodeId: selected.nodes[0].id,
  });
  if (writes[0].args.intent.type !== "insertRoadNode")
    throw Error("expected insertion");
  expect(writes[0].args.intent.t).toBeGreaterThan(0);
  expect(writes[0].args.intent.t).toBeLessThan(1);
  const changed = (await scene(page)).objects.find(
    (o): o is Road => o.kind === "road" && o.id === selected.id,
  )!;
  expect(changed.nodes).toHaveLength(3);
  expect((await status(page)).revision).toBe(revision + 1);
  expect((await camera(page)).scale).toBeCloseTo(viewScale(3), 6);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await settled(page);
  expect(await calls(page, "history")).toHaveLength(1);
  expect((await scene(page)).objects).toEqual(original);
  expect(await calls(page, "commit")).toHaveLength(beforeCommits + 1);
  await expect(
    page.getByRole("button", { name: "Verlauf aufrauen", exact: true }),
  ).toBeVisible();
});

test("filled street map paints its layers and labels and preserves tools at exact policy boundaries", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.goto(url);
  await ready(page);
  await land(page);
  const named = await road(
    page,
    "Birkenweg",
    [-260, -210],
    [440, -210],
    12,
    "stone",
  );
  for (const [x, name, color, important] of [
    [-240, "Mühle", "#123456", false],
    [240, "Rathaus", "#654321", true],
  ] as const) {
    const result = await seed(page, {
      type: "createHouse",
      parcelId: null,
      transform: { x, y: -70, angle: 0 },
      width: 12,
      depth: 10,
    });
    const house = result.objects.find((o) => o.kind === "house")!;
    await seed(page, { type: "roof", id: house.id, roof: color });
    await seed(page, { type: "rename", id: house.id, name });
    if (important)
      await seed(page, { type: "importantPlace", id: house.id, value: true });
  }
  await seed(page, {
    type: "groundStroke",
    brush: {
      mode: "paint",
      tip: "hard",
      color: [210, 70, 30],
      diameter: 100,
      opacity: 1,
      flow: 1,
      seed: 7,
      // The real flow integrates time: a one-second hold reaches full byte opacity.
      points: [
        [280, 100, 0],
        [280, 100, 1000],
      ],
    },
  });
  const scenery = await seed(page, {
    type: "sceneryStroke",
    brush: {
      biome: "forest",
      radius: 40,
      size: 10,
      density: 1,
      seed: 11,
      points: [[-220, 100]],
    },
  });
  const forest = scenery.objects.find((o) => o.kind === "scenery")!;
  if (forest.kind !== "scenery") throw Error("missing forest");
  expect(forest.assets.length).toBeGreaterThan(0);
  await seed(page, {
    type: "waterStroke",
    brush: {
      mode: "lower",
      resolution: 0,
      radius: 55,
      amount: 20,
      strength: 1,
      target: 10,
      points: [[-220, 280]],
    },
  });
  const river = await seed(page, {
    type: "riverEdit",
    view: null,
    action: {
      kind: "put",
      id: null,
      name: "Klarbach",
      nodes: [
        { id: "", point: [160, 260], width: 20 },
        { id: "", point: [400, 260], width: 20 },
      ],
      automatic: false,
      reverse: false,
      snap: 0,
      settings: {
        roughness: 0,
        tolerance: 0,
        meander: 0,
        sourceFade: false,
        seed: 1,
      },
    },
  });
  expect(river.rivers!.after[0].samples.length).toBeGreaterThan(1);
  const catalog = await page.evaluate(async () =>
    window.atlasCore("regions", {
      version: await window.atlasCore("status", {}),
      bounds: null,
      ids: [],
      rankIds: [],
      detail: null,
      scale: 1,
      exact: false,
    }),
  );
  const politics = catalog.catalog.categories.find(
    (c) => c.name === "Politisch",
  )!;
  const towns = catalog.catalog.categories.find(
    (c) => c.name === "Ortschaften",
  )!;
  const districtRank = catalog.catalog.ranks.find(
    (r) => r.categoryId === politics.id && r.name === "Viertel",
  )!;
  const markerRank = catalog.catalog.ranks.find(
    (r) => r.categoryId === towns.id && r.name === "Gehöft",
  )!;
  const district = (
    await seed(page, {
      type: "regionEdit",
      action: { kind: "create", name: "Uferbezirk", rankId: districtRank.id },
    })
  ).regions![0];
  await seed(page, {
    type: "regionEdit",
    action: {
      kind: "update",
      id: district.id,
      name: district.name,
      rankId: district.rankId,
      label: district.label,
      style: { color: "#b020b0", opacity: 0.25, width: 3, dash: "solid" },
    },
  });
  await seed(page, {
    type: "regionStroke",
    id: district.id,
    points: [[0, 140]],
    radius: 90,
    erase: false,
  });
  const marker = (
    await seed(page, {
      type: "regionEdit",
      action: { kind: "create", name: "Weiler", rankId: markerRank.id },
    })
  ).regions![0];
  await seed(page, {
    type: "regionStroke",
    id: marker.id,
    points: [[0, 360]],
    radius: 10,
    erase: false,
  });
  await seed(page, {
    type: "terrainStroke",
    brush: {
      mode: "raise",
      resolution: 2,
      radius: 70,
      amount: 30,
      strength: 1,
      target: 10,
      points: [[280, 380]],
    },
  });
  await page.reload();
  await settled(page);
  // Additive observer attaches to the existing real app canvas; it restores both prototypes.
  const observer = await page.evaluateHandle(async () => {
    const path = "/tests/support/canvasProbe.tsx";
    const { observeBaseFrame } = await import(/* @vite-ignore */ path);
    return observeBaseFrame(
      document.querySelector(
        '[data-testid="atlas-canvas"]',
      ) as HTMLCanvasElement,
    ) as ReturnType<typeof import("../support/canvasProbe").observeBaseFrame>;
  });
  try {
    await clearCalls(page);
    await street(page);
    const maps = await calls(page, "mapTiles");
    expect(maps.length).toBeGreaterThan(0);
    expect(maps.every((c) => c.args.tiles.length <= 64)).toBe(true);
    expect(await calls(page, "scene")).toHaveLength(0);
    await noInterior(page);
    const labels = await observer.evaluate((o) => o.snapshot());
    expect(labels.frame).toBeGreaterThan(0);
    for (const label of [
      "Birkenweg",
      "Mühle",
      "Rathaus",
      "Uferbezirk",
      "Weiler",
    ])
      expect(labels.texts).toContain(label);
    const flat = await patch(page, [-100, 0]);
    expect(hasColor(flat, [178, 185, 151])).toBe(true);
    expect(hasColor(flat, [134, 184, 198])).toBe(false);
    expect(hasColor(await patch(page, [-180, -210], 1), [170, 169, 163])).toBe(
      true,
    );
    expect(hasColor(await patch(page, [-232, -62], 1), [18, 52, 86])).toBe(
      true,
    );
    expect(hasColor(await patch(page, [248, -62], 1), [101, 67, 33])).toBe(
      true,
    );
    const ground = await patch(page, [280, 100], 3);
    await info.attach("ground-probe", {
      body: JSON.stringify({
        ground,
        camera: await camera(page),
        groundRequests: await calls(page, "groundTiles"),
        terrainRequests: await calls(page, "terrainTiles"),
      }),
      contentType: "application/json",
    });
    await page.screenshot({
      path: info.outputPath("street-map-before-probes.png"),
    });
    expect(
      hasColor(ground, [210, 70, 30]),
      JSON.stringify([
        ...new Set(
          ground.flatMap((_, i) =>
            i % 4 === 0 ? [ground.slice(i, i + 4).join(",")] : [],
          ),
        ),
      ]),
    ).toBe(true);
    expect(await patch(page, [360, 100])).toEqual(flat);
    const asset = forest.assets[0];
    expect(hasColor(await patch(page, asset.point, 1), [71, 113, 72])).toBe(
      true,
    );
    expect(hasColor(await patch(page, [-290, 100]), [71, 113, 72])).toBe(false);
    const water = await patch(page, [-220, 280], 3),
      shore = await patch(page, [-164, 280], 2),
      dry = await patch(page, [-140, 280], 2);
    // Confirm these spatial probes against the actual current water contours too.
    const surfaces = await page.evaluate(
      async (requests) => {
        const output = [];
        for (const request of requests)
          output.push(await window.atlasCore("terrainTiles", request.args));
        return output;
      },
      await calls(page, "terrainTiles"),
    );
    const waterPolygons = surfaces.flatMap((surface) =>
      surface.tiles.flatMap((tile) =>
        tile.waters.flatMap((body) => body.polygons),
      ),
    );
    expect(
      waterPolygons.some((poly) => containsPolygon(poly, [-220, 280])),
    ).toBe(true);
    expect(
      waterPolygons.some((poly) => containsPolygon(poly, [-140, 280])),
    ).toBe(false);
    expect(hasColor(water, [134, 184, 198])).toBe(true);
    expect(hasColor(dry, [134, 184, 198])).toBe(false);
    expect(shore).not.toEqual(water);
    const sample =
      river.rivers!.after[0].samples[
        Math.floor(river.rivers!.after[0].samples.length / 2)
      ];
    const riverInside = await patch(page, sample.point, 2),
      riverBank = await patch(page, [sample.point[0], sample.point[1] + 12], 2),
      riverOutside = await patch(
        page,
        [sample.point[0], sample.point[1] + 40],
        2,
      );
    expect(hasColor(riverInside, [114, 184, 207])).toBe(true);
    expect(riverBank).not.toEqual(riverInside);
    expect(hasColor(riverOutside, [114, 184, 207])).toBe(false);
    expect(hasColor(await patch(page, [90, 140], 2), [176, 32, 176])).toBe(
      true,
    );
    expect(await patch(page, [-40, 140])).not.toEqual(flat);
    const regions = await page.evaluate(
      async (ids) =>
        window.atlasCore("regions", {
          version: await window.atlasCore("status", {}),
          bounds: null,
          ids,
          rankIds: [],
          detail: null,
          scale: 0.6773333333333333,
          exact: false,
        }),
      [district.id, marker.id],
    );
    const markerSummary = regions.summaries.find((r) => r.id === marker.id)!;
    expect(Math.sqrt(markerSummary.area) * viewScale(3)).toBeLessThan(80);
    expect(
      hasColor(await patch(page, markerSummary.anchor, 2), [57, 55, 47]),
    ).toBe(true);
    const relief = await patch(page, [260, 360], 8);
    const reliefColors = new Set(
      relief.flatMap((_, i) =>
        i % 4 === 0 ? [relief.slice(i, i + 3).join(",")] : [],
      ),
    );
    expect(reliefColors.size).toBeGreaterThan(2);
    expect(relief).not.toEqual(await patch(page, [-100, 0], 8));
    await info.attach("street-map-observations", {
      body: JSON.stringify(
        {
          labels,
          flat,
          ground,
          water,
          shore,
          dry,
          riverInside,
          riverBank,
          riverOutside,
          reliefColors: [...reliefColors],
          camera: await camera(page),
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
    await page.screenshot({ path: info.outputPath("street-map.png") });
    const toolbar = page.locator(".atlas-tools"),
      help = page.locator(".atlas-map-help");
    for (const absent of ["Raum", "Radieren", "Zuweisen", "Tür", "Treppe"])
      await expect(
        toolbar.getByRole("button", { name: absent, exact: true }),
      ).toHaveCount(0);
    for (const [name, label, hint] of [
      ["Auswahl", null, "Klicken: Auswählen · Ziehen: Bearbeiten"],
      [
        "Straße",
        "Straßenbreite (Fuß)",
        "Klicken: Punkt · Enter / Rechtsklick: Übernehmen",
      ],
      [
        "Fluss",
        "Flussbreite (Fuß)",
        "Klicken: Punkt · Enter / Rechtsklick: Übernehmen",
      ],
      [
        "Boden",
        "Bodenfarbe",
        "Ziehen / Halten: Boden malen · Loslassen: Übernehmen",
      ],
      ["Gewässer", "Absenkung (Fuß)", "Ziehen: Zeichnen"],
      ["Höhen", "Pinselmodus", "Ziehen: Zeichnen"],
      ["Regionen", "Regionsmodus", "Ziehen: Zeichnen"],
    ] as const) {
      const button = toolbar.getByRole("button", { name, exact: true });
      await button.click();
      await settled(page);
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(help).toContainText(hint);
      if (label)
        await expect(page.getByLabel(label, { exact: true })).toBeVisible();
      if (name === "Auswahl")
        await expect(page.locator(".atlas-overview-hint")).toHaveText(
          "Übersicht · Doppelklick auf freie Karte zum Hineinzoomen",
        );
      if (name === "Straße") {
        await expect(
          page.getByLabel("Bebauung", { exact: true }),
        ).toBeVisible();
        await expect(page.locator(".atlas-overview-hint")).toHaveText(
          "Straßenplanung · Detailbearbeitung ab 20 %",
        );
      }
      if (name === "Fluss") {
        await expect(
          page.getByRole("button", {
            name: "Neuen Fluss zeichnen",
            exact: true,
          }),
        ).toBeVisible();
        await expect(page.locator(".atlas-overview-hint")).toHaveText(
          "Flussplanung",
        );
      }
      if (name === "Boden")
        await expect(
          page.getByRole("button", { name: "Pipette", exact: true }),
        ).toBeVisible();
      if (name === "Gewässer" || name === "Höhen")
        await expect(page.locator(".atlas-settings")).toContainText(
          "Höhenraster:",
        );
      if (name === "Gewässer")
        await expect(page.locator(".atlas-settings")).toContainText(
          "Ziehen: Gewässer malen",
        );
      if (name === "Höhen")
        await expect(page.locator(".atlas-settings")).toContainText(
          "Ziehen: Direkt malen",
        );
      if (name === "Regionen") {
        await expect(
          page.getByLabel("Rangstufe", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByLabel("Regionsmodus", { exact: true }),
        ).toHaveValue("paint");
      }
    }
    const beforeBlocked = (await calls(page, "commit")).length;
    for (const name of ["Haus", "Landschaft"]) {
      const button = toolbar.getByRole("button", { name, exact: true });
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(help).toContainText(
        `${name} · Für diese Bearbeitung hineinzoomen.`,
      );
      await expect(help).not.toContainText("Ziehen: Zeichnen");
      await paintedReady(page);
      await dragWorld(page, [-100, 0], [-80, 20]);
      await settled(page);
    }
    expect(await calls(page, "commit")).toHaveLength(beforeBlocked);
    await toolbar.getByRole("button", { name: "Auswahl", exact: true }).click();
    await paintedReady(page);
    await clickWorld(page, [-180, -210]);
    await settled(page);
    expect(
      (await calls(page, "roadHeader")).some((c) => c.args.roadId === named.id),
    ).toBe(true);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Birkenweg",
    );
    // Wheel enters and leaves exact policy while the navigation name remains Straßenzug.
    for (const [target, blocked] of [
      [1.3, false],
      [1.2, false],
      [1.14, true],
    ] as const) {
      const current = await camera(page),
        anchor = await screen(page, [0, 0]);
      await page.mouse.move(anchor.x, anchor.y);
      await page.mouse.wheel(0, -Math.log(target / current.scale) / 0.0015);
      await settled(page);
      await paintedReady(page);
      expect((await camera(page)).scale).toBeCloseTo(target, 6);
      await expect(page.locator(".atlas-map-title")).toContainText(
        "Straßenzug",
      );
      expect(await patch(page, [-40, 140])).not.toEqual(
        await patch(page, [-100, 0]),
      );
      expect((await observer.evaluate((o) => o.snapshot())).texts).toContain(
        "Uferbezirk",
      );
      for (const name of ["Haus", "Landschaft"]) {
        await toolbar.getByRole("button", { name, exact: true }).click();
        if (blocked)
          await expect(help).toContainText(
            `${name} · Für diese Bearbeitung hineinzoomen.`,
          );
        else {
          await expect(help).not.toContainText(
            "Für diese Bearbeitung hineinzoomen",
          );
          await expect(help).toContainText("Ziehen: Zeichnen");
        }
      }
      await toolbar
        .getByRole("button", { name: "Auswahl", exact: true })
        .click();
      await settled(page);
      await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
        "Birkenweg",
      );
      await noInterior(page);
    }
    expect(await calls(page, "commit")).toHaveLength(beforeBlocked);
  } finally {
    await observer.evaluate((o) => o.close());
    await observer.dispose();
  }
});
