import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { launchAtlasDesktop } from "./atlas-p0-desktop.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--"))
    throw new Error(`Missing value for ${name}`);
  return args[index + 1];
};
const out = resolve(option("--out", "artifacts/atlas-rebuild/ui-smoke"));
await mkdir(out, { recursive: true });
const file = join(out, "ui.saltatlas");
const report = {
  purpose: "UI integration, not a performance acceptance",
  build: JSON.parse(await readFile("desktop-dist/build.json", "utf8")),
  checks: [],
  passed: false,
  error: null,
};
const check = (name, condition) => {
  report.checks.push({ name, passed: Boolean(condition) });
  assert.ok(condition, name);
};
const session = await launchAtlasDesktop({
  executablePath: option("--executable", undefined),
  diagnostics: true,
  env: {
    ATLAS_P0_DIALOG_UNSAVED: "discard",
    ATLAS_P0_DIALOG_SAVE: file,
    ATLAS_P0_DIALOG_OPEN: file,
  },
});
const { page, app } = session;
const state = () =>
  page.evaluate(() => window.atlasObserve([], { events: false }));
const ready = () =>
  page.waitForFunction(() => {
    const snapshot = window.atlasObserve?.([], { events: false });
    if (snapshot?.state.error) throw new Error(snapshot.state.error);
    return snapshot && !snapshot.state.loading && !snapshot.state.finishing;
  });
const click = (name) =>
  page.getByRole("button", { name, exact: typeof name === "string" }).click();

