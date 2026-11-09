// A bounded diagnosis of the existing product, never a presentation/acceptance gate.
// Usage: node scripts/atlas-p0-graphics-probe.mjs --lab|--hardware --out <new-dir>
//        [--runs 1|2|3] [--gpu-timers]
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchAtlasDesktop } from "./atlas-p0-desktop.mjs";
import {
  brush,
  button,
  exact,
  movingStroke,
  prepareStroke,
  snapshot,
  stateSnapshot,
} from "./atlas-p0-interactions.mjs";
import { distribution, strokeEvidence } from "./atlas-p0-evaluate.mjs";
import { summarizeSubmissionTiming } from "./atlas-p0-timing.mjs";
import { nativePresentationCapability, parseTrace } from "./atlas-p0-trace.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const self = fileURLToPath(import.meta.url);
const argv = process.argv.slice(2);
const value = (name) => {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  if (!argv[index + 1] || argv[index + 1].startsWith("--"))
    throw new Error(`${name} requires a value`);
  return argv[index + 1];
};
const writeJson = (file, data) =>
  writeFile(file, JSON.stringify(data, null, 2) + "\n");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function compositionWork(draws) {
  if (!draws.length)
    throw new Error("Missing actual terrain draw observations");
  const names = [
    "canonicalSamples",
    "deltaSamples",
    "horizontalSamples",
    "projectionProducts",
    "basisCaptureSamples",
    "canonicalBasisBuilds",
    "colourSamples",
    "anchorCopySamples",
    "compositionWork",
  ];
  for (const draw of draws) {
    if (
      names.some(
        (name) => !Number.isSafeInteger(draw[name]) || draw[name] < 0,
      ) ||
      draw.colourSamples + draw.basisCaptureSamples !== draw.composedSamples ||
      draw.canonicalSamples + draw.deltaSamples + draw.basisCaptureSamples >
        draw.composedSamples
    )
      throw new Error("Missing or inconsistent numeric composition facts");
  }
  return Object.fromEntries(
    names.map((name) => [
      name,
      {
        total: draws.reduce((sum, draw) => sum + draw[name], 0),
        perDraw: distribution(draws.map((draw) => draw[name])),
      },
    ]),
  );
}

/** Attribute all measured GL calls to actual draws; never infer pixels from call count. */
function gpuWork(draws, timers) {
  if (!timers.enabled) return { available: false };
  const valid =
    !timers.disjoint &&
    !timers.truncated &&
    timers.droppedEvents === 0 &&
    Number.isFinite(timers.startedAt) &&
    Number.isFinite(timers.stoppedAt) &&
    timers.stoppedAt >= timers.startedAt &&
    draws.every(
      (draw) =>
        Number.isSafeInteger(draw.frame) &&
        draw.frame > 0 &&
        Number.isFinite(draw.uploadStart) &&
        Number.isFinite(draw.submittedAt) &&
        draw.submittedAt >= draw.uploadStart,
    ) &&
    timers.samples.length > 0 &&
    timers.samples.every(
      (sample) =>
        sample.available &&
        Number.isFinite(sample.gpuMs) &&
        sample.gpuMs >= 0 &&
        Number.isFinite(sample.at) &&
        sample.at >= timers.startedAt &&
        sample.at <= timers.stoppedAt &&
        ["canvas", "offscreen"].includes(sample.target),
    );
  const frames = draws
    .filter(
      (draw) =>
        draw.uploadStart >= timers.startedAt &&
        draw.submittedAt <= timers.stoppedAt,
    )
    .map((draw) => ({
      frame: draw.frame,
      composedSamples: draw.composedSamples,
      samples: timers.samples.filter(
        (sample) =>
          sample.at >= draw.uploadStart && sample.at <= draw.submittedAt,
      ),
    }));
  const assigned = frames.flatMap((frame) => frame.samples);
  const covered = (frame) =>
    frame.samples.some((sample) => sample.target === "canvas") &&
    (frame.composedSamples === 0 ||
      frame.samples.some((sample) => sample.target === "offscreen"));
  const complete =
    frames.length > 0 &&
    frames.every(covered) &&
    assigned.length === timers.samples.length &&
    new Set(assigned).size === assigned.length;
  const sum = (frame, target) =>
    frame.samples
      .filter((sample) => sample.target === target)
      .reduce((total, sample) => total + (sample.gpuMs ?? 0), 0);
  const changed = frames.filter((frame) => frame.composedSamples > 0);
  const totalSamples = changed.reduce(
    (total, frame) => total + frame.composedSamples,
    0,
  );
  return {
    available: true,
    valid: valid && complete,
    measuredFrames: frames.length,
    unmeasuredFrames: frames.filter((frame) => !covered(frame)).length,
    unmatchedCalls: timers.samples.filter(
      (sample) => !assigned.includes(sample),
    ).length,
    offscreenMsPerTerrainDraw:
      valid && complete
        ? distribution(changed.map((frame) => sum(frame, "offscreen")))
        : null,
    canvasMsPerFrame:
      valid && complete
        ? distribution(frames.map((frame) => sum(frame, "canvas")))
        : null,
    offscreenMsPerMillionChangedSamples:
      valid && complete && totalSamples > 0
        ? (changed.reduce(
            (total, frame) => total + sum(frame, "offscreen"),
            0,
          ) /
            totalSamples) *
          1e6
        : null,
    interpretation:
      "Offscreen includes separable horizontal projection, numeric and colour passes plus any anchor copy; changed samples come from product facts, not GL call count. projectionProducts is the admitted product count before empty-page skips, not a GPU instruction counter. GPU completion is not native presentation.",
  };
}

