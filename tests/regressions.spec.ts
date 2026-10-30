import { test, expect } from "@playwright/test";
import { files } from "./files";
import { Atlas } from "../src/model";

for (const key of ["Home", "f"])
  test(`${key} cannot change the view during drawing`, async ({ page }) => {
    await page.goto("http://127.0.0.1:1420");
    const r = (await page.getByTestId("map-canvas").boundingBox())!;
    const point = (x: number, y: number) => ({
      x: r.x + 160 + x * 32 + 16,
      y: r.y + 120 + y * 32 + 16,
    });
    const start = point(0, 0),
      end = point(2, 2);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y);
    await page.mouse.up();
    // Retain a real room selection so F tests selection fitting, too.
    await page.locator(".room-row").click();
    await page.keyboard.press("r");
    const a = point(10, 10),
      b = point(12, 12);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y);
    await expect(page.locator(".drawing-preview")).toHaveText("9 Rasterzellen");
    await page.keyboard.press(key);
    await expect(page.locator(".zoom-value")).toHaveText("100%");
    await page.mouse.up();
    await expect(page.locator("footer")).toContainText("18 Zellen");
    await expect(page.locator(".room-row")).toHaveCount(2);
    // Ignored requests must not run later when the gesture ends.
    await expect(page.locator(".zoom-value")).toHaveText("100%");
    await page.keyboard.press(key);
    await expect(page.locator(".zoom-value")).not.toHaveText("100%");
  });

test("opening a distant map activates and fits its first occupied floor", async ({
  page,
}) => {
  const a: Atlas = {
    version: 3,
    gridFeet: 5,
    levels: [
      { id: "empty", name: "Leer", rooms: [], cells: {} },
      {
        id: "upper",
        name: "Turm",
        rooms: [{ id: "room", name: "Ferne Halle" }],
        cells: { "10000,-10000": "room" },
      },
    ],
  };
  await page.goto("http://127.0.0.1:1420");
  await files(page, a);
  await page.getByRole("button", { name: "Öffnen", exact: true }).click();
  await expect(page.locator(".map-heading")).toHaveText("Turm");
  await expect(page.locator(".zoom-value")).toHaveText("400%");
  // The room must actually be drawn inside the viewport, not just listed.
  expect(
    await page.getByTestId("map-canvas").evaluate((node: HTMLCanvasElement) => {
      const pixels = node
        .getContext("2d")!
        .getImageData(0, 0, node.width, node.height).data;
      let floor = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i] === 248 && pixels[i + 1] === 245 && pixels[i + 2] === 233)
          floor++;
      return floor;
    }),
  ).toBeGreaterThan(1000);
  await expect(page.getByLabel("Gespeichert", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Rückgängig", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  expect(
    await page.evaluate(() => (window as any).__saved[0].document),
  ).toEqual(a);
});

test("unchanged preview and release reuse the same proposed room", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:1420");
  await files(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__newIds = [];
    const original = crypto.randomUUID.bind(crypto);
    crypto.randomUUID = () => {
      const id = original();
      w.__newIds.push(id);
      return id;
    };
  });
  const r = (await page.getByTestId("map-canvas").boundingBox())!,
    x = r.x + 176,
    y = r.y + 136;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 4, y + 4, { steps: 8 });
  expect(await page.evaluate(() => (window as any).__newIds.length)).toBe(1);
  await page.mouse.up();
  expect(await page.evaluate(() => (window as any).__newIds.length)).toBe(1);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  expect(
    await page.evaluate(() => {
      const w = window as any;
      return w.__saved[0].document.levels[0].rooms[0].id === w.__newIds[0];
    }),
  ).toBe(true);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(page.locator(".room-row")).toHaveCount(0);
});

test("retracing an eraser stroke reuses its preview and creates one undo step", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:1420");
  const r = (await page.getByTestId("map-canvas").boundingBox())!;
  const x = r.x + 176,
    y = r.y + 136;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 64, y);
  await page.mouse.up();
  await page.keyboard.press("e");
  await page.evaluate(() => {
    const w = window as any;
    w.__paint = 0;
    const original = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (
      ...args: Parameters<typeof original>
    ) {
      w.__paint++;
      return original.apply(this, args);
    };
  });
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 64, y);
  await expect(page.locator(".drawing-preview")).toHaveText("3 Rasterzellen");
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const paint = await page.evaluate(() => (window as any).__paint);
  await page.mouse.move(x + 32, y);
  await page.mouse.move(x + 64, y);
  expect(await page.evaluate(() => (window as any).__paint)).toBe(paint);
  await page.mouse.up();
  await expect(page.locator(".room-row")).toHaveCount(0);
  await page.keyboard.press("Control+z");
  await expect(page.locator("footer")).toContainText("3 Zellen");
});
