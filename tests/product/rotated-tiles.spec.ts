import { selectObject } from "../support/editor";
import { ready } from "../support/editor";
import { expect, test } from "../support/fixture";

// Exercise tile-boundary rendering at both supported test DPRs.
// Settle each navigation step before observing the next view; transition races
// are exercised separately in the held-read lifecycle tests.
for (const dpr of [1, 2]) {
  test.describe(`Rotated tiles DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });
    for (const width of [64, 128]) {
      test(`rotated partial upper floor ${width}`, async ({ page }) => {
        await page.goto("http://127.0.0.1:1420/tests/support/atlas.html");
        await page.evaluate(async (width) => {
          const commit = async (intent: object) =>
            window.atlasCore<{ objects: { id: string }[] }>("commit", {
              version: await window.atlasCore("status", {}),
              intent,
            });
          const house = await commit({
            type: "createHouse",
            parcelId: null,
            transform: { x: 0, y: 0, angle: 0.4 },
            width,
            depth: width,
          });
          const cells = Array.from({ length: (width * width) / 2 }, (_, i) => [
            i % (width / 2),
            Math.floor(i / (width / 2)),
          ]);
          await commit({
            type: "room",
            buildingId: house.objects[0].id,
            intent: { kind: "draw", floor: 1, cells },
          });
        }, width);
        await page.reload();
        await selectObject(page, "⌂ Haus 1");
        await ready(page);
        await page
          .getByRole("button", { name: "Innen öffnen", exact: true })
          .click();
        await ready(page);
        await page
          .getByRole("button", { name: "Geschoss +", exact: true })
          .click();
        await ready(page);
        await page
          .getByRole("button", { name: "Einpassen", exact: true })
          .click();
        await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
        const before = await page
          .getByTestId("atlas-canvas")
          .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
        await page.getByLabel("Untere Geschosse anzeigen").uncheck();
        await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
        await expect
          .poll(() =>
            page
              .getByTestId("atlas-canvas")
              .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL()),
          )
          .not.toBe(before);
      });
    }
  });
}

test("rotated wall crossing fixed tile boundary", async ({ page }) => {
  await page.goto("http://127.0.0.1:1420/tests/support/atlas.html");
  await page.evaluate(async () => {
    const commit = async (intent: object) =>
      window.atlasCore<{ objects: { id: string }[] }>("commit", {
        version: await window.atlasCore("status", {}),
        intent,
      });
    const house = await commit({
      type: "createHouse",
      parcelId: null,
      transform: { x: 0, y: 0, angle: 0.4 },
      width: 64,
      depth: 64,
    });
    const cells = Array.from({ length: 64 * 32 }, (_, i) => [
      (i % 64) - 32,
      Math.floor(i / 64),
    ]);
    await commit({
      type: "room",
      buildingId: house.objects[0].id,
      intent: { kind: "draw", floor: 1, cells },
    });
  });
  await page.reload();
  await selectObject(page, "⌂ Haus 1");
  await ready(page);
  await page.getByRole("button", { name: "Innen öffnen", exact: true }).click();
  await ready(page);
  await page.getByRole("button", { name: "Geschoss +", exact: true }).click();
  await ready(page);
  await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
});
