import { test, expect } from "../support/fixture";
import {
  url,
  ready,
  clickWorld,
  screen,
  scene,
  status,
  calls,
  dragWorld,
} from "../support/editor";
import type { Preview, Parcel, Road } from "../../src/atlas/model";
import { parcelHandles } from "../../src/atlas/parcelPlanning";
async function rightClick(page: import("@playwright/test").Page) {
  const q = await screen(page, [100, 0]);
  await page.mouse.click(q.x, q.y, { button: "right" });
}
test("mouse road planning edits and excludes parcels, commits once and undoes together", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Straße", exact: true }).click();
  await page.getByLabel("Rauheit", { exact: true }).fill("0");
  await page.getByLabel("Rauheit", { exact: true }).press("Enter");
  await expect(page.getByLabel("Bebauung", { exact: true })).toHaveValue(
    "houses",
  );
  await expect(
    page.locator(".atlas-tools input,.atlas-tools select"),
  ).toHaveCount(0);
  await clickWorld(page, [0, 0]);
  await clickWorld(page, [160, 0]);
  await expect
    .poll(async () => (await calls(page, "preview")).length)
    .toBeGreaterThan(0);
  let preview: Preview;
  await expect
    .poll(async () => {
      const last = (await calls(page, "preview")).at(-1)!;
      preview = await page.evaluate(
        (args) => window.atlasCore("preview", args),
        last.args,
      );
      return (
        preview.valid &&
        preview.objects.filter((o) => o.kind === "parcel").length
      );
    })
    .toBeGreaterThan(1);
  const objects = preview!.valid ? preview!.objects : [];
  const parcels = objects.filter((o): o is Parcel => o.kind === "parcel");
  const road = objects.find((o): o is Road => o.kind === "road")!;
  const p = parcels.find((p) => p.frame.y > 0)!;
  await clickWorld(page, [p.frame.x, p.frame.y + 10]);
  await expect(
    page.getByRole("heading", { name: "Parzelle", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Übernehmen", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Abbrechen", exact: true }),
  ).toBeInViewport();
  const handle = parcelHandles(p, road).find((h) => h.kind === "depth")!;
  await dragWorld(page, handle.point, [handle.point[0], handle.point[1] - 5]);
  await expect
    .poll(async () => {
      const intent = (await calls(page, "preview")).at(-1)?.args.intent;
      return (
        intent?.type === "createRoad" &&
        intent.population?.layout?.some((p) => p.depth === 45)
      );
    })
    .toBe(true);
  await page.getByLabel("Parzelle auslassen").check();
  await page.getByLabel("Parzelle auslassen").uncheck();
  await page.getByLabel("Parzelle auslassen").check();
  await page.getByRole("button", { name: "← Zur Straßenplanung" }).click();
  await expect(page.getByText(/Ausgelassene Parzellen/)).toBeVisible();
  // Capture the completed candidate, not a timing-dependent older preview.
  await expect(page.getByRole("status", { name: "Aktionsstatus" })).toBeEmpty();
  await page.screenshot({ path: test.info().outputPath("road-plan-1440.png") });
  await rightClick(page);
  await expect.poll(async () => (await status(page)).revision).toBe(1);
  const committed = (await scene(page)).objects;
  expect(committed.filter((o) => o.kind === "parcel")).toHaveLength(
    parcels.length - 1,
  );
  expect(committed.some((o) => o.kind === "house")).toBe(true);
  expect(await calls(page, "commit")).toHaveLength(1);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect.poll(async () => (await scene(page)).objects.length).toBe(0);
});

test("right click commits fixed points while preview is held and ignores mouse ghost", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Straße", exact: true }).click();
  await page.getByLabel("Rauheit", { exact: true }).fill("0");
  await page.getByLabel("Rauheit", { exact: true }).press("Enter");
  await page.getByLabel("Bebauung", { exact: true }).selectOption("parcels");
  await clickWorld(page, [0, 0]);
  await page.evaluate(() => {
    window.atlasHold = { cmd: "preview" };
  });
  await clickWorld(page, [150, 0]);
  await expect.poll(() => page.evaluate(() => !!window.atlasHeld)).toBe(true);
  const ghost = await screen(page, [160, 60]);
  await page.mouse.move(ghost.x, ghost.y);
  await page.mouse.click(ghost.x, ghost.y, { button: "right" });
  await expect.poll(async () => (await status(page)).revision).toBe(1);
  await page.evaluate(() => window.atlasRelease?.());
  const objects = (await scene(page)).objects;
  const road = objects.find((o): o is Road => o.kind === "road")!;
  expect(road.nodes.map((n) => n.point)).toEqual([
    [0, 0],
    [150, 0],
  ]);
  expect(objects.some((o) => o.kind === "parcel")).toBe(true);
  expect(objects.some((o) => o.kind === "house")).toBe(false);
  await rightClick(page);
  expect(await calls(page, "commit")).toHaveLength(1);
});

test("compact controls fit a small window and cancel an incomplete road", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 620 });
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Straße", exact: true }).click();
  await expect(page.getByLabel("Bebauung", { exact: true })).toBeInViewport();
  await expect(
    page.getByText("Bebauungsdetails", { exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath("controls-900.png") });
  await page.getByText("Bebauungsdetails", { exact: true }).click();
  await page.getByLabel("Bebauung", { exact: true }).selectOption("none");
  await expect(page.getByText("Bebauungsdetails", { exact: true })).toHaveCount(
    0,
  );
  await clickWorld(page, [0, 0]);
  await rightClick(page);
  expect((await scene(page)).objects).toHaveLength(0);
});

test("existing parcel handles reject a house cut and preserve the document", async ({
  page,
}) => {
  const { seedParcels, selectObject, paintedReady } =
    await import("../support/editor");
  await page.goto(url);
  const { parcel } = await seedParcels(page);
  await page.reload();
  await ready(page);
  await page
    .getByLabel("Ansichtsmaßstab")
    .selectOption({ label: "Grundstück" });
  await paintedReady(page);
  await selectObject(page, "▱ Parzelle");
  await ready(page);
  const before = await scene(page),
    road = before.objects.find((o): o is Road => o.kind === "road")!;
  const handle = parcelHandles(parcel, road).find((h) => h.kind === "depth")!;
  await dragWorld(page, handle.point, [handle.point[0], parcel.frame.y + 5]);
  await expect
    .poll(async () =>
      (await calls(page, "commit")).some(
        (c) => c.args.intent.type === "updateParcel",
      ),
    )
    .toBe(true);
  await expect(page.locator(".atlas-status")).not.toContainText(
    "Änderung wird übernommen",
  );
  expect((await status(page)).revision).toBe(before.status.revision);
  expect((await scene(page)).objects).toEqual(before.objects);
});
