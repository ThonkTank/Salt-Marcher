import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { captureCanvas } from "./atlas-p0-desktop.mjs";
import {
  button,
  capture,
  heightMode,
  landPixel,
  position,
  stateSnapshot,
  waterPixel,
} from "./atlas-p0-interactions.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const self = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);
const near = (a, b) => Number.isFinite(a) && Math.abs(a - b) < 1e-8;
const sameSamples = (a, b) =>
  a.length === b.length && a.every((value, index) => near(value, b[index]));

/** Read actual saved coefficients and reconstruct the documented cubic field. */
function inspect(file, { points, level }) {
  const Database = require("better-sqlite3");
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const rows = db
      .prepare(
        "SELECT level,tile_x,tile_y,values_blob FROM height_tiles ORDER BY level,tile_y,tile_x",
      )
      .all();
    const tiles = new Map(
      rows.map((row) => [`${row.level}:${row.tile_x}:${row.tile_y}`, row]),
    );
    const coefficient = (level, x, y) => {
      const tx = Math.floor(x / 64),
        ty = Math.floor(y / 64);
      const row = tiles.get(`${level}:${tx}:${ty}`);
      return row
        ? row.values_blob.readDoubleLE(((y - ty * 64) * 64 + x - tx * 64) * 8)
        : 0;
    };
    const weights = (t) => [
      (1 - t) ** 3 / 6,
      (3 * t ** 3 - 6 * t ** 2 + 4) / 6,
      (-3 * t ** 3 + 3 * t ** 2 + 3 * t + 1) / 6,
      t ** 3 / 6,
    ];
    const samples = points.map(([x, y]) => {
      let value = -100;
      for (let level = 0; level <= 21; level++) {
        const step = 5 * 2 ** level;
        const gx = x / step,
          gy = y / step;
        const ix = Math.floor(gx),
          iy = Math.floor(gy);
        const wx = weights(gx - ix),
          wy = weights(gy - iy);
        for (let j = 0; j < 4; j++)
          for (let i = 0; i < 4; i++)
            value += coefficient(level, ix + i - 1, iy + j - 1) * wx[i] * wy[j];
      }
      return Math.max(-100_000, Math.min(100_000, value));
    });
    const digest = createHash("sha256");
    for (const row of rows) {
      digest.update(`${row.level}:${row.tile_x}:${row.tile_y}\0`);
      digest.update(row.values_blob);
    }
    const step = 5 * 2 ** level;
    return {
      heightDigest: digest.digest("hex"),
      levels: [...new Set(rows.map((row) => row.level))],
      tileXs: [...new Set(rows.map((row) => row.tile_x))],
      samples,
      controls: points.map(([x, y]) =>
        coefficient(level, Math.round(x / step), Math.round(y / step)),
      ),
    };
  } finally {
    db.close();
  }
}

function inspectSaved(file, probes) {
  const result = spawnSync(
    require("electron"),
    [self, "inspect", file, JSON.stringify(probes)],
    {
      cwd: root,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      encoding: "utf8",
      timeout: 30_000,
    },
  );
  if (result.error || result.status !== 0)
    throw new Error(
      `Coast source inspection failed: ${result.error ?? result.stderr}`,
    );
  return JSON.parse(result.stdout);
}

async function settled(page) {
  await page.waitForFunction(
    () => {
      const state = window.atlasObserve([], { events: false });
      if (state.state.error) throw new Error(state.state.error);
      // Pixel evidence must wait for the scene fence, not only submission.
      return (
        !state.state.loading &&
        !state.state.writing &&
        !state.state.fileAction &&
        !state.document.active &&
        !state.document.finishing &&
        state.renderer.submittedRevision === state.document.revision &&
        state.renderer.submittedViewGeneration ===
          state.renderer.viewGeneration &&
        state.renderer.lastCompletedViewGeneration ===
          state.renderer.viewGeneration &&
        state.renderer.lastCompletedFrame >= state.renderer.lastSubmittedFrame
      );
    },
    null,
    { timeout: 30_000 },
  );
}

