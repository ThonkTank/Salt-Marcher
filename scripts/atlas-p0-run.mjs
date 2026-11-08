import { _electron as electron } from "@playwright/test";
import { createRequire } from "node:module";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { cpus, release, totalmem } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateAcceptance,
  evaluateFunctional,
  evaluateSubmissionDiagnostics,
  evaluateColdSubmissionDiagnostics,
  checkBuildIdentity,
  P0_REQUIREMENTS,
} from "./atlas-p0-evaluate.mjs";
import { analyzeTrace } from "./atlas-p0-trace.mjs";
import {
  snapshot,
  stateSnapshot,
  button,
  brush,
  exact,
  position,
  capture,
  navigateTo,
  zoomAndPan,
  heldStroke,
  waitForSaveCompletion,
  observeStroke as observeDab,
  waterPixel,
  landPixel,
} from "./atlas-p0-interactions.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);
const runtimeExecutablePath = require("electron");
const executableIndex = argv.indexOf("--executable");
const packaged = executableIndex >= 0;
const executablePath = packaged
  ? resolve(argv[executableIndex + 1])
  : runtimeExecutablePath;
const lab = argv.includes("--lab"),
  native = argv.includes("--native");
const full = argv.includes("--full") || argv.includes("--acceptance");
const onlyIndex = argv.indexOf("--only");
const only = onlyIndex < 0 ? null : argv[onlyIndex + 1];
if (only && !["interactions", "scaling", "collection"].includes(only))
  throw new Error("Unknown --only selection");
const caseIndex = argv.indexOf("--case");
const scenarioId = caseIndex < 0 ? null : argv[caseIndex + 1];
const runsIndex = argv.indexOf("--runs");
const selectedRuns = runsIndex < 0 ? null : Number(argv[runsIndex + 1]);
if ((caseIndex >= 0 || runsIndex >= 0) && (only !== "collection" || !full))
  throw new Error("--case/--runs require --full --only collection diagnostics");
if (
  caseIndex >= 0 &&
  !P0_REQUIREMENTS.scenarios.some(
    (scenario) => scenario.id === scenarioId && scenario.kind !== "navigation",
  )
)
  throw new Error("Unknown collection case");
if (
  runsIndex >= 0 &&
  (!Number.isInteger(selectedRuns) || selectedRuns < 1 || selectedRuns > 3)
)
  throw new Error("Diagnostic --runs must be 1, 2 or 3");
let independentRunId = "pilot-1";
const outIndex = argv.indexOf("--out");
const out = resolve(
  outIndex >= 0
    ? argv[outIndex + 1]
    : join(
        "artifacts/atlas-rebuild/runs",
        new Date().toISOString().replaceAll(":", "-") +
          "-" +
          randomUUID().slice(0, 8),
      ),
);
if (lab === native) {
  console.error(
    "Usage: node scripts/atlas-p0-run.mjs (--lab | --native) [--executable packaged-binary] [--full] [--only interactions|scaling|collection] [--case collection-id --runs 1|2|3] [--out directory]",
  );
  process.exit(2);
}
await mkdir(out, { recursive: true });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const log = (message) => console.log(`[atlas-p0] ${message}`);
if (full && only)
  log(
    `Partial ${only} diagnostics in ${selectedRuns ?? 3} group(s)${scenarioId ? `; case ${scenarioId}` : ""}. Full acceptance still requires all cases and three independent complete runs.`,
  );
else if (full)
  log(
    "Full collection requests three independent complete scenario runs. Native acceptance still requires a qualified display and proven exact-frame presentation mapping.",
  );
else if (native)
  log(
    "Native pilot only; use --full for the required repetitions. Acceptance still requires a qualified display and proven exact-frame presentation mapping.",
  );
const report = {
  schemaVersion: 1,
  mode: lab ? "lab" : "native",
  scope: only
    ? `P0 partial ${only} diagnostics${scenarioId ? `: ${scenarioId}` : ""}`
    : full
      ? "P0 full scenario collection plus representative scaling"
      : "P0 representative functional pilot plus scaling; limited timing samples",
  selection: only ?? "all",
  diagnosticSelection: { scenarioId, selectedRuns },
  startedAt: new Date().toISOString(),
  manifest: P0_REQUIREMENTS,
  excluded: [
    "later P1-P9 tools and final scenario scope",
    "physical pixel timing",
    "Aaron's hardware performance",
    "cold operating-system page cache",
  ],
  reference: {
    qualified: false,
    softwareRendering: lab,
    displayHz: null,
    hardware: {
      cpu: cpus()[0]?.model,
      ramBytes: totalmem(),
      os: `${process.platform} ${release()}`,
    },
  },
  presentationMapping: {
    status: "unsupported",
    method: null,
    reason:
      "No proven join from Atlas semantic render generation to Chromium surface-frame/display-frame presentation. Submission and RAF remain proxies.",
    clock: { calibrated: false },
  },
  functional: { checks: [] },
  runs: [],
  negativeControls: [],
  errors: [],
};
const check = (id, passed, details = {}) => {
  report.functional.checks.push({
    id,
    independentRunId,
    passed: Boolean(passed),
    ...details,
  });
  if (!passed) throw new Error(`Functional check failed: ${id}`);
};
const closeEnough = (actual, expected) =>
  actual.length === expected.length &&
  actual.every(
    (value, index) =>
      Number.isFinite(value) && Math.abs(value - expected[index]) < 1e-7,
  );
// A coarse overview may evict fine authors. An unknown canonical sample stays
// null; known values must still be exact. Detail views and saved files below
// require every sample, so this never certifies missing fine data as preserved.
const knownValuesAgree = (actual, expected) =>
  actual.length === expected.length &&
  actual.every(
    (value, index) =>
      value === null ||
      (Number.isFinite(value) && Math.abs(value - expected[index]) < 1e-7),
  );

function fixtureCommand(...args) {
  const result = spawnSync(
    runtimeExecutablePath,
    [join(root, "scripts/atlas-p0-fixture.mjs"), ...args],
    {
      cwd: root,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      encoding: "utf8",
      timeout: 300_000,
      maxBuffer: 8 * 1024 ** 2,
    },
  );
  if (result.status !== 0 || result.error)
    throw new Error(
      `Fixture process failed: ${result.error ?? result.stderr ?? result.status}`,
    );
  return JSON.parse(result.stdout.trim());
}

