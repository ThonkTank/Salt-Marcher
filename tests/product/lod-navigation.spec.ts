import { test, expect } from "../support/fixture";
import { ready, url } from "../support/editor";
import { ATLAS_VIEWS } from "../../src/atlas/lod";

test("all atlas views navigate in both directions with bounded surface requests", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto(url);
  await ready(page);
  for (const view of [...ATLAS_VIEWS, ...[...ATLAS_VIEWS].reverse()]) {
    await page.getByLabel("Ansichtsmaßstab").selectOption({ label: view.name });
    await ready(page);
    await expect(page.locator(".atlas-map-title")).toContainText(view.name);
  }
  const counts = await page.evaluate(() =>
    window.atlasCalls.flatMap((call) =>
      call.cmd === "mapTiles" ||
      call.cmd === "terrainTiles" ||
      call.cmd === "groundTiles"
        ? [{ layer: call.cmd, count: call.args.tiles.length }]
        : [],
    ),
  );
  for (const layer of ["mapTiles", "terrainTiles", "groundTiles"]) {
    expect(counts.some((c) => c.layer === layer && c.count > 0)).toBe(true);
  }
  expect(counts.every((c) => c.count <= 64)).toBe(true);
});
