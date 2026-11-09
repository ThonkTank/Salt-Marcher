import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { cpus, release, totalmem } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { launchAtlasDesktop } from "./atlas-p0-desktop.mjs";
import {
  analyzeTrace,
  nativePresentationCapability,
  parseTrace,
} from "./atlas-p0-trace.mjs";
import {
  brush,
  button,
  exact,
  landPixel,
  position,
  snapshot,
  waterPixel,
} from "./atlas-p0-interactions.mjs";

export { nativePresentationCapability };

const knownIdentity = (value) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  !/^(unknown|unavailable|undefined|null)$/i.test(value.trim());
const softwareGpu = (gpu) =>
  typeof gpu !== "string" ||
  /swiftshader|llvmpipe|softpipe|software|unavailable/i.test(gpu);

/** One small existing coast fixture; a preflight without --probe never creates it. */
async function probeFixture(out) {
  const require = createRequire(import.meta.url);
  const result = spawnSync(
    require("electron"),
    [
      fileURLToPath(new URL("./atlas-p0-fixture.mjs", import.meta.url)),
      "create",
      join(out, "probe-fixture"),
    ],
    {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      encoding: "utf8",
      timeout: 30_000,
    },
  );
  if (result.error || result.status !== 0)
    throw new Error(
      `Native probe fixture failed: ${result.error ?? result.stderr}`,
    );
  return JSON.parse(result.stdout);
}

/**
 * A discriminating content probe, not an exact-generation latency sample.
 * Its three terrain ROIs change from the analytic coast's water to land.
 * The cursor continues moving even when drop-render freezes those actual tiles.
 */