async function launch(project, label, fault = "none") {
  const role =
    label.startsWith("control-") || label.startsWith("scaling-")
      ? "control"
      : "scenario";
  if (role === "scenario") label = `${independentRunId}-${label}`;
  const sessionDirectory = join(out, label);
  await mkdir(sessionDirectory, { recursive: true });
  const env = {
    ...process.env,
    ATLAS_P0_PROJECT: project,
    ATLAS_P0_DIALOG_OPEN: project,
    ATLAS_P0_DIALOG_SAVE: project,
    ATLAS_P0_DIALOG_UNSAVED: "discard",
    ATLAS_P0_DIAGNOSTICS: "1",
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ATLAS_P0_FAULT;
  if (fault !== "none") env.ATLAS_P0_FAULT = fault;
  const args = lab
    ? [
        "--ozone-platform=headless",
        "--ozone-override-screen-size=1600,1200",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ]
    : [];
  if (!packaged) args.push(join(root, "desktop-dist/main.cjs"));
  const app = await electron.launch({
    executablePath,
    args,
    env,
    timeout: 30_000,
  });
  const output = [];
  app.process().stdout?.on("data", (data) => output.push(String(data)));
  app.process().stderr?.on("data", (data) => output.push(String(data)));
  const page = await app.firstWindow();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.setDefaultTimeout(20_000);
  try {
    await page.waitForFunction(
      () => {
        const error = document.querySelector('[role="alert"]')?.textContent;
        if (error) throw new Error(error);
        return typeof window.atlasObserve === "function";
      },
      null,
      { timeout: 30_000 },
    );
  } catch (error) {
    const details = {
      error: String(error),
      pageErrors,
      body: await page
        .locator("body")
        .innerText()
        .catch(() => "unavailable"),
    };
    await writeFile(
      join(sessionDirectory, "startup-failure.json"),
      JSON.stringify(details, null, 2),
    );
    await page
      .screenshot({ path: join(sessionDirectory, "startup-failure.png") })
      .catch(() => {});
    await app.close();
    await writeFile(join(sessionDirectory, "electron.log"), output.join(""));
    throw new Error(
      `Electron renderer startup failed: ${JSON.stringify(details)}`,
    );
  }
  const metadata = await app.evaluate(async () =>
    globalThis.__atlasHost.info(),
  );
  const buildIdentity = checkBuildIdentity(
    report.workspaceBuild,
    metadata.build,
    metadata.buildProvenance,
  );
  if (packaged && metadata.packaged !== true)
    buildIdentity.failures.push({
      code: "REQUESTED_EXECUTABLE_IS_NOT_PACKAGED",
    });
  buildIdentity.passed = buildIdentity.failures.length === 0;
  if (!buildIdentity.passed) {
    const evidence = {
      executablePath,
      requestedPackaged: packaged,
      observedPackaged: metadata.packaged,
      workspaceBuild: report.workspaceBuild,
      executedBuild: metadata.build,
      provenance: metadata.buildProvenance,
      identity: buildIdentity,
    };
    await writeFile(
      join(sessionDirectory, "build-identity-failure.json"),
      JSON.stringify(evidence, null, 2),
    );
    await app.close();
    await writeFile(join(sessionDirectory, "electron.log"), output.join(""));
    report.errors.push({
      code: "EXECUTED_BUILD_IDENTITY_FAILED",
      failures: buildIdentity.failures,
    });
    throw new Error(
      `Executed build identity rejected: ${JSON.stringify(buildIdentity.failures)}`,
    );
  }
  report.build = {
    ...metadata.build,
    sha256: packaged
      ? report.packagedBuild.sha256
      : report.workspaceBuild.sha256,
    provenance: metadata.buildProvenance,
    workspaceSourceAndLockVerified: true,
  };
  const view = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    dpr: devicePixelRatio,
    visible: document.visibilityState,
    focused: document.hasFocus(),
    timeOrigin: performance.timeOrigin,
  }));
  const gpu = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return { available: false };
    const extension = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      available: true,
      renderer: extension
        ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      vendor: extension
        ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL)
        : gl.getParameter(gl.VENDOR),
      version: gl.getParameter(gl.VERSION),
    };
  });
  const instance = {
    id: label,
    independentRunId,
    role,
    instanceId: randomUUID(),
    pid: app.process().pid,
    executablePath,
    args,
    metadata,
    executedBuild: metadata.build,
    buildProvenance: metadata.buildProvenance,
    buildIdentity,
    view,
    gpu,
    scenarios: [],
  };
  report.runs.push(instance);
  if (!report.reference.viewport) {
    report.reference.viewport = {
      width: view.width,
      height: view.height,
      dpr: view.dpr,
    };
    report.reference.hardware.gpu = gpu.renderer ?? "unknown";
    report.reference.softwareRendering =
      lab || /swiftshader|llvmpipe|software/i.test(gpu.renderer ?? "");
    report.reference.displayHz =
      metadata.displays?.[0]?.displayFrequency ??
      metadata.display?.displayFrequency ??
      metadata.displayFrequency ??
      null;
    // A display existing is insufficient to silently nominate it as the reference.
    report.reference.qualified = false;
  }
  await writeFile(
    join(sessionDirectory, "environment.json"),
    JSON.stringify({ ...instance, scenarios: undefined }, null, 2),
  );
  log(
    `${label}: Electron ${metadata.versions.electron}; ${view.width}×${view.height} DPR ${view.dpr}; ${gpu.renderer}`,
  );
  return {
    app,
    page,
    instance,
    directory: sessionDirectory,
    async close() {
      try {
        const final = await snapshot(page);
        await writeFile(
          join(sessionDirectory, "observation.json"),
          JSON.stringify(final, null, 2),
        );
        instance.final = {
          document: final.document,
          state: final.state,
          renderer: final.renderer,
          droppedEvents: final.droppedEvents,
          background: final.background,
        };
        instance.storeMetrics = await app.evaluate(() =>
          globalThis.__atlasHost.metrics(),
        );
        instance.pageErrors = pageErrors;
      } finally {
        await app.close();
        await writeFile(
          join(sessionDirectory, "electron.log"),
          output.join(""),
        );
      }
    },
  };
}

