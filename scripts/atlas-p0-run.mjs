import { _electron as electron } from "@playwright/test";
import { createRequire } from "node:module";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { cpus, release, totalmem } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateRun,
  selectP0Scope,
  evaluateScenario,
  extractNavigationSamples,
  evaluateNavigationDiagnostics,
  strokeEvidence,
  evaluateSubmissionDiagnostics,
  evaluateBrushPublicationOrder,
  evaluateSaveOverlap,
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
  brushDoseBehavior,
  waitForSaveCompletion,
  storeActivityPosition,
  storeIntervalReference,
  movingStroke,
  prepareStroke,
  strokeInputs,
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
const traceRequested = argv.includes("--trace");
const purpose = full ? "acceptance" : "probe";
const onlyIndex = argv.indexOf("--only");
const only = onlyIndex < 0 ? null : argv[onlyIndex + 1];
if (only && !["interactions", "scaling", "collection"].includes(only))
  throw new Error("Unknown --only selection");
const caseIndex = argv.indexOf("--case");
const scenarioId = caseIndex < 0 ? null : argv[caseIndex + 1];
const runsIndex = argv.indexOf("--runs");
const selectedRuns = runsIndex < 0 ? null : Number(argv[runsIndex + 1]);
if ((caseIndex >= 0 || runsIndex >= 0) && only !== "collection")
  throw new Error("--case/--runs require --only collection diagnostics");
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
const selectedScope = selectP0Scope(only ?? "all", scenarioId);
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
  schemaVersion: 2,
  purpose,
  mode: lab ? "lab" : "native",
  scope: only
    ? `P0 partial ${only} diagnostics${scenarioId ? `: ${scenarioId}` : ""}`
    : full
      ? "P0 full scenario collection plus representative scaling"
      : "P0 architecture probe; shared scenarios with one attempt each",
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
const repetitions = selectedRuns ?? (full ? 3 : 1);
report.planned = [];
for (let run = 1; run <= repetitions; run++) {
  const runId = full ? `release-${run}` : `probe-${run}`;
  if (selectedScope.workflow)
    report.planned.push({ run: runId, id: "coast-workflow", state: "planned" });
  for (const spec of selectedScope.scenarios)
    report.planned.push({ run: runId, id: spec.id, state: "planned" });
}
if (selectedScope.controls)
  for (const fault of [
    "ignore-zoom",
    "pointerup-render",
    "delay-render",
    "drop-render",
    "recovery",
  ])
    report.planned.push({
      run: null,
      id: `control-${fault}`,
      state: "planned",
    });
if (selectedScope.scaling)
  for (const size of P0_REQUIREMENTS.scaling.minimumSourceTiles)
    report.planned.push({ run: null, id: `scaling-${size}`, state: "planned" });

const activeSessions = new Set();
let interrupted = false;
const progress = (id, state, details = {}, run = independentRunId) => {
  const entry = report.planned.find(
    (entry) => entry.id === id && entry.run === run,
  );
  if (entry) Object.assign(entry, { state, ...details });
};
async function atomicJson(file, value) {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2));
  await rename(temporary, file);
}
let checkpointTask = Promise.resolve();
function checkpoint() {
  checkpointTask = checkpointTask.then(async () => {
    report.evaluation = evaluateRun(report);
    await atomicJson(join(out, "report.json"), report);
    await atomicJson(join(out, "run-index.json"), {
      schemaVersion: 2,
      purpose,
      selection: report.selection,
      startedAt: report.startedAt,
      finishedAt: report.finishedAt,
      interrupted,
      status: report.evaluation.status,
      build: report.build,
      harness: report.harness,
      cases: report.planned,
    });
  });
  return checkpointTask;
}
async function scenarioCompleted(scenario, resultFile) {
  const passed = scenario.collectionPassed === true;
  const recordCheck = (id, valid) =>
    report.functional.checks.push({
      id,
      independentRunId,
      passed: Boolean(valid),
      scenario: scenario.id,
      resultFile,
    });
  if (scenario.id === "M06-height-busy") {
    recordCheck(
      "busy-worker-and-save",
      passed &&
        scenario.attempts.every(
          (attempt) =>
            attempt.saveAttempts?.some((save) => save.overlapProven) &&
            attempt.saveAttempts.every(
              (save) => !save.inputIds.length || save.overlapProven,
            ),
        ),
    );
    recordCheck(
      "worker-and-save-executed",
      scenario.attempts.length > 0 &&
        scenario.attempts.every((attempt) =>
          attempt.saveAttempts?.some(
            (save) =>
              save.overlapProven &&
              save.backgroundAfter.samples > save.backgroundBefore.samples,
          ),
        ),
    );
  }
  if (scenario.id === "M10-height-cold") {
    recordCheck("cold-blocked-inputs", scenario.blockedInputs?.passed === true);
    recordCheck(
      "cold-before-navigation",
      passed &&
        scenario.attempts.every((attempt) => attempt.coldBeforeNavigation),
    );
    recordCheck(
      "cold-edit-after-navigation",
      passed && scenario.attempts.every((attempt) => attempt.stroke?.passed),
    );
    recordCheck(
      "cold-edit-content",
      passed &&
        scenario.attempts.every(
          (attempt) =>
            Math.abs(attempt.beforeHeightObserved + 20) < 1e-7 &&
            attempt.afterHeight > 0 &&
            landPixel(attempt.changedImage?.pixels[0]),
        ),
    );
  }
  progress(
    scenario.id,
    scenario.evaluation.status === "FAIL" || !passed ? "failed" : "completed",
    { resultFile },
  );
  await checkpoint();
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, async () => {
    interrupted = true;
    report.interrupted = signal;
    report.finishedAt = new Date().toISOString();
    await Promise.allSettled(
      [...activeSessions].map((session) => session.close()),
    );
    await checkpoint();
    process.exit(signal === "SIGINT" ? 130 : 143);
  });
