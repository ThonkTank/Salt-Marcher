import { test, expect } from "@playwright/test";
import { resolve, join } from "node:path";
import { writeFile, mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir, cpus, platform, release } from "node:os";
import { createHash } from "node:crypto";
import { startCoreTransport } from "../support/coreTransport";
import { paintedReady, settled } from "../support/editor";
import { terrainCases, terrainRecipe } from "./terrain-cases";

const cases = [
  ...terrainCases,
  {
    name: "dense-overview",
    fixture: "dense-overview",
    diameter: 0,
    seed: 7,
    points: [],
  },
];
const percentile = (values: number[]) =>
  values.length
    ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1]
    : null;
for (const scenario of cases)
  test(scenario.name, async ({ page, browser }, info) => {
    const directory = await mkdtemp(join(tmpdir(), "atlas-terrain-perf-"));
    const binary = resolve(
      process.env.ATLAS_PERF_BINARY ??
        "src-tauri/target/release/examples/atlas_test_server",
    );
    const fixture = resolve(
      process.env.ATLAS_TERRAIN_FIXTURES ??
        "src-tauri/target/diagnostics/terrain-performance",
      `${scenario.fixture}.saltatlas`,
    );
    const transport = startCoreTransport({
      binary,
      env: { ...process.env, TMPDIR: directory, ATLAS_MEASURE_WORKER: "1" },
    });
    let measuring = false;
    const requests: {
      cmd: string;
      ms: number;
      workerMs: number;
      requestBytes: number;
      responseBytes: number;
    }[] = [];
    const request = async (cmd: string, args: Record<string, unknown>) => {
      const include = measuring;
      const started = performance.now();
      const response = await transport.request({ cmd, args });
      const elapsed = performance.now() - started;
      const result = JSON.parse(response);
      if (include)
        requests.push({
          cmd,
          ms: elapsed,
          workerMs: result.workerMs,
          requestBytes: Buffer.byteLength(JSON.stringify({ cmd, args }) + "\n"),
          responseBytes: Buffer.byteLength(response + "\n"),
        });
      if (result.error) throw Error(JSON.stringify(result.error));
      return result.value;
    };
    try {
      await request("open", { path: fixture });
      await page.exposeBinding("atlasCore", (_source, cmd, args) =>
        request(cmd, args),
      );
      await page.exposeBinding("atlasRaw", (_source, cmd, args) =>
        request(cmd, args),
      );
      await page.goto("http://127.0.0.1:1422/tests/support/atlas.html");
      await paintedReady(page);
      await page
        .getByLabel("Ansichtsmaßstab")
        .selectOption({ label: terrainRecipe.view });
      await paintedReady(page);
      if (scenario.points.length) {
        await page.getByRole("button", { name: "Höhen", exact: true }).click();
        await page
          .getByLabel("Pinselgröße (Pixel)", { exact: true })
          .fill(String(scenario.diameter));
        await page.getByLabel("Pinselgröße (Pixel)", { exact: true }).blur();
        await paintedReady(page);
      }
      await page.evaluate(() => {
        const values: {
          name: string;
          start: number;
          duration: number;
          revision: number;
          sessionId: string;
        }[] = [];
        const collect = (entries: PerformanceEntry[]) => {
          for (const entry of entries)
            if (entry.name.startsWith("atlas.")) {
              const measure = entry as PerformanceMeasure;
              values.push({
                name: entry.name,
                start: entry.startTime,
                duration: entry.duration,
                revision: measure.detail?.revision,
                sessionId: measure.detail?.sessionId,
              });
            }
        };
        const observer = new PerformanceObserver((list) =>
          collect(list.getEntries()),
        );
        observer.observe({ type: "measure" });
        Object.assign(window, {
          terrainResults: () => {
            collect(observer.takeRecords());
            observer.disconnect();
            return values;
          },
        });
      });
      const started = performance.now();
      measuring = true;
      if (scenario.points.length) {
        const canvas = page.getByTestId("atlas-canvas");
        const box = (await canvas.boundingBox())!;
        const transform = await canvas.evaluate((c: HTMLCanvasElement) => {
          const t = c.getContext("2d")!.getTransform(),
            d = devicePixelRatio;
          return { x: t.e / d, y: t.f / d, scale: t.a / d };
        });
        for (const [i, point] of scenario.points.entries()) {
          await page.mouse.move(
            box.x + transform.x + point[0] * transform.scale,
            box.y + transform.y + point[1] * transform.scale,
          );
          if (i === 0) await page.mouse.down();
          await page.waitForTimeout(terrainRecipe.intervalMs);
        }
        await page.mouse.up();
        await settled(page);
      } else {
        await page
          .getByLabel("Ansichtsmaßstab")
          .selectOption({ label: "Umland" });
      }
      await paintedReady(page);
      const totalMs = performance.now() - started;
      measuring = false;
      const values = await page.evaluate(() =>
        (
          window as unknown as {
            terrainResults: () => {
              name: string;
              start: number;
              duration: number;
              revision: number;
              sessionId: string;
            }[];
          }
        ).terrainResults(),
      );
      const paints = values.filter((v) => v.name === "atlas.canvas.paint");
      const writes = values.filter((v) => v.name === "atlas.terrain.confirmed");
      const visible = writes.flatMap((w) => {
        const p = paints.find(
          (p) =>
            p.sessionId === w.sessionId &&
            p.revision >= w.revision &&
            p.start >= w.start + w.duration,
        );
        return p ? [p.start + p.duration - w.start] : [];
      });
      const paintP95 = percentile(paints.map((p) => p.duration));
      const visibleP95 = percentile(visible);
      const summary = {
        totalMs,
        writes: writes.length,
        visibleSamples: visible.length,
        workerP95: percentile(requests.map((r) => r.workerMs)),
        roundtripP95: percentile(requests.map((r) => r.ms)),
        confirmationP95: percentile(writes.map((w) => w.duration)),
        paintP95,
        visibleP95,
        requestBytes: requests.reduce((sum, r) => sum + r.requestBytes, 0),
        responseBytes: requests.reduce((sum, r) => sum + r.responseBytes, 0),
        targetsMet: scenario.points.length
          ? paintP95 !== null &&
            paintP95 <= 16.7 &&
            visibleP95 !== null &&
            visibleP95 <= 50
          : null,
      };
      const hash = (bytes: Uint8Array) =>
        createHash("sha256").update(bytes).digest("hex");
      const report = {
        recipe: terrainRecipe.version,
        scenario,
        intervalMs: terrainRecipe.intervalMs,
        environment: {
          node: process.version,
          browser: browser.version(),
          cpu: cpus()[0]?.model,
          platform: platform(),
          release: release(),
          viewport: page.viewportSize(),
          dpr: await page.evaluate(() => devicePixelRatio),
        },
        fixtureSha256: hash(await readFile(fixture)),
        workerSha256: hash(await readFile(binary)),
        note: "Worker time includes queueing. Browser/JSONL bridge, not native IPC. 16 ms is minimum pacing; actual delivery depends on machine speed.",
        summary,
        requests,
        values,
      };
      const reportPath = info.outputPath("terrain-timing.json");
      await writeFile(reportPath, JSON.stringify(report, null, 2));
      await info.attach("terrain-timing", {
        path: reportPath,
        contentType: "application/json",
      });
      expect(requests.length).toBeGreaterThan(0);
      expect(requests.every((r) => Number.isFinite(r.workerMs))).toBe(true);
      expect(paints.length).toBeGreaterThan(0);
      if (scenario.points.length) {
        expect(writes.length).toBeGreaterThan(2);
        expect(visible.length).toBe(writes.length);
      }
    } finally {
      await transport.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
