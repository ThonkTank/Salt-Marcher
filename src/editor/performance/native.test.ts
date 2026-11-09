import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  qualifyNativeReference,
  nativePreflight,
  nativePresentationCapability,
} from "../../../scripts/atlas-p0-native.mjs";
import {
  evaluateNativePreflight,
  evaluateRun,
} from "../../../scripts/atlas-p0-evaluate.mjs";
import { analyzeTrace } from "../../../scripts/atlas-p0-trace.mjs";

function observed() {
  return {
    cpu: "Reference CPU",
    gpu: "ANGLE (Reference GPU, OpenGL)",
    platform: "linux",
    architecture: "x64",
    os: "reference-kernel",
    ramBytes: 16 * 1024 ** 3,
    displayId: "42",
    displayHz: 60,
    viewport: { width: 1440, height: 960, dpr: 1 },
    visible: true,
    focused: true,
    hardwareAcceleration: true,
    softwareRendering: false,
  };
}
const profile = () => ({ id: "chosen-reference", ...observed() });
const codes = (result: ReturnType<typeof qualifyNativeReference>) =>
  result.blockers.map((issue) => issue.code);

describe("screenshot frame identity candidate", () => {
  const screenshot = {
    name: "Screenshot",
    pid: 10,
    ts: 4000,
    args: {
      source_id: "9007199254740993",
      frame_sequence: 12,
      expected_display_time: 500,
      snapshot: Buffer.from("not terrain evidence").toString("base64"),
    },
  };
  const reporter = (pid: number, serial: number, fields = {}) => [
    {
      name: "PipelineReporter",
      pid,
      ph: "b",
      ts: 1000,
      id: serial,
      args: {
        frame_reporter: {
          frame_source: "9007199254740993",
          frame_sequence: 12,
          state: "STATE_PRESENTED_ALL",
          has_missing_content: false,
          layer_tree_host_id: 1,
          surface_frame_trace_id: String(9007199254740993n + BigInt(serial)),
          display_trace_id: String(9007199254741993n + BigInt(serial)),
          ...fields,
        },
      },
    },
    { name: "PipelineReporter", pid, ph: "e", ts: 3000, id: serial },
  ];
  const analysis = (events: unknown[]) =>
    analyzeTrace(JSON.stringify({ traceEvents: [screenshot, ...events] }), {
      rendererPid: 20,
    });

  it("matches exact IDs in the target renderer without accepting content, estimated time or presentation", () => {
    const result = analysis([...reporter(10, 1), ...reporter(20, 2)]);
    const frame = result.screenshots[0];
    expect(frame.frameIdentityStatus).toBe("unique-reporter-candidate");
    expect(frame.reporterCandidates).toHaveLength(1);
    expect(frame.reporterCandidates[0].pid).toBe(20);
    expect(frame.reporterCandidates[0].endTs).toBe(3000);
    expect(frame.expectedDisplayTime).toBe(500);
    expect(frame.presentationAt).toBeNull();
    expect(result.screenshotMapping.mappedPresentations).toBe(0);
    expect(result.mappingStatus).toBe("unsupported");
  });

  it("does not choose an earlier or later reporter when frame identity is ambiguous", () => {
    const result = analysis([...reporter(20, 1), ...reporter(20, 2)]);
    expect(result.screenshots[0].frameIdentityStatus).toBe("ambiguous");
    expect(result.screenshots[0].presentationAt).toBeNull();
    expect(result.screenshotMapping.ambiguous).toBe(1);
  });

  it.each([
    { frame_source: "9007199254740992" },
    { frame_source: "-2" },
    { frame_sequence: 13 },
    { state: "STATE_PRESENTED_PARTIAL" },
    { state: "STATE_DROPPED" },
    { has_missing_content: true },
    { display_trace_id: undefined },
    { display_trace_id: null },
    { display_trace_id: -1 },
    { display_trace_id: "18446744073709551616" },
    { display_trace_id: "9223372036854775808" },
    { display_trace_id: "-9223372036854775809" },
    { display_trace_id: "not-an-id" },
    { surface_frame_trace_id: undefined },
    { surface_frame_trace_id: null },
    { surface_frame_trace_id: {} },
    { layer_tree_host_id: null },
    { layer_tree_host_id: "1" },
  ])(
    "retains a missing frame for incomplete or wrong evidence: %j",
    (fields) => {
      const result = analysis(reporter(20, 1, fields));
      expect(result.screenshots[0].frameIdentityStatus).toBe("unmapped");
      expect(result.screenshots[0].presentationAt).toBeNull();
      expect(result.screenshotMapping.unmapped).toBe(1);
    },
  );

  it("does not infer a target renderer from the screenshot's browser PID", () => {
    const result = analyzeTrace(
      JSON.stringify({ traceEvents: [screenshot, ...reporter(10, 1)] }),
    );
    expect(result.screenshots[0].frameIdentityStatus).toBe("unmapped");
    expect(result.screenshotMapping.rendererPids).toEqual([]);
  });

  it("preserves signed int64 trace IDs from the real pinned Chromium trace", () => {
    const trace = JSON.stringify({
      traceEvents: [
        screenshot,
        ...reporter(20, 1, {
          surface_frame_trace_id: "-3985621293103288367",
          display_trace_id: "-3985621293103288366",
        }),
      ],
    }).replace(/"(-398562129310328836[67])"/g, "$1");
    const result = analyzeTrace(trace, { rendererPid: 20 });
    const frame = result.screenshots[0];
    expect(frame.frameIdentityStatus).toBe("unique-reporter-candidate");
    expect(frame.reporterCandidates[0].surface_frame_trace_id).toBe(
      "-3985621293103288367",
    );
    expect(frame.reporterCandidates[0].display_trace_id).toBe(
      "-3985621293103288366",
    );
    expect(frame.presentationAt).toBeNull();
  });

  it("retains both signed boundaries and the full positive uint64 frame identity", () => {
    const result = analyzeTrace(
      JSON.stringify({
        traceEvents: [
          {
            ...screenshot,
            args: { ...screenshot.args, source_id: "0xffffffffffffffff" },
          },
          ...reporter(20, 1, {
            frame_source: "18446744073709551615",
            surface_frame_trace_id: "-9223372036854775808",
            display_trace_id: "9223372036854775807",
          }),
        ],
      }),
      { rendererPid: 20 },
    );
    expect(result.screenshots[0].frameIdentityStatus).toBe(
      "unique-reporter-candidate",
    );
    expect(result.screenshots[0].sourceId).toBe("18446744073709551615");
    expect(result.screenshots[0].presentationAt).toBeNull();
  });

  it("retains missing image content separately from a unique frame-only candidate", () => {
    const result = analyzeTrace(
      JSON.stringify({
        traceEvents: [
          { ...screenshot, args: { ...screenshot.args, snapshot: null } },
          ...reporter(20, 1),
        ],
      }),
      { rendererPid: 20 },
    );
    expect(result.screenshots[0]).toMatchObject({
      frameIdentityStatus: "unique-reporter-candidate",
      imageStatus: "missing",
      snapshotSha256: null,
      presentationAt: null,
    });
    expect(result.screenshotMapping.mappedPresentations).toBe(0);
  });
});

