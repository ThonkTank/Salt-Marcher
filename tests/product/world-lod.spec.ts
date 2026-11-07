import { test, expect } from "../support/fixture";
import {
  ready,
  settled,
  paintedReady,
  status,
  url,
  calls,
  selectRoom,
  metadata,
} from "../support/editor";

test("world land, region-category settlement and local refinement roundtrip", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.goto(url);
  await ready(page);
  await page.getByLabel("Ansichtsmaßstab").selectOption({ label: "Welt" });
  await paintedReady(page);
  await expect(page.locator(".atlas-map-title")).toContainText("Welt");
  await expect(page.locator(".atlas-scale")).toContainText("km");
  await page.getByRole("button", { name: "Höhen", exact: true }).click();
  await paintedReady(page);
  await expect(page.getByLabel("Pinselmodus")).toHaveValue("land");
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  const p = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const revision = (await status(page)).revision;
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 35, p.y + 20, { steps: 6 });
  await page.mouse.up();
  await expect
    .poll(async () => (await status(page)).revision)
    .toBeGreaterThan(revision);
  await ready(page);
  const edits = await calls(page, "beginTerrainStroke");
  expect(edits).toHaveLength(1);
  expect(edits[0].args.view?.level).toBeGreaterThan(15);
  await page.screenshot({ path: info.outputPath("world.png") });
  await page.getByLabel("Ansichtsmaßstab").selectOption({ label: "Stadt" });
  await paintedReady(page);
  await page.getByRole("button", { name: "Regionen", exact: true }).click();
  await paintedReady(page);
  await page
    .getByLabel("Kategorie", { exact: true })
    .selectOption({ label: "Ortschaften" });
  await page
    .getByLabel("Rangstufe", { exact: true })
    .selectOption({ label: "Stadt" });
  await page.getByLabel("Name der neuen Region").fill("Salzmarsch");
  await page.getByRole("button", { name: "Neue Region", exact: true }).click();
  await expect(page.getByLabel("Regionsname")).toHaveValue("Salzmarsch");
  await ready(page);
  const beforeRegion = (await status(page)).revision;
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 20, p.y, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(async () => (await status(page)).revision)
    .toBe(beforeRegion + 1);
  await ready(page);
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  await page.getByLabel("Ansichtsmaßstab").selectOption({ label: "Umland" });
  await paintedReady(page);
  await page.screenshot({ path: info.outputPath("settlement-region.png") });
  await page
    .getByLabel("Ansichtsmaßstab")
    .selectOption({ label: "Grundstück" });
  await paintedReady(page);
  await page.getByRole("button", { name: "Höhen", exact: true }).click();
  await paintedReady(page);
  await page.getByLabel("Pinselmodus").selectOption("raise");
  const beforeDetail = (await status(page)).revision;
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 20, p.y + 10, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(async () => (await status(page)).revision)
    .toBeGreaterThan(beforeDetail);
  await settled(page);
  await page.getByRole("button", { name: "Haus", exact: true }).click();
  await paintedReady(page);
  await page.mouse.move(p.x + 50, p.y + 50);
  await page.mouse.down();
  await page.mouse.move(p.x + 110, p.y + 110, { steps: 5 });
  await page.mouse.up();
  await settled(page);
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  await page.getByRole("button", { name: "Innen öffnen", exact: true }).click();
  await ready(page);
  const house = (
    await page.evaluate(() =>
      window.atlasCore("scene", {
        context: { kind: "exterior" },
        bounds: [-1e8, -1e8, 1e8, 1e8],
      }),
    )
  ).objects.find((o) => o.kind === "house")!;
  await selectRoom(page, house.id);
  await page.getByLabel("Raumname", { exact: true }).fill("Stube am Meer");
  await page.getByLabel("Raumname", { exact: true }).blur();
  await expect
    .poll(async () =>
      (await metadata(page, house.id)).rooms.some(
        (r) => r.name === "Stube am Meer",
      ),
    )
    .toBe(true);
  await ready(page);
  await page.getByRole("button", { name: "Zur Atlasansicht" }).click();
  await ready(page);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect.poll(async () => (await status(page)).dirty).toBe(false);
  const snapshot = await page.evaluate(async () =>
    window.atlasCore("regions", {
      version: await window.atlasCore("status", {}),
      bounds: null,
      ids: [],
      rankIds: [],
      detail: null,
      scale: 1,
      exact: false,
    }),
  );
  expect(snapshot.summaries.some((r) => r.name === "Salzmarsch")).toBe(true);
  await page.getByRole("button", { name: "Öffnen", exact: true }).click();
  await ready(page);
  await page.getByLabel("Ansichtsmaßstab").selectOption({ label: "Welt" });
  await paintedReady(page);
  expect((await status(page)).dirty).toBe(false);
  expect(
    (await metadata(page, house.id)).rooms.some(
      (r) => r.name === "Stube am Meer",
    ),
  ).toBe(true);
});
