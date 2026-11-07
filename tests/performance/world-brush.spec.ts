import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { test, expect } from "../support/fixture";
import { ready, paintedReady, settled } from "../support/editor";

const url = "http://127.0.0.1:1422/tests/support/atlas.html";
test.use({
  coreOptions: {
    binary: resolve("src-tauri/target/release/examples/atlas_test_server"),
  },
});
test("direct land records input-to-confirmation and paint timings", async ({
  page,
}, info) => {
  await page.goto(url);
  await ready(page);
  await page.getByLabel("Ansichtsmaßstab").selectOption({ label: "Welt" });
  await page.getByRole("button", { name: "Höhen", exact: true }).click();
  await paintedReady(page);
  await page.evaluate(() => {
    const values: {
      name: string;
      start: number;
      duration: number;
      revision: number;
    }[] = [];
    Object.assign(window, { terrainMeasures: values });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.startsWith("atlas.")) {
          const measure = entry as PerformanceMeasure;
          values.push({
            name: measure.name,
            start: measure.startTime,
            duration: measure.duration,
            revision: measure.detail?.revision,
          });
        }
      }
    }).observe({ type: "measure" });
  });
  const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2 - 160, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 40; i++) {
    await page.mouse.move(
      box.x + box.width / 2 - 160 + i * 8,
      box.y + box.height / 2 + Math.sin(i / 8) * 20,
    );
    await page.waitForTimeout(16);
  }
  const released = await page.evaluate(() => performance.now());
  await page.mouse.up();
  await settled(page);
  await paintedReady(page);
  const values = await page.evaluate(
    () =>
      (
        window as unknown as {
          terrainMeasures: {
            name: string;
            start: number;
            duration: number;
            revision: number;
          }[];
        }
      ).terrainMeasures,
  );
  const paints = values.filter((v) => v.name === "atlas.canvas.paint");
  const writes = values.filter((v) => v.name === "atlas.terrain.confirmed");
  const visible = writes.flatMap((w) => {
    const p = paints.find(
      (p) => p.revision >= w.revision && p.start >= w.start + w.duration,
    );
    return p ? [p.start + p.duration - w.start] : [];
  });
  const p95 = (v: number[]) =>
    v.sort((a, b) => a - b)[
      Math.min(v.length - 1, Math.floor(v.length * 0.95))
    ];
  const summary = {
    environment: "Playwright Chromium / release Rust; not native acceptance",
    writes: writes.length,
    firstVisibleMs: visible[0],
    tailMs: Math.max(0, ...paints.map((p) => p.start + p.duration - released)),
    inputToConfirmedP95: p95(writes.map((v) => v.duration)),
    inputToPaintP95: p95(visible),
    paintP95: p95(paints.map((v) => v.duration)),
  };
  const report = info.outputPath("terrain-timing.json");
  await writeFile(report, JSON.stringify({ summary, values }, null, 2));
  await info.attach("terrain-timing.json", {
    path: report,
    contentType: "application/json",
  });
  await page.screenshot({ path: info.outputPath("direct-coast.png") });
  expect(writes.length).toBeGreaterThan(2);
  expect(visible.length).toBeGreaterThan(2);
});
