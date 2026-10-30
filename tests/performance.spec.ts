import { test, expect } from "@playwright/test";
import { addLevel, draw, emptyAtlas, rectangle } from "../src/model";
import { files } from "./files";
test("10,000 cells: idle drawing stops and navigation keeps document references", async ({
  page,
}) => {
  let a = emptyAtlas();
  for (let i = 0; i < 3; i++) {
    if (i) a = addLevel(a, a.levels.at(-1)!.id);
    a = draw(a, a.levels.at(-1)!.id, rectangle("0,0", "49,65"));
  }
  a = draw(a, a.levels[2].id, rectangle("0,65", "49,67"));
  expect(a.levels.reduce((n, l) => n + Object.keys(l.cells).length, 0)).toBe(
    10000,
  );
  await page.addInitScript(() => {
    const w = window as any;
    w.__fills = 0;
    const original = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (
      ...args: Parameters<typeof original>
    ) {
      w.__fills++;
      return original.apply(this, args);
    };
  });
  await page.goto("http://127.0.0.1:1420");
  await files(page, a);
  await page.getByRole("button", { name: "Öffnen", exact: true }).click();
  await page.getByRole("button", { name: "Karte einpassen" }).click();
  await page.waitForTimeout(300);
  const first = await page.evaluate(() => (window as any).__fills);
  expect(first).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__fills)).toBe(first);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  const r = (await page.getByTestId("map-canvas").boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(r.x + r.width / 2 + 100, r.y + r.height / 2 + 50, {
    steps: 10,
  });
  await page.mouse.up({ button: "middle" });
  await page.mouse.wheel(0, -200);
  await page.keyboard.press("PageUp");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  expect(
    await page.evaluate(() => {
      const s = (window as any).__saved;
      return s[0].document === s[1].document;
    }),
  ).toBe(true);
  await page.screenshot({ path: "test-results/atlas-10000-cells.png" });
});
