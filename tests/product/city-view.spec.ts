import { expect, test } from "../support/fixture";
import {
  calls,
  clearCalls,
  clickWorld,
  ready,
  seedHouse,
  showObjects,
  url,
} from "../support/editor";

test("city overview loads tiles, keeps navigation and returns to exact editing", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await seedHouse(page);
  await page.reload();
  await ready(page);
  const canvas = page.getByTestId("atlas-canvas"),
    box = (await canvas.boundingBox())!;
  await clearCalls(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 1600);
  await expect(
    page.getByRole("button", { name: "Zum Bearbeiten hineinzoomen" }),
  ).toBeVisible();
  await expect
    .poll(async () => (await calls(page, "mapTiles")).length)
    .toBeGreaterThan(0);
  await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
  await clearCalls(page);
  await page.mouse.click(box.x + 100, box.y + 100);
  expect(await calls(page, "commit")).toHaveLength(0);
  await page
    .getByRole("button", { name: "Zum Bearbeiten hineinzoomen" })
    .click();
  await ready(page);
  await expect
    .poll(async () => (await calls(page, "scene")).length)
    .toBeGreaterThan(0);
});

test("important place is editable and survives history and reopen", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  const { id } = await seedHouse(page);
  await page.reload();
  await ready(page);
  await showObjects(page);
  // Select by the stable object id's current name through the existing browser.
  await clickWorld(page, [10, 10]);
  const mark = page.getByRole("checkbox", { name: "Wichtiger Ort" });
  await expect(mark).toBeVisible();
  await mark.click();
  await expect(mark).toBeChecked();
  await expect
    .poll(async () =>
      page.evaluate(async (id) => {
        const scene = await window.atlasCore("scene", {
          context: { kind: "exterior" },
          bounds: [0, 0, 100, 100],
        });
        const object = scene.objects.find((o) => o.id === id);
        return object?.kind === "house" && object.importantPlace;
      }, id),
    )
    .toBe(true);
  await page.getByTestId("atlas-canvas").focus();
  await page.keyboard.press("Control+z");
  await expect(mark).not.toBeChecked();
  await page.keyboard.press("Control+Shift+z");
  await expect(mark).toBeChecked();
  await page.keyboard.press("Control+s");
  await expect
    .poll(() =>
      page.evaluate(async () => (await window.atlasCore("status", {})).dirty),
    )
    .toBe(false);
  await page.evaluate(() => window.atlasCore("open", {}));
  await page.reload();
  await ready(page);
  await clickWorld(page, [10, 10]);
  await expect(
    page.getByRole("checkbox", { name: "Wichtiger Ort" }),
  ).toBeChecked();
});