async function values(page, points) {
  return (await stateSnapshot(page, points)).samples;
}
async function dab(session, point = [0, 0], timeout = 5000) {
  const before = await stateSnapshot(session.page);
  const at = await position(session.page, point);
  await session.page.mouse.move(at.x, at.y);
  await session.page.mouse.down();
  await session.page.mouse.up();
  return observeDab(session, before, timeout);
}
async function editDuringActualSave(session, point) {
  const attempts = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const worker = await stateSnapshot(session.page);
    if (
      worker.background.active !== true ||
      worker.background.sessionId !== worker.sessionId
    ) {
      await button(session.page, "Hintergrundarbeit starten");
      await session.page.waitForFunction(() => {
        const o = window.atlasObserve([], { events: false });
        return (
          o.background.active === true &&
          o.background.sessionId === o.sessionId &&
          o.background.samples > 0
        );
      });
    }
    const before = await stateSnapshot(session.page, [point]);
    const at = await position(session.page, point);
    const previous = await session.app.evaluate(
      () => globalThis.__atlasHost.storeActivity?.() ?? [],
    );
    const known = [...new Set(previous.map((e) => e.token))];
    // Observe real utility-process activity. Send ordinary native mouse events
    // only while a new real snapshot/publish interval is actually open.
    const monitor = session.app.evaluate(
      async ({ BrowserWindow }, { at, known }) => {
        const deadline = performance.now() + 800;
        while (performance.now() < deadline) {
          const events = globalThis.__atlasHost.storeActivity?.() ?? [];
          const active = events.find(
            (e) =>
              e.phase === "start" &&
              !known.includes(e.token) &&
              !events.some(
                (end) =>
                  end.token === e.token &&
                  end.kind === e.kind &&
                  end.phase === "end",
              ),
          );
          if (active) {
            const contents = BrowserWindow.getAllWindows()[0].webContents;
            const observedWorker = await contents.executeJavaScript(
              "(() => { const o = window.atlasObserve([], { events: false }); return { sessionId: o.sessionId, background: o.background }; })()",
            );
            if (
              observedWorker.background.active !== true ||
              observedWorker.background.sessionId !== observedWorker.sessionId
            )
              return {
                dispatched: false,
                reason: "worker-finished-before-input",
                observedActive: active,
                observedWorker,
              };
            const coordinates = { x: Math.round(at.x), y: Math.round(at.y) };
            contents.sendInputEvent({ type: "mouseMove", ...coordinates });
            contents.sendInputEvent({
              type: "mouseDown",
              button: "left",
              clickCount: 1,
              ...coordinates,
            });
            for (let step = 1; step <= 4; step++) {
              await new Promise((resolve) => setTimeout(resolve, 24));
              contents.sendInputEvent({
                type: "mouseMove",
                x: coordinates.x + step * 32,
                y: coordinates.y + (step % 2) * 4,
                modifiers: ["leftButtonDown"],
              });
            }
            contents.sendInputEvent({
              type: "mouseUp",
              button: "left",
              clickCount: 1,
              x: coordinates.x + 128,
              y: coordinates.y,
            });
            return { dispatched: true, observedActive: active, observedWorker };
          }
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
        return { dispatched: false };
      },
      { at, known },
    );
    await button(session.page, "Speichern");
    const trigger = await monitor;
    if (!trigger.dispatched) {
      attempts.push({ attempt, trigger, overlapProven: false });
      const started =
        trigger.observedActive ??
        (await session.app.evaluate(
          (_electron, known) =>
            globalThis.__atlasHost
              .storeActivity()
              .find(
                (event) =>
                  event.phase === "start" && !known.includes(event.token),
              ),
          known,
        ));
      if (started) await waitForSaveCompletion(session, started);
      continue;
    }
    const edit = await observeDab(session, before);
    const afterHeight = (await values(session.page, [point]))[0];
    // Completion is only needed to verify the observed interval succeeded. The
    // original native input and model/submission timestamps remain unchanged.
    await session.page.waitForFunction(
      () => {
        const { state } = window.atlasObserve([], { events: false });
        if (state.error) throw new Error(state.error);
        return !state.writing;
      },
      null,
      { timeout: 10_000 },
    );
    const activity = await waitForSaveCompletion(
      session,
      trigger.observedActive,
    );
    const finished = await stateSnapshot(session.page);
    const intervals = activity
      .filter((e) => e.phase === "start" && !known.includes(e.token))
      .map((start) => ({
        start,
        end: activity.find(
          (end) =>
            end.token === start.token &&
            end.kind === start.kind &&
            end.phase === "end",
        ),
      }))
      .filter((pair) => pair.end?.success === true);
    const matches = edit.samples
      .filter((sample) => sample.inputKind === "edit")
      .slice(0, 1)
      .flatMap((sample) =>
        intervals
          .filter(({ start, end }) => {
            const epoch = edit.after.timeOrigin + sample.createdAt;
            return (
              start.sessionId === edit.after.sessionId &&
              epoch >= start.epochMs &&
              epoch <= end.epochMs
            );
          })
          .map((interval) => ({
            inputId: sample.inputId,
            inputEpochMs: edit.after.timeOrigin + sample.createdAt,
            ...interval,
          })),
      );
    const overlapProven =
      matches.length > 0 &&
      before.background.active &&
      before.background.sessionId === before.sessionId &&
      trigger.observedWorker?.sessionId === before.sessionId &&
      trigger.observedWorker?.background.sessionId === before.sessionId &&
      trigger.observedWorker?.background.active === true &&
      finished.background.sessionId === before.sessionId &&
      Number.isFinite(before.background.samples) &&
      before.background.samples > 0 &&
      finished.background.samples > before.background.samples &&
      Number.isFinite(before.samples[0]) &&
      Number.isFinite(afterHeight) &&
      afterHeight > before.samples[0] &&
      !edit.timedOut &&
      edit.samples.length >= 2 &&
      edit.samples.every((s) => Number.isFinite(s.submissionAt));
    attempts.push({
      attempt,
      trigger,
      overlapProven,
      matches,
      activity,
      samples: edit.samples,
      beforeHeight: before.samples[0],
      afterHeight,
      backgroundBefore: before.background,
      backgroundAfter: finished.background,
    });
    if (overlapProven) return { passed: true, attempts, edit };
    // Keep failed dispatched attempts in the evidence. The populated terrain
    // fixture supplies real save work; no artificial store delay is inserted.
    await session.page.waitForFunction(
      () => !window.atlasObserve([], { events: false }).state.writing,
    );
  }
  return { passed: false, attempts };
}

