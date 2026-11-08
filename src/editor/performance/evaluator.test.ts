import { describe, expect, it } from "vitest";

// The executable evaluator is intentionally shared with the command-line runner.
import {
  evaluateAcceptance,
  evaluateSubmissionDiagnostics,
  evaluateColdSubmissionDiagnostics,
  extractEditSamples,
  checkBuildIdentity,
} from "../../../scripts/atlas-p0-evaluate.mjs";
import { analyzeTrace, parseTrace } from "../../../scripts/atlas-p0-trace.mjs";

const oneCase = {
  scope: "evaluator-test-only",
  independentRuns: 1,
  requiredChecks: [],
  scenarios: [{ id: "warm", kind: "edit", minSamples: 100 }],
};

describe("executed package provenance", () => {
  const workspace = {
    commit: "workspace",
    sourceSha256: "a".repeat(64),
    lockSha256: "b".repeat(64),
  };
  const provenance = {
    status: "ok",
    kind: "executed-main-sibling",
    path: "/package/resources/app.asar/desktop-dist/build.json",
    sha256: "c".repeat(64),
  };
  it("requires the actual embedded source and lock identity", () => {
    expect(
      checkBuildIdentity(
        workspace,
        { ...workspace, commit: "actual-package-commit" },
        provenance,
      ).passed,
    ).toBe(true);
    expect(
      checkBuildIdentity(
        workspace,
        { ...workspace, sourceSha256: "d".repeat(64) },
        provenance,
      ).failures,
    ).toContainEqual(
      expect.objectContaining({
        code: "BUILD_IDENTITY_MISMATCH",
        field: "sourceSha256",
      }),
    );
    expect(
      checkBuildIdentity(
        workspace,
        { ...workspace, lockSha256: "e".repeat(64) },
        provenance,
      ).failures,
    ).toContainEqual(
      expect.objectContaining({
        code: "BUILD_IDENTITY_MISMATCH",
        field: "lockSha256",
      }),
    );
  });
  it("fails missing provenance or manifest instead of substituting workspace values", () => {
    expect(
      checkBuildIdentity(workspace, null, { status: "error" }).passed,
    ).toBe(false);
    expect(checkBuildIdentity(workspace, workspace, null).passed).toBe(false);
    expect(
      checkBuildIdentity(workspace, { commit: "unknown" }, provenance).passed,
    ).toBe(false);
  });
});

function sample(index: number, delay = 16) {
  const createdAt = index * 100;
  return {
    inputId: index + 1,
    sessionId: "session-a",
    revision: index + 2,
    submittedRevision: index + 2,
    frameId: index + 3,
    createdAt,
    handlerAt: createdAt + 1,
    modelAt: createdAt + 2,
    submissionAt: createdAt + 4,
    presentation: {
      at: createdAt + delay,
      evidence: "chromium-presented-frame",
      state: "presented-all",
      inputId: index + 1,
      sessionId: "session-a",
      revision: index + 2,
      frameId: index + 3,
      surfaceFrameTraceId: `surface-${index}`,
      displayTraceId: `display-${index}`,
    },
  };
}

function knownGood() {
  return {
    mode: "native",
    reference: {
      qualified: true,
      softwareRendering: false,
      displayHz: 60,
      viewport: { width: 1440, height: 960, dpr: 1 },
      hardware: {
        cpu: "test-cpu",
        gpu: "test-gpu",
        os: "test-os",
        ramBytes: 16 * 1024 ** 3,
      },
    },
    build: { commit: "known-test-commit", sha256: "known-test-build" },
    fixture: { sha256: "known-test-fixture" },
    presentationMapping: {
      status: "supported",
      method: "chromium-surface-frame-id-v1",
      traceSha256: "known-test-trace",
      clock: { calibrated: true },
    },
    runs: [
      {
        id: "release-1",
        instanceId: "process-1",
        scenarios: [
          {
            id: "warm",
            samples: Array.from({ length: 100 }, (_, i) => sample(i)),
            droppedEvents: 0,
          },
        ],
      },
    ],
  };
}

