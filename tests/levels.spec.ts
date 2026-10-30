import { test, expect } from "@playwright/test";
import { files } from "./files";
import fixture from "./fixtures/v3-valid.json" with { type: "json" };
import { Atlas } from "../src/model";
test("floors, names, ordering, deletion, cancellation and saved state", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:1420");
  await files(page);
  const canvas = page.getByTestId("map-canvas"),
    r = (await canvas.boundingBox())!;
  await page.mouse.click(r.x + 176, r.y + 136);
  await expect(page.locator(".room-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByLabel("Gespeichert", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Geschoss hinzufügen", exact: true })
    .click();
  await expect(page.locator(".level-row")).toHaveCount(2);
  await expect(page.locator(".room-row")).toHaveCount(0);
  await page.mouse.click(r.x + 176, r.y + 136);
  await expect(page.locator(".room-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Geschoss umbenennen" }).click();
  await page.getByLabel("Geschossname").fill("Obergeschoss");
  await page
    .getByRole("button", { name: "Name übernehmen", exact: true })
    .click();
  await page.getByLabel("Unteres Geschoss", { exact: true }).check();
  await page.getByRole("button", { name: "Geschoss nach unten" }).click();
  await expect(page.locator(".level-row").last()).toHaveText("Obergeschoss");
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(page.locator(".level-row").first()).toHaveText("Obergeschoss");
  await page.keyboard.press("PageDown");
  await expect(page.locator(".map-heading")).toHaveText("Erdgeschoss");
  await page.mouse.move(r.x + 240, r.y + 200);
  await page.mouse.down();
  await page.mouse.move(r.x + 340, r.y + 280);
  await page.keyboard.press("PageUp");
  await page.mouse.up();
  await expect(page.locator(".map-heading")).toHaveText("Obergeschoss");
  await expect(page.locator("footer")).toContainText("1 Zellen");
  await page
    .getByRole("button", { name: "Geschoss löschen", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("1 Räumen");
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(page.locator(".level-row")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Geschoss löschen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Geschoss endgültig löschen" })
    .click();
  await expect(page.locator(".level-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(page.locator(".level-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  const saved = await page.evaluate(
    () => (window as any).__saved.at(-1).document,
  );
  expect(Object.keys(saved).sort()).toEqual(["gridFeet", "levels", "version"]);
  expect(saved.version).toBe(3);
  expect(saved.levels.map((l: any) => Object.keys(l.cells))).toEqual([
    ["0,0"],
    ["0,0"],
  ]);
  await page.keyboard.press("PageUp");
  await page.mouse.move(r.x + 400, r.y + 350);
  await page.mouse.wheel(0, -200);
  await expect(page.getByLabel("Gespeichert", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/atlas-2d.png" });
});
test("open/save, canceled or failed saves, and dirty document protection", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:1420");
  await files(page, fixture as Atlas);
  await page.getByRole("button", { name: "Öffnen", exact: true }).click();
  await expect(page.locator(".level-row")).toHaveCount(2);
  await expect(page.locator(".room-row")).toContainText("Halle");
  await page.getByRole("button", { name: "Halle 2 Rasterzellen" }).click();
  await page.getByLabel("Raumname", { exact: true }).fill("Bibliothek");
  await page.getByRole("button", { name: "Name übernehmen" }).click();
  await page.getByRole("button", { name: "Neu", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveText(/Ungespeicherte/);
  await page.evaluate(() => {
    (window as any).__saveResult = null;
  });
  await page.getByRole("button", { name: "Speichern und fortfahren" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => (window as any).__newCount)).toBe(0);
  await page.evaluate(() => {
    (window as any).__saveError = "Test: Schreibfehler";
  });
  await page.getByRole("button", { name: "Speichern und fortfahren" }).click();
  await expect(page.getByRole("alert")).toContainText("Schreibfehler");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(page.locator(".room-row")).toContainText("Bibliothek");
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(page.getByLabel("Gespeichert", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await page.evaluate(() => {
    delete (window as any).__saveError;
    (window as any).__saveResult = "Atlas.saltatlas.json";
  });
  await page
    .getByRole("button", { name: "Speichern unter …", exact: true })
    .click();
  expect(await page.evaluate(() => (window as any).__saved.at(-1).saveAs)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Neu", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".level-row")).toHaveCount(1);
  await expect(page.locator(".room-row")).toHaveCount(0);
});
