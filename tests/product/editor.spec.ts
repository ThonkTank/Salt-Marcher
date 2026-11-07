import { editorUrl } from "../support/browserServer";
import {
  finishRoad,
  ready,
  paintedReady,
  selectObject,
  showObjects,
  status,
} from "../support/editor";
import { expect, test } from "../support/fixture";
test("draw curved road, populate, open rotated house, undo and save", async ({
  page,
}) => {
  await page.goto(editorUrl);
  const canvas = page.getByTestId("atlas-canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  await page.getByRole("button", { name: "Straße", exact: true }).click();
  await paintedReady(page);
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + 100, box.y + 220);
  await page.mouse.move(box.x + 380, box.y + 240);
  await page.mouse.down();
  await page.mouse.move(box.x + 440, box.y + 330, { steps: 8 });
  await page.mouse.up();
  await page.mouse.click(box.x + 600, box.y + 390);
  await finishRoad(page);
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await window.atlasCore("status", {})).revision,
      ),
    )
    .toBe(1);
  const objects = await page.evaluate(
    async () =>
      (
        await window.atlasCore("scene", {
          context: { kind: "exterior" },
          bounds: [-1000, -1000, 1000, 1000],
        })
      ).objects,
  );
  const houses = objects.filter((o) => o.kind === "house");
  expect(houses.length).toBeGreaterThan(2);
  expect(houses.some((h) => h.transform.angle !== 0)).toBeTruthy();
  await selectObject(page, new RegExp(`⌂ ${houses[0].name}$`));
  await page.getByRole("button", { name: "Innen öffnen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Zur Atlasansicht" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Erdgeschoss · G 0", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zur Atlasansicht" }).click();
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => (await window.atlasCore("status", {})).dirty),
    )
    .toBe(false);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (
            await window.atlasCore("scene", {
              context: { kind: "exterior" },
              bounds: [-1000, -1000, 1000, 1000],
            })
          ).objects.length,
      ),
    )
    .toBe(0);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (
            await window.atlasCore("scene", {
              context: { kind: "exterior" },
              bounds: [-1000, -1000, 1000, 1000],
            })
          ).objects.length,
      ),
    )
    .toBe(objects.length);
  const previousSession = await page.evaluate(
    async () => (await window.atlasCore("status", {})).sessionId,
  );
  await page.getByRole("button", { name: "Öffnen", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await window.atlasCore("status", {})).sessionId,
      ),
    )
    .not.toBe(previousSession);
  const reopened = await page.evaluate(async () =>
    window.atlasCore("scene", {
      context: { kind: "exterior" },
      bounds: [-1000, -1000, 1000, 1000],
    }),
  );
  // Snapshot 10 does not persist working SQLite row ordinals.
  const byId = (items: typeof objects) =>
    [...items].sort((a, b) => a.id.localeCompare(b.id));
  expect(byId(reopened.objects)).toEqual(byId(objects));
  expect(reopened.status.dirty).toBe(false);
  expect(reopened.status.canUndo).toBe(false);
  expect(reopened.status.canRedo).toBe(false);
});
test("ground painting and independently rotated interior drawing", async ({
  page,
}) => {
  await page.goto(editorUrl);
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  const canvas = page.getByTestId("atlas-canvas");
  await page.getByRole("button", { name: "Boden", exact: true }).click();
  await paintedReady(page);
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 220, box.y + 150, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await status(page)).revision).toBe(1);
  await ready(page);
  await page.getByRole("button", { name: "Haus", exact: true }).click();
  await paintedReady(page);
  await page.mouse.move(box.x + 330, box.y + 220);
  await page.mouse.down();
  await page.mouse.move(box.x + 430, box.y + 320, { steps: 8 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  await paintedReady(page);
  await expect(
    page.getByRole("button", { name: "Innen öffnen", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Drehung (Grad)").fill("37");
  await page.getByLabel("Drehung (Grad)").blur();
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  await page.getByRole("button", { name: "Innen öffnen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Erdgeschoss · G 0", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Geschoss +", exact: true }).click();
  await expect(page.locator(".atlas-map-title")).toContainText("Geschoss 1");
  await page.getByRole("button", { name: "Raum", exact: true }).click();
  await paintedReady(page);
  await page.mouse.move(box.x + 350, box.y + 250);
  await page.mouse.down();
  await page.mouse.move(box.x + 375, box.y + 270, { steps: 4 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  await paintedReady(page);
  await expect(
    page.getByRole("button", { name: /Raum .* · G 1/ }),
  ).toBeVisible();
});

test("unsaved document boundary supports cancel, save and replacement", async ({
  page,
}) => {
  await page.goto(editorUrl);
  await ready(page);
  await page.getByRole("button", { name: "Haus", exact: true }).click();
  await paintedReady(page);
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 300, { steps: 5 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  await paintedReady(page);
  await expect(
    page.getByRole("button", { name: "Innen öffnen", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Neu", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  await paintedReady(page);
  await expect(
    page.getByRole("button", { name: "Innen öffnen", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Neu", exact: true }).click();
  await page
    .getByRole("button", { name: "Speichern und fortfahren", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (
            await window.atlasCore("scene", {
              context: { kind: "exterior" },
              bounds: [-1000, -1000, 1000, 1000],
            })
          ).objects.length,
      ),
    )
    .toBe(0);
  await page.getByRole("button", { name: "Öffnen", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (
            await window.atlasCore("scene", {
              context: { kind: "exterior" },
              bounds: [-1000, -1000, 1000, 1000],
            })
          ).objects.length,
      ),
    )
    .toBe(1);
});

test("house movement is continuous and cancels on return, escape and blur", async ({
  page,
}) => {
  await page.goto(editorUrl);
  await page.evaluate(async () =>
    window.atlasCore("commit", {
      version: await window.atlasCore("status", {}),
      intent: {
        type: "createHouse",
        parcelId: null,
        transform: { x: 0, y: 0, angle: 0 },
        width: 8,
        depth: 8,
      },
    }),
  );
  await page.reload();
  await selectObject(page, "⌂ Haus 1");
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!,
    x = box.x + 200,
    y = box.y + 170;
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  await page.evaluate(() => {
    window.atlasCalls = [];
  });
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 37, y + 17, { steps: 4 });
  await page.mouse.move(x, y, { steps: 4 });
  await page.mouse.up();
  expect(
    await page.evaluate(
      () => window.atlasCalls.filter((c) => c.cmd === "commit").length,
    ),
  ).toBe(0);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 37, y + 17, { steps: 4 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(
    await page.evaluate(
      () => window.atlasCalls.filter((c) => c.cmd === "commit").length,
    ),
  ).toBe(0);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 37, y + 17, { steps: 4 });
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.up();
  expect(
    await page.evaluate(
      () => window.atlasCalls.filter((c) => c.cmd === "commit").length,
    ),
  ).toBe(0);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 37, y + 17, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.atlasCalls.filter((c) => c.cmd === "commit").length,
      ),
    )
    .toBe(1);
  const h = await page.evaluate(async () =>
    (
      await window.atlasCore("scene", {
        context: { kind: "exterior" },
        bounds: [-100, -100, 100, 100],
      })
    ).objects.find((o) => o.kind === "house"),
  );
  expect(h?.kind).toBe("house");
  if (h?.kind === "house") {
    expect(h.transform.x).toBeCloseTo(37 / 3.2);
    expect(h.transform.y).toBeCloseTo(17 / 3.2);
  }
});

test("opening from exterior overview preserves camera and defers interior reads", async ({
  page,
}) => {
  await page.goto(editorUrl);
  await page.evaluate(async () =>
    window.atlasCore("commit", {
      version: await window.atlasCore("status", {}),
      intent: {
        type: "createHouse",
        parcelId: null,
        transform: { x: 0, y: 0, angle: 0 },
        width: 8,
        depth: 8,
      },
    }),
  );
  await page.reload();
  await selectObject(page, "⌂ Haus 1");
  await page.getByTestId("atlas-canvas").hover();
  await page.mouse.wheel(0, 900);
  await expect(page.locator(".atlas-zoom")).toHaveText("13 %");
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  await page.evaluate(() => {
    window.atlasCalls = [];
  });
  await page.getByRole("button", { name: "Innen öffnen", exact: true }).click();
  await expect(
    page.getByText("Zum Innenbearbeiten auf mindestens 20 % zoomen."),
  ).toBeVisible();
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  await expect(page.locator(".atlas-zoom")).toHaveText("13 %");
  expect(
    await page.evaluate(() =>
      window.atlasCalls.filter((c) => c.cmd === "interiorTile"),
    ),
  ).toEqual([]);
  await page.getByTestId("atlas-canvas").hover();
  await page.mouse.wheel(0, -100);
  await expect(page.locator(".atlas-zoom")).toHaveText("20 %");
  await expect
    .poll(() =>
      page.evaluate(
        () => window.atlasCalls.filter((c) => c.cmd === "interiorTile").length,
      ),
    )
    .toBeGreaterThan(0);
});

test("centered door on a rotated even-width house can be selected and converted", async ({
  page,
}) => {
  await page.goto(editorUrl);
  const id = await page.evaluate(async () => {
    const result = await window.atlasCore("commit", {
      version: await window.atlasCore("status", {}),
      intent: {
        type: "createHouse",
        parcelId: null,
        transform: { x: 0, y: 0, angle: 0.4 },
        width: 4,
        depth: 5,
      },
    });
    return result.objects[0].id;
  });
  await page.reload();
  await selectObject(page, "⌂ Haus 1");
  await page.getByRole("button", { name: "Innen öffnen", exact: true }).click();
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  await page.mouse.click(
    box.x + 160 + 32 * Math.cos(0.4),
    box.y + 120 + 32 * Math.sin(0.4),
  );
  await page.evaluate(() => {
    window.atlasCalls = [];
  });
  await page
    .getByRole("button", { name: "Tür / Durchgang umwandeln", exact: true })
    .click();
  await expect
    .poll(async () => {
      const d = await page.evaluate(
        (buildingId) =>
          window.atlasCore("detail", {
            buildingId,
            floor: 0,
            bounds: [-2, -2, 10, 10],
          }),
        id,
      );
      return d.connections[0];
    })
    .toMatchObject({ kind: "passage", offset: 0.5 });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.atlasCalls.filter((c) => c.cmd === "interiorMetadata").length,
      ),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect
    .poll(async () => {
      const d = await page.evaluate(
        (buildingId) =>
          window.atlasCore("detail", {
            buildingId,
            floor: 0,
            bounds: [-2, -2, 10, 10],
          }),
        id,
      );
      return d.connections[0];
    })
    .toMatchObject({ kind: "door", offset: 0.5 });
});

test("close without a reachable core offers explicit cancellation or closing", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.atlasFailStatus = true;
  });
  await page.goto(editorUrl);
  await expect(
    page.getByRole("button", { name: "Sitzung erneut laden" }),
  ).toBeVisible();
  await page.evaluate(() => window.atlasClose?.());
  const dialog = page.getByRole("dialog", {
    name: "Verbindung zum Dokument unterbrochen",
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Speichern und fortfahren" }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
  expect(await page.evaluate(() => window.atlasClosed === true)).toBe(false);
  await page.evaluate(() => window.atlasClose?.());
  await dialog
    .getByRole("button", { name: "Trotzdem schließen", exact: true })
    .click();
  await expect.poll(() => page.evaluate(() => window.atlasClosed)).toBe(true);
});

test("close respects unsaved cancellation and a cancelled save picker", async ({
  page,
}) => {
  await page.goto(editorUrl);
  await page.evaluate(async () =>
    window.atlasCore("commit", {
      version: await window.atlasCore("status", {}),
      intent: {
        type: "createHouse",
        parcelId: null,
        transform: { x: 0, y: 0, angle: 0 },
        width: 4,
        depth: 5,
      },
    }),
  );
  await page.reload();
  await showObjects(page);
  await expect(
    page.getByRole("button", { name: "⌂ Haus 1", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.atlasClose?.());
  const dialog = page.getByRole("dialog", {
    name: "Ungespeicherte Änderungen",
  });
  await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
  expect(await page.evaluate(() => window.atlasClosed === true)).toBe(false);
  await page.evaluate(() => {
    window.atlasCancelSave = true;
    window.atlasClose?.();
  });
  await dialog
    .getByRole("button", { name: "Speichern und fortfahren" })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => window.atlasClosed === true)).toBe(false);
  await page.evaluate(() => {
    window.atlasCancelSave = false;
    window.atlasClose?.();
  });
  await dialog
    .getByRole("button", { name: "Speichern und fortfahren" })
    .click();
  await expect.poll(() => page.evaluate(() => window.atlasClosed)).toBe(true);
  expect(
    await page.evaluate(
      async () => (await window.atlasCore("status", {})).dirty,
    ),
  ).toBe(false);
});

test("clean document closes without prompting and dirty document can be discarded", async ({
  page,
}) => {
  await page.goto(editorUrl);
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => !!window.atlasClose)).toBe(true);
  await page.evaluate(() => window.atlasClose?.());
  await expect.poll(() => page.evaluate(() => window.atlasClosed)).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(async () =>
    window.atlasCore("commit", {
      version: await window.atlasCore("status", {}),
      intent: {
        type: "createHouse",
        parcelId: null,
        transform: { x: 0, y: 0, angle: 0 },
        width: 4,
        depth: 5,
      },
    }),
  );
  await page.reload();
  await showObjects(page);
  await expect(
    page.getByRole("button", { name: "⌂ Haus 1", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.atlasClose?.());
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Verwerfen", exact: true })
    .click();
  await expect.poll(() => page.evaluate(() => window.atlasClosed)).toBe(true);
});

test("rotated partial upper floor shows lower cells across tiles", async ({
  page,
}) => {
  await page.goto(editorUrl);
  await page.evaluate(async () => {
    const commit = async (intent: import("../../src/atlas/model").Intent) =>
      window.atlasCore("commit", {
        version: await window.atlasCore("status", {}),
        intent,
      });
    const house = await commit({
      type: "createHouse",
      parcelId: null,
      transform: { x: 0, y: 0, angle: 0.4 },
      width: 32,
      depth: 32,
    });
    const cells = Array.from({ length: 512 }, (_, i): [number, number] => [
      i % 16,
      Math.floor(i / 16),
    ]);
    await commit({
      type: "room",
      buildingId: house.objects[0].id,
      intent: { kind: "draw", floor: 1, cells },
    });
  });
  await page.reload();
  await selectObject(page, "⌂ Haus 1");
  await page.getByRole("button", { name: "Innen öffnen", exact: true }).click();
  await page.getByRole("button", { name: "Geschoss +", exact: true }).click();
  await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  await paintedReady(page);
  const pixels = () =>
    page
      .getByTestId("atlas-canvas")
      .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  const before = await pixels();
  const toggle = async (checked: boolean) => {
    await page.evaluate(() => {
      window.atlasCalls = [];
    });
    await page.getByLabel("Untere Geschosse anzeigen").setChecked(checked);
    await expect
      .poll(() =>
        page.evaluate(
          (enabled) =>
            window.atlasCalls.some(
              (c) =>
                c.cmd === "interiorTile" && c.args.includeLower === enabled,
            ),
          checked,
        ),
      )
      .toBe(true);
    await paintedReady(page);
  };
  await toggle(false);
  const after = await pixels();
  expect(after).not.toBe(before);
  await toggle(true);
  expect(await pixels()).toBe(before);
});

test("failed tile batches drain physical reads before releasing their slots", async ({
  page,
}) => {
  await page.goto(editorUrl);
  const setup = await page.evaluate(async () => {
    await window.atlasCore("commit", {
      version: await window.atlasCore("status", {}),
      intent: {
        type: "createHouse",
        parcelId: null,
        transform: { x: 0, y: 0, angle: 0 },
        width: 8,
        depth: 8,
      },
    });
    return {
      status: await window.atlasCore("status", {}),
      scene: await window.atlasCore("scene", {
        context: { kind: "exterior" },
        bounds: [-100, -100, 100, 100],
      }),
    };
  });
  const active = setup.scene.objects.find((o) => o.kind === "house")!.id;
  await page.goto(`${editorUrl}?presentation`);
  await page.evaluate(
    ({ status, active }) => {
      window.atlasTileBarrier = true;
      window.atlasPresentationSet({
        status,
        active,
        bounds: [-1000, -1000, 1000, 1000],
      });
    },
    { status: setup.status, active },
  );
  await expect
    .poll(() => page.evaluate(() => window.atlasTileReleases.length))
    .toBe(4);
  await page.evaluate(() => {
    window.atlasFailRead = "interiorTile";
    window.atlasTileReleases.shift()!();
  });
  await expect.poll(() => page.evaluate(() => window.atlasReadActive)).toBe(3);
  expect(await page.evaluate(() => window.atlasPresentation.error)).toBe("");
  await page.evaluate(() =>
    window.atlasPresentationSet({ bounds: [700, 0, 750, 50] }),
  );
  await expect.poll(() => page.evaluate(() => window.atlasReadMax)).toBe(4);
  await page.evaluate(() => {
    window.atlasTileBarrier = false;
    for (const release of window.atlasTileReleases.splice(0)) release();
  });
  await expect
    .poll(() => page.evaluate(() => window.atlasPresentation.fresh))
    .toBe(true);
  expect(await page.evaluate(() => window.atlasReadMax)).toBeLessThanOrEqual(4);
  await expect.poll(() => page.evaluate(() => window.atlasReadActive)).toBe(0);
});

test("presentation remount shares physical read slots with its predecessor", async ({
  page,
}) => {
  await page.goto(editorUrl);
  const setup = await page.evaluate(async () => {
    await window.atlasCore("commit", {
      version: await window.atlasCore("status", {}),
      intent: {
        type: "createHouse",
        parcelId: null,
        transform: { x: 0, y: 0, angle: 0 },
        width: 8,
        depth: 8,
      },
    });
    return {
      status: await window.atlasCore("status", {}),
      scene: await window.atlasCore("scene", {
        context: { kind: "exterior" },
        bounds: [-100, -100, 100, 100],
      }),
    };
  });
  const active = setup.scene.objects.find((o) => o.kind === "house")!.id;
  await page.goto(`${editorUrl}?presentation`);
  await page.evaluate(
    ({ status, active }) => {
      window.atlasTileBarrier = true;
      window.atlasPresentationSet({
        status,
        active,
        bounds: [-1000, -1000, 1000, 1000],
      });
    },
    { status: setup.status, active },
  );
  await expect
    .poll(() => page.evaluate(() => window.atlasTileReleases.length))
    .toBe(4);
  await page.evaluate(() => window.atlasUnmount?.());
  await expect(page.locator("output")).toHaveCount(0);
  await page.evaluate(() => window.atlasRemount?.());
  await expect(page.locator("output")).toBeVisible();
  await page.evaluate(
    ({ status, active }) => {
      window.atlasCalls = [];
      window.atlasPresentationSet({ status, active });
    },
    { status: setup.status, active },
  );
  await expect
    .poll(() => page.evaluate(() => window.atlasPresentation.loading))
    .toBe(true);
  expect(
    await page.evaluate(
      () => window.atlasCalls.filter((c) => c.cmd === "scene").length,
    ),
  ).toBe(0);
  await page.evaluate(() => {
    window.atlasTileBarrier = false;
    for (const release of window.atlasTileReleases.splice(0)) release();
  });
  await expect
    .poll(() => page.evaluate(() => window.atlasPresentation.fresh))
    .toBe(true);
  expect(await page.evaluate(() => window.atlasReadMax)).toBeLessThanOrEqual(4);
});