async function presentationProbe(desktop, out, name) {
  const { page } = desktop;
  const points = [
    [-650, -96],
    [-650, 96],
    [-554, 0],
  ];
  const center = [-650, 0];
  await button(page, "Nahansicht");
  await page.getByLabel("Raster anzeigen").uncheck();
  await brush(page, 256, 2000);
  const pointer = await position(page, center);
  await page.mouse.move(pointer.x, pointer.y);
  await exact(page);
  const before = await snapshot(page, points);
  const screenPoints = [];
  for (const point of points) screenPoints.push(await position(page, point));
  const viewport = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
  }));
  const rendererPid = await desktop.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.getOSProcessId(),
  );
  await desktop.app.evaluate(() =>
    globalThis.__atlasHost.startTrace({ screenshots: true }),
  );
  await page.waitForTimeout(200);
  await page.mouse.click(pointer.x, pointer.y);
  // These are genuine hover inputs. No artificial marker or DOM animation can
  // stand in for the changed terrain pixels at the separate fixed ROIs.
  for (let i = 0; i < 16; i++) {
    await page.mouse.move(pointer.x + 170 + i * 4, pointer.y + 140);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(300);
  const path = join(out, `${name}-trace.json`);
  await desktop.app.evaluate(
    (_, file) => globalThis.__atlasHost.stopTrace(file),
    path,
  );
  const observation = await snapshot(page, points);
  const text = await readFile(path, "utf8");
  const analysis = analyzeTrace(text, { rendererPid });
  const images = parseTrace(text)
    .traceEvents.filter((event) => event.name === "Screenshot")
    .map((event) => event.args?.snapshot);
  const decoded = await desktop.app.evaluate(
    ({ nativeImage }, { images, screenPoints, viewport }) =>
      images.map((base64) => {
        if (typeof base64 !== "string") return null;
        const image = nativeImage.createFromBuffer(
          Buffer.from(base64, "base64"),
        );
        if (image.isEmpty()) return null;
        const size = image.getSize();
        if (
          Math.abs(
            size.width / size.height - viewport.width / viewport.height,
          ) > 0.01
        )
          return null;
        const bitmap = image.toBitmap();
        const pixels = screenPoints.map(({ x, y }) => {
          const px = Math.round((x * size.width) / viewport.width);
          const py = Math.round((y * size.height) / viewport.height);
          if (px < 1 || py < 1 || px >= size.width - 1 || py >= size.height - 1)
            return null;
          const rgb = [0, 0, 0];
          // A small patch reduces JPEG/chroma noise, without moving the sample
          // to a different part of the terrain after seeing its result.
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const at = ((py + dy) * size.width + px + dx) * 4;
              rgb[0] += bitmap[at + 2] / 9;
              rgb[1] += bitmap[at + 1] / 9;
              rgb[2] += bitmap[at] / 9;
            }
          return rgb;
        });
        return { size, pixels };
      }),
    { images, screenPoints, viewport },
  );
  const events = observation.events.slice(before.eventCount);
  const edits = events.filter(
    (event) => event.kind === "brush-interval" && event.changed,
  );
  const input = events.find(
    (event) => event.kind === "input" && event.eventType === "pointerdown",
  );
  const inputMark = analysis.marks.find(
    (mark) => mark.name === `atlas.input.${input?.id}`,
  );
  const frames = analysis.screenshots.map((frame, index) => {
    const content = decoded[index];
    const state =
      content?.pixels.length === 3 &&
      content.pixels.every(
        (pixel) => pixel?.length === 3 && pixel.every(Number.isFinite),
      )
        ? content.pixels.every(waterPixel)
          ? "before"
          : content.pixels.every(landPixel)
            ? "changed"
            : "mixed"
        : "unreadable";
    const reporter =
      frame.frameIdentityStatus === "unique-reporter-candidate"
        ? frame.reporterCandidates[0]
        : null;
    return {
      ...frame,
      content: { ...content, state },
      // This relative same-trace-clock value tests the delay fault only. It
      // remains a candidate: copy provenance and first presentation are open.
      reporterAfterInputMarkMs:
        reporter && inputMark ? (reporter.endTs - inputMark.ts) / 1000 : null,
    };
  });
  analysis.screenshots = frames;
  const firstChanged = frames.find(
    (frame) => frame.content.state === "changed",
  );
  const beforeHeights = points.map(([x]) => 20 + 0.05 * x);
  const fixtureMatches =
    before.samples.length === points.length &&
    before.samples.every(
      (height, index) => Math.abs(height - beforeHeights[index]) < 1e-5,
    );
  const press = edits[0];
  const expectedPress =
    press?.cause === "press" &&
    press.radius === 512 &&
    press.level === 3 &&
    press.rateFtPerSecond === 2000 &&
    Math.abs(press.acceptedElapsedMs - 1000 / 60) < 1e-5 &&
    Math.hypot(press.to[0] - center[0], press.to[1] - center[1]) <= 4;
  const probe = {
    name,
    traceSha256: analysis.sha256,
    events: analysis.events,
    mappingStatus: analysis.mappingStatus,
    screenshotMapping: analysis.screenshotMapping,
    missingEdge: analysis.missingEdge,
    clockObservation: analysis.clockObservation,
    observerOverhead:
      "unqualified; this bounded probe cannot establish an acceptance-grade measurement cost",
    fixtureExpectation: {
      points,
      beforeHeights,
      afterPredicate:
        "land at all three ROIs after the nominal 1/60-second 2000 ft/s press",
      explanation:
        "The coastal plane is 20 + .05*x. At these points the level-3, radius-512 stationary quartic brush's positive cubic interpolation adds more than 20 feet; all begin below water and end above it. This sign predicate cannot identify arbitrary intermediate exact height revisions.",
    },
    fixtureMatches,
    expectedPress,
    modelChangedAtAllPoints:
      observation.samples.length === 3 &&
      observation.samples.every((height) => height > 0),
    changedSteps: edits.length,
    capturedBefore: frames.filter((frame) => frame.content.state === "before")
      .length,
    capturedChanged: frames.filter((frame) => frame.content.state === "changed")
      .length,
    capturedMixed: frames.filter((frame) => frame.content.state === "mixed")
      .length,
    capturedUnreadable: frames.filter(
      (frame) => frame.content.state === "unreadable",
    ).length,
    overlaySubmissions: events.filter((event) => event.kind === "submit")
      .length,
    firstChangedReporterAfterInputMarkMs:
      firstChanged?.reporterAfterInputMarkMs ?? null,
    controlPassed: false,
    presentationAt: null,
  };
  const observedInput =
    inputMark &&
    fixtureMatches &&
    expectedPress &&
    probe.modelChangedAtAllPoints;
  probe.controlPassed = Boolean(
    observedInput &&
    probe.capturedBefore > 0 &&
    (name.includes("drop-render")
      ? !firstChanged &&
        probe.capturedBefore >= 2 &&
        probe.overlaySubmissions >= 2
      : firstChanged &&
        firstChanged.reporterAfterInputMarkMs !== null &&
        firstChanged.reporterAfterInputMarkMs >= 0 &&
        (!name.includes("delay-render") ||
          firstChanged.reporterAfterInputMarkMs >= 250)),
  );
  await writeFile(
    join(out, `${name}-analysis.json`),
    JSON.stringify(analysis, null, 2),
  );
  await writeFile(
    join(out, `${name}-observation.json`),
    JSON.stringify(observation, null, 2),
  );
  return probe;
}