async function createFixtures(directory) {
  if (!process.versions.electron) throw new Error("Fixture needs Electron ABI");
  const { ProjectStore } = require(
    join(root, "desktop-dist/project-store.cjs"),
  );
  const {
    createCoastFixture,
    heightTilesFromControls,
    heightSpacing,
  } = require(join(root, "desktop-dist/model.cjs"));
  const levels = Array.from({ length: 22 }, (_, i) => i).filter((i) => i !== 4);
  const fields = [];
  // Constant extra fields sum to zero within the complete stroke+brush region.
  // They change reconstruction cost while retaining the simple fixture's shape.
  for (const [index, level] of levels.entries()) {
    const step = heightSpacing(level),
      controls = [];
    const amount = index < 18 ? (index % 2 ? -1 : 1) : [1, 1, -2][index - 18];
    for (
      let y = Math.floor(-2400 / step) - 2;
      y <= Math.ceil(2400 / step) + 2;
      y++
    )
      for (
        let x = Math.floor(-2000 / step) - 2;
        x <= Math.ceil(500 / step) + 2;
        x++
      )
        controls.push([x, y, amount]);
    fields.push(...heightTilesFromControls(level, controls));
  }
  await mkdir(directory, { recursive: true });
  const result = {};
  for (const name of ["simple", "many-levels"]) {
    const tiles = createCoastFixture({ trench: false });
    if (name === "many-levels") tiles.push(...fields);
    const store = new ProjectStore(join(directory, `${name}-work`));
    try {
      const initial = store.status();
      store.commit({
        sessionId: initial.sessionId,
        sequence: 1,
        transactionId: randomUUID(),
        patches: tiles.map((after) => ({ key: after.key, after })),
      });
      const status = store.status();
      const file = join(directory, `${name}.saltatlas`);
      await store.saveProject(
        { sessionId: status.sessionId, sequence: status.sequence },
        file,
      );
      result[name] = {
        file,
        sha256: sha256(await readFile(file)),
        sourceTiles: tiles.length,
        levels: [...new Set(tiles.map((tile) => tile.level))].sort(
          (a, b) => a - b,
        ),
      };
    } finally {
      store.close();
    }
  }
  return result;
}