await checkpoint();
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
// Independent fixture constants describe a 1-s stationary dose at their
// declared rate. The UI's accepted press/hold dose scales those constants.
const atStationaryDose = (before, afterOneSecond, factor) =>
  before.map((value, i) => value + (afterOneSecond[i] - value) * factor);
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
  let closing;
  const session = {
    app,
    page,
    instance,
    directory: sessionDirectory,
    close() {
      if (closing) return closing;
      closing = (async () => {
        try {
          const final = await snapshot(page);
          instance.brushPublication = evaluateBrushPublicationOrder(
            final.events,
          );
          const publicationFailures = instance.brushPublication.issues.filter(
            (issue) =>
              !(
                fault === "drop-render" &&
                issue.code === "BRUSH_STEP_SUBMISSION_MISSING"
              ),
          );
          if (publicationFailures.length)
            report.errors.push({
              code: "BRUSH_PUBLICATION_ORDER_FAILED",
              instance: instance.id,
              issues: publicationFailures,
            });
          const activity = await app.evaluate(() =>
            globalThis.__atlasHost.storeActivity(),
          );
          instance.observationFile = join(sessionDirectory, "observation.json");
          instance.storeActivityFile = join(
            sessionDirectory,
            "store-activity.json",
          );
          await writeFile(
            instance.observationFile,
            JSON.stringify(final, null, 2),
          );
          await writeFile(
            instance.storeActivityFile,
            JSON.stringify(activity, null, 2),
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
          if (final.droppedEvents || activity.droppedEvents)
            throw new Error(
              "Diagnostic evidence was dropped; this process cannot pass",
            );
          if (pageErrors.length)
            throw new Error(`Renderer errors: ${pageErrors.join("; ")}`);
        } finally {
          await app.close();
          await writeFile(
            join(sessionDirectory, "electron.log"),
            output.join(""),
          );
          activeSessions.delete(session);
        }
      })();
      return closing;
    },
  };
  activeSessions.add(session);
  return session;
}