/**
 * Qualify an explicitly selected machine against observations; never trust a PASS flag.
 * @param {unknown} profile
 * @param {unknown} [observed]
 */
export function qualifyNativeReference(profile, observed = {}) {
  observed ??= {};
  const blockers = [];
  const block = (code, field) => blockers.push({ code, field });
  if (!profile || !knownIdentity(profile.id))
    block("REFERENCE_PROFILE_REQUIRED", "id");
  for (const field of [
    "cpu",
    "gpu",
    "platform",
    "architecture",
    "os",
    "displayId",
  ])
    if (
      !knownIdentity(observed[field]) ||
      !knownIdentity(profile?.[field]) ||
      profile[field] !== observed[field]
    )
      block("REFERENCE_PROFILE_MISMATCH", field);
  if (observed.softwareRendering !== false || softwareGpu(observed.gpu))
    block("SOFTWARE_RENDERING", "gpu");
  if (observed.hardwareAcceleration !== true)
    block("HARDWARE_ACCELERATION_UNPROVEN", "gpu");
  if (
    !Number.isSafeInteger(observed.ramBytes) ||
    observed.ramBytes <= 0 ||
    profile?.ramBytes !== observed.ramBytes
  )
    block("REFERENCE_MEMORY_MISMATCH", "ramBytes");
  if (
    !Number.isFinite(observed.displayHz) ||
    observed.displayHz < 59 ||
    profile?.displayHz !== observed.displayHz
  )
    block("REFERENCE_DISPLAY_UNQUALIFIED", "displayHz");
  for (const [field, expected] of Object.entries({
    width: 1440,
    height: 960,
    dpr: 1,
  }))
    if (
      observed.viewport?.[field] !== expected ||
      profile?.viewport?.[field] !== expected
    )
      block("REFERENCE_VIEWPORT_UNQUALIFIED", field);
  if (observed.visible !== true || observed.focused !== true)
    block("REFERENCE_WINDOW_NOT_VISIBLE", "window");
  return { qualified: blockers.length === 0, blockers };
}

/**
 * Preflight creates no fixtures. An explicit probe uses one small existing
 * fixture; its optional laboratory mode never qualifies a native reference.
 * @param {{out: string, executablePath?: string, profilePath?: string, probe?: boolean, lab?: boolean, env?: NodeJS.ProcessEnv}} options
 */
