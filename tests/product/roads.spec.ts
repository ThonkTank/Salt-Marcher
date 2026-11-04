import { finishRoad, populationDetails } from "../support/editor";
import { selectObject } from "../support/editor";
import type { House, Preview, Road, Status } from "../../src/atlas/model";
import {
  calls,
  clearCalls,
  clickWorld,
  ready,
  scene,
  screen,
  seedRoad,
  population as settings,
  url,
  status as version,
} from "../support/editor";
import { expect, test } from "../support/fixture";

test("new compound road accepts the latest candidate while an obsolete preview is held", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Straße", exact: true }).click();
  await expect(page.getByLabel("Bebauung", { exact: true })).toHaveValue(
    "houses",
  );
  await page.getByLabel("Bebauung", { exact: true }).selectOption("houses");
  await clickWorld(page, [-20, 30]);
  await page.evaluate(() => {
    window.atlasHold = { cmd: "preview" };
  });
  await clickWorld(page, [150, 30]);
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  // Parameter and checkbox changes supersede the held immutable action.
  await page.getByLabel("Bebauung", { exact: true }).selectOption("none");
  await page.getByLabel("Bebauung", { exact: true }).selectOption("houses");
  await populationDetails(page);
  await page.getByLabel("Hausabstand (Fuß)").fill("5");
  await page.getByLabel("Hausabstand (Fuß)").blur();
  const accept = page.getByTestId("atlas-canvas");
  await expect(accept).toBeEnabled();
  await page.getByTestId("atlas-canvas").focus();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await version(page)).revision).toBe(1);
  await page.evaluate(() => window.atlasRelease?.());
  const commits = await calls(page, "commit");
  expect(commits).toHaveLength(1);
  expect(commits[0].args.intent).toMatchObject({
    type: "createRoad",
    population: { gap: 5 },
  });
  const objects = (await scene(page)).objects;
  expect(objects.filter((o) => o.kind === "road")).toHaveLength(1);
  expect(objects.filter((o) => o.kind === "parcel").length).toBeGreaterThan(0);
  expect(objects.filter((o) => o.kind === "house")).toHaveLength(
    objects.filter((o) => o.kind === "parcel").length,
  );
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect.poll(async () => (await scene(page)).objects.length).toBe(0);
});

test("road checkbox and recipe settings survive tools; disabling only removes draft population; Escape revokes held preview", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Straße", exact: true }).click();
  await page.getByLabel("Bebauung", { exact: true }).selectOption("houses");
  await populationDetails(page);
  await page.getByText("Erweitert", { exact: true }).click();
  await page
    .getByLabel("Parzellentiefe", { exact: true })
    .selectOption("manual");
  await page.getByLabel("Parzellentiefe (Fuß)").fill("65");
  await page.getByLabel("Parzellentiefe (Fuß)").blur();
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  await page.getByRole("button", { name: "Straße", exact: true }).click();
  await expect(page.getByLabel("Bebauung", { exact: true })).toHaveValue(
    "houses",
  );
  await clickWorld(page, [0, 50]);
  await clickWorld(page, [120, 50]);
  const accept = page.getByTestId("atlas-canvas");
  await expect(accept).toBeEnabled();
  await page.getByLabel("Bebauung", { exact: true }).selectOption("none");
  await expect(accept).toBeEnabled();
  await expect
    .poll(
      async () =>
        (
          (await calls(page, "preview")).at(-1)?.args.intent as {
            population?: unknown;
          }
        )?.population,
    )
    .toBeNull();
  await page.evaluate(() => {
    window.atlasHold = { cmd: "preview" };
  });
  await page.getByLabel("Bebauung", { exact: true }).selectOption("houses");
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.atlasRelease?.());
  await expect(
    page.locator(".atlas-actions .atlas-preview-summary"),
  ).toHaveCount(0);
  expect(await calls(page, "commit")).toHaveLength(0);
  expect((await version(page)).revision).toBe(0);
});

