import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { captureCanvas } from "./atlas-p0-desktop.mjs";
import {
  button,
  capture,
  exact,
  landPixel,
  position,
  stateSnapshot,
  storeActivityPosition,
  waitForSaveCompletion,
  waterPixel,
} from "./atlas-p0-interactions.mjs";
import { referenceLandscapeSample } from "./atlas-p3-landscape-reference.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const self = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);
const probes = [
  [160, 160],
  [360, 160],
  [-800, 0],
  [-300, -700],
  [700, -700],
  [1600, -700],
  [-300, 700],
  [700, 700],
  [1600, 700],
];
const centre = probes[0];
const samePixel = (a, b) =>
  a?.length === 4 &&
  b?.length === 4 &&
  a.every((value, index) => Math.abs(value - b[index]) <= 2);
const sameValues = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function electronNode(args) {
  const result = spawnSync(require("electron"), args, {
    cwd: root,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    encoding: "utf8",
    timeout: 60_000,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `Landscape fixture process failed: ${result.error ?? result.stderr}`,
    );
  return JSON.parse(result.stdout);
}

function digest(sources) {
  const hash = createHash("sha256");
  for (const source of [...sources].sort((a, b) =>
    a.key.localeCompare(b.key),
  )) {
    hash.update(source.key);
    for (const bytes of [source.mask, source.values].filter(Boolean))
      hash.update(
        Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      );
  }
  return hash.digest("hex");
}

/** Full offline source inspection of this deliberately small real fixture. */
async function inspect(file, points) {
  const { ProjectStore } = require(
    join(root, "desktop-dist/project-store.cjs"),
  );
  const directory = await mkdtemp(join(tmpdir(), "atlas-landscape-inspect-"));
  const store = new ProjectStore(directory);
  try {
    const info = await store.openProject(file);
    const request = {
      sessionId: info.sessionId,
      bounds: [-100_000_000, -100_000_000, 100_000_000, 100_000_000],
      minLevel: 0,
    };
    const landscape = store.readLandscapeRegion(request).tiles;
    const heights = store.readRegion(request).tiles;
    const levels = [...new Set(landscape.map((source) => source.level))].sort(
      (a, b) => a - b,
    );
    let explicitEmpty = 0;
    for (const source of landscape)
      for (let index = 0; index < source.mask.length; index++)
        if (
          source.mask[index] &&
          source.values.subarray(index * 4, index * 4 + 4).every((v) => v === 0)
        )
          explicitEmpty++;
    return {
      sequence: info.sequence,
      levels,
      sourceTiles: landscape.length,
      explicitEmpty,
      samples: points.map(([x, y]) =>
        referenceLandscapeSample(landscape, x, y),
      ),
      coarseSamples: points.map(([x, y]) =>
        referenceLandscapeSample(landscape, x, y, {
          minLevel: levels.at(-1) ?? 0,
        }),
      ),
      heightDigest: digest(heights),
      landscapeDigest: digest(landscape),
      levelDigests: Object.fromEntries(
        levels.map((level) => [
          level,
          digest(landscape.filter((source) => source.level === level)),
        ]),
      ),
    };
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
}

async function settled(page) {
  await exact(page, 30_000);
  await page.waitForFunction(
    () => {
      const state = window.atlasObserve([], { events: false });
      if (state.state.error) throw new Error(state.state.error);
      return state.renderer.landscape?.ready === true;
    },
    null,
    { timeout: 30_000 },
  );
}

async function tool(page, name, diameter, density) {
  // Icons are part of the accessible name, as with the existing height tools.
  await button(page, new RegExp(`${name}$`));
  await page.getByLabel("Pinselgröße", { exact: true }).fill(String(diameter));
  await page.getByLabel("Pinselgröße", { exact: true }).press("Enter");
  if (name === "Wald") {
    await page
      .getByLabel("Landschaft", { exact: true })
      .selectOption({ label: "Wald" });
    await page
      .getByLabel("Landschaftsdichte", { exact: true })
      .fill(String(density));
    await page.getByLabel("Landschaftsdichte", { exact: true }).press("Enter");
  }
}

async function readyPointer(page, point = centre) {
  const at = await position(page, point);
  await page.mouse.move(at.x, at.y);
  await page.waitForFunction(
    () => {
      const state = window.atlasObserve([], { events: false });
      if (state.state.error) throw new Error(state.state.error);
      return state.readiness.ready === true;
    },
    null,
    { timeout: 30_000 },
  );
  return at;
}

async function dab(page) {
  await readyPointer(page);
  await page.mouse.down();
  await page.mouse.up();
  await settled(page);
}

/** Native Down; ordinary Up/Escape/Blur handlers in that same event-loop turn. */
async function sealedDab(page) {
  await readyPointer(page);
  await page.evaluate(() => {
    document.querySelector("canvas").addEventListener(
      "pointerdown",
      (event) => {
        const canvas = event.currentTarget;
        const before = window.atlasObserve([], { events: false });
        canvas.dispatchEvent(
          new PointerEvent("pointerup", {
            pointerId: event.pointerId,
            pointerType: "mouse",
            isPrimary: true,
            button: 0,
            buttons: 0,
            clientX: event.clientX,
            clientY: event.clientY,
            bubbles: true,
          }),
        );
        const sealed = window.atlasObserve([], { events: false });
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        window.dispatchEvent(new Event("blur"));
        window.__atlasLandscapeTerminal = {
          before,
          sealed,
          after: window.atlasObserve([], { events: false }),
        };
      },
      { once: true },
    );
  });
  await page.mouse.down();
  const terminal = await page.evaluate(() => window.__atlasLandscapeTerminal);
  await page.mouse.up();
  await settled(page);
  return terminal;
}

async function image(session, label) {
  const box = await session.page.locator("canvas").boundingBox();
  if (!box) throw new Error("Landscape canvas is unavailable");
  await session.page.mouse.move(
    box.x + box.width - 20,
    box.y + box.height - 20,
  );
  await settled(session.page);
  return capture(session, label, probes);
}

async function saveAs(session, file) {
  await session.app.evaluate((_electron, file) => {
    process.env.ATLAS_P0_DIALOG_SAVE = file;
  }, file);
  const since = await storeActivityPosition(session);
  await button(session.page, "Speichern unter");
  const start = await session.app.evaluate(async (_electron, since) => {
    const deadline = performance.now() + 20_000;
    while (performance.now() < deadline) {
      const activity = globalThis.__atlasHost.storeActivity({
        sinceEvent: since,
      });
      if (activity.droppedEvents)
        throw new Error("Save observations were dropped");
      const start = activity.events.find(
        (event) => event.kind === "snapshot" && event.phase === "start",
      );
      if (start) return start;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("Landscape save did not start");
  }, since);
  await waitForSaveCompletion(session, start);
  await settled(session.page);
}

/**
 * A held stroke through the real controller at two samples per animation frame.
 * Native Down/Up bracket coalesced PointerEvents so the rate is reproducible
 * without Playwright round trips throttling it to one event per frame.
 */
async function runContinuousLandscape({ launch, out, recordCheck, project }) {
  const file = join(out, "landscape-continuous.saltatlas");
  const session = await launch({
    label: "landscape-continuous",
    diagnostics: true,
    project,
  });
  const evidence = {
    purpose:
      "Continuous native-handler correctness and comparable software-renderer work; no hardware latency acceptance",
  };
  try {
    const { page } = session;
    await button(page, "Nahansicht");
    await page.getByLabel("Raster anzeigen").uncheck();
    await tool(page, "Wald", 16, 75);
    const path = Array.from({ length: 321 }, (_, i) => [
      -320 + i * 2.5,
      80 * Math.sin((i * Math.PI * 2) / 320),
    ]);
    const samples = path.filter((_, index) => index % 40 === 0);
    await readyPointer(page, path[0]);
    await settled(page);
    const before = (evidence.before = await stateSnapshot(page, samples));
    const base = (evidence.base = await capture(
      session,
      "continuous-base",
      samples,
    ));
    await page.evaluate(() => {
      document.querySelector("canvas").addEventListener(
        "pointerdown",
        (event) => {
          window.__atlasLandscapePointer = event.pointerId;
        },
        { once: true },
      );
    });
    await page.mouse.down();
    evidence.stroke = await page.evaluate(async (path) => {
      const canvas = document.querySelector("canvas");
      const box = canvas.getBoundingClientRect();
      const start = window.atlasObserve([], { events: false });
      const clock = performance.now();
      let sent = 0;
      for (let offset = 1; offset < path.length; offset += 2) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const samples = path.slice(offset, offset + 2).map(
          ([x, y]) =>
            new PointerEvent("pointermove", {
              pointerId: window.__atlasLandscapePointer,
              pointerType: "mouse",
              isPrimary: true,
              button: -1,
              buttons: 1,
              clientX:
                box.x +
                box.width / 2 +
                (x - start.camera.x) * start.camera.scale,
              clientY:
                box.y +
                box.height / 2 +
                (y - start.camera.y) * start.camera.scale,
              bubbles: true,
            }),
        );
        const event = samples.at(-1);
        Object.defineProperty(event, "getCoalescedEvents", {
          value: () => samples,
        });
        canvas.dispatchEvent(event);
        sent += samples.length;
        const state = window.atlasObserve([], { events: false });
        if (state.state.error || !state.document.active)
          return {
            sent,
            elapsedMs: performance.now() - clock,
            error: state.state.error,
            state,
          };
      }
      return {
        sent,
        elapsedMs: performance.now() - clock,
        state: window.atlasObserve([], { sinceEvent: start.eventCount }),
      };
    }, path);
    recordCheck(
      "landscape: continuous 320-sample stroke crosses negative and positive tile borders without resetting",
      evidence.stroke.sent === 320 &&
        !evidence.stroke.error &&
        evidence.stroke.state.document.active &&
        evidence.stroke.state.document.revision > before.document.revision,
      { sent: evidence.stroke.sent, error: evidence.stroke.error },
    );
    const paintPasses = evidence.stroke.state.events.filter(
      (event) => event.kind === "height-terrain",
    );
    const work = (evidence.work = Object.fromEntries(
      [
        "uploadedBytes",
        "canonicalSamples",
        "deltaSamples",
        "colourSamples",
        "horizontalSamples",
        "projectionProducts",
      ].map((key) => [
        key,
        paintPasses.reduce((sum, event) => sum + (event[key] ?? 0), 0),
      ]),
    ));
    recordCheck(
      "landscape: real GPU colour passes reuse unchanged height projection",
      work.colourSamples > 0 &&
        work.canonicalSamples === 0 &&
        work.deltaSamples === 0 &&
        work.horizontalSamples === 0 &&
        work.projectionProducts === 0 &&
        evidence.stroke.state.droppedEvents === 0,
      work,
    );
    const end = await position(page, path.at(-1));
    await page.mouse.move(end.x, end.y);
    await page.mouse.up();
    await settled(page);
    const after = (evidence.after = await stateSnapshot(page, samples));
    recordCheck(
      "landscape: held stroke preserves its beginning, bends and endpoint as one Undo action",
      after.document.sequence === before.document.sequence + 1 &&
        after.document.historyActions === before.document.historyActions + 1 &&
        after.landscapeDisplay.every((weights) => weights?.[0] > 0),
    );
    const changed = (evidence.changed = await capture(
      session,
      "continuous-painted",
      samples,
    ));
    recordCheck(
      "landscape: continuous stroke updates real land pixels while preserving underwater colour",
      base.pixels.some(
        (pixel, i) => landPixel(pixel) && !samePixel(pixel, changed.pixels[i]),
      ) &&
        base.pixels.every(
          (pixel, i) =>
            !waterPixel(pixel) || samePixel(pixel, changed.pixels[i]),
        ),
    );
    await button(page, /Rückgängig/);
    await settled(page);
    const undone = (evidence.undone = await stateSnapshot(page, samples));
    recordCheck(
      "landscape: one Undo removes the entire continuous stroke",
      undone.landscapeDisplay.every((weights) =>
        weights?.every((value) => value === 0),
      ),
    );
    await button(page, /Wiederholen/);
    await settled(page);
    const redone = (evidence.redone = await stateSnapshot(page, samples));
    recordCheck(
      "landscape: one Redo restores the complete continuous stroke",
      sameValues(redone.landscapeDisplay, after.landscapeDisplay),
    );
    await saveAs(session, file);
    const saved = (evidence.saved = electronNode([
      self,
      "inspect",
      file,
      JSON.stringify(samples),
    ]));
    const original = electronNode([
      self,
      "inspect",
      project,
      JSON.stringify(samples),
    ]);
    recordCheck(
      "landscape: continuous stroke saves exact author weights without changing height bytes",
      sameValues(saved.samples, after.landscapeDisplay) &&
        saved.heightDigest === original.heightDigest,
    );
    recordCheck(
      "landscape: continuous session has no renderer exception",
      session.errors.length === 0,
      session.errors,
    );
  } catch (error) {
    evidence.error = String(error);
    try {
      evidence.failure = await stateSnapshot(session.page);
      evidence.failureEvents = await session.page.evaluate(
        (sinceEvent) => window.atlasObserve([], { sinceEvent }).events,
        Math.max(0, evidence.failure.eventCount - 300),
      );
    } catch (captureError) {
      evidence.observationError = String(captureError);
    }
    throw error;
  } finally {
    await writeFile(
      join(out, "landscape-continuous-evidence.json"),
      JSON.stringify(evidence, null, 2),
    );
    await session.close();
  }
}

export async function runLandscapeScenario({ launch, out, recordCheck }) {
  const fixtures = electronNode([
    join(root, "scripts/atlas-p0-fixture.mjs"),
    "create",
    join(out, "landscape-fixture"),
  ]);
  await runContinuousLandscape({
    launch,
    out,
    recordCheck,
    project: fixtures.files.coast,
  });
  const beforeFile = join(out, "landscape-before-coarse.saltatlas");
  const finalFile = join(out, "landscape-final.saltatlas");
  let session = await launch({
    label: "landscape-edit",
    diagnostics: true,
    project: fixtures.files.coast,
    env: { ATLAS_P0_DIALOG_OPEN: finalFile },
  });
  const evidence = {
    purpose: "P3.1 functional content, no native performance acceptance",
    images: {},
  };
  try {
    const { page } = session;
    await button(page, "Nahansicht");
    await page.getByLabel("Raster anzeigen").uncheck();
    const base = (evidence.images.base = await image(
      session,
      "landscape-base",
    ));
    const box = await page.locator("canvas").boundingBox();
    const points = (evidence.samplePoints = base.screenPoints.map(
      ({ x, y }) => [
        base.camera.x + (x + 0.5 - box.width / 2) / base.camera.scale,
        base.camera.y + (y + 0.5 - box.height / 2) / base.camera.scale,
      ],
    ));
    const original = (evidence.original = electronNode([
      self,
      "inspect",
      fixtures.files.coast,
      JSON.stringify(points),
    ]));
    recordCheck(
      "landscape: real coast fixture exposes land and water",
      landPixel(base.pixels[0]) &&
        landPixel(base.pixels[1]) &&
        waterPixel(base.pixels[2]),
    );
    recordCheck(
      "landscape: initial project has no prepainted landscape",
      original.sourceTiles === 0,
    );

    await button(page, "Regionsansicht");
    await tool(page, "Wald", 128, 35);
    const initialSequence = (await stateSnapshot(page)).document.sequence;
    const terminal = (evidence.postUpCancellation = await sealedDab(page));
    recordCheck(
      "landscape: Up remains sealed after Escape and blur before the next RAF",
      terminal.before.document.active &&
        terminal.sealed.document.finishing &&
        terminal.after.document.finishing &&
        terminal.after.document.sequence === initialSequence,
    );
    recordCheck(
      "landscape: coarse brush uses one document transaction",
      (await stateSnapshot(page)).document.sequence === initialSequence + 1,
    );
    await button(page, "Nahansicht");
    const forest = (evidence.images.forest = await image(
      session,
      "landscape-forest",
    ));
    recordCheck(
      "landscape: authored forest changes actual land pixels",
      !samePixel(forest.pixels[0], base.pixels[0]) &&
        !samePixel(forest.pixels[1], base.pixels[1]),
    );
    recordCheck(
      "landscape: water masks forest without altering terrain pixels",
      samePixel(forest.pixels[2], base.pixels[2]),
    );

    await tool(page, "Lichtung", 32);
    const beforeClearing = (await stateSnapshot(page)).document.sequence;
    await dab(page);
    recordCheck(
      "landscape: one clearing stroke records one ordinary action",
      (await stateSnapshot(page)).document.sequence === beforeClearing + 1,
    );
    const cleared = (evidence.images.cleared = await image(
      session,
      "landscape-cleared",
    ));
    recordCheck(
      "landscape: fine clearing reveals the original terrain",
      samePixel(cleared.pixels[0], base.pixels[0]) &&
        samePixel(cleared.pixels[1], forest.pixels[1]),
    );
    await button(page, /Rückgängig/);
    const undoClearing = (evidence.images.undoClearing = await image(
      session,
      "landscape-clearing-undone",
    ));
    recordCheck(
      "landscape: clearing Undo restores inherited forest",
      samePixel(undoClearing.pixels[0], forest.pixels[0]),
    );
    await button(page, /Wiederholen/);
    const redoClearing = (evidence.images.redoClearing = await image(
      session,
      "landscape-clearing-redone",
    ));
    recordCheck(
      "landscape: clearing Redo restores explicit empty",
      samePixel(redoClearing.pixels[0], base.pixels[0]),
    );

    await tool(page, "Wald", 32, 100);
    await readyPointer(page);
    const beforePreview = (evidence.beforePreview = await stateSnapshot(
      page,
      points,
    ));
    await page.mouse.down();
    await page.waitForFunction(
      (points) => {
        const state = window.atlasObserve(points, { events: false });
        if (state.state.error) throw new Error(state.state.error);
        return state.document.active && state.landscapeDisplay?.[0]?.[0] > 0;
      },
      points,
      { timeout: 30_000 },
    );
    const preview = (evidence.preview = await stateSnapshot(page, points));
    recordCheck(
      "landscape: active preview is materialized and drawn before cancellation",
      preview.document.active &&
        preview.document.sequence === beforePreview.document.sequence &&
        preview.landscapeDisplay[0][0] > 0,
    );
    await page.keyboard.press("Escape");
    await page.mouse.up();
    const cancelled = (evidence.images.cancelled = await image(
      session,
      "landscape-cancelled",
    ));
    const afterCancel = (evidence.afterCancel = await stateSnapshot(
      page,
      points,
    ));
    recordCheck(
      "landscape: Escape before Up restores preview without an action",
      afterCancel.document.sequence === beforePreview.document.sequence &&
        afterCancel.document.historyActions ===
          beforePreview.document.historyActions &&
        samePixel(cancelled.pixels[0], base.pixels[0]) &&
        afterCancel.landscapeDisplay[0].every((value) => value === 0),
    );

    await saveAs(session, beforeFile);
    const before = (evidence.beforeCoarse = electronNode([
      self,
      "inspect",
      beforeFile,
      JSON.stringify(points),
    ]));
    recordCheck(
      "landscape: saved fine clearing is exactly empty above inherited forest",
      before.levels.length >= 2 &&
        before.explicitEmpty > 0 &&
        before.samples[0].every((value) => value === 0) &&
        before.coarseSamples[0][0] > 0 &&
        before.samples[1][0] > 0,
    );

    await button(page, "Regionsansicht");
    await tool(page, "Wald", 128, 100);
    await dab(page);
    await button(page, "Nahansicht");
    const changed = (evidence.images.coarseChanged = await image(
      session,
      "landscape-coarse-changed",
    ));
    recordCheck(
      "landscape: fine clearing survives visible coarse forest change",
      samePixel(changed.pixels[0], base.pixels[0]) &&
        !samePixel(changed.pixels[1], forest.pixels[1]),
    );
    await button(page, /Rückgängig/);
    const coarseUndo = (evidence.images.coarseUndo = await image(
      session,
      "landscape-coarse-undone",
    ));
    recordCheck(
      "landscape: coarse Undo preserves clearing and restores former forest",
      samePixel(coarseUndo.pixels[0], base.pixels[0]) &&
        samePixel(coarseUndo.pixels[1], forest.pixels[1]),
    );
    await button(page, /Wiederholen/);
    const coarseRedo = (evidence.images.coarseRedo = await image(
      session,
      "landscape-coarse-redone",
    ));
    recordCheck(
      "landscape: coarse Redo restores the same displayed content",
      coarseRedo.pixels.every((pixel, index) =>
        samePixel(pixel, changed.pixels[index]),
      ),
    );
    await saveAs(session, finalFile);
    const after = (evidence.afterCoarse = electronNode([
      self,
      "inspect",
      finalFile,
      JSON.stringify(points),
    ]));
    const coarseLevel = before.levels.at(-1);
    recordCheck(
      "landscape: coarse changes preserve every finer source payload",
      before.levels
        .filter((level) => level < coarseLevel)
        .every(
          (level) => before.levelDigests[level] === after.levelDigests[level],
        ) &&
        before.levelDigests[coarseLevel] !== after.levelDigests[coarseLevel],
    );
    recordCheck(
      "landscape: full independent saved-source sampler confirms clearing and forest",
      after.samples[0].every((value) => value === 0) &&
        after.samples[1][0] > before.samples[1][0] &&
        after.coarseSamples[0][0] > 0,
    );
    const displayed = (evidence.displayed = await stateSnapshot(page, points));
    recordCheck(
      "landscape: visible texels across multiple tiles match the full saved-source sampler",
      sameValues(displayed.landscapeDisplay, after.samples),
    );
    recordCheck(
      "landscape: nonempty coverage changes visible land across the painted region",
      after.samples.every((weights, index) =>
        waterPixel(base.pixels[index]) ||
        weights.reduce((sum, value) => sum + value, 0) < 16
          ? true
          : !samePixel(changed.pixels[index], base.pixels[index]),
      ),
    );
    recordCheck(
      "landscape: height payloads remain unchanged",
      original.heightDigest === before.heightDigest &&
        before.heightDigest === after.heightDigest,
    );
    recordCheck(
      "landscape: hidden underwater authors remain in the saved file",
      after.samples[2][0] > 0 && samePixel(changed.pixels[2], base.pixels[2]),
    );

    await button(page, "Neu");
    await settled(page);
    await button(page, "Öffnen");
    await button(page, "Nahansicht");
    await page.getByLabel("Raster anzeigen").uncheck();
    const reopened = (evidence.images.reopened = await image(
      session,
      "landscape-reopened",
    ));
    recordCheck(
      "landscape: ordinary Open restores the saved pixels",
      reopened.pixels.every((pixel, index) =>
        samePixel(pixel, changed.pixels[index]),
      ),
    );
    recordCheck(
      "landscape: editing session has no renderer exception",
      session.errors.length === 0,
      session.errors,
    );
    await session.close();

    // No diagnostic binding on this start: inspect the actual ordinary canvas.
    session = await launch({ label: "landscape-restart", project: finalFile });
    await button(session.page, "Nahansicht");
    await session.page.getByLabel("Raster anzeigen").uncheck();
    const restartBox = await session.page.locator("canvas").boundingBox();
    if (!restartBox)
      throw new Error("Restarted landscape canvas is unavailable");
    await session.page.mouse.move(
      restartBox.x + restartBox.width - 20,
      restartBox.y + restartBox.height - 20,
    );
    const deadline = Date.now() + 30_000;
    let restarted;
    do {
      restarted = await captureCanvas(
        session,
        "landscape-restarted",
        base.screenPoints,
      );
      if (
        restarted.pixels.every((pixel, index) =>
          samePixel(pixel, changed.pixels[index]),
        )
      )
        break;
      await session.page.waitForTimeout(100);
    } while (Date.now() < deadline);
    evidence.images.restarted = restarted;
    recordCheck(
      "landscape: fresh ordinary process preserves clearing, forest and water pixels",
      restarted.pixels.every((pixel, index) =>
        samePixel(pixel, changed.pixels[index]),
      ),
    );
    recordCheck(
      "landscape: restart has no diagnostic binding or renderer exception",
      session.errors.length === 0 &&
        (await session.page.evaluate(
          () => typeof window.atlasObserve === "undefined",
        )),
      session.errors,
    );
    const reopenedSources = (evidence.reopenedSources = electronNode([
      self,
      "inspect",
      finalFile,
      JSON.stringify(points),
    ]));
    recordCheck(
      "landscape: inspection and restart preserve saved author bytes",
      reopenedSources.landscapeDigest === after.landscapeDigest &&
        reopenedSources.heightDigest === after.heightDigest &&
        sameValues(reopenedSources.samples, after.samples),
    );
  } catch (error) {
    evidence.error = String(error);
    try {
      evidence.failure = await stateSnapshot(session.page, probes);
      evidence.failureEvents = await session.page.evaluate(
        (sinceEvent) => window.atlasObserve([], { sinceEvent }).events,
        Math.max(0, evidence.failure.eventCount - 300),
      );
    } catch (captureError) {
      evidence.failureObservationError = String(captureError);
    }
    throw error;
  } finally {
    await writeFile(
      join(out, "landscape-evidence.json"),
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
      await inspect(resolve(process.argv[3]), JSON.parse(process.argv[4])),
    ),
  );