describe("P0 acceptance cannot turn missing evidence into a pass", () => {
  it("accepts a complete independently specified fast profile", () => {
    const result = evaluateAcceptance(knownGood(), oneCase);
    expect(result.status).toBe("PASS");
    expect(result.groups[0].inputToPresentationMs).toMatchObject({
      count: 100,
      p95: 16,
      maximum: 16,
    });
  });

  it("fails a slow p95 even though most events are fast", () => {
    const report = knownGood();
    for (let i = 94; i < 100; i++)
      report.runs[0].scenarios[0].samples[i] = sample(i, 80);
    const result = evaluateAcceptance(report, oneCase);
    expect(result.status).toBe("FAIL");
    expect(result.failures).toContainEqual(
      expect.objectContaining({ code: "WARM_P95_EXCEEDED", actual: 80 }),
    );
  });

  it("keeps a missing presentation in the denominator and blocks", () => {
    const report = knownGood();
    Object.assign(report.runs[0].scenarios[0].samples[50], {
      presentation: null,
    });
    const result = evaluateAcceptance(report, oneCase);
    expect(result.passed).toBe(false);
    expect(result.groups[0]).toMatchObject({ sampleCount: 100, missing: 1 });
    expect(result.blockers).toContainEqual(
      expect.objectContaining({ code: "MISSING_PRESENTATION", inputId: 51 }),
    );
  });

  it.each(["frameId", "revision", "inputId", "sessionId"])(
    "rejects a stale or unrelated %s",
    (key) => {
      const report = knownGood();
      Object.assign(report.runs[0].scenarios[0].samples[0].presentation, {
        [key]: "unrelated",
      });
      const result = evaluateAcceptance(report, oneCase);
      expect(result.status).toBe("FAIL");
      expect(result.failures).toContainEqual(
        expect.objectContaining({ code: "UNMATCHED_OR_STALE_PRESENTATION" }),
      );
    },
  );

  it("cannot substitute a RAF or submission timestamp for compositor evidence", () => {
    const report = knownGood();
    report.runs[0].scenarios[0].samples[0].presentation.evidence =
      "requestAnimationFrame";
    expect(evaluateAcceptance(report, oneCase).passed).toBe(false);
    const sampleOnly = { ...sample(0), presentation: null };
    expect(evaluateSubmissionDiagnostics([sampleOnly])).toMatchObject({
      status: "PROXY_ONLY",
      presentationProven: false,
    });
  });

  it("does not approve a software headless reference with perfect synthetic timings", () => {
    const report = knownGood();
    report.mode = "lab";
    report.reference.softwareRendering = true;
    report.reference.displayHz = 0;
    const result = evaluateAcceptance(report, oneCase);
    expect(result.status).toBe("BLOCKED");
    expect(result.blockers).toContainEqual({
      code: "NATIVE_REFERENCE_UNQUALIFIED",
    });
  });

  it("does not pool a bad release into two fast releases", () => {
    const report = knownGood();
    const second = structuredClone(report.runs[0]);
    second.id = "release-2";
    second.instanceId = "process-2";
    const third = structuredClone(report.runs[0]);
    third.id = "release-3";
    third.instanceId = "process-3";
    third.scenarios[0].samples = Array.from({ length: 100 }, (_, i) =>
      sample(i, 75),
    );
    report.runs.push(second, third);
    const result = evaluateAcceptance(report, {
      ...oneCase,
      independentRuns: 3,
    });
    expect(result.failures).toContainEqual(
      expect.objectContaining({ code: "WARM_P95_EXCEEDED", run: "release-3" }),
    );
  });

  it("requires scenarios, independent processes, and the fixed P0 sample scope", () => {
    const report = knownGood();
    expect(evaluateAcceptance(report).passed).toBe(false);
    const duplicate = structuredClone(report.runs[0]);
    report.runs.push(duplicate);
    expect(evaluateAcceptance(report, oneCase).failures).toContainEqual({
      code: "RUNS_NOT_INDEPENDENT",
    });
    report.runs = [];
    expect(evaluateAcceptance(report, oneCase).passed).toBe(false);
  });

  it("includes event-queue delay instead of measuring from handler entry", () => {
    const report = knownGood();
    for (const event of report.runs[0].scenarios[0].samples) {
      event.handlerAt += 80;
      event.modelAt += 80;
      event.submissionAt += 80;
      event.presentation.at += 80;
    }
    expect(
      evaluateAcceptance(report, oneCase).groups[0].inputToPresentationMs.p95,
    ).toBe(96);
    expect(evaluateAcceptance(report, oneCase).passed).toBe(false);
  });

  it("measures cold total latency per sample and enforces its maximum", () => {
    const report = knownGood();
    const samples = report.runs[0].scenarios[0].samples;
    samples.forEach((entry) =>
      Object.assign(entry, {
        navigationId: entry.inputId + 1000,
        coldBeforeNavigation: true,
        navigationAt: entry.createdAt - 300,
        readyAt: entry.createdAt - 1,
      }),
    );
    Object.assign(samples[0], { navigationAt: samples[0].createdAt - 2100 });
    const requirements = {
      ...oneCase,
      scenarios: [
        { id: "warm", kind: "cold", minSamples: 100, minTotalSamples: 100 },
      ],
    };
    const result = evaluateAcceptance(report, requirements);
    expect(result.failures).toContainEqual(
      expect.objectContaining({ code: "COLD_MAXIMUM_EXCEEDED", inputId: 1 }),
    );
    expect(result.groups[0].navigationToPresentationMs?.maximum).toBe(2116);
  });

  it("fails timeouts even when the timed-out presentation is absent", () => {
    const report = knownGood();
    Object.assign(report.runs[0].scenarios[0].samples[0], {
      presentation: null,
      timeout: true,
    });
    const result = evaluateAcceptance(report, oneCase);
    expect(result.status).toBe("FAIL");
    expect(result.failures).toContainEqual(
      expect.objectContaining({ code: "SAMPLE_TIMEOUT", inputId: 1 }),
    );
  });

  it("rejects a nonfinite required CPU or frame observation", () => {
    for (const field of ["cpuWorkMs", "presentationFrameIntervalsMs"]) {
      const report = knownGood();
      Object.assign(report.runs[0].scenarios[0], {
        durationMs: 30_000,
        authorChanges: 0,
        cameraBlockedOnStore: false,
        cpuWorkMs: [1, 2],
        presentationFrameIntervalsMs: [16, 17],
        [field]: [1, Number.NaN, 2],
      });
      const result = evaluateAcceptance(report, {
        ...oneCase,
        scenarios: [
          {
            id: "warm",
            kind: "navigation",
            minSamples: 100,
            minDurationMs: 30_000,
          },
        ],
      });
      expect(result.status).toBe("FAIL");
      expect(result.failures).toContainEqual(
        expect.objectContaining({ code: "INVALID_NAVIGATION_SAMPLES" }),
      );
    }
  });

  it("does not hide slow pointerup acceptance in many fast live-edit samples", () => {
    const report = knownGood();
    report.runs[0].scenarios[0].samples = Array.from({ length: 1100 }, (_, i) =>
      Object.assign(sample(i, i >= 1094 ? 80 : 16), {
        inputKind: i < 1000 ? "edit" : "pointerup",
      }),
    );
    const requirements = {
      ...oneCase,
      scenarios: [
        {
          id: "warm",
          kind: "edit",
          minSamples: 100,
          requiredInputKinds: ["edit", "pointerup"],
        },
      ],
    };
    const result = evaluateAcceptance(report, requirements);
    expect(result.groups[0].inputToPresentationMs.p95).toBe(16);
    expect(result.failures).toContainEqual(
      expect.objectContaining({
        code: "INPUT_KIND_P95_EXCEEDED",
        inputKind: "pointerup",
        actual: 80,
      }),
    );
  });
});

