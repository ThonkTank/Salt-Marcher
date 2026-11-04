import { test, expect } from "../support/fixture";
import {
  ready,
  url,
  dragWorld,
  status,
  scene,
  calls,
  clickWorld,
  commit,
} from "../support/editor";

test("landscape stroke previews, commits once, cancels, undoes and deletes", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Landschaft", exact: true }).click();
  await expect(page.getByLabel("Landschaftsart")).toHaveValue("forest");
  await dragWorld(page, [20, 30], [80, 40], false);
  await expect
    .poll(async () =>
      (await calls(page, "preview")).some(
        (c) => (c.args.intent as { type?: string })?.type === "sceneryStroke",
      ),
    )
    .toBe(true);
  expect((await status(page)).revision).toBe(0);
  await page.mouse.up();
  await expect.poll(async () => (await status(page)).revision).toBe(1);
  await ready(page);
  const painted = (await scene(page)).objects;
  expect(painted).toHaveLength(1);
  expect(painted[0].kind).toBe("scenery");
  expect(
    (await calls(page, "commit")).filter(
      (c) => (c.args.intent as { type?: string })?.type === "sceneryStroke",
    ),
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await ready(page);
  await expect.poll(async () => (await scene(page)).objects.length).toBe(0);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await ready(page);
  await expect.poll(async () => (await scene(page)).objects).toEqual(painted);
  const revision = (await status(page)).revision;
  await dragWorld(page, [30, 80], [90, 90], false);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect((await status(page)).revision).toBe(revision);
  await dragWorld(page, [30, 80], [90, 90], false);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.up();
  expect((await status(page)).revision).toBe(revision);
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  if (painted[0].kind !== "scenery") throw Error("missing stroke");
  await clickWorld(page, painted[0].assets[0].point);
  await expect(
    page.getByRole("heading", { name: "Landschaftsstrich" }),
  ).toBeVisible();
  await page.keyboard.press("Delete");
  await expect(page.getByRole("dialog")).toContainText(
    "Betroffene Kartenobjekte: 1.",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Löschen bestätigen", exact: true })
    .click();
  await expect.poll(async () => (await scene(page)).objects.length).toBe(0);
});

test("all landscape asset sets render and survive saving and opening", async ({
  page,
}, testInfo) => {
  await page.goto(url);
  await ready(page);
  for (const [i, biome] of (
    ["forest", "meadow", "scrub", "rocks"] as const
  ).entries()) {
    await commit(page, {
      type: "sceneryStroke",
      brush: {
        biome,
        radius: 25,
        density: 0.8,
        size: biome === "meadow" ? 4 : 8,
        seed: 32 + i,
        points: [
          [25 + i * 58, 35],
          [25 + i * 58, 110],
        ],
      },
    });
  }
  const painted = (await scene(page)).objects;
  await page.evaluate(async () => {
    const status = await window.atlasCore("status", {});
    await window.atlasCore("save", { version: status });
    await window.atlasCore("open", {});
  });
  expect((await scene(page)).objects).toEqual(painted);
  await page.reload();
  await ready(page);
  await page.getByRole("button", { name: "Landschaft", exact: true }).click();
  await page.getByLabel("Landschaftsart").selectOption("meadow");
  await page.getByLabel("Dichte (%)").fill("80");
  await page.getByLabel("Dichte (%)").blur();
  await page.getByLabel("Assetgröße (Fuß)").fill("4");
  await page.getByLabel("Assetgröße (Fuß)").blur();
  await page.mouse.move(40, 40);
  await page.screenshot({ path: testInfo.outputPath("landscape-assets.png") });
  const revision = (await status(page)).revision;
  await dragWorld(page, [35, 150], [80, 150]);
  await expect
    .poll(async () => (await status(page)).revision)
    .toBe(revision + 1);
  expect(
    (await scene(page)).objects.filter(
      (o) => o.kind === "scenery" && o.biome === "meadow",
    ),
  ).toHaveLength(2);
});
