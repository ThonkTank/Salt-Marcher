import { expect, test } from "../support/fixture";
import {
  calls,
  commit,
  paintedReady,
  ready,
  screen,
  settled,
  status,
  url,
} from "../support/editor";

for (const mode of ["mountains", "hills", "canyon"] as const) {
  test(`${mode}: physical preset, live relief and whole-stroke history`, async ({
    page,
  }) => {
    await page.goto(url);
    await ready(page);
    // A flat land base makes both positive relief and a flooded canyon observable.
    await commit(page, {
      type: "terrainStroke",
      brush: {
        resolution: mode === "mountains" ? 12 : mode === "hills" ? 8 : 7,
        mode: "land",
        radius:
          mode === "mountains" ? 300000 : mode === "hills" ? 20000 : 10000,
        amount: 1,
        strength: 1,
        target: 10,
        points: [[0, 0]],
      },
    });
    await page.reload();
    await ready(page);
    await page.getByRole("button", { name: "Höhen", exact: true }).click();
    await page.getByLabel("Ansichtsmaßstab").selectOption({ label: "Welt" });
    await page.getByLabel("Höhenlinien").uncheck();
    await page.getByLabel("Pinselmodus").selectOption(mode);
    await paintedReady(page);
    const canvas = page.getByTestId("atlas-canvas");
    const pixels = () =>
      canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
    const initial = await pixels();
    const revision = (await status(page)).revision;
    const p = await screen(page, [0, 0]);
    await page.mouse.move(p.x - 150, p.y);
    await page.mouse.down();
    // No wait for Begin: an ordinary continuous pointer movement.
    await page.mouse.move(p.x, p.y - 35, { steps: 18 });
    await expect
      .poll(async () => (await status(page)).revision)
      .toBeGreaterThan(revision + 1);
    await paintedReady(page);
    const middle = await pixels();
    expect(middle).not.toBe(initial);
    await page.mouse.move(p.x + 150, p.y + 20, { steps: 18 });
    await page.mouse.up();
    await settled(page);
    await paintedReady(page);
    const after = await pixels();
    expect(after).not.toBe(middle);
    const begins = await calls(page, "beginTerrainStroke");
    expect(begins).toHaveLength(1);
    const finishedRevision = (await status(page)).revision;
    await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
    await paintedReady(page);
    await expect
      .poll(async () => (await status(page)).revision)
      .toBeGreaterThan(finishedRevision);
    await paintedReady(page);
    expect((await pixels()) === initial).toBe(true);
    await page
      .getByRole("button", { name: "Wiederholen", exact: true })
      .click();
    await paintedReady(page);
    await expect
      .poll(async () => (await status(page)).revision)
      .toBeGreaterThan(finishedRevision + 1);
    await paintedReady(page);
    expect((await pixels()) === after).toBe(true);
    await page.getByLabel("Geländegröße").selectOption("0");
    await expect(page.getByLabel("Breite (Meter)")).toHaveValue(
      mode === "mountains" ? "6000" : mode === "hills" ? "800" : "200",
    );
    await page.getByRole("button", { name: "Gewässer", exact: true }).click();
    await expect(page.getByLabel("Pinselgröße (Pixel)")).toHaveValue("80");
    await page.getByRole("button", { name: "Höhen", exact: true }).click();
    await page.getByLabel("Pinselmodus").selectOption("land");
    await expect(page.getByLabel("Pinselgröße (Pixel)")).toHaveValue("80");
  });
}
