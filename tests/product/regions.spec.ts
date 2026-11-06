import {
  calls,
  commit,
  dragWorld,
  ready,
  screen,
  status,
  url,
} from "../support/editor";
import { expect, test } from "../support/fixture";
const regions = (page: import("@playwright/test").Page) =>
  page.evaluate(async () =>
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
test("regions paint, transfer, independent ranks, erase, history and abort", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Regionen", exact: true }).click();
  await page.getByLabel("Name der neuen Region").fill("West");
  await page.getByRole("button", { name: "Neue Region", exact: true }).click();
  await page.getByRole("button", { name: "West · leer", exact: true }).click();
  await expect(page.getByLabel("Regionsname")).toHaveValue("West");
  await expect.poll(async () => (await regions(page)).summaries.length).toBe(1);
  await dragWorld(page, [20, 20], [60, 20]);
  await expect
    .poll(async () => (await regions(page)).summaries[0].area)
    .toBeGreaterThan(0);
  await ready(page);
  const west = (await regions(page)).summaries[0];
  const revision = (await status(page)).revision;
  await dragWorld(page, [70, 20], [90, 20], false);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect((await status(page)).revision).toBe(revision);
  await page.getByLabel("Name der neuen Region").fill("Ost");
  await page.getByRole("button", { name: "Neue Region", exact: true }).click();
  await page.getByRole("button", { name: "Ost · leer", exact: true }).click();
  await expect(page.getByLabel("Regionsname")).toHaveValue("Ost");
  await dragWorld(page, [45, 20], [65, 20]);
  await expect
    .poll(
      async () =>
        (await regions(page)).summaries.find((r) => r.id === west.id)!.area,
    )
    .toBeLessThan(west.area);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await regions(page)).summaries.find((r) => r.id === west.id)!.area,
    )
    .toBe(west.area);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await regions(page)).summaries.find((r) => r.id === west.id)!.area,
    )
    .toBeLessThan(west.area);
  const strokes = (await calls(page, "commit")).filter(
    (c) => (c.args.intent as { type: string }).type === "regionStroke",
  );
  expect(strokes.length).toBe(2);
});
test("screen sized brushes convert zoom consistently and names/categories can be edited", async ({
  page,
}) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Regionen", exact: true }).click();
  await page.getByLabel("Name der neuen Region").fill("Testland");
  await page.getByRole("button", { name: "Neue Region", exact: true }).click();
  await page
    .getByRole("button", { name: "Testland · leer", exact: true })
    .click();
  await expect(page.getByLabel("Regionsname")).toHaveValue("Testland");
  await dragWorld(page, [40, 40], [42, 40]);
  await expect.poll(async () => (await status(page)).revision).toBe(2);
  await ready(page);
  const first = (await calls(page, "commit")).find(
    (c) => (c.args.intent as { type: string }).type === "regionStroke",
  )!.args.intent as { radius: number };
  const p = await screen(page, [40, 40]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.wheel(0, 500);
  await expect
    .poll(async () => (await screen(page, [60, 40])).x - p.x)
    .toBeLessThan(60);
  await ready(page);
  await expect(
    page.getByLabel("Pinselgröße (Pixel)", { exact: true }),
  ).toHaveValue("80");
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 20, p.y);
  await page.mouse.up();
  await expect.poll(async () => (await status(page)).revision).toBe(3);
  const last = (await calls(page, "commit"))
    .filter((c) => (c.args.intent as { type: string }).type === "regionStroke")
    .at(-1)!.args.intent as { radius: number };
  expect(last.radius).toBeGreaterThan(first.radius);
  await page
    .getByText("Kategorien und Rangstufen verwalten", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Kategorie hinzufügen", exact: true })
    .click();
  await expect
    .poll(async () => (await regions(page)).catalog.categories.length)
    .toBe(4);
});

test("region relationships, category deletion confirmation and compact panel", async ({
  page,
}, info) => {
  await page.goto(url);
  await ready(page);
  const ids: string[] = [];
  for (const [name, rankId] of [
    ["Stadt", "builtin-rank-5"],
    ["Westbezirk", "builtin-rank-6"],
    ["Ostbezirk", "builtin-rank-6"],
  ]) {
    const result = await commit(page, {
      type: "regionEdit",
      action: { kind: "create", name, rankId },
    });
    ids.push(result.regions![0].id);
  }
  for (const [i, x] of [0, 20, 55].entries())
    await commit(page, {
      type: "regionStroke",
      id: ids[i],
      points: [
        [x, 30],
        [x + 20, 30],
      ],
      radius: 35,
      erase: false,
    });
  await page.reload();
  await ready(page);
  await page.getByRole("button", { name: "Regionen", exact: true }).click();
  await page
    .getByLabel("Rangstufe", { exact: true })
    .selectOption("builtin-rank-5");
  await page.getByRole("button", { name: "Stadt", exact: true }).click();
  await expect(page.getByLabel("Regionsname")).toHaveValue("Stadt");
  await ready(page);
  await expect(
    page.getByRole("button", { name: /Westbezirk · .*%/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Ostbezirk · .*%/ }),
  ).toBeVisible();
  await page.getByLabel("Regionsname").fill("Hafenstadt");
  await page.getByLabel("Regionsname").press("Enter");
  await expect
    .poll(
      async () =>
        (await regions(page)).summaries.find((r) => r.id === ids[0])?.name,
    )
    .toBe("Hafenstadt");
  await ready(page);
  await page.screenshot({ path: info.outputPath("regions-map.png") });
  await page.setViewportSize({ width: 900, height: 620 });
  await ready(page);
  await page
    .getByText("Kategorien und Rangstufen verwalten", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Kategorie löschen", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("3 Regionen");
  await page.screenshot({ path: info.outputPath("regions-delete-small.png") });
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  expect((await regions(page)).summaries.length).toBe(3);
  await page
    .getByRole("button", { name: "Kategorie löschen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Löschen bestätigen", exact: true })
    .click();
  await expect.poll(async () => (await regions(page)).summaries.length).toBe(0);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect.poll(async () => (await regions(page)).summaries.length).toBe(3);
});