export async function nativePreflight({
  out,
  executablePath,
  profilePath,
  probe = false,
  lab = false,
  env = process.env,
}) {
  await mkdir(out, { recursive: true });
  const report = {
    schemaVersion: 1,
    purpose: probe ? "native-presentation-investigation" : "native-preflight",
    mode: lab ? "lab" : "native",
    status: "BLOCKED",
    fixturesCreated: false,
    qualification: { qualified: false, blockers: [] },
    presentation: nativePresentationCapability,
    blockers: [],
    errors: [],
  };
  const failure = (code, error) => {
    report.status = "FAIL";
    report.errors.push({ code, message: String(error) });
  };
  let desktop;
  const output = [];
  try {
    if (lab && !probe)
      throw new Error(
        "Laboratory mode is only available for the explicit presentation probe.",
      );
    if (lab)
      report.blockers.push({ code: "LABORATORY_PROBE_NOT_NATIVE_REFERENCE" });
    if (process.platform === "linux" && !env.DISPLAY && !env.WAYLAND_DISPLAY) {
      report.blockers.push({ code: "NO_NATIVE_DISPLAY" });
      if (!lab) return report;
    }
    let profile = null;
    if (profilePath) {
      const bytes = await readFile(profilePath);
      profile = JSON.parse(bytes.toString("utf8"));
      report.profile = {
        path: profilePath,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    }
    const fixture = probe ? await probeFixture(out) : null;
    report.fixturesCreated = Boolean(fixture);
    if (fixture)
      report.fixture = {
        sha256: fixture.coast.sha256,
        file: fixture.files.coast,
      };
    desktop = await launchAtlasDesktop({
      executablePath,
      lab,
      diagnostics: true,
      project: fixture?.files.coast,
      env: probe ? { ATLAS_P0_DIALOG_UNSAVED: "discard" } : {},
    });
    await desktop.page.waitForFunction(
      () => typeof window.atlasObserve === "function",
    );
    const host = await desktop.app.evaluate(
      async ({ BrowserWindow, screen }) => {
        const window = BrowserWindow.getAllWindows()[0];
        const display = screen.getDisplayMatching(window.getBounds());
        return {
          ...(await globalThis.__atlasHost.info()),
          display,
          visible: window.isVisible() && !window.isMinimized(),
          focused: window.isFocused(),
        };
      },
    );
    const view = await desktop.page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      if (!canvas) throw new Error("Native preflight has no product canvas");
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      const extension = gl?.getExtension("WEBGL_debug_renderer_info");
      return {
        viewport: {
          width: innerWidth,
          height: innerHeight,
          dpr: devicePixelRatio,
        },
        gpu: gl
          ? String(
              gl.getParameter(
                extension?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER,
              ),
            )
          : "unavailable",
      };
    });
    const observed = {
      cpu: cpus()[0]?.model ?? "unknown",
      gpu: view.gpu,
      platform: process.platform,
      architecture: process.arch,
      os: release(),
      ramBytes: totalmem(),
      displayId: String(host.display.id),
      displayHz: host.display.displayFrequency,
      viewport: view.viewport,
      visible: host.visible,
      focused: host.focused,
      softwareRendering: softwareGpu(view.gpu),
      hardwareAcceleration: host.gpuFeatures?.webgl === "enabled",
    };
    report.observed = observed;
    report.build = host.build;
    report.runtime = host.versions;
    report.qualification = qualifyNativeReference(profile, observed);
    report.blockers.push(...report.qualification.blockers);
    // Evidence template only: the empty ID prevents accidental reference nomination.
    await writeFile(
      join(out, "reference-observed.json"),
      JSON.stringify({ id: "", ...observed }, null, 2),
    );
    if (probe) {
      report.probe = { cases: [], mappingStatus: "unsupported" };
      for (const [name, fault] of [
        ["native-probe", null],
        ["native-probe-drop-render", "drop-render"],
        ["native-probe-delay-render", "delay-render"],
        ["native-probe-recovery", null],
      ]) {
        if (report.probe.cases.length) {
          if (desktop.errors.length) throw new Error(desktop.errors.join("; "));
          await desktop.close();
          output.push(...desktop.output);
          desktop = await launchAtlasDesktop({
            executablePath,
            lab,
            diagnostics: true,
            project: fixture.files.coast,
            env: {
              ATLAS_P0_DIALOG_UNSAVED: "discard",
              ...(fault ? { ATLAS_P0_FAULT: fault } : {}),
            },
          });
        }
        const result = await presentationProbe(desktop, out, name);
        report.probe.cases.push(result);
        if (!result.controlPassed)
          failure("NATIVE_PROBE_CONTROL_FAILED", result.name);
      }
    }
    if (desktop.errors.length) throw new Error(desktop.errors.join("; "));
  } catch (error) {
    failure("NATIVE_PREFLIGHT_ERROR", error);
  } finally {
    if (desktop) {
      try {
        await desktop.close();
      } catch (error) {
        failure("NATIVE_PREFLIGHT_CLOSE_FAILED", error);
      }
      try {
        await writeFile(
          join(out, "native-electron.log"),
          [...output, ...desktop.output].join(""),
        );
      } catch (error) {
        failure("NATIVE_PREFLIGHT_LOG_FAILED", error);
      }
    }
    report.blockers.push({
      code: nativePresentationCapability.code,
      reason: nativePresentationCapability.reason,
    });
    await writeFile(
      join(out, "native-preflight.json"),
      JSON.stringify(report, null, 2),
    );
  }
  return report;
}
