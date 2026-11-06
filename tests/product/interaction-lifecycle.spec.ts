import { selectObject } from "../support/editor";
import { expect, test } from "../support/fixture";

import { url } from "../support/editor";

test("capture loss and blur cancel gestures; cancellation after enqueue preserves the commit", async ({
  page,
}) => {
  await page.goto(url);
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  await page.getByRole("button", { name: "Haus", exact: true }).click();
  const canvas = page.getByTestId("atlas-canvas");
  const box = (await canvas.boundingBox())!;
  const begin = async () => {
    await page.mouse.move(box.x + 200, box.y + 160);
    await page.mouse.down();
    await page.mouse.move(box.x + 250, box.y + 210);
    await expect
      .poll(() =>
        canvas.evaluate((c: HTMLCanvasElement) => c.hasPointerCapture(1)),
      )
      .toBe(true);
  };
  await page.evaluate(() => {
    window.atlasCalls = [];
  });
  await begin();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect
    .poll(() =>
      canvas.evaluate((c: HTMLCanvasElement) => c.hasPointerCapture(1)),
    )
    .toBe(false);
  await page.mouse.up();
  await begin();
  await canvas.evaluate((c: HTMLCanvasElement) => c.releasePointerCapture(1));
  await expect
    .poll(() =>
      canvas.evaluate((c: HTMLCanvasElement) => c.hasPointerCapture(1)),
    )
    .toBe(false);
  await page.mouse.up();
  expect(
    await page.evaluate(
      () => window.atlasCalls.filter((c) => c.cmd === "commit").length,
    ),
  ).toBe(0);
  await page.evaluate(() => {
    window.atlasHold = { cmd: "commit" };
  });
  await begin();
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await canvas.dispatchEvent("lostpointercapture", { pointerId: 1 });
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.atlasRelease!());
  await expect
    .poll(
      async () =>
        (
          await page.evaluate(() =>
            window.atlasCore("scene", {
              context: { kind: "exterior" },
              bounds: [-1000, -1000, 1000, 1000],
            }),
          )
        ).objects.length,
    )
    .toBe(1);
  expect(
    await page.evaluate(
      () => window.atlasCalls.filter((c) => c.cmd === "commit").length,
    ),
  ).toBe(1);
});