async function emptyNavigation(fixture) {
  const file = join(out, `${independentRunId}-empty-working.saltatlas`);
  await copyFile(fixture.files.empty, file);
  const session = await launch(file, "empty-navigation");
  try {
    await exact(session.page);
    for (const grid of [true, false]) {
      await session.page.getByLabel("Raster anzeigen").setChecked(grid);
      const before = await snapshot(session.page);
      const metricsBefore = await session.app.evaluate(() =>
        globalThis.__atlasHost.metrics(),
      );
      const start = performance.now();
      const wheelChecks = [];
      do {
        const canvas = await session.page.locator("canvas").boundingBox();
        if (!canvas) throw new Error("Navigation canvas unavailable");
        // Pan moves the world origin. Keep native input on the actual canvas
        // instead of following that origin out of the window during long runs.
        const p = {
          x: Math.round(canvas.x + canvas.width / 2),
          y: Math.round(canvas.y + canvas.height / 2),
        };
        await session.page.mouse.move(p.x, p.y);
        for (let i = 0; i < 8; i++) {
          const old = (await stateSnapshot(session.page)).camera;
          const delta = i % 2 ? -80 : 80;
          await session.page.mouse.wheel(0, delta);
          await session.page.waitForFunction(
            ({ scale, delta }) => {
              const current = window.atlasObserve([], { events: false }).camera
                .scale;
              return delta > 0 ? current < scale : current > scale;
            },
            { scale: old.scale, delta },
            { timeout: 2000 },
          );
          const now = (await stateSnapshot(session.page)).camera;
          wheelChecks.push({
            before: old,
            after: now,
            delta,
            passed: delta > 0 ? now.scale < old.scale : now.scale > old.scale,
          });
          await session.page.waitForTimeout(40);
        }
        await session.page.mouse.down({ button: "middle" });
        await session.page.mouse.move(p.x + 120, p.y + 70, { steps: 12 });
        await session.page.mouse.up({ button: "middle" });
      } while (performance.now() - start < 30_000);
      const after = await snapshot(session.page);
      const metricsAfter = await session.app.evaluate(() =>
        globalThis.__atlasHost.metrics(),
      );
      const cutoff = Math.max(
        0,
        ...before.events.filter((e) => e.kind === "input").map((e) => e.id),
      );
      const inputs = after.events.filter(
        (e) =>
          e.kind === "input" && e.id > cutoff && e.inputKind === "navigation",
      );
      const frames = after.events
        .slice(before.events.length)
        .filter((e) => e.kind === "frame");
      session.instance.scenarios.push({
        id: grid ? "M01-grid-on" : "M01-grid-off",
        kind: "navigation",
        durationMs: performance.now() - start,
        samples: inputs.map((e) => ({
          inputId: e.id,
          createdAt: e.createdAt,
          handlerAt: e.at,
          presentation: null,
        })),
        authorChanges: after.document.sequence - before.document.sequence,
        cameraBlockedOnStore: metricsAfter.reads !== metricsBefore.reads,
        cpuWorkMs: frames.map((e) => e.cpuMs),
        rafFrameIntervalsMs: frames.map((e) => e.interval),
        presentationFrameIntervalsMs: [],
        droppedEvents: after.droppedEvents,
      });
      check(
        grid ? "empty-navigation-grid-on" : "empty-navigation-grid-off",
        inputs.length > 0 &&
          wheelChecks.length >= 8 &&
          wheelChecks.every((c) => c.passed) &&
          before.document.sequence === after.document.sequence &&
          metricsAfter.commits === metricsBefore.commits &&
          metricsAfter.reads === metricsBefore.reads &&
          (after.camera.x !== before.camera.x ||
            after.camera.y !== before.camera.y),
        {
          inputs: inputs.length,
          wheelChecks,
          authorChanges: 0,
          storeReads: metricsAfter.reads - metricsBefore.reads,
        },
      );
    }
  } finally {
    await session.close();
  }
}

async function traceSummary(file) {
  const bytes = await readFile(file);
  const analysis = analyzeTrace(bytes.toString());
  await writeFile(
    file.replace(/\.json$/, "-analysis.json"),
    JSON.stringify(analysis, null, 2),
  );
  return {
    file,
    sha256: hash(bytes),
    bytes: bytes.length,
    events: analysis.events,
    selectedEventCounts: analysis.selectedEventCounts,
    exactSemanticFrameMapping: analysis.mappingStatus,
    missingEdge: analysis.missingEdge,
  };
}