test("both extension ends keep original direction, sections, parcel poses and interior cells; repeat populate is idempotent", async ({
  page,
}) => {
  await page.goto(url);
  const road = await seedRoad(page);
  const before = (await scene(page)).objects.filter((o) => o.kind !== "road");
  const interiors = await page.evaluate(
    async (ids) =>
      Promise.all(
        ids.map(async (buildingId) => ({
          buildingId,
          tile: await window.atlasCore<any>("interiorTile", {
            buildingId,
            floor: 0,
            bounds: [-100, -100, 100, 100],
            includeLower: true,
          }),
        })),
      ),
    before.filter((o) => o.kind === "house").map((o) => o.id),
  );
  await page.reload();
  await ready(page);
  await selectObject(page, "↝ Testweg");
  await ready(page);
  for (const [end, p] of [
    ["Ende", [160, 0]],
    ["Anfang", [-40, 0]],
  ] as const) {
    await page.getByRole("button", { name: "Auswahl", exact: true }).click();
    await page
      .getByRole("button", { name: `Am ${end} verlängern`, exact: true })
      .click();
    await page.getByLabel("Rauheit", { exact: true }).fill("0");
    await page.getByLabel("Rauheit", { exact: true }).press("Enter");
    await expect(page.getByLabel("Bebauung", { exact: true })).toHaveValue(
      "houses",
    );
    await clickWorld(page, [p[0], p[1]]);
    const accept = page.getByTestId("atlas-canvas");
    await expect(accept).toBeEnabled();
    const previous = (await version(page)).revision;
    await finishRoad(page);
    await expect
      .poll(async () => (await version(page)).revision)
      .toBe(previous + 1);
    await ready(page);
  }
  const after = (await scene(page)).objects,
    updated = after.find((o): o is Road => o.kind === "road")!;
  expect(updated.nodes.map((n) => n.point)).toEqual([
    [-40, 0],
    [0, 0],
    [80, 0],
    [160, 0],
  ]);
  expect(
    updated.nodes.slice(1, 3).map((n) => ({ id: n.id, point: n.point })),
  ).toEqual(road.nodes.map((n) => ({ id: n.id, point: n.point })));
  expect(updated.nodes[1].outgoing).toEqual(road.nodes[0].outgoing);
  expect(updated.nodes[2].incoming).toEqual(road.nodes[1].incoming);
  expect(updated.edgeSections[1]).toBe(road.edgeSections[0]);
  expect(updated.sections).toHaveLength(3);
  for (const old of before)
    expect(after.find((o) => o.id === old.id)).toEqual(old);
  for (const old of interiors) {
    const tile = await page.evaluate(
      (buildingId) =>
        window.atlasCore<any>("interiorTile", {
          buildingId,
          floor: 0,
          bounds: [-100, -100, 100, 100],
          includeLower: true,
        }),
      old.buildingId,
    );
    expect(tile.cells).toEqual(old.tile.cells);
    expect(tile.lower).toEqual(old.tile.lower);
  }
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  const rev = (await version(page)).revision;
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Straße bebauen", exact: true })
      .click();
    await expect(
      page.getByText("Keine Änderung.", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () => (await calls(page, "preview")).at(-1)?.args.intent)
      .toMatchObject({ type: "populate", settings });
    await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  }
  expect((await version(page)).revision).toBe(rev);
  await page
    .getByRole("button", { name: "Straße bebauen", exact: true })
    .click();
  await populationDetails(page);
  await page
    .getByRole("button", { name: "Neue Variante", exact: true })
    .click();
  await finishRoad(page);
  await expect.poll(async () => (await version(page)).revision).toBe(rev + 1);
  expect((await scene(page)).objects.filter((o) => o.kind !== "road")).toEqual(
    after.filter((o) => o.kind !== "road"),
  );
});

