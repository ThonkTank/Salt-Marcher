import { describe, expect, it } from "vitest";

// The executable evaluator is intentionally shared with the command-line runner.
import {
  evaluateAcceptance,
  evaluateSubmissionDiagnostics,
  evaluateColdSubmissionDiagnostics,
  extractEditSamples,
  checkBuildIdentity,
  evaluateFunctional,
  P0_FUNCTIONAL_CHECKS,
  P0_REQUIREMENTS,
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
        independentRunId: "release-1",
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

function knownFunctional() {
  return {
    errors: [] as unknown[],
    runs: [
      {
        id: "workflow",
        independentRunId: "release-1",
        instanceId: "workflow-1",
        role: "scenario",
        scenarios: [],
      },
    ],
    functional: {
      // The evaluator must recompute this summary, never trust it.
      passed: true,
      checks: P0_FUNCTIONAL_CHECKS.map((id) => ({
        id,
        independentRunId: "release-1",
        passed: true,
        ...(id === "continuous-stroke-live"
          ? {
              liveBeforeRelease: true,
              firstLiveAt: 100,
              releasedAt: 500,
              checkedIntermediateStates: 3,
            }
          : {}),
      })),
    },
    scaling: {
      passed: true,
      cases: [32, 1024, 9000].map((sourceTiles) => ({
        id: `scale-${sourceTiles}`,
        sourceTiles,
        decodedBytes: sourceTiles * 32_768,
        passed: true,
        coarseReadiness: {
          documentSourceBytes: 32_768,
          rendererSourceBytes: 32_768,
          workerSourceBytes: 32_768,
        },
        coarseEdit: {
          documentSourceBytes: 65_536,
          rendererSourceBytes: 65_536,
          workerSourceBytes: 65_536,
        },
        stageReadDeltas: {
          coarseReadiness: {
            reads: 1,
            returnedTiles: 1,
            returnedBytes: 32_768,
          },
          coarseEdit: { reads: 0, returnedTiles: 0, returnedBytes: 0 },
        },
      })),
    },
    negativeControls: P0_REQUIREMENTS.requiredFaultControls.map((spec) => ({
      ...spec,
      passed: true,
      observedFault: spec.fault,
      primaryPassed: false,
      recovery: { primaryCheck: spec.primaryCheck, passed: true },
    })),
  };
}

describe("representative functional evidence controls the aggregate", () => {
  it("accepts complete behavior, real source-size coverage, and fault recovery", () => {
    expect(evaluateFunctional(knownFunctional())).toEqual({
      status: "PASS",
      passed: true,
      failures: [],
    });
  });

  it.each([
    "visible-zoom",
    "pan-anchor",
    "continuous-stroke-live",
    "continuous-stroke-undo",
    "cold-edit-content",
    "world-detail-roundtrip",
  ])("rejects a missing, duplicate, or failed %s check", (id) => {
    for (const corruption of ["missing", "duplicate", "failed"]) {
      const report = knownFunctional();
      const index = report.functional.checks.findIndex((c) => c.id === id);
      if (corruption === "missing") report.functional.checks.splice(index, 1);
      else if (corruption === "duplicate")
        report.functional.checks.push({ ...report.functional.checks[index] });
      else report.functional.checks[index].passed = false;
      expect(report.functional.passed).toBe(true);
      expect(evaluateFunctional(report).passed).toBe(false);
    }
  });

  it("requires intermediate terrain evidence before pointer release", () => {
    for (const corrupted of [
      { liveBeforeRelease: false },
      { firstLiveAt: undefined },
      { releasedAt: undefined },
      { firstLiveAt: 500 },
      { firstLiveAt: 510 },
      { checkedIntermediateStates: 1 },
      { checkedIntermediateStates: 2.5 },
    ]) {
      const report = knownFunctional();
      Object.assign(
        report.functional.checks.find(
          (c) => c.id === "continuous-stroke-live",
        )!,
        corrupted,
      );
      expect(evaluateFunctional(report).failures).toContainEqual({
        code: "CONTINUOUS_STROKE_LIVE_EVIDENCE_MISSING",
        run: "release-1",
        check: "continuous-stroke-live",
      });
    }
  });

  it("does not hide a failed extra check or runner failure behind required passes", () => {
    const report = knownFunctional();
    report.functional.checks.push({
      id: "additional-content-invariant",
      independentRunId: "release-1",
      passed: false,
    });
    expect(evaluateFunctional(report).failures).toContainEqual({
      code: "FUNCTIONAL_CHECK_FAILED",
      run: "release-1",
      check: "additional-content-invariant",
    });
    report.functional.checks.pop();
    report.errors.push({ code: "SOURCE_READ_FAILED" });
    expect(evaluateFunctional(report).passed).toBe(false);
  });

  it("requires the checks in every release rather than accepting one good release", () => {
    const report = knownFunctional();
    report.runs.push({
      ...report.runs[0],
      id: "workflow-2",
      independentRunId: "release-2",
      instanceId: "workflow-2",
    });
    expect(evaluateFunctional(report).failures).toContainEqual({
      code: "FUNCTIONAL_CHECK_MISSING_OR_FAILED",
      run: "release-2",
      check: "visible-zoom",
    });
    report.functional.checks.push(
      ...report.functional.checks.map((c) => ({
        ...c,
        independentRunId: "release-2",
      })),
    );
    expect(evaluateFunctional(report).passed).toBe(true);
  });

  it("cannot approve omitted, undersized, or failed source-scaling cases", () => {
    for (const corruption of ["missing", "too-small", "failed", "error"]) {
      const report = knownFunctional();
      if (corruption === "missing") report.scaling.cases.pop();
      if (corruption === "too-small")
        Object.assign(report.scaling.cases[2], {
          sourceTiles: 8192,
          decodedBytes: 256 * 1024 ** 2,
        });
      if (corruption === "failed") report.scaling.cases[1].passed = false;
      if (corruption === "error")
        Object.assign(report.scaling.cases[1], {
          error: "read exceeds 512 source tiles",
        });
      // An expected limit/failure is useful evidence, never successful scaling.
      expect(report.scaling.passed).toBe(true);
      expect(evaluateFunctional(report).passed).toBe(false);
    }
  });

  it("rejects invented source-byte coverage and duplicated scale cases", () => {
    const report = knownFunctional();
    report.scaling.cases[2].decodedBytes = 9000;
    expect(evaluateFunctional(report).failures).toContainEqual({
      code: "SCALING_CASE_SIZE_INVALID",
      case: "scale-9000",
    });
    const duplicate = knownFunctional();
    duplicate.scaling.cases.push({ ...duplicate.scaling.cases[2] });
    expect(evaluateFunctional(duplicate).passed).toBe(false);
  });

  it("requires bounded actual working sets before and during coarse editing", () => {
    for (const stage of ["coarseReadiness", "coarseEdit"] as const) {
      for (const field of [
        "documentSourceBytes",
        "rendererSourceBytes",
        "workerSourceBytes",
      ] as const) {
        for (const invalid of [
          undefined,
          -1,
          Number.NaN,
          256 * 1024 ** 2 + 1,
        ]) {
          const report = knownFunctional();
          Object.assign(report.scaling.cases[2][stage], { [field]: invalid });
          expect(evaluateFunctional(report).passed).toBe(false);
        }
      }
    }
  });

  it("rejects missing read evidence and a whole-large-fixture read despite small final caches", () => {
    for (const stage of ["coarseReadiness", "coarseEdit"] as const) {
      const missing = knownFunctional();
      Object.assign(missing.scaling.cases[2].stageReadDeltas, {
        [stage]: undefined,
      });
      expect(evaluateFunctional(missing).failures).toContainEqual({
        code: "SCALING_SOURCE_READS_MISSING_OR_INVALID",
        case: "scale-9000",
        stage,
      });
      const allSources = knownFunctional();
      allSources.scaling.cases[2].stageReadDeltas[stage] = {
        reads: 1,
        returnedTiles: 9000,
        returnedBytes: 9000 * 32_768,
      };
      expect(evaluateFunctional(allSources).failures).toContainEqual({
        code: "SCALING_SOURCE_READ_BUDGET_EXCEEDED",
        case: "scale-9000",
        stage,
        returnedTiles: 9000,
        returnedBytes: 9000 * 32_768,
        maximumBytes: 256 * 1024 ** 2,
      });
    }
  });

  it.each(["ignore-zoom", "pointerup-render"])(
    "requires %s to fail its real primary check and recover normally",
    (fault) => {
      for (const corruption of [
        "not-injected",
        "primary-passed",
        "wrong-primary",
        "wrong-failure",
        "unexpected-exception",
        "recovery-failed",
        "control-failed",
        "missing",
        "duplicate",
      ]) {
        const report = knownFunctional();
        const index = report.negativeControls.findIndex(
          (c) => c.fault === fault,
        );
        const control = report.negativeControls[index];
        if (corruption === "not-injected") control.observedFault = "none";
        if (corruption === "primary-passed") control.primaryPassed = true;
        if (corruption === "wrong-primary") control.primaryCheck = "unrelated";
        if (corruption === "wrong-failure")
          control.primaryFailureCode = "UNRELATED_TIMEOUT";
        if (corruption === "unexpected-exception")
          Object.assign(control, { mutant: { error: "renderer crashed" } });
        if (corruption === "recovery-failed") control.recovery.passed = false;
        if (corruption === "control-failed") control.passed = false;
        if (corruption === "missing") report.negativeControls.splice(index, 1);
        if (corruption === "duplicate")
          report.negativeControls.push({ ...control });
        expect(evaluateFunctional(report).passed).toBe(false);
      }
    },
  );

  it("propagates functional failure into the same native acceptance result", () => {
    const timing = knownGood();
    const report = { ...knownFunctional(), ...timing };
    const requirements = {
      ...oneCase,
      requiredChecks: P0_FUNCTIONAL_CHECKS,
      scaling: P0_REQUIREMENTS.scaling,
      requiredFaultControls: P0_REQUIREMENTS.requiredFaultControls,
    };
    expect(evaluateAcceptance(report, requirements).passed).toBe(true);
    report.scaling.cases[1].passed = false;
    const failure = evaluateAcceptance(report, requirements);
    expect(failure.status).toBe("FAIL");
    expect(failure.failures).toContainEqual({
      code: "SCALING_CASE_FAILED",
      case: "scale-1024",
    });
  });
});

describe("release grouping preserves independent coverage", () => {
  it("allows scenario subprocesses without pretending they are separate releases", () => {
    const report = knownGood();
    const next = structuredClone(report.runs[0]);
    next.id = "second-scenario-process";
    next.instanceId = "process-2";
    next.scenarios[0].id = "second";
    report.runs.push(next);
    const requirements = {
      ...oneCase,
      scenarios: [
        ...oneCase.scenarios,
        { ...oneCase.scenarios[0], id: "second" },
      ],
    };
    expect(evaluateAcceptance(report, requirements).passed).toBe(true);
    expect(
      evaluateAcceptance(report, { ...requirements, independentRuns: 3 })
        .failures,
    ).toContainEqual({
      code: "INSUFFICIENT_INDEPENDENT_RUNS",
      actual: 1,
      required: 3,
    });
  });

  it("does not use fault-control launches as release repetitions", () => {
    const report = knownGood();
    for (let index = 2; index <= 3; index++) {
      const control = structuredClone(report.runs[0]);
      Object.assign(control, {
        id: `control-${index}`,
        independentRunId: `release-${index}`,
        instanceId: `process-${index}`,
        role: "control",
      });
      report.runs.push(control);
    }
    expect(
      evaluateAcceptance(report, { ...oneCase, independentRuns: 3 }).failures,
    ).toContainEqual({
      code: "INSUFFICIENT_INDEPENDENT_RUNS",
      actual: 1,
      required: 3,
    });
  });

  it("rejects absent release identity instead of counting process IDs", () => {
    const report = knownGood();
    Object.assign(report.runs[0], { independentRunId: undefined });
    expect(evaluateAcceptance(report, oneCase).failures).toContainEqual({
      code: "INDEPENDENT_RUN_ID_MISSING",
      run: "release-1",
    });
  });

  it("fails omitted and duplicate scenarios even across separate subprocesses", () => {
    const report = knownGood();
    const duplicate = structuredClone(report.runs[0]);
    duplicate.id = "second-process";
    duplicate.instanceId = "process-2";
    report.runs.push(duplicate);
    expect(evaluateAcceptance(report, oneCase).failures).toContainEqual({
      code: "MISSING_OR_DUPLICATE_SCENARIO",
      run: "release-1",
      scenario: "warm",
    });
    report.runs = [report.runs[0]];
    report.runs[0].scenarios = [];
    expect(evaluateAcceptance(report, oneCase).failures).toContainEqual({
      code: "MISSING_OR_DUPLICATE_SCENARIO",
      run: "release-1",
      scenario: "warm",
    });
  });

  it("retains a failed collection even when enough fast samples were captured", () => {
    const report = knownGood();
    Object.assign(report.runs[0].scenarios[0], { collectionPassed: false });
    expect(evaluateAcceptance(report, oneCase).failures).toContainEqual({
      code: "SCENARIO_COLLECTION_FAILED",
      run: "release-1",
      scenario: "warm",
    });
  });
});

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
    second.independentRunId = "release-2";
    second.instanceId = "process-2";
    const third = structuredClone(report.runs[0]);
    third.id = "release-3";
    third.independentRunId = "release-3";
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

  it("does not substitute many live edits for missing pointerup samples", () => {
    const report = knownGood();
    report.runs[0].scenarios[0].samples = Array.from({ length: 101 }, (_, i) =>
      Object.assign(sample(i), { inputKind: i < 100 ? "edit" : "pointerup" }),
    );
    const result = evaluateAcceptance(report, {
      ...oneCase,
      scenarios: [
        {
          ...oneCase.scenarios[0],
          requiredInputKinds: ["edit", "pointerup"],
        },
      ],
    });
    expect(result.failures).toContainEqual({
      code: "INSUFFICIENT_INPUT_KIND_SAMPLES",
      run: "release-1",
      scenario: "warm",
      inputKind: "pointerup",
      actual: 1,
      required: 100,
    });
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
