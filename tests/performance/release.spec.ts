import { test, expect } from "@playwright/test";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { startCoreTransport } from "../support/coreTransport";
import { paintedReady as ready } from "../support/editor";
import { ATLAS_VIEWS } from "../../src/atlas/lod";

const fixtures = [
  {
    name: "city-100000",
    path: "src-tauri/target/diagnostics/city/city-100000.saltatlas",
  },
  {
    name: "city-250000",
    path: "src-tauri/target/diagnostics/city/city-250000.saltatlas",
  },
  {
    name: "world-10000",
    path: "src-tauri/target/diagnostics/world/world-10000.saltatlas",
  },
];
const output = resolve(
  process.env.ATLAS_PERF_OUTPUT ??
    "src-tauri/target/cleanup/atlas-simplify/performance-run",
);
for (const fixture of fixtures) {
  test(`${fixture.name} release baseline`, async ({ page, browser }) => {
    test.skip(
      !!process.env.ATLAS_PERF_FIXTURE &&
        process.env.ATLAS_PERF_FIXTURE !== fixture.name,
      "fixture filter",
    );
    mkdirSync(output, { recursive: true });
    const evidence = join(output, `${fixture.name}.jsonl`);
    writeFileSync(evidence, "");
    const record = (value: unknown) =>
      appendFileSync(evidence, `${JSON.stringify(value)}\n`);
    const directory = await mkdtemp(join(tmpdir(), "atlas-perf-"));
    const core = startCoreTransport({
      binary: resolve("src-tauri/target/release/examples/atlas_test_server"),
      env: { ...process.env, TMPDIR: directory },
    });
    let pass = "cold";
    const request = async (cmd: string, args: Record<string, unknown>) => {
      const started = performance.now();
      const wire = JSON.stringify({ cmd, args });
      const response = await core.request({ cmd, args });
      record({
        type: "request",
        pass,
        cmd,
        ms: performance.now() - started,
        requestBytes: Buffer.byteLength(wire),
        responseBytes: Buffer.byteLength(response),
      });
      const result = JSON.parse(response);
      if (result.error) throw Error(JSON.stringify(result.error));
      return result.value;
    };
    await page.exposeBinding("atlasCore", (_source, cmd, args) =>
      request(cmd, args),
    );
    await page.exposeBinding("atlasRaw", (_source, cmd, args) =>
      request(cmd, args),
    );
    try {
      record({
        type: "environment",
        fixture: fixture.name,
        path: resolve(fixture.path),
        browser: browser.version(),
        viewport: page.viewportSize(),
        dpr: await page.evaluate(() => devicePixelRatio),
        note: "cold = first open in fresh worker; warm = reopen in same worker, OS cache uncontrolled",
      });
      for (pass of ["cold", "warm"]) {
        let started = performance.now();
        await request("open", { path: resolve(fixture.path) });
        record({
          type: "phase",
          pass,
          phase: "open",
          ms: performance.now() - started,
        });
        started = performance.now();
        await page.goto("http://127.0.0.1:1422/tests/support/atlas.html");
        await ready(page);
        record({
          type: "phase",
          pass,
          phase: "first-view",
          ms: performance.now() - started,
        });
        started = performance.now();
        await page
          .getByRole("button", { name: "Einpassen", exact: true })
          .click();
        await ready(page);
        record({
          type: "phase",
          pass,
          phase: "fit-view",
          ms: performance.now() - started,
        });
        const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
        await page.evaluate(() => {
          const data = { times: [] as number[], active: true };
          (window as unknown as { perfFrames: typeof data }).perfFrames = data;
          let last = performance.now();
          const frame = (now: number) => {
            if (!data.active) return;
            data.times.push(now - last);
            last = now;
            requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        });
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down({ button: "middle" });
        await page.mouse.move(
          box.x + box.width / 2 + 150,
          box.y + box.height / 2 + 80,
          { steps: 120 },
        );
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
          steps: 120,
        });
        await page.mouse.up({ button: "middle" });
        const frames = await page.evaluate(() => {
          const data = (
            window as unknown as {
              perfFrames: { times: number[]; active: boolean };
            }
          ).perfFrames;
          data.active = false;
          return data.times.slice(2).sort((a, b) => a - b);
        });
        record({
          type: "frames",
          pass,
          count: frames.length,
          p50: frames[Math.floor(frames.length * 0.5)],
          p95: frames[Math.floor(frames.length * 0.95)],
          max: frames.at(-1),
        });
        expect(frames.length).toBeGreaterThan(0);
        for (const view of ATLAS_VIEWS) {
          started = performance.now();
          await page
            .getByLabel("Ansichtsmaßstab")
            .selectOption({ label: view.name });
          await ready(page);
          await expect(page.locator(".atlas-map-title")).toContainText(
            view.name,
          );
          record({
            type: "view",
            pass,
            view: view.name,
            ms: performance.now() - started,
          });
        }
      }
    } finally {
      await core.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
}