// Wrap draw calls only in the explicit instrumented diagnostic. Results are
// read after QUERY_RESULT_AVAILABLE; no gl.finish, waiting fence or sync readback.
async function installTimers(page, enabled) {
  return page.evaluate((enabled) => {
    const gl = document.querySelector("canvas")?.getContext("webgl2");
    const extension = gl?.getExtension("EXT_disjoint_timer_query_webgl2");
    const info = {
      available: Boolean(extension),
      enabled: Boolean(extension && enabled),
    };
    if (!info.enabled) return info;
    // A faster 101-point stroke can exceed 4,096 calls with three passes per
    // changed tile. Bound diagnostic storage independently of product budgets.
    const queryLimit = 32_768;
    let truncated = false;
    const startedAt = performance.now();
    const startEvent = window.atlasObserve([], { events: false }).eventCount;
    const records = [],
      originals = {};
    let framebuffer = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
    originals.bindFramebuffer = gl.bindFramebuffer;
    gl.bindFramebuffer = function (target, buffer) {
      if (target === gl.FRAMEBUFFER || target === gl.DRAW_FRAMEBUFFER)
        framebuffer = buffer;
      return originals.bindFramebuffer.call(this, target, buffer);
    };
    for (const name of [
      "drawArrays",
      "drawElements",
      "drawArraysInstanced",
      "drawElementsInstanced",
    ]) {
      originals[name] = gl[name];
      gl[name] = function (...args) {
        if (records.length >= queryLimit) {
          truncated = true;
          return originals[name].apply(this, args);
        }
        const query = gl.createQuery();
        const record = {
          query,
          target: framebuffer ? "offscreen" : "canvas",
          at: performance.now(),
        };
        gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
        try {
          return originals[name].apply(this, args);
        } finally {
          gl.endQuery(extension.TIME_ELAPSED_EXT);
          records.push(record);
        }
      };
    }
    window.atlasGraphicsProbe = async (points = []) => {
      for (const [name, original] of Object.entries(originals))
        gl[name] = original;
      const stoppedAt = performance.now();
      // GL wrappers and this journal stop in one renderer task. Later frames
      // during asynchronous query readback do not enter either measurement.
      const observation = window.atlasObserve(points, {
        sinceEvent: startEvent,
      });
      const deadline = performance.now() + 3000;
      while (
        records.some(
          ({ query }) =>
            !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE),
        ) &&
        performance.now() < deadline
      )
        await new Promise((resolve) => setTimeout(resolve, 20));
      const disjoint = Boolean(gl.getParameter(extension.GPU_DISJOINT_EXT));
      const samples = records.map(({ query, ...record }) => {
        const available = Boolean(
          gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE),
        );
        const gpuMs =
          !disjoint && available
            ? gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6
            : null;
        gl.deleteQuery(query);
        return { ...record, available, gpuMs };
      });
      delete window.atlasGraphicsProbe;
      return {
        ...info,
        startedAt,
        stoppedAt,
        startEvent,
        droppedEvents: observation.droppedEvents,
        observation,
        disjoint,
        queryLimit,
        truncated,
        samples,
      };
    };
    return { ...info, startedAt, startEvent };
  }, enabled);
}