test("new waits for accepted edit and clears the replaced session selection", async ({
  page,
}) => {
  await page.goto(url);
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  await page.getByRole("button", { name: "Haus", exact: true }).click();
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  await page.evaluate(() => {
    window.atlasCalls = [];
    window.atlasHold = { cmd: "commit" };
  });
  await page.mouse.move(box.x + 200, box.y + 160);
  await page.mouse.down();
  await page.mouse.move(box.x + 250, box.y + 210);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await page.getByRole("button", { name: "Neu", exact: true }).click();
  expect(
    await page.evaluate(() => window.atlasCalls.some((c) => c.cmd === "new")),
  ).toBe(false);
  await page.evaluate(() => window.atlasRelease!());
  await expect(
    page.getByText("Änderungen vor dem Fortfahren speichern?"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Speichern und fortfahren" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.atlasCalls.some((c) => c.cmd === "new")),
    )
    .toBe(true);
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  const calls = await page.evaluate(() => window.atlasCalls.map((c) => c.cmd));
  expect(calls.indexOf("commit")).toBeLessThan(calls.indexOf("save"));
  expect(calls.indexOf("save")).toBeLessThan(calls.indexOf("new"));
  expect(
    (
      await page.evaluate(() =>
        window.atlasCore("scene", {
          context: { kind: "exterior" },
          bounds: [-1000, -1000, 1000, 1000],
        }),
      )
    ).objects,
  ).toHaveLength(0);
  await expect(
    page.getByRole("heading", { name: "Gebäude", exact: true }),
  ).toHaveCount(0);
});

test("held lower and floor reads keep pixels and readiness coherent", async ({
  page,
}) => {
  await page.goto(url);
  await page.evaluate(async () => {
    const commit = async (intent: import("../../src/atlas/model").Intent) =>
      window.atlasCore("commit", {
        version: await window.atlasCore("status", {}),
        intent,
      });
    const h = await commit({
      type: "createHouse",
      parcelId: null,
      transform: { x: 0, y: 0, angle: 0.4 },
      width: 32,
      depth: 32,
    });
    await commit({
      type: "room",
      buildingId: h.objects[0].id,
      intent: {
        kind: "draw",
        floor: 1,
        cells: Array.from({ length: 512 }, (_, i) => [
          i % 16,
          Math.floor(i / 16),
        ]),
      },
    });
  });
  await page.reload();
  await selectObject(page, "⌂ Haus 1");
  await page.getByRole("button", { name: "Innen öffnen" }).click();
  await page.getByRole("button", { name: "Geschoss +" }).click();
  await page.getByRole("button", { name: "Einpassen" }).click();
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  const canvas = page.getByTestId("atlas-canvas");
  const pixels = () => canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
  const original = await pixels();
  const toggle = page.getByLabel("Untere Geschosse anzeigen");
  await page.evaluate(() => {
    window.atlasHold = { cmd: "interiorTile" };
  });
  await toggle.uncheck();
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await expect(page.getByText("Ansicht wird geladen …")).toBeVisible();
  // A rendered frame while the read is held must still use the published lower mode.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(await pixels()).toBe(original);
  await page.evaluate(() => window.atlasRelease!());
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  const withoutLower = await pixels();
  expect(withoutLower).not.toBe(original);
  await page.evaluate(() => {
    window.atlasHold = { cmd: "interiorTile" };
  });
  await toggle.check();
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await expect(page.getByText("Ansicht wird geladen …")).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(await pixels()).toBe(withoutLower);
  await page.evaluate(() => window.atlasRelease!());
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  expect(await pixels()).toBe(original);
  await page.evaluate(() => {
    window.atlasHold = { cmd: "interiorTile", floor: 0 };
  });
  await page.getByRole("button", { name: "Geschoss −" }).click();
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await expect(page.getByText("Ansicht wird geladen …")).toBeVisible();
  await page.evaluate(() => window.atlasRelease!());
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  await page.getByRole("button", { name: "Geschoss +" }).click();
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  expect(await pixels()).toBe(original);
});

test("a newer interior gesture survives an older held commit", async ({
  page,
}) => {
  await page.goto(url);
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
  await page.getByRole("button", { name: "Innen öffnen" }).click();
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  await page.getByRole("button", { name: "Radieren", exact: true }).click();
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  await page.evaluate(() => {
    window.atlasCalls = [];
    window.atlasHold = { cmd: "commit" };
  });
  await page.mouse.click(box.x + 178, box.y + 138);
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await page.mouse.move(box.x + 194, box.y + 138);
  await page.mouse.down();
  await page.mouse.move(box.x + 210, box.y + 154);
  await page.evaluate(() => window.atlasRelease!());
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.atlasHook?.status?.revision ??
          window.atlasCalls.filter((c) => c.cmd === "interiorTile").length,
      ),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      page
        .getByTestId("atlas-canvas")
        .evaluate((c: HTMLCanvasElement) => c.hasPointerCapture(1)),
    )
    .toBe(true);
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.atlasCalls.filter((c) => c.cmd === "commit").length,
      ),
    )
    .toBe(2);
  const intents = await page.evaluate(() =>
    window.atlasCalls
      .filter((c) => c.cmd === "commit")
      .map((c) => c.args.intent),
  );
  if (intents[1].type !== "room" || intents[1].intent.kind !== "erase")
    throw Error("Expected room erase");
  expect(intents[1].intent.cells).toEqual([
    [2, 1],
    [3, 1],
    [2, 2],
    [3, 2],
  ]);
});

test("old deletion cannot clear a newer object selection", async ({ page }) => {
  await page.goto(url);
  await page.evaluate(async () => {
    for (const x of [0, 80])
      await window.atlasCore("commit", {
        version: await window.atlasCore("status", {}),
        intent: {
          type: "createHouse",
          parcelId: null,
          transform: { x, y: 0, angle: 0 },
          width: 4,
          depth: 4,
        },
      });
  });
  await page.reload();
  await selectObject(page, "⌂ Haus 1");
  await page.evaluate(() => {
    window.atlasHold = { cmd: "commit" };
  });
  await page.getByRole("button", { name: "Objekt löschen" }).click();
  await page
    .getByRole("button", { name: "Löschen bestätigen", exact: true })
    .click();
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  await selectObject(page, "⌂ Haus 2");
  await page.evaluate(() => window.atlasRelease!());
  await expect(page.getByLabel("Name")).toHaveValue("Haus 2");
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(false);
  await expect(page.getByLabel("Name")).toHaveValue("Haus 2");
});

test("a house gesture while scene data is missing is blocked without deferred commit", async ({
  page,
}) => {
  const { ready, scene, status } = await import("../support/editor");
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Haus", exact: true }).click();
  await ready(page);
  const before = await status(page);
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  await page.evaluate(() => {
    window.atlasHold = { cmd: "scene" };
  });
  await page.setViewportSize({ width: 1800, height: 1000 });
  await expect(page.getByText("Ansicht wird geladen …")).toBeVisible();
  await page.mouse.move(box.x + 200, box.y + 160);
  await page.mouse.down();
  await page.mouse.move(box.x + 264, box.y + 224);
  await page.mouse.up();
  expect((await status(page)).revision).toBe(before.revision);
  expect((await scene(page)).objects).toEqual([]);
  await page.evaluate(() => window.atlasRelease?.());
  await ready(page);
  expect(
    await page.evaluate(
      () =>
        window.atlasCalls.filter(
          (c) => c.cmd === "commit" || c.cmd === "preview",
        ).length,
    ),
  ).toBe(0);
  expect((await status(page)).revision).toBe(before.revision);
});