async function coastJourney(fixture) {
  const file = join(out, `${independentRunId}-coast-working.saltatlas`);
  await copyFile(fixture.files.coast, file);
  const session = await launch(file, "coast-journey");
  const points = fixture.expected.points;
  try {
    await exact(session.page);
    await session.page.getByLabel("Raster anzeigen").uncheck();
    check(
      "canonical-fixture",
      closeEnough(await values(session.page, points), fixture.expected.before),
    );
    const navigationBehavior = await zoomAndPan(session);
    check(
      "visible-zoom",
      navigationBehavior.zoom.passed,
      navigationBehavior.zoom,
    );
    check("pan-anchor", navigationBehavior.pan.passed, navigationBehavior.pan);
    const continuous = await heldStroke(session);
    check("continuous-stroke-live", continuous.live.passed, continuous.live);
    check("continuous-stroke-undo", continuous.undo.passed, continuous.undo);
    await button(session.page, "Weltansicht");
    await exact(session.page);
    const world = await snapshot(session.page);
    const worldImage = await capture(session, "world-view", []);
    await button(session.page, "Nahansicht");
    await exact(session.page);
    const nearAgain = await values(session.page, points);
    const remoteChecks = [];
    for (const origin of fixture.origins.slice(2)) {
      await navigateTo(session.page, origin);
      await exact(session.page);
      const actual = await values(
        session.page,
        points.map(([x, y]) => [x + origin[0], y + origin[1]]),
      );
      remoteChecks.push({
        origin,
        actual,
        passed: closeEnough(actual, fixture.expected.before),
      });
    }
    await navigateTo(session.page, [0, 0]);
    await exact(session.page);
    check(
      "world-detail-roundtrip",
      world.camera.scale === 0.000002 &&
        closeEnough(nearAgain, fixture.expected.before) &&
        remoteChecks.every((c) => c.passed),
      { worldCamera: world.camera, worldImage, nearAgain, remoteChecks },
    );
    const beforeImage = await capture(session, "coast-before", [[-800, 0]]);
    await button(session.page, "Regionsansicht");
    await exact(session.page);
    await brush(session.page, 64, 100);
    await session.app.evaluate(() => globalThis.__atlasHost.startTrace());
    const coarse = await dab(session);
    // Preserve presentation reporter completion after submission. This tail is
    // outside the measured input/model/submission intervals and adds no samples.
    await session.page.waitForTimeout(500);
    const tracePath = join(session.directory, "chromium-trace.json");
    const actualTracePath = await session.app.evaluate(
      (_electron, path) => globalThis.__atlasHost.stopTrace(path),
      tracePath,
    );
    try {
      report.trace = await traceSummary(actualTracePath);
    } catch (error) {
      report.trace = {
        requestedPath: tracePath,
        actualPath: actualTracePath,
        status: "unavailable",
        error: String(error),
      };
    }
    if (!full)
      session.instance.scenarios.push({
        id: "M04-coarse-fine",
        kind: "edit",
        samples: coarse.samples,
        droppedEvents: coarse.after.droppedEvents,
      });
    report.submissionDiagnostics = evaluateSubmissionDiagnostics(
      coarse.samples,
    );
    check(
      "coarse-exact-values",
      !coarse.timedOut &&
        coarse.samples.length >= 2 &&
        coarse.samples.every((s) => Number.isFinite(s.submissionAt)) &&
        closeEnough(
          await values(session.page, points),
          fixture.expected.afterCoarseDab,
        ),
      {
        samples: await values(session.page, points),
        expected: fixture.expected.afterCoarseDab,
      },
    );
    await button(session.page, "Nahansicht");
    await exact(session.page);
    const afterImage = await capture(session, "coast-after", [[-800, 0]]);
    const water = beforeImage.pixels[0],
      land = afterImage.pixels[0];
    check(
      "terrain-pixels",
      water &&
        land &&
        water[2] > water[0] &&
        land[0] > land[2] &&
        JSON.stringify(water) !== JSON.stringify(land),
      { before: beforeImage, after: afterImage },
    );
    await button(session.page, /Rückgängig/);
    await exact(session.page);
    const undone = await values(session.page, points);
    await button(session.page, /Wiederholen/);
    await exact(session.page);
    const redone = await values(session.page, points);
    check(
      "undo-redo",
      closeEnough(undone, fixture.expected.before) &&
        closeEnough(redone, fixture.expected.afterCoarseDab),
      { undone, redone },
    );
    await button(session.page, "Speichern");
    await session.page.waitForFunction(() => window.atlasObserve().state.saved);
    const stored = fixtureCommand("inspect", file);
    check(
      "coarse-preserves-fine",
      stored.fineSha256 === fixture.coast.fineSha256 &&
        closeEnough(stored.samples, fixture.expected.afterCoarseDab),
      {
        beforeFineSha256: fixture.coast.fineSha256,
        afterFineSha256: stored.fineSha256,
        storedSamples: stored.samples,
      },
    );
    const previousSession = (await snapshot(session.page)).sessionId;
    await button(session.page, "Öffnen");
    await session.page.waitForFunction(
      (previous) => window.atlasObserve().sessionId !== previous,
      previousSession,
    );
    await exact(session.page);
    check(
      "save-reopen",
      closeEnough(
        await values(session.page, points),
        fixture.expected.afterCoarseDab,
      ),
    );

    // Cold source absence is observed before the real navigation. No preparatory
    // dataReady wait or direct camera/model invocation is permitted here.
    const target = [79_200, 0];
    const coldBefore = (await values(session.page, [target]))[0] === null;
    check("cold-before-navigation", coldBefore, {
      target,
      cache: "application cache; OS cache unchanged",
    });
    await brush(session.page, 128, 120);
    const coldStart = await stateSnapshot(session.page);
    const canvasBox = await session.page.locator("canvas").boundingBox();
    if (!canvasBox) throw new Error("Cold target canvas unavailable");
    const { startReadyStrokeMonitor } =
      await import("./atlas-p0-collection.mjs");
    const monitor = startReadyStrokeMonitor(session, {
      sessionId: coldStart.sessionId,
      afterInputId: coldStart.lastInputId,
      sinceEvent: coldStart.eventCount,
      screenPoint: {
        x: Math.round(canvasBox.x + canvasBox.width / 2),
        y: Math.round(canvasBox.y + canvasBox.height / 2),
      },
      point: target,
    });
    await navigateTo(session.page, target);
    const trigger = await monitor;
    if (!trigger.dispatched)
      throw new Error(
        `Cold first input was not dispatched: ${JSON.stringify(trigger)}`,
      );
    const navigation = trigger.navigation;
    const ready = trigger.ready;
    const cold = await observeDab(session, coldStart);
    const coldAfterHeight = (await values(session.page, [target]))[0];
    const coldAfterImage = await capture(session, "cold-after-edit", [target]);
    check(
      "cold-edit-content",
      Math.abs(trigger.observed.beforeHeight + 20) < 1e-7 &&
        coldAfterHeight > 0 &&
        landPixel(coldAfterImage.pixels[0]),
      {
        point: target,
        expectedBefore: -20,
        before: trigger.observed.beforeHeight,
        after: coldAfterHeight,
        coldAfterImage,
        driverDelayMs: cold.samples[0]?.createdAt - ready.at,
      },
    );
    const coldSamples = cold.samples
      .filter((sample) => sample.inputKind === "edit")
      .slice(0, 1)
      .map((sample) => ({
        ...sample,
        navigationId: navigation.id,
        navigationAt: navigation.createdAt,
        readyAt: ready.at,
        coldBeforeNavigation: coldBefore,
        timeout: cold.timedOut,
      }));
    if (!full)
      session.instance.scenarios.push({
        id: "M10-height-cold",
        kind: "cold",
        samples: coldSamples,
        droppedEvents: cold.after.droppedEvents,
      });
    check(
      "cold-edit-after-navigation",
      !cold.timedOut &&
        cold.samples.length > 0 &&
        cold.samples.every((s) => Number.isFinite(s.submissionAt)) &&
        ready.at >= navigation.createdAt,
      {
        navigationCreatedAt: navigation.createdAt,
        readyAt: ready.at,
        readyDelayMs: ready.at - navigation.createdAt,
        submissionOnly: true,
      },
    );

    await capture(session, "final-coast-lab", []);
  } finally {
    await session.close();
  }
  const restarted = await launch(file, "process-restart");
  try {
    await exact(restarted.page);
    check(
      "process-restart",
      closeEnough(
        await values(restarted.page, fixture.expected.points),
        fixture.expected.afterCoarseDab,
      ),
    );
  } finally {
    await restarted.close();
  }
}

async function busyJourney(fixture) {
  const file = join(out, `${independentRunId}-busy-working.saltatlas`);
  await copyFile(fixture.busy.file, file);
  const session = await launch(file, "busy-journey");
  try {
    await exact(session.page);
    await session.page.getByLabel("Raster anzeigen").uncheck();
    await brush(session.page, 128, 120);
    await button(session.page, "Hintergrundarbeit starten");
    await session.page.waitForFunction(() => {
      const observed = window.atlasObserve([], { events: false });
      return (
        observed.background.active === true &&
        observed.background.sessionId === observed.sessionId &&
        observed.background.samples > 0
      );
    });
    const busyBefore = await stateSnapshot(session.page);
    const metricsBefore = await session.app.evaluate(() =>
      globalThis.__atlasHost.metrics(),
    );
    const overlap = await editDuringActualSave(session, [-800, -300]);
    await button(session.page, "Speichern");
    await session.page.waitForFunction(() => window.atlasObserve().state.saved);
    const metricsAfter = await session.app.evaluate(() =>
      globalThis.__atlasHost.metrics(),
    );
    const busyAfter = await stateSnapshot(session.page);
    if (!full)
      session.instance.scenarios.push({
        id: "M06-height-busy",
        kind: "edit",
        samples: overlap.attempts.flatMap((attempt) => attempt.samples ?? []),
        droppedEvents: busyAfter.droppedEvents,
      });
    check(
      "worker-and-save-executed",
      busyBefore.background.active &&
        busyBefore.background.sessionId === busyBefore.sessionId &&
        busyAfter.background.sessionId === busyBefore.sessionId &&
        busyAfter.background.samples > busyBefore.background.samples &&
        metricsAfter.snapshots > metricsBefore.snapshots,
      {
        fixtureSourceTiles: fixture.busy.sourceTiles,
        fixtureBytes: fixture.busy.decodedBytes,
        snapshots: metricsAfter.snapshots - metricsBefore.snapshots,
        backgroundBefore: busyBefore.background,
        backgroundAfter: busyAfter.background,
      },
    );
    check(
      "busy-worker-and-save",
      overlap.passed &&
        overlap.attempts.every(
          (attempt) => !attempt.samples?.length || attempt.overlapProven,
        ),
      {
        attempts: overlap.attempts,
        explanation:
          "Native input creation must fall inside an observed successful snapshot/publish interval with current-session worker activity and progress. All dispatched attempts remain in the result.",
      },
    );
    await capture(session, "busy-final", [[-800, -300]]);
  } finally {
    await session.close();
  }
}