describe("explicit native reference qualification", () => {
  it("qualifies a matching observed reference without accepting presentation", () => {
    expect(qualifyNativeReference(profile(), observed())).toEqual({
      qualified: true,
      blockers: [],
    });
    expect(nativePresentationCapability.status).toBe("unsupported");
    expect(analyzeTrace('{"traceEvents":[]}').mappingStatus).toBe(
      "unsupported",
    );
  });

  it.each([
    undefined,
    null,
    {},
    [],
    { id: "" },
    { id: " " },
    { id: "unknown" },
  ])("requires an explicitly named profile: %j", (value) => {
    expect(qualifyNativeReference(value, observed()).qualified).toBe(false);
    expect(codes(qualifyNativeReference(value, observed()))).toContain(
      "REFERENCE_PROFILE_REQUIRED",
    );
  });

  it.each(["cpu", "gpu", "platform", "architecture", "os", "displayId"])(
    "rejects a changed observed %s even if the profile claims PASS",
    (field) => {
      const selected = { ...profile(), qualified: true, status: "PASS" };
      const result = qualifyNativeReference(selected, {
        ...observed(),
        [field]: "different",
      });
      expect(result.qualified).toBe(false);
      expect(result.blockers).toContainEqual({
        code: "REFERENCE_PROFILE_MISMATCH",
        field,
      });
    },
  );

  it("does not equate two unknown hardware values or missing observations", () => {
    expect(
      codes(
        qualifyNativeReference(
          { ...profile(), cpu: "unknown" },
          { ...observed(), cpu: "unknown" },
        ),
      ),
    ).toContain("REFERENCE_PROFILE_MISMATCH");
    expect(qualifyNativeReference(profile()).qualified).toBe(false);
    expect(qualifyNativeReference(profile(), null).qualified).toBe(false);
  });

  it.each(["SwiftShader", "llvmpipe", "softpipe", "unavailable"])(
    "rejects %s despite a false software-rendering flag",
    (gpu) => {
      const actual = { ...observed(), gpu };
      expect(
        codes(qualifyNativeReference({ ...profile(), gpu }, actual)),
      ).toContain("SOFTWARE_RENDERING");
    },
  );

  it("requires affirmative hardware, visible-window and focus observations", () => {
    expect(
      codes(
        qualifyNativeReference(profile(), {
          ...observed(),
          hardwareAcceleration: undefined,
        }),
      ),
    ).toContain("HARDWARE_ACCELERATION_UNPROVEN");
    expect(
      codes(
        qualifyNativeReference(profile(), {
          ...observed(),
          softwareRendering: true,
        }),
      ),
    ).toContain("SOFTWARE_RENDERING");
    for (const field of ["visible", "focused"])
      for (const value of [false, undefined, "true"])
        expect(
          codes(
            qualifyNativeReference(profile(), {
              ...observed(),
              [field]: value,
            }),
          ),
        ).toContain("REFERENCE_WINDOW_NOT_VISIBLE");
  });

  it.each([0, 58, Number.NaN, Number.POSITIVE_INFINITY, "60", undefined])(
    "rejects an unqualified display frequency %s",
    (displayHz) => {
      expect(
        codes(
          qualifyNativeReference(
            { ...profile(), displayHz },
            { ...observed(), displayHz },
          ),
        ),
      ).toContain("REFERENCE_DISPLAY_UNQUALIFIED");
    },
  );

  it("rejects a different display frequency or memory size from the selected profile", () => {
    expect(
      codes(
        qualifyNativeReference(profile(), { ...observed(), displayHz: 144 }),
      ),
    ).toContain("REFERENCE_DISPLAY_UNQUALIFIED");
    expect(
      codes(
        qualifyNativeReference(profile(), {
          ...observed(),
          ramBytes: 8 * 1024 ** 3,
        }),
      ),
    ).toContain("REFERENCE_MEMORY_MISMATCH");
  });

  it.each([
    { width: 1280, height: 960, dpr: 1 },
    { width: 1440, height: 900, dpr: 1 },
    { width: 1440, height: 960, dpr: 2 },
  ])(
    "does not authorize a non-reference viewport even when the profile matches %j",
    (viewport) => {
      expect(
        codes(
          qualifyNativeReference(
            { ...profile(), viewport },
            { ...observed(), viewport },
          ),
        ),
      ).toContain("REFERENCE_VIEWPORT_UNQUALIFIED");
    },
  );
});