async function pressReady(page, point) {
  const at = await position(page, point);
  await page.mouse.move(at.x, at.y);
  await page.waitForFunction(() => {
    const state = window.atlasObserve([], { events: false });
    if (state.state.error) throw new Error(state.state.error);
    return state.readiness.ready;
  });
  await page.mouse.down();
  return at;
}

const expectedPixels = (pixels) =>
  pixels.length === 6 &&
  pixels.every((pixel, index) =>
    (index === 2 || index === 5 ? waterPixel : landPixel)(pixel),
  );

export async function runCoastScenario({ launch, out, recordCheck }) {
  const file = join(out, "coast.saltatlas");
  const evidence = {};
  let session = await launch({
    label: "coast-edit",
    diagnostics: true,
    env: { ATLAS_P0_DIALOG_SAVE: file, ATLAS_P0_DIALOG_OPEN: file },
  });
  try {
    const { page } = session;
    await heightMode(page, "land");
    await page.getByLabel("Pinselgröße (Pixel)", { exact: true }).fill("80");
    await page
      .getByLabel("Pinselgröße (Pixel)", { exact: true })
      .press("Enter");
    await page.getByLabel("Küstenform", { exact: true }).selectOption("round");
    await page.getByLabel("Raster anzeigen").uncheck();
    await settled(page);
    const initial = await stateSnapshot(page);
    const level = initial.state.level;
    const step = 5 * 2 ** level;
    const span = 64 * step;
    const radius = initial.state.diameter / initial.camera.scale / 2;
    const points = [-1, -0.75, 0, 0.75, 1].map((x) => [x * span, 0]);
    points.push([0, 2 * radius + 4 * step]);
    const probes = { points, level };
    evidence.probes = probes;
    const expectedLand = [10, 10, 10, 10, 10, -100];
    const expectedFinal = [10, 10, -10, 10, 10, -100];
    const before = (evidence.before = await stateSnapshot(page, points));
    recordCheck(
      "coast: new world is known ocean",
      before.samples.every((z) => z === -100),
    );

    const start = [-1.25 * span, 0];
    const end = [1.25 * span, 0];
    const from = await position(page, start);
    const to = await position(page, end);
    const box = await page.locator("canvas").boundingBox();
    recordCheck(
      "coast: continuous path includes negative and positive source-tile boundaries",
      from.x > box.x + 40 &&
        to.x < box.x + box.width - 40 &&
        start[0] < -span &&
        end[0] > span,
    );
    await pressReady(page, start);
    await page.waitForFunction((start) => {
      const state = window.atlasObserve([start], { events: false });
      if (state.state.error) throw new Error(state.state.error);
      return state.document.active && state.samples[0] > 0;
    }, start);
    const pressed = await stateSnapshot(page, [start]);
    await page.waitForTimeout(200);
    const held = await stateSnapshot(page, [start]);
    recordCheck(
      "coast: Land reaches its interior height immediately and holding does not add elevation",
      near(pressed.samples[0], 10) &&
        sameSamples(held.samples, pressed.samples),
    );
    await page.mouse.move(to.x, to.y, { steps: 32 });
    await page.mouse.up();
    await page.mouse.move(1, 1);
    await settled(page);
    const land = (evidence.land = await stateSnapshot(page, points));
    recordCheck(
      "coast: one Land stroke paints its full path in one history action",
      sameSamples(land.samples, expectedLand) &&
        land.document.historyActions === before.document.historyActions + 1,
      land.samples,
    );
    const landImage = (evidence.landImage = await capture(
      session,
      "coast-land",
      points,
    ));
    recordCheck(
      "coast: completed Land frame contains actual land pixels along the entire path",
      landImage.pixels.slice(0, 5).every(landPixel) &&
        waterPixel(landImage.pixels[5]),
    );
    await button(page, /Rückgängig/);
    await settled(page);
    recordCheck(
      "coast: one Undo removes the whole Land stroke",
      sameSamples((await stateSnapshot(page, points)).samples, before.samples),
    );
    await button(page, /Wiederholen/);
    await settled(page);
    recordCheck(
      "coast: one Redo restores Land exactly",
      sameSamples((await stateSnapshot(page, points)).samples, land.samples),
    );

    await heightMode(page, "sea");
    await pressReady(page, [0, 0]);
    await page.mouse.up();
    await page.mouse.move(1, 1);
    await settled(page);
    const sea = (evidence.sea = await stateSnapshot(page, points));
    recordCheck(
      "coast: Meer cuts a sea-level channel while preserving the surrounding land and deep ocean",
      sameSamples(sea.samples, expectedFinal) &&
        sea.document.historyActions === land.document.historyActions + 1,
      sea.samples,
    );
    const finalImage = (evidence.finalImage = await capture(
      session,
      "coast-sea",
      points,
    ));
    recordCheck(
      "coast: completed Meer frame shows water between retained land",
      expectedPixels(finalImage.pixels),
    );
    await button(page, /Rückgängig/);
    await settled(page);
    recordCheck(
      "coast: Undo restores the terrain before Meer exactly",
      sameSamples((await stateSnapshot(page, points)).samples, land.samples),
    );
    await button(page, /Wiederholen/);
    await settled(page);
    recordCheck(
      "coast: Redo restores the sea cut exactly",
      sameSamples((await stateSnapshot(page, points)).samples, sea.samples),
    );
    await button(page, "Speichern");
    await page.waitForFunction(() => {
      const state = window.atlasObserve([], { events: false }).state;
      return state.saved && !state.fileAction && !state.writing;
    });
    const saved = (evidence.saved = inspectSaved(file, probes));
    recordCheck(
      "coast: real saved author bytes contain exact Land and Meer residuals across tile boundaries",
      sameSamples(saved.samples, expectedFinal) &&
        sameSamples(saved.controls, [110, 110, 90, 110, 110, 0]) &&
        saved.levels.length === 1 &&
        saved.levels[0] === level &&
        saved.tileXs.some((x) => x < 0) &&
        saved.tileXs.some((x) => x > 0),
      saved,
    );
    await button(page, "Neu");
    await settled(page);
    recordCheck(
      "coast: New clears the edited world",
      (await stateSnapshot(page, points)).samples.every((z) => z === -100),
    );
    await button(page, "Öffnen");
    await settled(page);
    recordCheck(
      "coast: UI Open restores both tools' saved terrain",
      sameSamples((await stateSnapshot(page, points)).samples, expectedFinal),
    );
    recordCheck(
      "coast: edited session has no renderer exception",
      session.errors.length === 0,
      session.errors,
    );
    await session.close();

    session = await launch({ label: "coast-restart", project: file });
    await session.page.waitForFunction(
      () =>
        document.querySelector("canvas")?.getAttribute("aria-busy") === "false",
    );
    await session.page.getByLabel("Raster anzeigen").uncheck();
    await session.page.mouse.move(1, 1);
    const deadline = Date.now() + 10_000;
    let restarted;
    do {
      restarted = await captureCanvas(
        session,
        "coast-restarted",
        finalImage.screenPoints,
      );
      if (expectedPixels(restarted.pixels)) break;
      await session.page.waitForTimeout(80);
    } while (Date.now() < deadline);
    evidence.restarted = restarted;
    recordCheck(
      "coast: a fresh ordinary process displays the retained land and sea cut without diagnostics",
      expectedPixels(restarted.pixels) &&
        (await session.page.evaluate(
          () => typeof window.atlasObserve === "undefined",
        )),
    );
    const afterRestart = inspectSaved(file, probes);
    recordCheck(
      "coast: opening and restarting preserve the exact saved height payload",
      afterRestart.heightDigest === saved.heightDigest &&
        sameSamples(afterRestart.samples, saved.samples),
    );
    recordCheck(
      "coast: ordinary restart has no renderer exception",
      session.errors.length === 0,
      session.errors,
    );
  } catch (error) {
    evidence.error = String(error);
    try {
      evidence.failure = await session.page.evaluate(
        () => window.atlasObserve?.([], { events: false }) ?? null,
      );
    } catch (captureError) {
      evidence.observationError = String(captureError);
    }
    throw error;
  } finally {
    await writeFile(
      join(out, "coast-evidence.json"),
      JSON.stringify(evidence, null, 2),
    );
    await session.close();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === self &&
  process.argv[2] === "inspect"
)
  console.log(
    JSON.stringify(
      inspect(resolve(process.argv[3]), JSON.parse(process.argv[4])),
    ),
  );