async function runCase({ directory, name, fixture, lab, timers }) {
  await mkdir(directory);
  const desktop = await launchAtlasDesktop({
    lab,
    diagnostics: true,
    project: fixture.file,
    env: { ATLAS_P0_DIALOG_UNSAVED: "discard" },
  });
  const session = { ...desktop, directory, instance: { id: name } };
  const { app, page } = session;
  const result = {
    name,
    fixture,
    acceptance: false,
    nativePresentation: false,
  };
  let tracing = false;
  let terrainDraws = [];
  let droppedEvents;
  const tracePath = join(directory, "chromium-trace.json");
  try {
    await page.waitForFunction(() => typeof window.atlasObserve === "function");
    await exact(page);
    await button(page, "Nahansicht");
    await page.getByLabel("Raster anzeigen").uncheck();
    await brush(page, 512, 4000);
    await exact(page);
    const points = Array.from({ length: 101 }, (_, index) => [
      -800,
      -1250 + index * 25,
    ]);
    const probes = [points[0], points[50], points[100]];
    const prepared = await prepareStroke(session, points);
    const first = prepared.positions[0];
    await page.mouse.move(first.x, first.y);
    await exact(page);
    result.before = await stateSnapshot(page, probes);
    if (!result.before.samples.every(Number.isFinite))
      throw new Error("Exact pre-stroke author heights are unavailable");
    // This ordinary read observes the sources selected by the actual display
    // power. It does not install data, assign readiness or mutate the editor.
    result.presentationSources = await page.evaluate(
      async ({ sessionId, power }) => {
        const read = await window.atlasDesktop.readPresentation({
          sessionId,
          power,
          bounds: [-2000, -2400, 500, 2400],
        });
        return {
          power,
          sequence: read.sequence,
          sourceTiles: read.tiles.length,
          levels: [...new Set(read.tiles.map((tile) => tile.level))].sort(
            (a, b) => a - b,
          ),
          overviewTiles: read.overviews.length,
        };
      },
      {
        sessionId: result.before.sessionId,
        power: result.before.renderer.presentationPower,
      },
    );
    if (name !== "simple" && result.presentationSources.levels.length !== 22)
      throw new Error(
        "The chosen display power does not reconstruct all 22 local source levels",
      );
    result.host = await app.evaluate(async ({ BrowserWindow, screen }) => {
      const window = BrowserWindow.getAllWindows()[0];
      return {
        ...(await globalThis.__atlasHost.info()),
        display: screen.getDisplayMatching(window.getBounds()),
        visible: window.isVisible(),
        focused: window.isFocused(),
      };
    });
    result.view = await page.evaluate(() => {
      const gl = document.querySelector("canvas").getContext("webgl2");
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
        gpu: String(
          gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
        ),
      };
    });
    if (
      result.view.width !== 1440 ||
      result.view.height !== 960 ||
      result.view.dpr !== 1
    )
      throw new Error("Expected existing 1440x960 DPR 1 scenario");
    if (!lab && /swiftshader|llvmpipe|software|softpipe/i.test(result.view.gpu))
      throw new Error("Hardware diagnostic refused software graphics");
    if (!lab && result.host.gpuFeatures?.webgl !== "enabled")
      throw new Error("Hardware WebGL acceleration is not enabled");
    if (!lab && (!result.host.visible || !result.host.focused))
      throw new Error(
        "Hardware window is not visible and focused; graphics timing would be unqualified",
      );
    result.gpuTimers = await installTimers(page, timers);
    await app.evaluate(() => globalThis.__atlasHost.startTrace());
    tracing = true;
    if (name === "static-control") {
      await app.evaluate(async ({ BrowserWindow }, positions) => {
        const contents = BrowserWindow.getAllWindows()[0].webContents;
        for (const position of positions) {
          contents.sendInputEvent({
            type: "mouseMove",
            x: Math.round(position.x),
            y: Math.round(position.y),
          });
          await new Promise((resolve) => setTimeout(resolve, 24));
        }
      }, prepared.positions);
      const observed = await snapshot(page, probes, {
        sinceEvent: result.before.eventCount,
      });
      await writeJson(join(directory, "observation.json"), observed);
      result.frameIntervals = distribution(
        observed.events
          .filter((e) => e.kind === "frame")
          .map((e) => e.interval),
      );
      const draws = observed.events.filter((e) => e.kind === "height-draw");
      terrainDraws = draws;
      droppedEvents = observed.droppedEvents;
      result.staticControl = {
        draws: draws.length,
        updatedTiles: draws.reduce((n, e) => n + e.updatedTiles, 0),
        composedSamples: draws.reduce((n, e) => n + e.composedSamples, 0),
        uploadedBytes: draws.reduce((n, e) => n + e.uploadedBytes, 0),
        pendingBefore: {
          uploadBytes: result.before.renderer.pendingUploadBytes,
          compositionTiles: result.before.renderer.pendingCompositionTiles,
        },
        pendingAfter: {
          uploadBytes: observed.renderer.pendingUploadBytes,
          compositionTiles: observed.renderer.pendingCompositionTiles,
        },
        modelUnchanged:
          observed.document.revision === result.before.document.revision,
      };
      if (
        !result.staticControl.modelUnchanged ||
        result.staticControl.updatedTiles !== 0 ||
        result.staticControl.composedSamples !== 0 ||
        result.staticControl.uploadedBytes !== 0 ||
        Object.values(result.staticControl.pendingBefore).some(
          (value) => value !== 0,
        ) ||
        Object.values(result.staticControl.pendingAfter).some(
          (value) => value !== 0,
        ) ||
        !draws.length
      )
        throw new Error(
          "Static control did not retain unchanged composed terrain",
        );
    } else {
      const stroke = await movingStroke(session, points);
      result.stroke = {
        timedOut: stroke.timedOut,
        time: stroke.time,
        timeline: strokeEvidence(stroke),
      };
      result.submission = summarizeSubmissionTiming(stroke.after.events);
      const draws = stroke.after.events.filter((e) => e.kind === "height-draw");
      terrainDraws = draws;
      droppedEvents = stroke.after.droppedEvents;
      result.work = {
        draws: draws.length,
        updatedTiles: distribution(draws.map((e) => e.updatedTiles)),
        composedSamples: distribution(draws.map((e) => e.composedSamples)),
        totalComposedSamples: draws.reduce((n, e) => n + e.composedSamples, 0),
      };
      await writeJson(join(directory, "observation.json"), stroke.after);
      if (stroke.timedOut) throw new Error("Stroke observer timed out");
    }
    if (result.gpuTimers.enabled) {
      const { observation, ...measured } = await page.evaluate(
        (points) => window.atlasGraphicsProbe(points),
        probes,
      );
      result.gpuTimers = measured;
      droppedEvents = observation.droppedEvents;
      terrainDraws = observation.events.filter(
        (event) =>
          event.kind === "height-draw" &&
          event.uploadStart >= measured.startedAt &&
          event.submittedAt <= measured.stoppedAt,
      );
      // Keep the complete journal underlying timer attribution, including any
      // final cursor/terrain draw after the stroke's own submission snapshot.
      await writeJson(join(directory, "observation.json"), observation);
    }
    if (droppedEvents !== 0)
      throw new Error("Graphics observation journal is incomplete");
    result.composition = compositionWork(terrainDraws);
    result.gpuWork = gpuWork(terrainDraws, result.gpuTimers);
    if (result.gpuWork.available && !result.gpuWork.valid)
      throw new Error(
        "GPU queries are incomplete or cannot be assigned to actual terrain draws",
      );
    await page.waitForTimeout(500);
    await app.evaluate(
      (_, file) => globalThis.__atlasHost.stopTrace(file),
      tracePath,
    );
    tracing = false;
    const trace = parseTrace(await readFile(tracePath, "utf8"));
    const swaps = trace.traceEvents.filter(
      (e) =>
        e.name === "SkiaOutputSurfaceImplOnGpu::SwapBuffers" && e.ph === "X",
    );
    result.swap = {
      inclusiveMs: distribution(swaps.map((e) => e.dur / 1000)),
      threadCpuMs: distribution(
        swaps.filter((e) => Number.isFinite(e.tdur)).map((e) => e.tdur / 1000),
      ),
      throttled: trace.traceEvents.filter((e) => e.name === "Swap throttled")
        .length,
    };
    result.after = await stateSnapshot(page, probes);
    if (name !== "static-control") {
      if (!result.after.samples.every(Number.isFinite))
        throw new Error("Exact post-stroke author heights are unavailable");
      result.heightChanged = result.after.samples.some(
        (v, i) => v !== result.before.samples[i],
      );
      await button(page, /Rückgängig/);
      await exact(page);
      result.undone = await stateSnapshot(page, probes);
      result.undoRestored = result.undone.samples.every(
        (v, i) =>
          Number.isFinite(v) && Math.abs(v - result.before.samples[i]) <= 1e-7,
      );
      if (!result.heightChanged || !result.undoRestored)
        throw new Error("Content or Undo mismatch");
    }
    result.status = "DIAGNOSTIC";
    if (desktop.errors.length) throw new Error(desktop.errors.join("; "));
  } catch (error) {
    result.status = "ERROR";
    result.error = String(error.stack ?? error);
  } finally {
    if (tracing)
      await app
        .evaluate(
          (_, file) => globalThis.__atlasHost.stopTrace(file),
          tracePath,
        )
        .catch(() => {});
    await desktop.close();
    await writeFile(join(directory, "electron.log"), desktop.output.join(""));
    await writeJson(join(directory, "diagnostic.json"), result);
  }
  return result;
}