try {
  await ready();
  const canvas = await page.locator("canvas").elementHandle();
  const initial = await page.locator("canvas").boundingBox();
  const camera = (await state()).camera;
  const boxes = await page
    .locator(".atlas-tools,.atlas-map,.atlas-panel,.atlas-header,.atlas-status")
    .evaluateAll((elements) =>
      Object.fromEntries(
        elements.map((element) => [
          element.classList[0],
          element.getBoundingClientRect().toJSON(),
        ]),
      ),
    );
  check(
    "three columns with header and footer outside the map",
    boxes["atlas-tools"].right <= boxes["atlas-map"].left &&
      boxes["atlas-map"].right <= boxes["atlas-panel"].left &&
      boxes["atlas-header"].bottom <= boxes["atlas-map"].top &&
      boxes["atlas-map"].bottom <= boxes["atlas-status"].top,
  );
  for (const name of [
    "Straße",
    "Fluss",
    "Gewässer",
    "Boden",
    "Regionen",
    "Einpassen",
  ])
    check(
      `${name}: unavailable action is disabled`,
      await page.getByRole("button", { name, exact: true }).isDisabled(),
    );
  await page.getByText("Innenräume", { exact: true }).click();
  for (const name of ["Raum", "Radieren", "Zuweisen", "Tür", "Treppe"])
    check(
      `${name}: interior placeholder is disabled`,
      await page.getByRole("button", { name, exact: true }).isDisabled(),
    );
  await page.getByText("Innenräume", { exact: true }).click();

  for (const [name, mode] of [
    ["Haus auswählen", "select"],
    ["Anheben", "raise"],
    ["Absenken", "lower"],
    ["Wald", "forest"],
    ["Lichtung", "clearing"],
    ["Haus platzieren", "house"],
    ["Verschieben", "pan"],
  ]) {
    await click(name);
    await page.waitForFunction(
      (mode) => window.atlasObserve([], { events: false }).state.mode === mode,
      mode,
    );
    check(
      `${mode}: real controller mode and one pressed tool`,
      (await page
        .locator('.atlas-tools button[aria-pressed="true"]')
        .count()) === 1,
    );
    assert.deepEqual(
      await page.locator("canvas").boundingBox(),
      initial,
      `${mode}: canvas bounds changed`,
    );
    assert.deepEqual((await state()).camera, camera, `${mode}: camera changed`);
  }
  check(
    "tool changes retain the canvas element",
    await page.evaluate(
      (node) => node === document.querySelector("canvas"),
      canvas,
    ),
  );

  await click("Anheben");
  await page.getByLabel("Pinselgröße", { exact: true }).fill("120");
  await page.getByLabel("Pinselgröße", { exact: true }).press("Enter");
  check(
    "brush diameter commits on Enter",
    (await state()).state.diameter === 120,
  );
  await page.getByLabel("Pinselstärke", { exact: true }).fill("3.048");
  await click("Absenken");
  check(
    "brush strength commits on blur with the existing unit conversion",
    Math.abs((await state()).state.amount - 10) < 1e-9,
  );
  await click("Wald");
  await page.getByLabel("Landschaft", { exact: true }).selectOption("2");
  await page.getByLabel("Landschaftsdichte", { exact: true }).fill("40");
  await page.getByLabel("Landschaftsdichte", { exact: true }).press("Enter");
  check(
    "landscape controls retain their controller bindings",
    (await state()).state.landscapeKind === 2 &&
      (await state()).state.landscapeDensity === 40,
  );
  await click("Lichtung");
  check(
    "clearing retains the disabled landscape selector",
    await page.getByLabel("Landschaft", { exact: true }).isDisabled(),
  );
  await click("Haus platzieren");
  await page.getByLabel("Hausbreite", { exact: true }).fill("18.288");
  await page.getByLabel("Hausbreite", { exact: true }).press("Enter");
  check(
    "house controls retain metric conversion",
    Math.abs((await state()).state.houseWidth - 60) < 1e-9,
  );

  await page.getByText("Zu Koordinaten", { exact: true }).click();
  await page.getByLabel("Ziel X").fill("12.192");
  await page.getByLabel("Ziel Y").fill("-6.096");
  await click("Zum Ziel");
  await ready();
  check(
    "coordinate navigation uses the existing camera command",
    Math.abs((await state()).camera.x - 40) < 1e-9 &&
      Math.abs((await state()).camera.y + 20) < 1e-9,
  );
  await page.getByText("Zu Koordinaten", { exact: true }).click();
  await page.getByLabel("Raster anzeigen").uncheck();
  check("map grid remains connected", (await state()).state.grid === false);

  const navigationBox = await page.locator("canvas").boundingBox();
  const beforeZoom = (await state()).camera;
  await page.mouse.move(
    navigationBox.x + navigationBox.width / 2,
    navigationBox.y + navigationBox.height / 2,
  );
  await page.mouse.wheel(0, -160);
  await page.waitForFunction(
    (scale) => window.atlasObserve([], { events: false }).camera.scale > scale,
    beforeZoom.scale,
  );
  await ready();
  const zoomed = (await state()).camera;
  check(
    "wheel zoom retains the world point under the map centre",
    Math.abs(zoomed.x - beforeZoom.x) < 1e-6 &&
      Math.abs(zoomed.y - beforeZoom.y) < 1e-6,
  );
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(
    navigationBox.x + navigationBox.width / 2 + 40,
    navigationBox.y + navigationBox.height / 2,
    { steps: 4 },
  );
  await page.mouse.up({ button: "middle" });
  await ready();
  const panned = (await state()).camera;
  check(
    "middle-button pan remains in the existing canvas controller",
    Math.abs(panned.x - (zoomed.x - 40 / zoomed.scale)) < 1e-6 &&
      Math.abs(panned.y - zoomed.y) < 1e-6,
  );

  await click("Anheben");
  await ready();
  const box = await page.locator("canvas").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(160);
  await page.mouse.up();
  await page.waitForFunction(
    () => window.atlasObserve([], { events: false }).state.canUndo,
  );
  await click(/Rückgängig/);
  await page.waitForFunction(
    () => window.atlasObserve([], { events: false }).state.canRedo,
  );
  check("header undo reaches the real history", (await state()).state.canRedo);
  await click(/Wiederholen/);
  await page.waitForFunction(
    () => window.atlasObserve([], { events: false }).state.canUndo,
  );
  check("header redo reaches the real history", (await state()).state.canUndo);
  await click("Speichern");
  await page.waitForFunction(
    () => window.atlasObserve([], { events: false }).state.saved,
  );
  check("header save writes a real project", (await stat(file)).size > 0);
  await page.locator(".preview-update-button").click();
  check(
    "existing updater dialog opens",
    await page.getByRole("dialog").isVisible(),
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Schließen", exact: true })
    .click();
  check(
    "updater dialog closes without remounting the canvas",
    !(await page.getByRole("dialog").isVisible()) &&
      (await page.evaluate(
        (node) => node === document.querySelector("canvas"),
        canvas,
      )),
  );
  await page.screenshot({ path: join(out, "desktop.png") });

  const beforeResize = (await state()).camera;
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(900, 620),
  );
  await page.waitForFunction(() => innerWidth === 900 && innerHeight === 620);
  await ready();
  const compact = await page.locator("canvas").boundingBox();
  check(
    "compact window retains a usable map",
    compact.width >= 500 && compact.height >= 450,
  );
  check(
    "compact window does not overflow",
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth === innerWidth &&
        document.documentElement.scrollHeight === innerHeight,
    ),
  );
  check(
    "compact tool rail does not clip labels horizontally",
    await page
      .locator(".atlas-tools")
      .evaluate((element) => element.scrollWidth === element.clientWidth),
  );
  assert.deepEqual(
    (await state()).camera,
    beforeResize,
    "resize changed the world camera",
  );
  check("compact resize keeps the world camera", true);
  await page.getByText("Zu Koordinaten", { exact: true }).click();
  const popover = await page.locator(".coordinate-popover").boundingBox();
  check(
    "coordinate popover stays inside the map",
    popover.x >= compact.x &&
      popover.x + popover.width <= compact.x + compact.width,
  );
  await page.getByText("Zu Koordinaten", { exact: true }).click();
  await page.screenshot({ path: join(out, "compact.png") });
  check("no renderer exceptions", session.errors.length === 0);
  report.passed = true;
} catch (error) {
  report.error = String(error);
  process.exitCode = 1;
} finally {
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(join(out, "electron.log"), session.output.join(""));
  console.log(
    `Editor UI: ${report.checks.filter((check) => check.passed).length}/${report.checks.length} checks; ${report.passed ? "PASS" : "FAIL"}`,
  );
  if (report.error) console.error(report.error);
  await session.close();
}