describe("native preflight evidence and result boundary", () => {
  it.each([
    { mode: "native", status: "BLOCKED", errors: [], exit: 2 },
    { mode: "lab", status: "BLOCKED", errors: [], exit: 2 },
    {
      mode: "native",
      status: "FAIL",
      errors: [
        {
          code: "NATIVE_PREFLIGHT_CLOSE_FAILED",
          message: "close failed",
        },
      ],
      exit: 1,
    },
    {
      mode: "lab",
      status: "FAIL",
      exit: 1,
      errors: [{ code: "NATIVE_PROBE_CONTROL_FAILED", message: "drop-render" }],
    },
  ])(
    "preserves a saved $mode $status preflight in the shared evaluator and CLI exit $exit",
    async ({ mode, status, errors, exit }) => {
      const out = await mkdtemp(join(tmpdir(), "atlas-native-evaluate-"));
      try {
        const preflight = {
          status,
          errors,
          blockers: [{ code: nativePresentationCapability.code }],
        };
        const report = {
          schemaVersion: 3,
          purpose:
            mode === "native"
              ? "native-preflight"
              : "native-presentation-investigation",
          mode,
          collectionStarted: false,
          preflight,
          errors: [],
          planned: [
            {
              run: "probe-1",
              id: "M03-height-large",
              state: "blocked-before-collection",
            },
          ],
        };
        const checkpoint = evaluateRun(report);
        expect(checkpoint).toEqual(evaluateNativePreflight(preflight));
        expect(checkpoint.status).toBe(status);
        expect(checkpoint.failures).toEqual(errors);
        expect(checkpoint.missing).toEqual([]);
        const path = join(out, "report.json");
        await writeFile(
          path,
          JSON.stringify({ ...report, evaluation: checkpoint }),
        );
        const result = spawnSync(
          process.execPath,
          [
            fileURLToPath(
              new URL(
                "../../../scripts/atlas-p0-evaluate.mjs",
                import.meta.url,
              ),
            ),
            path,
          ],
          { encoding: "utf8" },
        );
        expect(result.stderr).toBe("");
        expect(result.status).toBe(exit);
        expect(JSON.parse(result.stdout)).toEqual(checkpoint);
      } finally {
        await rm(out, { recursive: true, force: true });
      }
    },
  );

  it("does not turn deliberately unstarted scenarios into measured failures", () => {
    const result = evaluateNativePreflight({
      status: "BLOCKED",
      qualification: { qualified: true, blockers: [] },
      errors: [],
      blockers: [{ code: nativePresentationCapability.code }],
    });
    expect(result.status).toBe("BLOCKED");
    expect(result.failures).toEqual([]);
    expect(result.missing).toEqual([]);
    expect(result.passed).toBe(false);
    expect(result.scopePassed).toBe(false);
    expect(result.nativeAcceptance).toMatchObject({
      evaluated: false,
      passed: false,
      status: "BLOCKED",
    });
    expect(evaluateNativePreflight(undefined).status).toBe("BLOCKED");
  });

  it("retains actual preflight/runner failures beside the presentation blocker", () => {
    const issue = {
      code: "NATIVE_PREFLIGHT_CLOSE_FAILED",
      message: "close failed",
    };
    const runtime = {
      code: "RUNNER_OR_PRODUCT_FAILURE",
      message: "write failed",
    };
    const result = evaluateNativePreflight(
      {
        errors: [issue],
        blockers: [{ code: nativePresentationCapability.code }],
      },
      [runtime],
    );
    expect(result.status).toBe("FAIL");
    expect(result.failures).toEqual([issue, runtime]);
    expect(result.nativeAcceptance.status).toBe("BLOCKED");
  });

  it.skipIf(process.platform !== "linux")(
    "persists NO_NATIVE_DISPLAY before a build, launch or fixture can be needed",
    async () => {
      const out = await mkdtemp(join(tmpdir(), "atlas-native-no-display-"));
      try {
        const result = await nativePreflight({
          out,
          executablePath: "/does-not-exist",
          env: {},
        });
        const saved = JSON.parse(
          await readFile(join(out, "native-preflight.json"), "utf8"),
        );
        expect(saved).toEqual(result);
        expect(result.status).toBe("BLOCKED");
        expect(result.fixturesCreated).toBe(false);
        expect(result.errors).toEqual([]);
        expect(result.blockers).toContainEqual({ code: "NO_NATIVE_DISPLAY" });
        expect(result.blockers).toContainEqual(
          expect.objectContaining({ code: nativePresentationCapability.code }),
        );
      } finally {
        await rm(out, { recursive: true, force: true });
      }
    },
  );

  it("persists a malformed-profile failure before any native launch", async () => {
    const out = await mkdtemp(join(tmpdir(), "atlas-native-bad-profile-"));
    const path = join(out, "invalid.json");
    try {
      await writeFile(path, "{invalid");
      const result = await nativePreflight({
        out,
        executablePath: "/does-not-exist",
        profilePath: path,
        env: { DISPLAY: ":test" },
      });
      expect(
        JSON.parse(await readFile(join(out, "native-preflight.json"), "utf8")),
      ).toEqual(result);
      expect(result.status).toBe("FAIL");
      expect(result.fixturesCreated).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "NATIVE_PREFLIGHT_ERROR" }),
      );
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});