if (argv[0] === "--create") {
  console.log(JSON.stringify(await createFixtures(resolve(argv[1]))));
} else {
  const lab = argv.includes("--lab"),
    hardware = argv.includes("--hardware");
  const out = value("--out"),
    runs = Number(value("--runs") ?? 3);
  if (
    lab === hardware ||
    !out ||
    !Number.isInteger(runs) ||
    runs < 1 ||
    runs > 3
  )
    throw new Error(
      "Usage: --lab|--hardware --out <new directory> [--runs 1|2|3] [--gpu-timers]",
    );
  const directory = resolve(out);
  await mkdir(dirname(directory), { recursive: true });
  await mkdir(directory); // Earlier evidence is never overwritten.
  const report = {
    purpose: "bounded-graphics-diagnosis",
    driverSha256: sha256(await readFile(self)),
    acceptance: false,
    nativePresentation: false,
    mode: lab ? "software-laboratory" : "hardware-diagnostic",
    runs,
    plannedCases: Array.from({ length: runs }, (_, index) =>
      ["simple", "many-levels", "static-control"].map((name) => ({
        run: index + 1,
        name,
      })),
    ).flat(),
    presentation: nativePresentationCapability,
    limitation:
      "Tracing and optional per-draw GPU queries perturb timings. Offscreen draw time excludes compositor/presentation; inclusive SwapBuffers spans include waiting. Static control uses real hover input and cached terrain, not brush edits. No measurement upgrades the native gate.",
    stimulus: {
      diameterPx: 512,
      rateFtPerSecond: 4000,
      positions: 101,
      intervalMs: 24,
    },
    cases: [],
  };
  if (
    hardware &&
    process.platform === "linux" &&
    !process.env.DISPLAY &&
    !process.env.WAYLAND_DISPLAY
  ) {
    report.status = "BLOCKED";
    report.blocker = "NO_NATIVE_DISPLAY";
    process.exitCode = 2;
  } else {
    const built = JSON.parse(
      await readFile(join(root, "desktop-dist/build.json"), "utf8"),
    );
    report.build = built;
    if (built.dirty)
      throw new Error("Build must record a clean product source tree");
    const created = spawnSync(
      require("electron"),
      [self, "--create", join(directory, "fixtures")],
      {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
        encoding: "utf8",
        timeout: 120000,
      },
    );
    if (created.error || created.status !== 0)
      throw new Error(`Fixture failed: ${created.error ?? created.stderr}`);
    report.fixtures = JSON.parse(created.stdout);
    for (let run = 1; run <= runs; run++) {
      for (const name of ["simple", "many-levels", "static-control"]) {
        const options = {
          directory: join(directory, `${run}-${name}`),
          name,
          fixture:
            report.fixtures[name === "static-control" ? "many-levels" : name],
          lab,
          timers: argv.includes("--gpu-timers"),
        };
        let result;
        try {
          result = await runCase(options);
        } catch (error) {
          result = {
            name,
            status: "ERROR",
            error: String(error.stack ?? error),
          };
        }
        if (
          result.host?.build?.sourceSha256 !== built.sourceSha256 ||
          result.host?.build?.lockSha256 !== built.lockSha256
        ) {
          result.status = "ERROR";
          result.identityError =
            "Runtime build identity differs from requested build";
        }
        report.cases.push({ run, ...result });
        await writeJson(join(directory, "report.json"), report);
        console.log(`[atlas-p0-graphics] ${run} ${name}: ${result.status}`);
        if (result.status === "ERROR") process.exitCode = 1;
      }
    }
    report.status =
      report.cases.length === runs * 3 &&
      report.cases.every((c) => c.status === "DIAGNOSTIC")
        ? "DIAGNOSTIC"
        : "ERROR";
  }
  await writeJson(join(directory, "report.json"), report);
  console.log(
    JSON.stringify({ status: report.status, directory, acceptance: false }),
  );
}