async function values(page, points) {
  return (await stateSnapshot(page, points)).samples;
}
async function dab(session, point = [0, 0], timeout = 5000) {
  return movingStroke(session, [point], { intervalMs: 1000, timeout });
}
async function editDuringActualSave(session, points) {
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
    const { before, positions } = await prepareStroke(session, points);
    const inputs = strokeInputs(positions);
    const sinceEvent = await storeActivityPosition(session);
    // Observe real utility-process activity. Send ordinary native mouse events
    // only while a new real snapshot/publish interval is actually open.
    const monitor = session.app.evaluate(
      async ({ BrowserWindow }, { inputs, sinceEvent }) => {
        let cursor = sinceEvent;
        const events = [];
        const deadline = performance.now() + 800;
        while (performance.now() < deadline) {
          const observed = globalThis.__atlasHost.storeActivity({
            sinceEvent: cursor,
          });
          if (observed.droppedEvents)
            throw new Error("Store activity events were dropped");
          events.push(...observed.events);
          cursor = observed.eventCount;
          const active = events.find(
            (e) =>
              e.phase === "start" &&
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
            let released = false;
            try {
              for (const input of inputs) {
                if (input.delayMs)
                  await new Promise((resolve) =>
                    setTimeout(resolve, input.delayMs),
                  );
                contents.sendInputEvent(input.event);
                if (input.event.type === "mouseUp") released = true;
              }
            } finally {
              if (!released) contents.sendInputEvent(inputs.at(-1).event);
            }
            return { dispatched: true, observedActive: active, observedWorker };
          }
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
        return { dispatched: false };
      },
      { inputs, sinceEvent },
    );
    await button(session.page, "Speichern");
    const trigger = await monitor;
    if (!trigger.dispatched) {
      attempts.push({ attempt, trigger, overlapProven: false });
      const started =
        trigger.observedActive ??
        (await session.app.evaluate(
          (_electron, sinceEvent) =>
            globalThis.__atlasHost
              .storeActivity({ sinceEvent })
              .events.find((event) => event.phase === "start"),
          sinceEvent,
        ));
      if (started) await waitForSaveCompletion(session, started);
      continue;
    }
    const edit = await observeDab(session, before);
    const afterHeight = (await values(session.page, [points[0]]))[0];
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
      .filter((e) => e.phase === "start" && e.index >= sinceEvent)
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
    const first = edit.samples.find((sample) => sample.inputKind === "edit");
    const overlap = evaluateSaveOverlap({
      sample: first,
      timeOrigin: edit.after.timeOrigin,
      sessionId: edit.after.sessionId,
      intervals,
      before,
      observedWorker: trigger.observedWorker,
      finished,
    });
    const matches = overlap.matches.map((interval) =>
      storeIntervalReference({
        ...interval,
        inputId: first.inputId,
        inputEpochMs: overlap.inputEpochMs,
        modelEpochMs: overlap.modelEpochMs,
      }),
    );
    const overlapProven = overlap.passed;
    const inputSubmissionComplete =
      !edit.timedOut &&
      edit.samples.length >= 2 &&
      edit.samples.every((s) => Number.isFinite(s.submissionAt));
    attempts.push({
      attempt,
      trigger,
      overlapProven,
      inputSubmissionComplete,
      matches,
      storeRange: {
        from: sinceEvent,
        to: (activity.at(-1)?.index ?? sinceEvent - 1) + 1,
      },
      samples: edit.samples,
      beforeHeight: before.samples[0],
      afterHeight,
      backgroundBefore: before.background,
      backgroundAfter: finished.background,
    });
    // Once dispatched, this is the measured stroke, including any failed input.
    // Its collector checks content/Undo/timing; no rescue stroke replaces it.
    return { passed: overlapProven, attempts, edit };
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
      progress(grid ? "M01-grid-on" : "M01-grid-off", "running");
      await checkpoint();
      await session.page.getByLabel("Raster anzeigen").setChecked(grid);
      const before = await stateSnapshot(session.page);
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
      } while (performance.now() - start < (full ? 30_000 : 1_000));
      const after = await snapshot(session.page, [], {
        sinceEvent: before.eventCount,
      });
      const metricsAfter = await session.app.evaluate(() =>
        globalThis.__atlasHost.metrics(),
      );
      const cutoff = before.lastInputId;
      const inputs = after.events.filter(
        (e) =>
          e.kind === "input" && e.id > cutoff && e.inputKind === "navigation",
      );
      const navigationSamples = extractNavigationSamples(after.events);
      const navigation = evaluateNavigationDiagnostics(navigationSamples);
      const frames = after.events.filter((e) => e.kind === "frame");
      const scenario = {
        id: grid ? "M01-grid-on" : "M01-grid-off",
        kind: "navigation",
        durationMs: performance.now() - start,
        samples: navigationSamples,
        gestureBoundaryInputIds: inputs
          .filter((input) => input.eventType === "pointerdown")
          .map((input) => input.id),
        authorChanges: after.document.sequence - before.document.sequence,
        storeReads: metricsAfter.reads - metricsBefore.reads,
        returnedTiles: metricsAfter.returnedTiles - metricsBefore.returnedTiles,
        returnedBytes: metricsAfter.returnedBytes - metricsBefore.returnedBytes,
        cpuWorkMs: frames.map((e) => e.cpuMs),
        rafFrameIntervalsMs: frames.map((e) => e.interval),
        presentationFrameIntervalsMs: [],
        droppedEvents: after.droppedEvents,
      };
      session.instance.scenarios.push(scenario);
      scenario.collectionPassed =
        inputs.length > 0 &&
        wheelChecks.length >= 8 &&
        wheelChecks.every((c) => c.passed) &&
        before.document.sequence === after.document.sequence &&
        metricsAfter.commits === metricsBefore.commits &&
        navigation.passed &&
        (after.camera.x !== before.camera.x ||
          after.camera.y !== before.camera.y);
      scenario.evaluation = evaluateScenario(scenario);
      const resultFile = join(session.directory, `${scenario.id}-result.json`);
      await atomicJson(resultFile, scenario);
      progress(
        scenario.id,
        scenario.evaluation.status === "FAIL" ? "failed" : "completed",
        { resultFile },
      );
      await checkpoint();
      check(
        grid ? "empty-navigation-grid-on" : "empty-navigation-grid-off",
        scenario.collectionPassed,
        {
          inputs: inputs.length,
          wheelChecks,
          authorChanges: scenario.authorChanges,
          storeReads: scenario.storeReads,
          navigation,
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
  let doseExpected;
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
    const rateBehavior = await brushDoseBehavior(session);
    check("held-dose-response", rateBehavior.held.passed, rateBehavior.held);
    check(
      "movement-duration-response",
      rateBehavior.movement.passed,
      rateBehavior.movement,
    );
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
    await brush(session.page, 64, 200);
    if (traceRequested)
      await session.app.evaluate(() => globalThis.__atlasHost.startTrace());
    const coarse = await dab(session);
    doseExpected = atStationaryDose(
      fixture.expected.before,
      fixture.expected.afterCoarseDab,
      coarse.time.acceptedDoseFt / fixture.expected.brush.amount,
    );
    if (traceRequested) {
      // Optional trace tails are outside the gesture and are never presentation proof.
      await session.page.waitForTimeout(500);
      const tracePath = join(session.directory, "chromium-trace.json");
      const actualTracePath = await session.app.evaluate(
        (_electron, path) => globalThis.__atlasHost.stopTrace(path),
        tracePath,
      );
      report.trace = await traceSummary(actualTracePath);
    }
    check(
      "coarse-exact-values",
      !coarse.timedOut &&
        coarse.time.passed &&
        coarse.time.stationary &&
        coarse.samples.length >= 2 &&
        coarse.samples.every((s) => Number.isFinite(s.submissionAt)) &&
        closeEnough(await values(session.page, points), doseExpected),
      {
        samples: await values(session.page, points),
        expected: doseExpected,
        time: coarse.time,
        requestedHoldMs: 1000,
        rateFtPerSecond: 200,
        reference: {
          rateFtPerSecond: fixture.expected.brush.amount,
          acceptedMs: 1000,
          expected: fixture.expected.afterCoarseDab,
        },
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
        closeEnough(redone, doseExpected),
      { undone, redone },
    );
    await button(session.page, "Speichern");
    await session.page.waitForFunction(
      () => window.atlasObserve([], { events: false }).state.saved,
    );
    const stored = fixtureCommand("inspect", file);
    check(
      "coarse-preserves-fine",
      stored.fineSha256 === fixture.coast.fineSha256 &&
        closeEnough(stored.samples, doseExpected),
      {
        beforeFineSha256: fixture.coast.fineSha256,
        afterFineSha256: stored.fineSha256,
        storedSamples: stored.samples,
      },
    );
    const previousSession = (await stateSnapshot(session.page)).sessionId;
    await button(session.page, "Öffnen");
    await session.page.waitForFunction(
      (previous) =>
        window.atlasObserve([], { events: false }).sessionId !== previous,
      previousSession,
    );
    await exact(session.page);
    check(
      "save-reopen",
      closeEnough(await values(session.page, points), doseExpected),
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
        doseExpected,
      ),
    );
  } finally {
    await restarted.close();
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
    await brush(session.page, 16, 1000);
    await button(session.page, "Nahansicht");
    await exact(session.page);
    const result = await movingStroke(
      session,
      [
        [-800, -300],
        [-680, -300],
        [-560, -300],
        [-440, -300],
      ],
      { timeout: fault === "drop-render" ? 5000 : 10_000 },
    );
    const evaluation = evaluateSubmissionDiagnostics(result.samples);
    const live = strokeEvidence(result);
    const doseBounded =
      fault !== "delay-render" ||
      (result.time.passed &&
        result.time.maximumStepMs <= 50 &&
        (result.time.discardMs.feedback ?? 0) > 0 &&
        result.time.timedDoseMs === 0);
    const code =
      fault === "delay-render"
        ? "SUBMISSION_LOWER_BOUND_EXCEEDS_LIMIT"
        : "MISSING_SUBMISSION";
    const valid =
      doseBounded &&
      (fault === "recovery"
        ? live.passed &&
          evaluation.status === "PROXY_ONLY" &&
          result.after.renderer.fault === "none"
        : result.after.renderer.fault === fault &&
          evaluation.status === "FAIL" &&
          evaluation.issues.some((e) => e.code === code));
    report.negativeControls.push({
      fault,
      passed: valid,
      actualFault: result.after.renderer.fault,
      evaluation,
      live,
      samples: result.samples,
      time: result.time,
      doseBounded,
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
    progress(`control-${fault}`, "running", {}, null);
    await checkpoint();
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
          observedFault: (await stateSnapshot(session.page)).renderer.fault,
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
    progress(`control-${fault}`, passed ? "completed" : "failed", {}, null);
    await checkpoint();
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
    progress(`scaling-${fixture.sourceTiles}`, "running", {}, null);
    await checkpoint();
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
        manifest.region.brush.amount * 2,
      );
      const beforeImage = await capture(session, "coarse-before", [
        manifest.region.pixelProbe,
        manifest.region.ridgePixelProbe,
      ]);
      result.stage = "coarse-edit";
      const edit = await dab(session, manifest.region.brush.center);
      result.time = edit.time;
      result.brush = {
        diameterPx: manifest.region.brush.diameter,
        rateFtPerSecond: manifest.region.brush.amount * 2,
        requestedHoldMs: 1000,
      };
      result.referenceExpected = manifest.expected;
      const factor = edit.time.acceptedDoseFt / manifest.region.brush.amount;
      const expected = {
        ...manifest.expected,
        afterCoarseDab: atStationaryDose(
          manifest.expected.before,
          manifest.expected.afterCoarseDab,
          factor,
        ),
        ridgeAfterCoarseDab: atStationaryDose(
          manifest.expected.ridgeBefore,
          manifest.expected.ridgeAfterCoarseDab,
          factor,
        ),
        ridgePixelAfterCoarseDab:
          manifest.expected.ridgePixelBefore +
          (manifest.expected.ridgePixelAfterCoarseDab -
            manifest.expected.ridgePixelBefore) *
            factor,
        ridgePixelWithoutFineAfterCoarseDab:
          -100 +
          (manifest.expected.ridgePixelWithoutFineAfterCoarseDab + 100) *
            factor,
      };
      result.expected = expected;
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
        !edit.time.passed ||
        !edit.time.stationary ||
        !knownValuesAgree(result.after, expected.afterCoarseDab) ||
        !knownValuesAgree(result.ridgeAfter, expected.ridgeAfterCoarseDab) ||
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
        !closeEnough(result.detail, expected.afterCoarseDab) ||
        !closeEnough(result.undone, manifest.expected.before) ||
        !closeEnough(result.redone, expected.afterCoarseDab)
      )
        throw new Error("Scaling detail return or history differs");
      result.stage = "ridge-detail-return";
      await navigateTo(session.page, manifest.region.ridgePixelProbe);
      await exact(session.page);
      result.ridgeDetail = await values(session.page, [
        manifest.region.ridgePixelProbe,
      ]);
      if (!closeEnough(result.ridgeDetail, [expected.ridgePixelAfterCoarseDab]))
        throw new Error("Detail return lost the populated fine ridge terrain");
      result.stage = "save-restart";
      await button(session.page, "Speichern");
      await session.page.waitForFunction(
        () => window.atlasObserve([], { events: false }).state.saved,
      );
      result.saved = fixtureCommand("inspect-scaling", file);
      if (result.saved.fineSha256 !== fixture.fineSha256)
        throw new Error("Coarse edit changed saved fine-source payloads");
      if (!closeEnough(result.saved.ridgeSamples, expected.ridgeAfterCoarseDab))
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
      if (!closeEnough(result.reopened, expected.afterCoarseDab))
        throw new Error("Scaling restart differs");
      await navigateTo(session.page, manifest.region.ridgePixelProbe);
      await exact(session.page);
      result.ridgeReopened = await values(session.page, [
        manifest.region.ridgePixelProbe,
      ]);
      if (
        !closeEnough(result.ridgeReopened, [expected.ridgePixelAfterCoarseDab])
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
    const resultFile = join(out, `scaling-${fixture.sourceTiles}-result.json`);
    await atomicJson(resultFile, result);
    progress(
      `scaling-${fixture.sourceTiles}`,
      result.passed ? "completed" : "failed",
      { resultFile },
      null,
    );
    await checkpoint();
  }
  report.scaling.passed =
    report.scaling.cases.length === 3 &&
    report.scaling.cases.every((c) => c.passed);
}

try {
  if (native && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    const error = new Error(
      "Native mode requires the regular reference display; no fixtures or traces were generated.",
    );
    error.code = "NO_NATIVE_DISPLAY";
    throw error;
  }
  const harnessFiles = (await readdir(join(root, "scripts")))
    .filter(
      (file) =>
        /^atlas-p0.*\.mjs$/.test(file) &&
        !/fixture|scaling|\.test\./.test(file),
    )
    .map((file) => `scripts/${file}`)
    .sort();
  const harnessHash = createHash("sha256");
  for (const file of harnessFiles)
    harnessHash
      .update(file)
      .update("\0")
      .update(await readFile(join(root, file)))
      .update("\0");
  report.harness = { sha256: harnessHash.digest("hex"), files: harnessFiles };
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
  {
    const fixture = selectedScope.needsBaseFixture
      ? fixtureCommand("create", join(out, "fixtures"))
      : null;
    if (selectedScope.needsBusyFixture)
      fixture.busy = fixtureCommand("create-busy", join(out, "busy-fixture"));
    if (fixture) {
      report.fixture = fixture.coast;
      report.fixtureManifest = fixture;
    }
    log("required real .saltatlas fixtures ready; starting built Electron app");
    const guarded = async (name, action, run = independentRunId) => {
      if (interrupted) return;
      progress(name, "running", {}, run);
      await checkpoint();
      try {
        await action();
        progress(name, "completed", {}, run);
      } catch (error) {
        report.errors.push({
          code: "SCENARIO_FAILURE",
          stage: name,
          independentRunId,
          message: String(error),
          stack: error.stack,
        });
        progress(name, "failed", { error: String(error) }, run);
        for (const entry of report.planned)
          if (entry.run === run && entry.state === "running")
            Object.assign(entry, { state: "failed", error: String(error) });
        log(`${name}: FAIL ${error}`);
      }
      await checkpoint();
    };
    for (let run = 1; run <= repetitions; run++) {
      if (interrupted) break;
      independentRunId = full ? `release-${run}` : `probe-${run}`;
      if (selectedScope.navigation)
        await guarded("empty-navigation", () => emptyNavigation(fixture));
      if (selectedScope.workflow)
        await guarded("coast-workflow", () => coastJourney(fixture));
      if (selectedScope.collection && !interrupted) {
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
            purpose,
            onScenario: scenarioCompleted,
            beforeScenario: async (id) => {
              progress(id, "running");
              await checkpoint();
            },
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
    if (selectedScope.controls) {
      await guarded("interaction-controls", () => interactionControls(fixture));
      for (const fault of ["delay-render", "drop-render", "recovery"])
        await guarded(
          `control-${fault}`,
          () => negativeControl(fixture, fault),
          null,
        );
    }
    if (selectedScope.scaling) await guarded("scaling", scalingJourney);
  }
} catch (error) {
  report.errors.push({
    code: error.code ?? "RUNNER_OR_PRODUCT_FAILURE",
    message: String(error),
    stack: error.stack,
  });
  console.error(error);
} finally {
  report.finishedAt = new Date().toISOString();
  await checkpoint();
  console.log(
    JSON.stringify(
      {
        output: out,
        purpose,
        status: report.evaluation.status,
        selectedScopePassed: report.evaluation.scopePassed,
        nativeAcceptance: report.evaluation.nativeAcceptance.status,
        failureCodes: [
          ...new Set(report.evaluation.failures.map((issue) => issue.code)),
        ],
        missingCases: report.planned.filter(
          (entry) => !["completed", "failed"].includes(entry.state),
        ).length,
        blockerCodes: [
          ...new Set(report.evaluation.blockers.map((issue) => issue.code)),
        ],
        report: join(out, "report.json"),
        index: join(out, "run-index.json"),
      },
      null,
      2,
    ),
  );
  process.exitCode = report.evaluation.failures.length
    ? 1
    : report.evaluation.scopePassed && lab && !full
      ? 0
      : report.evaluation.passed
        ? 0
        : 2;
}