async function negativeControl(fixture, fault) {
  const file = join(out, `${fault}-working.saltatlas`);
  await copyFile(fixture.files.coast, file);
  const session = await launch(
    file,
    `control-${fault}`,
    fault === "recovery" ? "none" : fault,
  );
  try {
    await exact(session.page);
    await brush(session.page, 16, 10);
    const result = await dab(
      session,
      [0, 0],
      fault === "drop-render" ? 5000 : 10_000,
    );
    const evaluation = evaluateSubmissionDiagnostics(result.samples);
    const code =
      fault === "delay-render"
        ? "SUBMISSION_LOWER_BOUND_EXCEEDS_LIMIT"
        : "MISSING_SUBMISSION";
    const valid =
      fault === "recovery"
        ? result.samples.length > 0 &&
          result.samples.every((s) => Number.isFinite(s.submissionAt)) &&
          result.after.renderer.fault === "none"
        : result.after.renderer.fault === fault &&
          evaluation.status === "FAIL" &&
          evaluation.issues.some((e) => e.code === code);
    report.negativeControls.push({
      fault,
      passed: valid,
      actualFault: result.after.renderer.fault,
      evaluation,
      samples: result.samples,
    });
    if (!valid)
      throw new Error(
        `Negative control did not fail/recover for its intended reason: ${fault}`,
      );
  } finally {
    await session.close();
  }
}

async function interactionControls(fixture) {
  for (const [fault, primaryCheck] of [
    ["ignore-zoom", "visible-zoom"],
    ["pointerup-render", "continuous-stroke-live"],
  ]) {
    const results = [];
    for (const current of [fault, "none"]) {
      const label = `control-${fault}-${current === "none" ? "recovery" : "mutant"}`;
      const file = join(out, `${label}.saltatlas`);
      await copyFile(fixture.files.coast, file);
      const session = await launch(file, label, current);
      try {
        await exact(session.page);
        const result =
          fault === "ignore-zoom"
            ? (await zoomAndPan(session, label)).zoom
            : (await heldStroke(session, label)).live;
        const observed = await snapshot(session.page);
        results.push({ ...result, observedFault: observed.renderer.fault });
      } catch (error) {
        results.push({
          passed: false,
          error: String(error),
          observedFault: (await snapshot(session.page)).renderer.fault,
        });
      } finally {
        await session.close();
      }
    }
    const [mutant, recovery] = results;
    const primaryFailureCode =
      fault === "ignore-zoom"
        ? mutant.failureCode === "ZOOM_DID_NOT_CHANGE_SCALE"
          ? mutant.failureCode
          : null
        : mutant.failureCode === "LIVE_TERRAIN_NOT_VISIBLE_BEFORE_RELEASE"
          ? mutant.failureCode
          : null;
    const passed =
      mutant.observedFault === fault &&
      mutant.passed === false &&
      !mutant.error &&
      !mutant.failure &&
      primaryFailureCode !== null &&
      recovery.observedFault === "none" &&
      recovery.passed === true &&
      !recovery.error;
    report.negativeControls.push({
      fault,
      primaryCheck,
      passed,
      primaryPassed: mutant.passed,
      primaryFailureCode,
      observedFault: mutant.observedFault,
      mutant,
      recovery: { primaryCheck, ...recovery },
    });
    log(
      `${fault}: primary ${mutant.passed ? "PASS (unexpected)" : "FAIL (expected)"}; recovery ${recovery.passed ? "PASS" : "FAIL"}`,
    );
  }
}