test("delete modal rechecks changed offscreen counts and requires explicit confirmation through button or keyboard", async ({
  page,
}) => {
  await page.goto(url);
  const road = await seedRoad(page, true, 1000);
  const all = (await scene(page)).objects;
  await page.reload();
  await ready(page);
  await selectObject(page, "↝ Testweg");
  await ready(page);
  await clearCalls(page);
  await page
    .getByRole("button", { name: "Objekt löschen", exact: true })
    .click();
  const modal = page.getByRole("dialog"),
    confirm = modal.getByRole("button", { name: "Löschen bestätigen" });
  const parcels = all.filter((o) => o.kind === "parcel").length;
  await expect(modal).toContainText(
    `${parcels} Parzellen · ${parcels} Häuser · ${parcels} Räume`,
  );
  await expect(confirm).toBeEnabled();
  const v = await version(page);
  await page.evaluate(
    async (houseId) => {
      await window.atlasCore("commit", {
        version: await window.atlasCore("status", {}),
        intent: { type: "delete", id: houseId },
      });
    },
    all.find((o) => o.kind === "house")!.id,
  );
  // Saving publishes a newer authoritative status without replacing the modal.
  await page.keyboard.press("Control+s");
  await expect(modal).toContainText("Dokumentstand geändert");
  await expect(confirm).toBeDisabled();
  expect(await calls(page, "commit")).toHaveLength(0);
  await expect(modal).not.toContainText(`${parcels} Häuser`);
  await modal
    .getByRole("button", { name: "Vorschau erneut prüfen", exact: true })
    .click();
  await expect(confirm).toBeEnabled();
  await expect(modal).toContainText(
    `${parcels} Parzellen · ${parcels - 1} Häuser · ${parcels - 1} Räume`,
  );
  await page.keyboard.press("Enter");
  expect((await scene(page)).objects.some((o) => o.id === road.id)).toBe(true);
  expect(await calls(page, "commit")).toHaveLength(0);
  await modal.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await ready(page);
  await page.getByTestId("atlas-canvas").focus();
  await page.keyboard.press("Delete");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect.poll(async () => (await scene(page)).objects.length).toBe(0);
  const commits = await calls(page, "commit");
  expect(commits).toHaveLength(1);
  expect(commits[0].args.intent).toEqual({ type: "delete", id: road.id });
  expect((commits[0].args.version as Status).revision).toBeGreaterThan(
    v.revision,
  );
});

test("final node pointerup collision replaces a valid move preview, stays visible, and Escape keeps confirmed geometry", async ({
  page,
}) => {
  await page.goto(url);
  const road = await seedRoad(page);
  const end: [number, number] = [80, 150];
  const proposed = await page.evaluate(
    async ({ road, end }) =>
      window.atlasCore<Preview>("preview", {
        version: await window.atlasCore("status", {}),
        intent: {
          type: "updateRoad",
          roadId: road.id,
          road: {
            name: road.name,
            width: road.width,
            material: road.material,
            nodes: road.nodes.map((n, i) =>
              i === 1 ? { ...n, point: end } : n,
            ),
          },
        },
      }),
    { road, end },
  );
  expect(proposed.valid).toBe(true);
  if (!proposed.valid) throw Error(proposed.reason);
  const target = proposed.objects
    .filter((o): o is House => o.kind === "house")
    .at(-1)!;
  await page.evaluate(
    async (transform) =>
      window.atlasCore("commit", {
        version: await window.atlasCore("status", {}),
        intent: {
          type: "createHouse",
          parcelId: null,
          transform,
          width: 4,
          depth: 4,
        },
      }),
    target.transform,
  );
  await page.reload();
  await ready(page);
  await selectObject(page, "↝ Testweg");
  await ready(page);
  await clearCalls(page);
  const start = await screen(page, [80, 0]),
    moved = await screen(page, [90, 0]),
    final = await screen(page, end);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(moved.x, moved.y);
  await expect
    .poll(async () => (await calls(page, "preview")).length)
    .toBeGreaterThan(0);
  await page.waitForTimeout(180);
  await page.getByTestId("atlas-canvas").evaluate(
    (canvas: HTMLCanvasElement, p) =>
      canvas.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          pointerId: 1,
          clientX: p.x,
          clientY: p.y,
        }),
      ),
    final,
  );
  await page.mouse.up();
  await expect(
    page.getByRole("status", { name: "Aktionsstatus" }),
  ).toContainText(/kollid|überschneid|Parzell/i);
  await page.waitForTimeout(250);
  expect(await calls(page, "commit")).toHaveLength(1);
  expect((await version(page)).revision).toBe(2);
  const finalIntent = (await calls(page, "commit")).at(-1)!.args.intent as {
    road: Road;
  };
  expect(finalIntent.road.nodes[1].point[0]).toBeCloseTo(end[0], 4);
  expect(finalIntent.road.nodes[1].point[1]).toBeCloseTo(end[1], 4);
  const pixels = await page
    .getByTestId("atlas-overlay")
    .evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await page.keyboard.press("Escape");
  await expect
    .poll(() =>
      page
        .getByTestId("atlas-overlay")
        .evaluate((c: HTMLCanvasElement) => c.toDataURL()),
    )
    .not.toBe(pixels);
  expect((await scene(page)).objects.find((o) => o.id === road.id)).toEqual(
    road,
  );
});

