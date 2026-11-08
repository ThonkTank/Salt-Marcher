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
    { status: "BLOCKED", errors: [], exit: 2 },
    {
      status: "FAIL",
      errors: [
        {
          code: "NATIVE_PREFLIGHT_CLOSE_FAILED",
          message: "close failed",
        },
      ],
      exit: 1,
    },
  ])(
    "preserves a saved $status preflight in the shared evaluator and CLI exit $exit",
    async ({ status, errors, exit }) => {
      const out = await mkdtemp(join(tmpdir(), "atlas-native-evaluate-"));
      try {
        const preflight = {
          status,
          errors,
          blockers: [{ code: nativePresentationCapability.code }],
        };
        const report = {
          schemaVersion: 2,
          purpose: "native-preflight",
          mode: "native",
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
