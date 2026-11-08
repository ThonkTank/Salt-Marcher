import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { cpus, release, totalmem } from "node:os";
import { join } from "node:path";
import { launchAtlasDesktop } from "./atlas-p0-desktop.mjs";
import {
  analyzeTrace,
  nativePresentationCapability,
} from "./atlas-p0-trace.mjs";

export { nativePresentationCapability };

const knownIdentity = (value) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  !/^(unknown|unavailable|undefined|null)$/i.test(value.trim());
const softwareGpu = (gpu) =>
  typeof gpu !== "string" ||
  /swiftshader|llvmpipe|softpipe|software|unavailable/i.test(gpu);

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
 * A small native-only investigation. Never creates fixtures or claims acceptance.
 * @param {{out: string, executablePath?: string, profilePath?: string, probe?: boolean, env?: NodeJS.ProcessEnv}} options
 */
export async function nativePreflight({
  out,
  executablePath,
  profilePath,
  probe = false,
  env = process.env,
}) {
  await mkdir(out, { recursive: true });
  const report = {
    schemaVersion: 1,
    purpose: probe ? "native-presentation-investigation" : "native-preflight",
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
  try {
    if (process.platform === "linux" && !env.DISPLAY && !env.WAYLAND_DISPLAY) {
      report.blockers.push({ code: "NO_NATIVE_DISPLAY" });
      return report;
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
    desktop = await launchAtlasDesktop({
      executablePath,
      lab: false,
      diagnostics: true,
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
    report.qualification = qualifyNativeReference(profile, observed);
    report.blockers.push(...report.qualification.blockers);
    // Evidence template only: the empty ID prevents accidental reference nomination.
    await writeFile(
      join(out, "reference-observed.json"),
      JSON.stringify({ id: "", ...observed }, null, 2),
    );
    if (probe) {
      await desktop.app.evaluate(() => globalThis.__atlasHost.startTrace());
      const box = await desktop.page.locator("canvas").boundingBox();
      if (!box) throw new Error("Native probe has no visible product canvas");
      await desktop.page.mouse.move(
        box.x + box.width / 2,
        box.y + box.height / 2,
      );
      for (let i = 0; i < 8; i++) {
        await desktop.page.mouse.wheel(0, i % 2 ? 100 : -100);
        await desktop.page.waitForTimeout(100);
      }
      await desktop.page.waitForTimeout(250);
      const path = join(out, "native-probe-trace.json");
      await desktop.app.evaluate(
        (_, file) => globalThis.__atlasHost.stopTrace(file),
        path,
      );
      const analysis = analyzeTrace(await readFile(path, "utf8"));
      await writeFile(
        join(out, "native-probe-analysis.json"),
        JSON.stringify(analysis, null, 2),
      );
      const observation = await desktop.page.evaluate(() =>
        window.atlasObserve(),
      );
      await writeFile(
        join(out, "native-probe-observation.json"),
        JSON.stringify(observation, null, 2),
      );
      report.probe = {
        traceSha256: analysis.sha256,
        events: analysis.events,
        mappingStatus: analysis.mappingStatus,
      };
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
          desktop.output.join(""),
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