test("existing road width and node edits commit directly; Escape preserves accepted writes", async ({
  page,
}) => {
  await page.goto(url);
  const road = await seedRoad(page, false);
  await page.reload();
  await ready(page);
  await selectObject(page, "↝ Testweg");
  await ready(page);
  await clearCalls(page);
  await page.evaluate(() => {
    window.atlasHold = { cmd: "commit" };
  });
  await page.getByLabel("Breite (Fuß)", { exact: true }).fill("20");
  await page.getByLabel("Breite (Fuß)", { exact: true }).blur();
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await page.evaluate(() => window.atlasRelease?.());
  await page.waitForTimeout(180);
  await expect.poll(async () => (await calls(page, "commit")).length).toBe(1);
  await ready(page);
  const mid = await screen(page, [40, 0]);
  await page.mouse.dblclick(mid.x, mid.y);
  await expect.poll(async () => (await calls(page, "commit")).length).toBe(2);
  await ready(page);
  let updated = (await scene(page)).objects.find(
    (o): o is Road => o.kind === "road",
  )!;
  expect(updated.nodes).toHaveLength(3);
  expect(updated.edgeSections).toEqual([
    road.edgeSections[0],
    road.edgeSections[0],
  ]);
  const inserted = updated.nodes[1];
  await clickWorld(page, inserted.point);
  await page
    .getByRole("button", { name: "Verlaufspunkt löschen", exact: true })
    .click();
  await expect.poll(async () => (await calls(page, "commit")).length).toBe(3);
  await ready(page);
  updated = (await scene(page)).objects.find(
    (o): o is Road => o.kind === "road",
  )!;
  expect(updated.nodes.map((n) => n.id)).toEqual(road.nodes.map((n) => n.id));
  await page.evaluate(() => {
    window.atlasHold = { cmd: "commit" };
  });
  await page.getByLabel("Breite (Fuß)", { exact: true }).fill("25");
  await page.getByLabel("Breite (Fuß)", { exact: true }).blur();
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.atlasRelease?.());
  await page.waitForTimeout(250);
  expect(await calls(page, "commit")).toHaveLength(4);
  expect(
    ((await scene(page)).objects.find((o) => o.kind === "road") as Road).width,
  ).toBe(25);
});

