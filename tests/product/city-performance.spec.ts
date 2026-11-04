import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { expect, test } from "../support/fixture";
import { ready, url } from "../support/editor";
for (const count of [100_000, 250_000])
  test(`city ${count}: overview payload and warm navigation`, async ({
    page,
    core,
  }, info) => {
    test.skip(
      process.env.ATLAS_CITY_BENCHMARK !== "1",
      "Run the ignored Rust fixture benchmark first, then opt in.",
    );
    test.setTimeout(600_000);
    const openedAt = Date.now();
    const result = JSON.parse(
      await core.request({
        cmd: "open",
        args: {
          path: resolve(
            process.env.ATLAS_CITY_DIR ?? "src-tauri/target/diagnostics/city",
            `city-${count}.saltatlas`,
          ),
        },
      }),
    );
    expect(result.error).toBeUndefined();
    const openMs = Date.now() - openedAt;
    await page.goto(url);
    await ready(page);
    const start = Date.now();
    await page.getByRole("button", { name: "Einpassen", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Zum Bearbeiten hineinzoomen" }),
    ).toBeVisible();
    await expect(page.getByText("Ansicht wird geladen …")).toHaveCount(0);
    const overviewMs = Date.now() - start;
    const call = await page.evaluate(() =>
      window.atlasCalls.find((c) => c.cmd === "mapTiles"),
    );
    expect(call).toBeTruthy();
    expect((call!.args.tiles as unknown[]).length).toBeLessThanOrEqual(64);
    const box = (await page.getByTestId("atlas-canvas").boundingBox())!;
    await page.evaluate(() => {
      const data: { times: number[]; active: boolean } = {
        times: [],
        active: true,
      };
      (window as unknown as { cityFrames: typeof data }).cityFrames = data;
      let last = performance.now();
      function frame(now: number) {
        if (!data.active) return;
        data.times.push(now - last);
        last = now;
        requestAnimationFrame(frame);
      }
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
    const times = await page.evaluate(() => {
      const data = (
        window as unknown as {
          cityFrames: { times: number[]; active: boolean };
        }
      ).cityFrames;
      data.active = false;
      return data.times.slice(2).sort((a, b) => a - b);
    });
    const p95 = times[Math.floor(times.length * 0.95)];
    const evidence = { count, openMs, overviewMs, p95, frames: times.length };
    await writeFile(
      info.outputPath("performance.json"),
      JSON.stringify(evidence, null, 2),
    );
    await page.screenshot({ path: info.outputPath("city.png") });
    expect(overviewMs).toBeLessThan(1000);
    expect(p95).toBeLessThan(33);
  });