/** Identical coarse region, actual fine payloads, and normal UI input at every size. */
async function scalingJourney() {
  const manifest = fixtureCommand(
    "create-scaling",
    join(out, "scaling-fixtures"),
  );
  report.scaling = { manifest, cases: [], passed: false };
  const sourceFootprint = (observed) => ({
    documentSourceBytes: observed.document.sourceBytes,
    rendererSourceBytes: observed.renderer.sourceBytes,
    workerSourceBytes: observed.renderer.workerSourceBytes,
  });
  const readDelta = (before, after) =>
    Object.fromEntries(
      ["reads", "returnedTiles", "returnedBytes"].map((key) => [
        key,
        after[key] - before[key],
      ]),
    );
  const assertSourceBudget = (footprint, reads) => {
    const maximum = P0_REQUIREMENTS.scaling.sourceBudgetBytes;
    if (
      Object.values(footprint).some(
        (bytes) => !Number.isFinite(bytes) || bytes < 0 || bytes > maximum,
      ) ||
      reads.returnedBytes > maximum ||
      reads.returnedTiles > maximum / P0_REQUIREMENTS.scaling.tileBytes
    )
      throw new Error("Scaling stage exceeded the declared source budget");
  };
  for (const fixture of manifest.fixtures) {
    const file = join(out, `scaling-${fixture.id}-working.saltatlas`);
    await copyFile(fixture.file, file);
    const result = {
      id: fixture.id,
      sourceTiles: fixture.sourceTiles,
      decodedBytes: fixture.decodedBytes,
      passed: false,
      stage: "launch",
      expected: manifest.expected,
      stageReadDeltas: {},
    };
    report.scaling.cases.push(result);
    let session;
    try {
      session = await launch(file, `scaling-${fixture.id}`);
      await exact(session.page);
      result.before = await values(session.page, manifest.expected.points);
      if (!closeEnough(result.before, manifest.expected.before))
        throw new Error("Initial scaling source values differ");
      const initialReads = await session.app.evaluate(() =>
        globalThis.__atlasHost.metrics(),
      );
      await session.page.getByLabel("Raster anzeigen").uncheck();
      result.stage = "coarse-navigation";
      const origin = await position(session.page);
      await session.page.mouse.move(origin.x, origin.y);
      const initialScale = (await snapshot(session.page)).camera.scale;
      let remaining =
        Math.log(initialScale / manifest.region.coarseCamera.scale) / 0.0018;
      let wheelSteps = 0;
      while (Math.abs(remaining) > 1e-10 && wheelSteps++ < 8) {
        const delta = Math.max(-500, Math.min(500, remaining));
        const previous = (await snapshot(session.page)).camera.scale;
        await session.page.mouse.wheel(0, delta);
        await session.page.waitForFunction(
          ({ scale, delta }) => {
            const o = window.atlasObserve();
            if (o.state.error) throw new Error(o.state.error);
            return delta > 0 ? o.camera.scale < scale : o.camera.scale > scale;
          },
          { scale: previous, delta },
          { timeout: 5000 },
        );
        await exact(session.page, 5000);
        // Native wheel deltas have finite precision. Correct through another
        // ordinary wheel event so the fixed analytic brush oracle stays exact.
        remaining =
          Math.log(
            (await snapshot(session.page)).camera.scale /
              manifest.region.coarseCamera.scale,
          ) / 0.0018;
      }
      const camera = (await snapshot(session.page)).camera;
      result.camera = camera;
      if (Math.abs(camera.scale - manifest.region.coarseCamera.scale) > 1e-14)
        throw new Error("Scaling case did not reach its declared camera");
      const coarseReads = await session.app.evaluate(() =>
        globalThis.__atlasHost.metrics(),
      );
      result.coarseReadiness = sourceFootprint(await snapshot(session.page));
      result.stageReadDeltas.coarseReadiness = readDelta(
        initialReads,
        coarseReads,
      );
      assertSourceBudget(
        result.coarseReadiness,
        result.stageReadDeltas.coarseReadiness,
      );
      result.ridgeBefore = await values(
        session.page,
        manifest.expected.ridgePoints,
      );
      if (!knownValuesAgree(result.ridgeBefore, manifest.expected.ridgeBefore))
        throw new Error("Known coarse-view ridge heights are incorrect");
      await brush(
        session.page,
        manifest.region.brush.diameter,
        manifest.region.brush.amount,
      );
      const beforeImage = await capture(session, "coarse-before", [
        manifest.region.pixelProbe,
        manifest.region.ridgePixelProbe,
      ]);
      result.stage = "coarse-edit";
      const edit = await dab(session, manifest.region.brush.center);
      const afterImage = await capture(session, "coarse-after", [
        manifest.region.pixelProbe,
        manifest.region.ridgePixelProbe,
      ]);
      result.after = await values(session.page, manifest.expected.points);
      result.ridgeAfter = await values(
        session.page,
        manifest.expected.ridgePoints,
      );
      result.samples = edit.samples;
      result.images = { beforeImage, afterImage };
      const editedReads = await session.app.evaluate(() =>
        globalThis.__atlasHost.metrics(),
      );
      result.coarseEdit = sourceFootprint(await snapshot(session.page));
      result.stageReadDeltas.coarseEdit = readDelta(coarseReads, editedReads);
      assertSourceBudget(result.coarseEdit, result.stageReadDeltas.coarseEdit);
      if (
        edit.timedOut ||
        !knownValuesAgree(result.after, manifest.expected.afterCoarseDab) ||
        !knownValuesAgree(
          result.ridgeAfter,
          manifest.expected.ridgeAfterCoarseDab,
        ) ||
        !waterPixel(beforeImage.pixels[0]) ||
        !landPixel(afterImage.pixels[0]) ||
        !landPixel(beforeImage.pixels[1]) ||
        !landPixel(afterImage.pixels[1])
      )
        throw new Error(
          "Coarse scaling edit failed its independent height/pixel oracle",
        );
      result.stage = "detail-return-history";
      await button(session.page, "Nahansicht");
      await exact(session.page);
      result.detail = await values(session.page, manifest.expected.points);
      await button(session.page, /Rückgängig/);
      await exact(session.page);
      result.undone = await values(session.page, manifest.expected.points);
      await button(session.page, /Wiederholen/);
      await exact(session.page);
      result.redone = await values(session.page, manifest.expected.points);
      if (
        !closeEnough(result.detail, manifest.expected.afterCoarseDab) ||
        !closeEnough(result.undone, manifest.expected.before) ||
        !closeEnough(result.redone, manifest.expected.afterCoarseDab)
      )
        throw new Error("Scaling detail return or history differs");
      result.stage = "ridge-detail-return";
      await navigateTo(session.page, manifest.region.ridgePixelProbe);
      await exact(session.page);
      result.ridgeDetail = await values(session.page, [
        manifest.region.ridgePixelProbe,
      ]);
      if (
        !closeEnough(result.ridgeDetail, [
          manifest.expected.ridgePixelAfterCoarseDab,
        ])
      )
        throw new Error("Detail return lost the populated fine ridge terrain");
      result.stage = "save-restart";
      await button(session.page, "Speichern");
      await session.page.waitForFunction(
        () => window.atlasObserve().state.saved,
      );
      result.saved = fixtureCommand("inspect-scaling", file);
      if (result.saved.fineSha256 !== fixture.fineSha256)
        throw new Error("Coarse edit changed saved fine-source payloads");
      if (
        !closeEnough(
          result.saved.ridgeSamples,
          manifest.expected.ridgeAfterCoarseDab,
        )
      )
        throw new Error("Saved coarse/fine ridge composition differs");
      result.resources = (await snapshot(session.page)).renderer;
      result.storeMetrics = await session.app.evaluate(() =>
        globalThis.__atlasHost.metrics(),
      );
      await session.close();
      session = null;
      session = await launch(file, `scaling-${fixture.id}-restart`);
      await exact(session.page);
      result.reopened = await values(session.page, manifest.expected.points);
      if (!closeEnough(result.reopened, manifest.expected.afterCoarseDab))
        throw new Error("Scaling restart differs");
      await navigateTo(session.page, manifest.region.ridgePixelProbe);
      await exact(session.page);
      result.ridgeReopened = await values(session.page, [
        manifest.region.ridgePixelProbe,
      ]);
      if (
        !closeEnough(result.ridgeReopened, [
          manifest.expected.ridgePixelAfterCoarseDab,
        ])
      )
        throw new Error("Restart lost the populated fine ridge terrain");
      result.stage = "complete";
      result.passed = true;
    } catch (error) {
      result.error = String(error);
      if (session) {
        const observed = await snapshot(session.page);
        result.productError = observed.state.error;
        result.resources = observed.renderer;
        result.document = observed.document;
        result.storeMetrics = await session.app.evaluate(() =>
          globalThis.__atlasHost.metrics(),
        );
        await capture(session, "failure", []);
      }
    } finally {
      if (session) await session.close();
    }
    log(
      `scaling ${fixture.sourceTiles} sources: ${result.passed ? "PASS" : `FAIL at ${result.stage}: ${result.productError ?? result.error}`}`,
    );
  }
  report.scaling.passed =
    report.scaling.cases.length === 3 &&
    report.scaling.cases.every((c) => c.passed);
}