test("lost compound commit is reconciled without automatic replay or an Enter queued during uncertainty", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Straße", exact: true }).click();
  await page.getByLabel("Bebauung", { exact: true }).selectOption("houses");
  await clickWorld(page, [0, 50]);
  await clickWorld(page, [130, 50]);
  const accept = page.getByTestId("atlas-canvas");
  await expect(accept).toBeEnabled();
  await page.evaluate(() => {
    window.atlasFailCommit = true;
    window.atlasFailStatus = true;
  });
  await finishRoad(page);
  await expect(
    page.getByRole("button", { name: "Sitzung erneut laden", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".atlas-actions .atlas-preview-summary"),
  ).toHaveCount(0);
  await page.getByTestId("atlas-canvas").focus();
  await page.keyboard.press("Enter");
  expect(await calls(page, "commit")).toHaveLength(1);
  await page.evaluate(() => {
    window.atlasFailStatus = false;
  });
  await page
    .getByRole("button", { name: "Sitzung erneut laden", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sitzung erneut laden", exact: true }),
  ).toHaveCount(0);
  await ready(page);
  await expect(
    page.locator(".atlas-actions .atlas-preview-summary"),
  ).toHaveCount(0);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  expect(await calls(page, "commit")).toHaveLength(1);
  expect((await version(page)).revision).toBe(1);
  await page.keyboard.press("Escape");
});

test("rejected final curve preserves author data and renders structured issues", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await seedRoad(page);
  await page.reload();
  await ready(page);
  await selectObject(page, "↝ Testweg");
  await ready(page);
  await clickWorld(page, [0, 0]);
  await page
    .getByRole("button", { name: "Kurvengriffe anlegen", exact: true })
    .click();
  await expect.poll(async () => (await version(page)).revision).toBe(2);
  await ready(page);
  await clearCalls(page);
  const road = (await scene(page)).objects.find(
      (o): o is Road => o.kind === "road",
    )!,
    handle = road.nodes[0].outgoing!;
  const start = await screen(page, handle),
    end = await screen(page, [-30, 0]);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 3 });
  await page.mouse.up();
  await expect(
    page.getByRole("status", { name: "Aktionsstatus" }),
  ).toContainText(/Parzell|Geometrie|Umkehr|Kurve/i);
  await page.waitForTimeout(200);
  expect(await calls(page, "commit")).toHaveLength(1);
  expect((await version(page)).revision).toBe(2);
  const red = await page
    .getByTestId("atlas-overlay")
    .evaluate((c: HTMLCanvasElement) => {
      const data = c
        .getContext("2d")!
        .getImageData(0, 0, c.width, c.height).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4)
        if (
          data[i] > 170 &&
          data[i + 1] < 110 &&
          data[i + 2] < 110 &&
          data[i + 3] > 100
        )
          count++;
      return count;
    });
  expect(red).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  // Correct the currently proposed handle, then finalize it without a second
  // confirmation click. The earlier invalid action must not own this result.
  const corrected = await screen(page, [25, 0]);
  await page.mouse.move(end.x, end.y);
  await page.mouse.down();
  await page.mouse.move(corrected.x, corrected.y, { steps: 3 });
  await page.mouse.up();
  await expect.poll(async () => (await version(page)).revision).toBe(3);
  expect(await calls(page, "commit")).toHaveLength(2);
  await page.keyboard.press("Escape");
});

test("generation UI separates retained empty parcels from skipped parcels", async ({
  page,
}) => {
  await page.goto(url);
  await seedRoad(page, false, 90);
  await page.evaluate(async () =>
    window.atlasCore("commit", {
      version: await window.atlasCore("status", {}),
      intent: {
        type: "createArea",
        area: {
          material: "water",
          points: [
            [-1, 9],
            [29, 9],
            [29, 16],
            [-1, 16],
          ],
        },
      },
    }),
  );
  await page.reload();
  await ready(page);
  await selectObject(page, "↝ Testweg");
  await page
    .getByRole("button", { name: "Straße bebauen", exact: true })
    .click();
  await populationDetails(page);
  await page
    .getByRole("combobox", { name: "Straßenseite", exact: true })
    .selectOption("right");
  for (const label of [
    "Min. Breite (Fuß)",
    "Max. Breite (Fuß)",
    "Min. Tiefe (Fuß)",
    "Max. Tiefe (Fuß)",
  ]) {
    await page.getByLabel(label, { exact: true }).fill("20");
    await page.getByLabel(label, { exact: true }).blur();
  }
  await page.getByText("Erweitert", { exact: true }).click();
  await page
    .getByLabel("Parzellentiefe", { exact: true })
    .selectOption("manual");
  await page.getByLabel("Parzellentiefe (Fuß)", { exact: true }).fill("5");
  await page.getByLabel("Parzellentiefe (Fuß)", { exact: true }).blur();
  await page.getByText("Erweitert", { exact: true }).click();
  const summary = page.locator(".atlas-actions .atlas-preview-summary");
  await expect(summary).toContainText(
    "2 neue Parzellen · 0 Häuser · 2 leer · 1 Grundstücke ausgelassen",
  );
  await summary.locator("summary").click();
  await expect(summary).toContainText("Kein Rasterplatz");
  await expect(summary).toContainText("kollidiert");
  const accept = page.getByTestId("atlas-canvas");
  await expect(accept).toBeEnabled();
  await finishRoad(page);
  await ready(page);
  const objects = (await scene(page)).objects;
  expect(objects.filter((o) => o.kind === "parcel")).toHaveLength(2);
  expect(objects.filter((o) => o.kind === "house")).toHaveLength(0);
});
