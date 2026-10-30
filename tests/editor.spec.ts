import { test, expect } from "@playwright/test";
test("draw, merge, split, assign and undo on the actual canvas", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:1420");
  const canvas = page.getByTestId("map-canvas");
  const box = (await canvas.boundingBox())!;
  const point = (x: number, y: number) => ({
    x: box.x + 160 + x * 32 + 16,
    y: box.y + 120 + y * 32 + 16,
  });
  async function drag(x: number, y: number, ex: number, ey: number) {
    const a = point(x, y),
      b = point(ex, ey);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 10 });
    await page.mouse.up();
  }
  await drag(0, 0, 2, 2);
  await expect(page.locator(".room-row")).toHaveCount(1);
  await drag(3, 0, 5, 2);
  await expect(page.locator(".room-row")).toHaveCount(2);
  await drag(2, 1, 3, 1);
  await expect(page.locator(".room-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Radieren", exact: true }).click();
  await drag(2, 0, 2, 2);
  await expect(page.locator(".room-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Auswählen", exact: true }).click();
  const p = point(0, 0);
  await page.mouse.click(p.x, p.y);
  await page
    .getByRole("button", { name: "Raum zuweisen", exact: true })
    .click();
  await page.getByLabel("Zuweisen zu").selectOption("new");
  await page.getByLabel("Name des neuen Raums").fill("Eingangshalle");
  await page.getByRole("button", { name: "Zuordnung übernehmen" }).click();
  await expect(page.locator(".room-row")).toContainText([
    "Raum",
    "Eingangshalle",
  ]);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(
    page.locator(".room-row").filter({ hasText: "Eingangshalle" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await expect(
    page.locator(".room-row").filter({ hasText: "Eingangshalle" }),
  ).toHaveCount(1);
  await page.screenshot({ path: "test-results/atlas-editor.png" });
  await page.getByRole("button", { name: "Neu", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(page.locator(".room-row")).toHaveCount(2);
  expect(errors).toEqual([]);
});
test("escape cancels a gesture and zoom/pan preserve cell alignment", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:1420");
  const box = (await page.getByTestId("map-canvas").boundingBox())!;
  await page.mouse.move(box.x + 180, box.y + 140);
  await page.mouse.down();
  await page.mouse.move(box.x + 280, box.y + 240);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator(".room-row")).toHaveCount(0);
  await page.keyboard.down("Space");
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 164, box.y + 164);
  await page.mouse.up();
  await page.keyboard.up("Space");
  await page.mouse.click(box.x + 160 + 64 + 16, box.y + 120 + 64 + 16);
  await expect(page.locator(".room-row")).toContainText(["1 Rasterzellen"]);
  await page.mouse.wheel(0, -300);
  await expect(page.locator(".zoom-value")).not.toHaveText("100%");
  await page.getByRole("button", { name: "Karte einpassen" }).click();
  await expect(page.locator(".room-row")).toHaveCount(1);
});