try {
  const buildMetadata = JSON.parse(
    await readFile(join(root, "desktop-dist/build.json"), "utf8"),
  );
  const buildHash = createHash("sha256"),
    buildFiles = [];
  async function collectBuiltFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) await collectBuiltFiles(file);
      else if (
        entry.isFile() &&
        !entry.name.endsWith(".map") &&
        entry.name !== "build.json"
      ) {
        const bytes = await readFile(file);
        buildHash.update(file);
        buildHash.update("\0");
        buildHash.update(bytes);
        buildFiles.push({ file, sha256: hash(bytes), bytes: bytes.length });
      }
    }
  }
  await collectBuiltFiles("desktop-dist");
  await collectBuiltFiles("dist-editor");
  report.workspaceBuild = {
    ...buildMetadata,
    sha256: buildHash.digest("hex"),
    files: buildFiles,
  };
  if (packaged) {
    const packageHash = createHash("sha256"),
      packageFiles = [];
    async function collectPackage(directory) {
      for (const entry of (
        await readdir(directory, { withFileTypes: true })
      ).sort((a, b) => a.name.localeCompare(b.name))) {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) await collectPackage(file);
        else if (entry.isFile()) {
          const bytes = await readFile(file);
          const identity = file.slice(dirname(executablePath).length + 1);
          packageHash.update(identity);
          packageHash.update("\0");
          packageHash.update(bytes);
          packageFiles.push({
            file: identity,
            bytes: bytes.length,
            sha256: hash(bytes),
          });
        }
      }
    }
    await collectPackage(dirname(executablePath));
    report.packagedBuild = {
      executablePath,
      sha256: packageHash.digest("hex"),
      files: packageFiles,
    };
  }
  if (native && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    report.errors.push({
      code: "NO_NATIVE_DISPLAY",
      message:
        "Native mode requires the regular reference display. Use --lab only for software headless functional evidence.",
    });
  } else {
    const fixture = fixtureCommand("create", join(out, "fixtures"));
    if (only !== "scaling")
      fixture.busy = fixtureCommand("create-busy", join(out, "busy-fixture"));
    report.fixture = fixture.coast;
    report.fixtureManifest = fixture;
    log("real .saltatlas fixtures created; starting built Electron app");
    const guarded = async (name, action) => {
      try {
        await action();
      } catch (error) {
        report.errors.push({
          code: "SCENARIO_FAILURE",
          stage: name,
          independentRunId,
          message: String(error),
          stack: error.stack,
        });
        log(`${name}: FAIL ${error}`);
      }
    };
    const repetitions = selectedRuns ?? (full ? 3 : 1);
    for (let run = 1; run <= repetitions; run++) {
      independentRunId = full ? `release-${run}` : "pilot-1";
      if (!only)
        await guarded("empty-navigation", () => emptyNavigation(fixture));
      if (!only || only === "interactions")
        await guarded("coast-journey", () => coastJourney(fixture));
      if (!only || only === "interactions")
        await guarded("busy-journey", () => busyJourney(fixture));
      if (full && (!only || only === "collection")) {
        await guarded("repeated-scenarios", async () => {
          const { collectRepeatedScenarios } =
            await import("./atlas-p0-collection.mjs");
          const result = await collectRepeatedScenarios({
            launch,
            fixture,
            out,
            independentRunId,
            fixtureCommand,
            editDuringActualSave,
            ...(scenarioId ? { scenarioId } : {}),
          });
          (report.collection ??= []).push({ independentRunId, ...result });
          if (!result.passed)
            report.errors.push({
              code: "COLLECTION_FAILURE",
              independentRunId,
              errors: result.errors,
            });
        });
      }
    }
    if (!only || only === "interactions") {
      await guarded("interaction-controls", () => interactionControls(fixture));
      for (const fault of ["delay-render", "drop-render", "recovery"])
        await guarded(`control-${fault}`, () =>
          negativeControl(fixture, fault),
        );
    }
    if (!only || only === "scaling") await guarded("scaling", scalingJourney);
  }
} catch (error) {
  report.errors.push({
    code: "RUNNER_OR_PRODUCT_FAILURE",
    message: String(error),
    stack: error.stack,
  });
  console.error(error);
} finally {
  report.finishedAt = new Date().toISOString();
  report.acceptance = evaluateAcceptance(report);
  report.functional.evaluation = evaluateFunctional(report);
  report.functional.passed = report.functional.evaluation.passed;
  report.nativeGate = {
    status: "BLOCKED",
    passed: false,
    reason: lab
      ? "Software headless laboratory: no qualified native reference; exact presentation mapping remains unavailable; collected sample counts are reported independently."
      : report.errors.some((error) => error.code === "NO_NATIVE_DISPLAY")
        ? "No native display is available; exact presentation mapping remains unavailable; collected sample counts are reported independently."
        : "This display is not yet qualified and exact presentation mapping remains unavailable. Collection mode and actual sample counts are reported separately.",
    fullEvaluation: report.acceptance.status,
  };
  report.proxySummary = report.runs.flatMap((r) =>
    r.scenarios
      .filter((s) => s.kind !== "navigation")
      .map((s) => ({
        run: r.id,
        scenario: s.id,
        diagnosticOnly: true,
        samples: s.samples.length,
        submission:
          s.kind === "cold"
            ? evaluateColdSubmissionDiagnostics(s.samples)
            : evaluateSubmissionDiagnostics(s.samples),
      })),
  );
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        output: out,
        functional: report.functional.passed ? "PASS" : "FAIL",
        scaling: report.scaling?.cases.map(
          ({ id, sourceTiles, passed, stage, error }) => ({
            id,
            sourceTiles,
            passed,
            stage,
            error,
          }),
        ),
        collection: report.collection?.map(
          ({ independentRunId, passed, errors }) => ({
            independentRunId,
            passed,
            errors,
          }),
        ),
        nativeGate: report.nativeGate,
        negativeControls: report.negativeControls.map(({ fault, passed }) => ({
          fault,
          passed,
        })),
        errors: report.errors,
      },
      null,
      2,
    ),
  );
  process.exitCode = report.errors.some(
    (error) => error.code === "NO_NATIVE_DISPLAY",
  )
    ? 2
    : !report.functional.passed
      ? 1
      : native || full
        ? report.acceptance.passed
          ? 0
          : 2
        : 0;
}