describe("independent negative-control evaluation", () => {
  it("detects a 250-ms render delay from its lower bound without inventing presentation", () => {
    const entry = { ...sample(0), submissionAt: 254, presentation: null };
    const result = evaluateSubmissionDiagnostics([entry]);
    expect(result.status).toBe("FAIL");
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "SUBMISSION_LOWER_BOUND_EXCEEDS_LIMIT",
        milliseconds: 254,
      }),
    );
    expect(result.presentationProven).toBe(false);
  });

  it("fails a dropped render and an empty capture", () => {
    expect(
      evaluateSubmissionDiagnostics([{ ...sample(0), submissionAt: null }])
        .issues,
    ).toContainEqual({ code: "MISSING_SUBMISSION", inputId: 1 });
    expect(evaluateSubmissionDiagnostics([]).status).toBe("FAIL");
  });

  it("extracts only the exact session/revision/frame and retains missing input IDs", () => {
    const events = [
      { kind: "input", id: 7, inputKind: "edit", createdAt: 10, at: 12 },
      { kind: "model", input: 7, revision: 5, at: 15 },
      {
        kind: "edit-submit",
        input: 7,
        frame: 8,
        sessionId: "old-session",
        revision: 5,
        at: 17,
      },
      { kind: "submit", frame: 8, sessionId: "old-session", at: 17 },
      {
        kind: "edit-submit",
        input: 7,
        frame: 9,
        sessionId: "session-a",
        revision: 4,
        at: 18,
      },
      { kind: "submit", frame: 9, sessionId: "session-a", at: 18 },
    ];
    const result = extractEditSamples(events, [7, 8], "session-a");
    expect(result).toHaveLength(2);
    expect(result[0].submissionAt).toBeNull();
    expect(result[1].createdAt).toBeNull();
    expect(evaluateSubmissionDiagnostics(result).status).toBe("FAIL");
  });
});

