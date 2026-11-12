import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { launchAtlasDesktop } from "./atlas-p0-desktop.mjs";
import { editRangeValue, setRangeValue } from "./atlas-p0-interactions.mjs";

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
const heightMode = async (mode) => {
  await click("Höhen");
  await page.getByLabel("Pinselmodus", { exact: true }).selectOption(mode);
  await page.waitForFunction(
    (mode) => window.atlasObserve([], { events: false }).state.mode === mode,
    mode,
  );
};
const diameter = () => page.getByLabel("Pinselgröße (Pixel)", { exact: true });
const sampleHeight = (point) =>
  page.evaluate(
    (point) => window.atlasObserve([point], { events: false }).samples[0],
    point,
  );
const waitForDiameter = (value) =>
  page.waitForFunction(
    (value) =>
      window.atlasObserve([], { events: false }).state.diameter === value,
    value,
  );

// Drive the native range with real pointer input. Fractional targets deliberately
// avoid relying on a product-specific conversion or an exact thumb width.
async function dragRange(label, from, to, duringDrag) {
  const slider = page.getByRole("slider", { name: label, exact: true });
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  assert.ok(box, `${label}: slider has bounds`);
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * from, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to, y, { steps: 8 });
  if (duringDrag) await duringDrag();
  await page.mouse.up();
}

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
    ["Höhen", "land"],
    ["Höhen", "sea"],
    ["Höhen", "raise"],
    ["Höhen", "lower"],
    ["Wald", "forest"],
    ["Lichtung", "clearing"],
    ["Haus platzieren", "house"],
    ["Verschieben", "pan"],
  ]) {
    if (name === "Höhen") await heightMode(mode);
    else await click(name);
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
    if (mode === "pan")
      check(
        "navigation does not expose height editing controls",
        (await page.getByLabel("Pinselmodus", { exact: true }).count()) === 0 &&
          (await page
            .getByLabel("Höhenänderung (m/s)", { exact: true })
            .count()) === 0,
      );
    if (mode === "select")
      check(
        "empty selection explains the next action without phantom house properties",
        (await page
          .getByText("Kein Haus ausgewählt", { exact: true })
          .isVisible()) && (await page.getByRole("slider").count()) === 0,
      );
  }
  check(
    "tool changes retain the canvas element",
    await page.evaluate(
      (node) => node === document.querySelector("canvas"),
      canvas,
    ),
  );

  await click("Höhen");
  check(
    "one height tool retains the chosen mode across tool changes",
    (await state()).state.mode === "lower" &&
      (await page.getByLabel("Pinselmodus", { exact: true }).inputValue()) ===
        "lower" &&
      (await page
        .locator(".atlas-tools")
        .getByRole("button", { name: /Anheben|Absenken/ })
        .count()) === 0,
  );
  const heightOptions = await page
    .getByLabel("Pinselmodus", { exact: true })
    .locator("option")
    .evaluateAll((options) =>
      options.map((option) => ({
        value: option.value,
        label: option.textContent,
        disabled: option.disabled,
      })),
    );
  assert.deepEqual(heightOptions, [
    { value: "land", label: "Land", disabled: false },
    { value: "sea", label: "Meer", disabled: false },
    { value: "mountains", label: "Bergkette", disabled: true },
    { value: "hills", label: "Hügel", disabled: true },
    { value: "canyon", label: "Schlucht", disabled: true },
    { value: "raise", label: "Anheben", disabled: false },
    { value: "lower", label: "Absenken", disabled: false },
    { value: "smooth", label: "Glätten", disabled: true },
    { value: "flatten", label: "Einebnen", disabled: true },
  ]);
  check("height mode choices preserve the available engine scope", true);
  await heightMode("land");
  check(
    "Land exposes its coast shape without an ineffective height rate",
    (await page.getByLabel("Küstenform", { exact: true }).inputValue()) ===
      "round" &&
      (await page
        .getByLabel("Höhenänderung (m/s)", { exact: true })
        .count()) === 0 &&
      (await state()).state.coastRoughness === 0,
  );
  await page.getByLabel("Küstenform", { exact: true }).selectOption("crinkled");
  check(
    "crinkled coast selects the previous default roughness",
    Math.abs((await state()).state.coastRoughness - 0.65) < 1e-9,
  );
  const roughness = page.getByLabel("Küstenrauheit (%)", { exact: true });
  await roughness.press("Home");
  for (let step = 0; step < 7; step++) await roughness.press("ArrowRight");
  await heightMode("sea");
  await click("Wald");
  await click("Höhen");
  check(
    "Meer and coast roughness survive a tool change",
    (await state()).state.mode === "sea" &&
      (await state()).state.heightMode === "sea" &&
      Math.abs((await state()).state.coastRoughness - 0.4) < 1e-9 &&
      (await page.getByLabel("Pinselmodus", { exact: true }).inputValue()) ===
        "sea" &&
      (await page
        .getByLabel("Höhenänderung (m/s)", { exact: true })
        .count()) === 0,
  );
  await page.screenshot({ path: join(out, "coast-settings.png") });
  await page.getByLabel("Küstenform", { exact: true }).selectOption("round");
  check(
    "round coast disables roughness through the real controller",
    (await state()).state.coastRoughness === 0,
  );
  check(
    "unavailable contours are visibly disabled",
    (await page
      .getByRole("checkbox", { name: "Höhenlinien", exact: true })
      .isVisible()) &&
      (await page
        .getByRole("checkbox", { name: "Höhenlinien", exact: true })
        .isDisabled()),
  );
  await heightMode("raise");
  check(
    "height settings expose native sliders instead of numeric steppers",
    (await page.getByRole("slider").count()) === 2 &&
      (await page.locator('.atlas-settings input[type="number"]').count()) ===
        0,
  );
  const beforeSlider = await state();
  await dragRange("Pinselgröße (Pixel)", 0.2, 0.65, async () => {
    const current = await state();
    check(
      "brush slider updates the next brush while dragging",
      current.state.diameter > 250 && current.state.diameter < 400,
    );
    check(
      "brush slider does not create terrain or history",
      current.document.revision === beforeSlider.document.revision &&
        current.document.historyActions ===
          beforeSlider.document.historyActions,
    );
  });
  await diameter().focus();
  await diameter().press("Home");
  check(
    "brush slider Home reaches the minimum",
    (await state()).state.diameter === 8,
  );
  await diameter().press("End");
  check(
    "brush slider End reaches the maximum",
    (await state()).state.diameter === 512,
  );
  await setRangeValue(page, "Pinselgröße (Pixel)", 120);
  check(
    "brush diameter commits on Enter",
    (await state()).state.diameter === 120,
  );
  await diameter().press("ArrowRight");
  check(
    "brush slider supports one-pixel keyboard increments",
    (await state()).state.diameter === 121,
  );
  await diameter().press("ArrowLeft");
  const diameterDraft = await editRangeValue(page, "Pinselgröße (Pixel)");
  await diameterDraft.fill("240");
  await diameterDraft.press("Escape");
  check(
    "Escape discards the diameter draft",
    (await state()).state.diameter === 120 &&
      (await diameter().inputValue()) === "120",
  );
  await editRangeValue(page, "Pinselgröße (Pixel)");
  await page.keyboard.press("]");
  check(
    "brush shortcuts do not change a focused number field",
    (await state()).state.diameter === 120,
  );
  await diameterDraft.press("Escape");
  const invalidDraft = await editRangeValue(page, "Pinselgröße (Pixel)");
  await invalidDraft.fill("999");
  await invalidDraft.press("Enter");
  check(
    "out-of-range precision input explains the error and keeps the valid brush",
    (await invalidDraft.getAttribute("aria-invalid")) === "true" &&
      (await state()).state.diameter === 120,
  );
  await invalidDraft.press("Escape");
  const strength = page.getByRole("slider", {
    name: "Höhenänderung (m/s)",
    exact: true,
  });
  await strength.focus();
  await strength.press("Home");
  check(
    "height-rate slider preserves the fine lower bound",
    Math.abs((await state()).state.amount - 0.1) < 1e-9,
  );
  await strength.press("End");
  check(
    "height-rate slider preserves the full upper bound",
    (await state()).state.amount === 10000,
  );
  await dragRange("Höhenänderung (m/s)", 0.2, 0.5);
  check(
    "height-rate slider makes moderate values accessible across the full range",
    (await state()).state.amount > 10 &&
      (await state()).state.amount < 100 &&
      /m\/s/.test(await strength.getAttribute("aria-valuetext")),
  );
  const strengthDraft = await editRangeValue(page, "Höhenänderung (m/s)");
  await strengthDraft.fill("3,048");
  await page.getByLabel("Pinselmodus", { exact: true }).click();
  await page.getByLabel("Pinselmodus", { exact: true }).selectOption("lower");
  check(
    "brush strength commits on blur with the existing unit conversion",
    Math.abs((await state()).state.amount - 10) < 1e-9,
  );
  const heightFields = await Promise.all(
    [
      "Pinselmodus",
      "Pinselgröße (Pixel)",
      "Höhenänderung (m/s)",
      "Höhenlinien",
    ].map((label) =>
      (label === "Höhenlinien"
        ? page.getByRole("checkbox", { name: label, exact: true })
        : page.getByLabel(label, { exact: true })
      ).boundingBox(),
    ),
  );
  check(
    "height controls retain the previous top-to-bottom order",
    heightFields.every(
      (box, index) => box && (index === 0 || box.y > heightFields[index - 1].y),
    ),
  );
  const brushInfo = page.getByRole("group", {
    name: "Pinselmaße",
    exact: true,
  });
  check(
    "world diameter and height grid are visible",
    (await brushInfo.isVisible()) &&
      /Weltdurchmesser/.test(await brushInfo.textContent()) &&
      /Höhenraster/.test(await brushInfo.textContent()),
  );
  await click("Wald");
  await page.getByLabel("Landschaft", { exact: true }).selectOption("2");
  await setRangeValue(page, "Landschaftsdichte", 40);
  check(
    "landscape controls retain their controller bindings",
    (await state()).state.landscapeKind === 2 &&
      (await state()).state.landscapeDensity === 40,
  );
  await dragRange("Landschaftsdichte", 0.4, 0.75, async () => {
    check(
      "landscape density slider updates the setting during drag",
      (await state()).state.landscapeDensity > 60 &&
        (await state()).state.landscapeDensity < 90,
    );
  });
  await page
    .getByRole("slider", { name: "Landschaftsdichte", exact: true })
    .press("Home");
  check(
    "landscape slider retains zero density",
    (await state()).state.landscapeDensity === 0,
  );
  await page
    .getByRole("slider", { name: "Landschaftsdichte", exact: true })
    .press("End");
  check(
    "landscape slider retains full density",
    (await state()).state.landscapeDensity === 100,
  );
  await click("Lichtung");
  check(
    "clearing retains the disabled landscape selector",
    await page.getByLabel("Landschaft", { exact: true }).isDisabled(),
  );
  await click("Haus platzieren");
  await setRangeValue(page, "Hausbreite", 18.288);
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
  await page.getByLabel("Ziel X").fill("123");
  await page.getByLabel("Ziel Y").fill("456");
  await click("Regionsansicht");
  await ready();
  check(
    "view presets retain the current centre and ignore unsubmitted coordinate drafts",
    Math.abs((await state()).camera.x - 40) < 1e-9 &&
      Math.abs((await state()).camera.y + 20) < 1e-9 &&
      (await state()).camera.scale === 0.025,
  );
  await click("Nahansicht");
  await ready();
  check(
    "returning to near view changes only scale",
    Math.abs((await state()).camera.x - 40) < 1e-9 &&
      Math.abs((await state()).camera.y + 20) < 1e-9 &&
      (await state()).camera.scale === 0.25,
  );
  await page.getByText("Zu Koordinaten", { exact: true }).click();
  await page.getByLabel("Raster anzeigen").uncheck();
  check("map grid remains connected", (await state()).state.grid === false);

  await heightMode("raise");
  const navigationBox = await page.locator("canvas").boundingBox();
  const beforeGestures = await state();
  await page.locator("canvas").focus();
  const beforeZoom = (await state()).camera;
  await page.mouse.move(
    navigationBox.x + navigationBox.width / 2,
    navigationBox.y + navigationBox.height / 2,
  );
  await page.keyboard.press("]");
  await waitForDiameter(132);
  await page.keyboard.press("[");
  await waitForDiameter(120);
  check(
    "bracket keys resize the height brush by the previous increments",
    true,
  );
  await page.keyboard.down("Alt");
  await page.mouse.wheel(0, -160);
  await waitForDiameter(132);
  await page.mouse.wheel(0, 160);
  await waitForDiameter(120);
  await page.keyboard.up("Alt");
  assert.deepEqual((await state()).camera, beforeZoom);
  check("Alt-wheel resizes the brush without zooming or moving the map", true);
  await setRangeValue(page, "Pinselgröße (Pixel)", 512);
  await page.locator("canvas").focus();
  await page.keyboard.press("]");
  check(
    "brush enlargement retains the existing maximum",
    (await state()).state.diameter === 512,
  );
  await setRangeValue(page, "Pinselgröße (Pixel)", 8);
  await page.locator("canvas").focus();
  await page.keyboard.press("[");
  check(
    "brush reduction retains the existing minimum",
    (await state()).state.diameter === 8,
  );
  await setRangeValue(page, "Pinselgröße (Pixel)", 120);
  check(
    "brush setting gestures leave document content and history unchanged",
    (await state()).document.revision === beforeGestures.document.revision &&
      (await state()).document.sequence === beforeGestures.document.sequence &&
      (await state()).state.canUndo === beforeGestures.state.canUndo,
  );
  const infoBeforeZoom = await brushInfo.textContent();
  // Opening an exact-value editor is a real click in the inspector. Restore
  // the intended wheel target before checking the canvas zoom anchor.
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
  check(
    "zoom preserves screen diameter and refreshes the world diameter display",
    (await state()).state.diameter === 120 &&
      (await brushInfo.textContent()) !== infoBeforeZoom,
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

  await heightMode("raise");
  await ready();
  const box = await page.locator("canvas").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await ready();
  const point = [(await state()).camera.x, (await state()).camera.y];
  const heightBefore = await sampleHeight(point);
  assert.equal(typeof heightBefore, "number", "pre-stroke height is known");
  // Keep the current author level: a level change correctly requires a fresh
  // visible foundation and another press, which is not a field-commit failure.
  await (await editRangeValue(page, "Pinselgröße (Pixel)")).fill("108");
  check(
    "number field remains a draft before the canvas press",
    (await state()).state.diameter === 120,
  );
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForFunction(
    () => window.atlasObserve([], { events: false }).gesture?.kind === "active",
  );
  const active = await state();
  check(
    "canvas press commits the field before fixing the stroke brush",
    active.state.diameter === 108 &&
      Math.abs(active.gesture.brush.radius - 54 / active.camera.scale) < 1e-9,
  );
  await page.keyboard.press("]");
  await page.keyboard.down("Alt");
  await page.mouse.wheel(0, -160);
  await page.keyboard.up("Alt");
  await page.mouse.wheel(0, -160);
  await page.waitForFunction(
    ({ point, heightBefore }) => {
      const snapshot = window.atlasObserve([point], { events: false });
      return (
        typeof snapshot.samples[0] === "number" &&
        snapshot.samples[0] > heightBefore
      );
    },
    { point, heightBefore },
  );
  const held = await state();
  assert.deepEqual(held.camera, active.camera);
  assert.deepEqual(held.gesture.brush, active.gesture.brush);
  check(
    "active height stroke ignores brush-size keys and wheel gestures",
    held.state.diameter === 108,
  );
  check("held brush changes actual terrain while the pointer is down", true);
  await page.mouse.up();
  await page.waitForFunction(() => {
    const snapshot = window.atlasObserve([], { events: false });
    return snapshot.state.canUndo && !snapshot.state.finishing;
  });
  const heightAfter = await sampleHeight(point);
  check(
    "completed height gesture raises the sampled terrain",
    heightAfter > heightBefore,
  );
  await click(/Rückgängig/);
  await page.waitForFunction(
    () => window.atlasObserve([], { events: false }).state.canRedo,
  );
  check(
    "header undo restores the pre-stroke terrain exactly",
    (await state()).state.canRedo &&
      Math.abs((await sampleHeight(point)) - heightBefore) < 1e-9,
  );
  await click(/Wiederholen/);
  await page.waitForFunction(
    () => window.atlasObserve([], { events: false }).state.canUndo,
  );
  check(
    "header redo restores the completed terrain exactly",
    (await state()).state.canUndo &&
      Math.abs((await sampleHeight(point)) - heightAfter) < 1e-9,
  );
  await heightMode("lower");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await ready();
  await page.mouse.down();
  await page.waitForFunction(
    ({ point, heightAfter }) => {
      const snapshot = window.atlasObserve([point], { events: false });
      return (
        snapshot.gesture?.kind === "active" &&
        typeof snapshot.samples[0] === "number" &&
        snapshot.samples[0] < heightAfter
      );
    },
    { point, heightAfter },
  );
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.waitForFunction(() => {
    const snapshot = window.atlasObserve([], { events: false });
    return !snapshot.gesture && !snapshot.state.finishing;
  });
  check(
    "lowering changes terrain and Escape keeps the completed stroke",
    (await sampleHeight(point)) < heightAfter && (await state()).state.canUndo,
  );

  await page.screenshot({ path: join(out, "height-sliders.png") });
  await click("Haus platzieren");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => {
    const snapshot = window.atlasObserve([], { events: false });
    if (snapshot.state.error) throw new Error(snapshot.state.error);
    return snapshot.readiness.ready;
  });
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => {
    const snapshot = window.atlasObserve([], { events: false });
    return snapshot.houses.headers.length === 1 && !snapshot.state.writing;
  });
  await click("Haus auswählen");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() =>
    Boolean(window.atlasObserve([], { events: false }).state.selectedHouse),
  );
  const beforeHouseSlider = await state();
  const originalRotation = beforeHouseSlider.state.selectedHouse.rotation;
  await dragRange("Hausdrehung", 0.15, 0.6, async () => {
    const dragging = await state();
    check(
      "selected-house slider previews its value without writing on every movement",
      dragging.state.selectedHouse.rotation === originalRotation &&
        dragging.document.historyActions ===
          beforeHouseSlider.document.historyActions &&
        dragging.document.sequence === beforeHouseSlider.document.sequence &&
        Number(
          await page
            .getByRole("slider", { name: "Hausdrehung", exact: true })
            .getAttribute("aria-valuenow"),
        ) > 180,
    );
  });
  await page.waitForFunction((rotation) => {
    const snapshot = window.atlasObserve([], { events: false });
    if (snapshot.state.error) throw new Error(snapshot.state.error);
    return (
      snapshot.state.selectedHouse?.rotation !== rotation &&
      !snapshot.state.writing
    );
  }, originalRotation);
  const afterHouseSlider = await state();
  check(
    "one house-slider drag creates exactly one document action",
    afterHouseSlider.document.historyActions ===
      beforeHouseSlider.document.historyActions + 1 &&
      afterHouseSlider.document.sequence ===
        beforeHouseSlider.document.sequence + 1,
  );
  await click(/Rückgängig/);
  await page.waitForFunction(
    (rotation) =>
      window.atlasObserve([], { events: false }).state.selectedHouse
        ?.rotation === rotation,
    originalRotation,
  );
  check("one Undo restores the complete house rotation", true);
  await click(/Wiederholen/);
  await page.waitForFunction(
    (rotation) =>
      window.atlasObserve([], { events: false }).state.selectedHouse
        ?.rotation === rotation,
    afterHouseSlider.state.selectedHouse.rotation,
  );
  check("one Redo restores the complete house rotation", true);
  const beforeCancelledHouseSlider = await state();
  await dragRange("Hausdrehung", 0.6, 0.3, async () => {
    await page.keyboard.press("Escape");
  });
  const afterCancelledHouseSlider = await state();
  check(
    "Escape cancels an uncommitted house-slider drag",
    afterCancelledHouseSlider.state.selectedHouse.rotation ===
      beforeCancelledHouseSlider.state.selectedHouse.rotation &&
      afterCancelledHouseSlider.document.sequence ===
        beforeCancelledHouseSlider.document.sequence &&
      afterCancelledHouseSlider.document.historyActions ===
        beforeCancelledHouseSlider.document.historyActions,
  );
  await page.screenshot({ path: join(out, "house-sliders.png") });
  await heightMode("lower");
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
  report.error = error.stack ?? String(error);
  await writeFile(
    join(out, "failure-observation.json"),
    JSON.stringify(await state(), null, 2),
  );
  await page.screenshot({ path: join(out, "failure.png") });
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