describe("M10 has its own navigation-based diagnostic contract", () => {
  it("does not fail a 282.2-ms cold edit merely for exceeding the warm 50-ms budget", () => {
    const entry = {
      ...sample(5),
      submissionAt: 782.2,
      presentation: null,
      navigationId: 100,
      navigationAt: 400,
      readyAt: 426.9,
      coldBeforeNavigation: true,
    };
    const result = evaluateColdSubmissionDiagnostics([entry]);
    expect(result.status).toBe("PROXY_ONLY");
    expect(result.presentationProven).toBe(false);
    expect(result.inputToSubmissionMs.maximum).toBeCloseTo(282.2);
    expect(result.navigationToSubmissionMs.maximum).toBeCloseTo(382.2);
    expect(result.issues).toEqual([]);
    expect(evaluateSubmissionDiagnostics([entry]).status).toBe("FAIL");
  });

  it("still rejects late navigation readiness, late submission, and missing evidence", () => {
    const entry = {
      ...sample(7),
      navigationId: 100,
      navigationAt: 0,
      readyAt: 600,
      coldBeforeNavigation: true,
    };
    expect(evaluateColdSubmissionDiagnostics([entry]).issues).toContainEqual(
      expect.objectContaining({
        code: "COLD_READINESS_TARGET_EXCEEDED",
        limitMs: 500,
      }),
    );
    expect(
      evaluateColdSubmissionDiagnostics([
        { ...entry, readyAt: 20, submissionAt: 800 },
      ]).issues,
    ).toContainEqual(
      expect.objectContaining({
        code: "COLD_SUBMISSION_LOWER_BOUND_EXCEEDS_LIMIT",
        limitMs: 750,
      }),
    );
    expect(
      evaluateColdSubmissionDiagnostics([
        { ...entry, readyAt: 20, submissionAt: null },
      ]).status,
    ).toBe("FAIL");
  });

  it("uses the cold contract in native evaluation too, with presentation still mandatory", () => {
    const report = knownGood();
    report.runs[0].scenarios[0].samples = Array.from(
      { length: 100 },
      (_, i) => {
        const entry = sample(i + 2, 280);
        return Object.assign(entry, {
          navigationId: i + 1000,
          navigationAt: entry.createdAt - 100,
          readyAt: entry.createdAt - 20,
          coldBeforeNavigation: true,
        });
      },
    );
    const requirements = {
      ...oneCase,
      scenarios: [
        { id: "warm", kind: "cold", minSamples: 100, minTotalSamples: 100 },
      ],
    };
    expect(evaluateAcceptance(report, requirements).status).toBe("PASS");
    Object.assign(report.runs[0].scenarios[0].samples[0], {
      presentation: null,
    });
    expect(evaluateAcceptance(report, requirements).passed).toBe(false);
  });
});

describe("real Chromium trace identities", () => {
  it("keeps adjacent uint64 surface IDs distinct instead of rounding them", () => {
    const parsed = parseTrace(
      '{"a":5174629918544706584,"b":5174629918544706587,"timestamp":11102875808}',
    );
    expect(parsed.a).toBe("5174629918544706584");
    expect(parsed.b).toBe("5174629918544706587");
    expect(parsed.timestamp).toBe(11102875808);
  });
  it("never upgrades temporal main-frame containment to proven presentation", () => {
    const trace = JSON.stringify({
      traceEvents: [
        {
          name: "ProxyMain::BeginMainFrame",
          ts: 1000,
          dur: 100,
          pid: 1,
          tid: 1,
          args: {
            main_frame_pipeline: {
              step: "BEGIN_MAIN_FRAME",
              main_frame_id: 10,
            },
          },
        },
        {
          name: "atlas.submit.session.1.1.1",
          ts: 1050,
          pid: 1,
          tid: 1,
          args: { data: { startTime: 50 } },
        },
      ],
    });
    const result = analyzeTrace(trace);
    expect(result.exactSubmissionCandidates[0].enclosingMainFrameIds).toEqual([
      10,
    ]);
    expect(result.mappingStatus).toBe("unsupported");
    expect(result.clockObservation.calibrated).toBe(false);
  });
});
