import { assert, describe, expect, it, vi } from "vitest";

// The executable evaluator is intentionally shared with the command-line runner.
import {
  evaluateAcceptance,
  evaluateSubmissionDiagnostics,
  evaluateColdSubmissionDiagnostics,
  extractEditSamples,
  extractColdBoundary,
  extractColdSamples,
  evaluateBlockedInput,
  checkBuildIdentity,
  evaluateFunctional,
  evaluateObservation,
  evaluateScenario,
  evaluateRun,
  strokeEvidence,
  extractNavigationSamples,
  evaluateNavigationDiagnostics,
  evaluateStrokeContent,
  selectP0Scope,
  evaluateBrushTime,
  evaluateBrushPublicationOrder,
  evaluateSaveOverlap,
  P0_FUNCTIONAL_CHECKS,
  P0_REQUIREMENTS,
} from "../../../scripts/atlas-p0-evaluate.mjs";
import { analyzeTrace, parseTrace } from "../../../scripts/atlas-p0-trace.mjs";
import { observeStroke } from "../../../scripts/atlas-p0-interactions.mjs";
import { startReadyStrokeMonitor } from "../../../scripts/atlas-p0-collection.mjs";

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

function coldSample(index: number, delay = 16) {
  const entry = {
    ...sample(index, delay),
    inputKind: "edit",
    eventType: "pointerdown",
  };
  const navigationId = index + 1000;
  const gateAt = entry.createdAt - 20;
  return {
    ...entry,
    coldFirst: true,
    navigationId,
    navigationAt: entry.createdAt - 100,
    coldBeforeNavigation: true,
    sourcesAt: entry.createdAt - 50,
    gateAt,
    gateSubmissionAt: gateAt - 1,
    gateFrameId: entry.frameId - 1,
    gateRevision: entry.revision - 1,
    gateViewGeneration: 2,
    gateSessionId: entry.sessionId,
    gateEvidence: "local-terrain-submit-v1",
    readyPresentation: {
      at: gateAt + 1,
      evidence: "chromium-presented-frame",
      state: "presented-all",
      inputId: navigationId,
      sessionId: entry.sessionId,
      revision: entry.revision - 1,
      frameId: entry.frameId - 1,
      viewGeneration: 2,
      surfaceFrameTraceId: `ready-surface-${index}`,
      displayTraceId: `ready-display-${index}`,
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

describe("explicit execution selection", () => {
  it("limits interactions to navigation, the coast workflow and controls", () => {
    const scope = selectP0Scope("interactions");
    expect(scope).toMatchObject({
      navigation: true,
      workflow: true,
      controls: true,
      collection: false,
      scaling: false,
      needsBaseFixture: true,
      needsBusyFixture: false,
    });
    expect(scope.scenarios.map((scenario) => scenario.id)).toEqual([
      "M01-grid-on",
      "M01-grid-off",
    ]);
    expect(scope.requiredChecks).toContain("empty-navigation-grid-on");
    expect(scope.requiredChecks).toContain("save-reopen");
    expect(scope.requiredChecks).not.toContain("busy-worker-and-save");
    expect(scope.requiredChecks).not.toContain("cold-edit-content");
  });
  it("preserves full selection and creates busy fixtures only for selected busy cases", () => {
    const all = selectP0Scope();
    expect(all).toMatchObject({
      navigation: true,
      workflow: true,
      controls: true,
      collection: true,
      scaling: true,
      needsBaseFixture: true,
      needsBusyFixture: true,
    });
    expect(all.scenarios).toEqual(P0_REQUIREMENTS.scenarios);
    expect(all.requiredChecks).toEqual(P0_FUNCTIONAL_CHECKS);
    const single = selectP0Scope("collection", "M03-height-small");
    expect(single.scenarios.map((scenario) => scenario.id)).toEqual([
      "M03-height-small",
    ]);
    expect(single).toMatchObject({
      navigation: false,
      workflow: false,
      controls: false,
      collection: true,
      scaling: false,
      needsBaseFixture: true,
      needsBusyFixture: false,
    });
    expect(
      selectP0Scope("collection", "M06-height-busy").needsBusyFixture,
    ).toBe(true);
    expect(selectP0Scope("scaling")).toMatchObject({
      collection: false,
      navigation: false,
      workflow: false,
      controls: false,
      scaling: true,
      needsBaseFixture: false,
      needsBusyFixture: false,
    });
  });
  it("never promotes an explicitly selected subset into complete native acceptance", () => {
    const report = { ...knownGood(), selection: "interactions" };
    const result = evaluateAcceptance(report, oneCase);
    expect(result.status).toBe("BLOCKED");
    expect(result.passed).toBe(false);
    expect(result.blockers).toContainEqual({
      code: "PARTIAL_EXECUTION_SCOPE",
      selection: "interactions",
    });
  });
});

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
    const samples = Array.from({ length: 100 }, (_, index) =>
      coldSample(index),
    );
    report.runs[0].scenarios[0].samples = samples;
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
  it("judges p95 per input kind and reports isolated overshoots separately", () => {
    const samples = ["edit", "pointerup"].flatMap((inputKind, kind) =>
      Array.from({ length: 100 }, (_, index) => {
        const entry = sample(index + kind * 100);
        return {
          ...entry,
          inputKind,
          submissionAt: entry.createdAt + (index < 5 ? 80 : 4),
        };
      }),
    );
    const result = evaluateSubmissionDiagnostics(samples);
    expect(result.status).toBe("PROXY_ONLY");
    expect(result.outliers).toHaveLength(10);
    expect(result.inputKinds.edit.p95).toBe(4);
    expect(result.inputKinds.pointerup.p95).toBe(4);
    samples[105].submissionAt = samples[105].createdAt + 80;
    expect(evaluateSubmissionDiagnostics(samples).issues).toContainEqual(
      expect.objectContaining({
        code: "SUBMISSION_LOWER_BOUND_EXCEEDS_LIMIT",
        inputKind: "pointerup",
        metric: "p95",
        milliseconds: 80,
      }),
    );
  });
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

describe("explicit processed no-op evidence", () => {
  function journal(includeNoop = true) {
    const events: Record<string, unknown>[] = [];
    for (let index = 0; index < 4; index++) {
      const input = index + 1,
        createdAt = index * 24;
      events.push({
        kind: "input",
        id: input,
        inputKind: index === 3 ? "pointerup" : "edit",
        createdAt,
        at: createdAt + 1,
      });
      if (index === 1) {
        if (includeNoop)
          events.push({ kind: "noop", input, at: createdAt + 2 });
      } else {
        events.push({
          kind: index === 3 ? "commit" : "model",
          input,
          revision: input,
          at: createdAt + 2,
        });
        events.push({
          kind: "submit",
          sessionId: "session-a",
          frame: input,
          revision: input,
          at: createdAt + 4,
        });
        events.push({
          kind: "edit-submit",
          input,
          sessionId: "session-a",
          revision: input,
          frame: input,
          at: createdAt + 4,
        });
      }
    }
    return {
      events,
      eventCount: events.length,
      sessionId: "session-a",
      droppedEvents: 0,
      state: { error: null },
    };
  }
  it("distinguishes processed no-change from missing evidence without inventing model or submit", () => {
    const observation = journal();
    const samples = extractEditSamples(
      observation.events,
      [1, 2, 3, 4],
      observation.sessionId,
    );
    expect(samples[1]).toMatchObject({
      modelChanged: false,
      noopAt: 26,
      modelAt: null,
      submissionAt: null,
      frameId: null,
    });
    const result = evaluateSubmissionDiagnostics(samples);
    expect(result.status).toBe("FAIL");
    expect(result.processedNoops).toBe(1);
    expect(result.missing).toBe(0);
    expect(result.issues).toContainEqual({
      code: "EXPECTED_EDIT_NO_CHANGE",
      inputId: 2,
      modelChanged: false,
    });
    expect(
      result.issues.some((issue) => issue.code === "MISSING_INPUT_OR_MODEL"),
    ).toBe(false);
    expect(
      evaluateSubmissionDiagnostics([{ ...samples[1], noopAt: 0 }]).issues[0]
        .code,
    ).toBe("INVALID_NOOP_RECEIPT");
    const stroke = strokeEvidence({ samples });
    expect(stroke.complete).toBe(true);
    expect(stroke.passed).toBe(false);
    expect(stroke.processedNoops).toBe(1);
    expect(stroke.continuity.maximumInputBacklogMs).toBe(4);
  });
  it.each([true, false])(
    "settles only an explicit no-op; missing evidence still times out (noop=%s)",
    async (includeNoop) => {
      const observation = journal(includeNoop);
      vi.stubGlobal("window", { atlasObserve: () => observation });
      const page = {
        evaluate: (fn: (argument: unknown) => unknown, argument: unknown) =>
          fn(argument),
        waitForFunction: async (
          fn: (argument: unknown) => unknown,
          argument: unknown,
        ) => {
          if (!fn(argument))
            throw Object.assign(new Error("predicate never completed"), {
              name: "TimeoutError",
            });
        },
      };
      try {
        const observed = await observeStroke(
          { page },
          { eventCount: 0, lastInputId: 0 },
          20,
        );
        expect(observed.timedOut).toBe(!includeNoop);
        expect(observed.samples[1].modelChanged).toBe(
          includeNoop ? false : null,
        );
        expect(observed.samples[1].submissionAt).toBeNull();
      } finally {
        vi.unstubAllGlobals();
      }
    },
  );
  it("preserves a real 169-ms feedback pause while completed no-ops leave the queue", () => {
    const samples = Array.from({ length: 10 }, (_, index) => {
      const createdAt = index * 24,
        noop = index >= 2 && index <= 7;
      return {
        ...sample(index),
        inputKind: index === 9 ? "pointerup" : "edit",
        createdAt,
        handlerAt: createdAt + 1,
        modelAt: noop ? null : createdAt + 2,
        modelChanged: !noop,
        noopAt: noop ? createdAt + 2 : null,
        submissionAt: noop ? null : createdAt + (index === 8 ? 5 : 4),
        presentation: null,
      };
    });
    const evidence = strokeEvidence({ samples });
    expect(evidence.complete).toBe(true);
    expect(evidence.processedNoops).toBe(6);
    expect(evidence.timeline).toHaveLength(10);
    expect(evidence.continuity.maximumInputBacklogMs).toBe(5);
    expect(evidence.continuity.maximumNoChangeFeedbackGapMs).toBe(169);
    expect(evidence.continuity.maximumMovingStallMs).toBe(169);
    expect(evidence.passed).toBe(false);
    expect(
      evaluateScenario({ kind: "edit", samples, droppedEvents: 0 }).failures,
    ).toContainEqual({
      code: "CONTINUOUS_SUBMISSION_STALL",
      attempt: 0,
      milliseconds: 169,
      limitMs: 100,
    });
  });
});

describe("bounded accepted brush time", () => {
  function events(): Record<string, unknown>[] {
    const base = { sessionId: "session-a", gestureId: 1 };
    const dose = {
      ...base,
      from: [0, 0],
      to: [0, 0],
      rateFtPerSecond: 100,
      changed: true,
    };
    return [
      { kind: "input", id: 1, inputKind: "edit", createdAt: 0, at: 1 },
      {
        ...base,
        kind: "brush-start",
        input: 1,
        startAt: 1,
        inputAt: 0,
        point: [0, 0],
        rateFtPerSecond: 100,
        at: 1,
      },
      {
        ...dose,
        kind: "brush-interval",
        intervalId: 1,
        revision: 1,
        cause: "press",
        nominalDose: true,
        fromAt: 2,
        toAt: 2,
        acceptedElapsedMs: 1000 / 60,
        rawElapsedMs: 0,
        inputIds: [1],
        at: 2.1,
      },
      {
        ...base,
        kind: "brush-discard",
        fromAt: 1,
        toAt: 10,
        reason: "feedback",
        at: 10,
      },
      { ...base, kind: "submit", frame: 1, revision: 1, at: 10.1 },
      {
        ...base,
        kind: "brush-submit",
        intervalId: 1,
        revision: 1,
        frame: 1,
        at: 10.2,
      },
      {
        ...dose,
        kind: "brush-interval",
        intervalId: 2,
        revision: 2,
        cause: "hold",
        nominalDose: false,
        fromAt: 10,
        toAt: 30,
        acceptedElapsedMs: 20,
        rawElapsedMs: 20,
        inputIds: [],
        at: 30.1,
      },
      { ...base, kind: "submit", frame: 2, revision: 2, at: 40.1 },
      {
        ...base,
        kind: "brush-submit",
        intervalId: 2,
        revision: 2,
        frame: 2,
        at: 40.2,
      },
      { kind: "input", id: 2, inputKind: "pointerup", createdAt: 49, at: 50 },
      {
        ...base,
        kind: "brush-discard",
        fromAt: 30,
        toAt: 50,
        reason: "pointerup",
        at: 50.1,
      },
      {
        ...base,
        kind: "brush-end",
        input: 2,
        endAt: 50,
        inputAt: 49,
        reason: "pointerup",
        at: 50.2,
      },
    ];
  }
  it("separates nominal press from accepted hold, rejected time and native input queue delay", () => {
    const result = evaluateBrushTime(events(), [1, 2], "session-a");
    expect(result.passed).toBe(true);
    expect(result.acceptedMs).toBeCloseTo(1000 / 60 + 20);
    expect(result.timedDoseMs).toBe(20);
    expect(result.pressDoseMs).toBeCloseTo(1000 / 60);
    expect(result.discardMs).toEqual({ feedback: 9, pointerup: 20 });
    expect(result.maximumStepMs).toBe(20);
    expect(result.stationary).toBe(true);
  });
  it.each(["gap", "overlap", "cap", "future-press"])(
    "rejects invalid %s accounting without inventing dose",
    (fault) => {
      const journal = events();
      if (fault === "gap") journal[10].fromAt = 40;
      if (fault === "overlap") journal[10].fromAt = 20;
      if (fault === "cap") journal[6].acceptedElapsedMs = 51;
      if (fault === "future-press") journal[2].toAt = 2 + 1000 / 60;
      const expected =
        fault === "gap"
          ? "UNEXPLAINED_BRUSH_TIME"
          : fault === "overlap"
            ? "OVERLAPPING_BRUSH_TIME"
            : "INVALID_OR_EXCESSIVE_BRUSH_DOSE";
      expect(
        evaluateBrushTime(journal, [1, 2], "session-a").issues,
      ).toContainEqual(expect.objectContaining({ code: expected }));
    },
  );
  it("rejects another gesture's dose before the first gesture's real publication", () => {
    const journal = events();
    journal.splice(3, 0, {
      ...journal[2],
      intervalId: 3,
      gestureId: 99,
      revision: 2,
      at: 4,
    });
    expect(evaluateBrushPublicationOrder(journal).issues).toContainEqual(
      expect.objectContaining({
        code: "MULTIPLE_UNPUBLISHED_BRUSH_STEPS",
        intervalId: 3,
        previousIntervalId: 1,
      }),
    );
  });
  it("retires only a truly changed offscreen view, including resize without camera input", () => {
    const journal = events().filter(
      (event) => !(event.kind === "brush-submit" && event.intervalId === 1),
    );
    journal.splice(
      3,
      0,
      {
        kind: "view-change",
        sessionId: "session-a",
        viewGeneration: 2,
        bounds: [10, 10, 20, 20],
        at: 7.9,
      },
      {
        kind: "brush-feedback-obsolete",
        sessionId: "session-a",
        gestureId: 1,
        intervalId: 1,
        revision: 1,
        reason: "outside-view",
        bounds: [-1, -1, 1, 1],
        viewBounds: [10, 10, 20, 20],
        viewGeneration: 2,
        at: 8,
      },
    );
    const result = evaluateBrushPublicationOrder(journal);
    expect(result.passed).toBe(true);
    expect(result.steps[0]).toMatchObject({ submittedAt: null, retiredAt: 8 });
    journal[3].viewGeneration = 3;
    expect(evaluateBrushPublicationOrder(journal).passed).toBe(false);
    journal[3].viewGeneration = 2;
    journal[3].bounds = journal[4].viewBounds = [-0.5, -0.5, 0.5, 0.5];
    expect(evaluateBrushPublicationOrder(journal).passed).toBe(false);
  });
  it("does not turn input-version coverage into a published brush step", () => {
    const journal = events();
    journal[5].kind = "brush-covered";
    expect(evaluateBrushPublicationOrder(journal).issues).toContainEqual(
      expect.objectContaining({
        code: "BRUSH_STEP_SUBMISSION_MISSING",
        intervalId: 1,
      }),
    );
    expect(evaluateBrushTime([], [], "session-a").passed).toBe(false);
  });
  it("reports consciously skipped inputs distinctly from unknown or unchanged model work", () => {
    const samples = extractEditSamples(
      [
        { kind: "input", id: 1, inputKind: "edit", createdAt: 1, at: 2 },
        { kind: "noop", input: 1, accepted: false, reason: "feedback", at: 3 },
      ],
      [1],
      "session-a",
    );
    expect(samples[0]).toMatchObject({
      accepted: false,
      noopReason: "feedback",
      modelChanged: false,
      modelAt: null,
      submissionAt: null,
    });
    expect(evaluateSubmissionDiagnostics(samples).issues).toContainEqual({
      code: "INPUT_NOT_ACCEPTED",
      inputId: 1,
      accepted: false,
      reason: "feedback",
      modelChanged: false,
    });
  });
});

describe("actual navigation response", () => {
  const navigation = () => [
    {
      kind: "input",
      id: 1,
      inputKind: "navigation",
      eventType: "wheel",
      createdAt: 643,
      at: 689,
    },
    {
      kind: "camera",
      input: 1,
      at: 689.2,
      camera: { x: 0, y: 0, scale: 0.216 },
    },
    { kind: "sources", at: 692.9, tiles: 0, bytes: 0 },
    {
      kind: "input",
      id: 2,
      inputKind: "navigation",
      eventType: "pointerdown",
      createdAt: 700,
      at: 701,
    },
    {
      kind: "input",
      id: 3,
      inputKind: "navigation",
      eventType: "pointermove",
      createdAt: 710,
      at: 711,
    },
    {
      kind: "camera",
      input: 3,
      at: 711.1,
      camera: { x: -40, y: -23, scale: 0.216 },
    },
  ];
  it("accepts the observed camera response before an asynchronous empty read", () => {
    const samples = extractNavigationSamples(navigation());
    expect(samples).toHaveLength(2);
    const result = evaluateNavigationDiagnostics(samples);
    expect(result.passed).toBe(true);
    expect(result.handlerToCameraMs.maximum).toBeCloseTo(0.2);
    const scenario = {
      kind: "navigation",
      samples,
      droppedEvents: 0,
      authorChanges: 0,
      storeReads: 1,
      returnedTiles: 0,
      cpuWorkMs: [1, 2],
    };
    expect(evaluateScenario(scenario).status).toBe("PROXY_ONLY");
    expect(evaluateScenario({ ...scenario, authorChanges: 1 }).status).toBe(
      "FAIL",
    );
  });
  it("retains missing, stale and read-before-camera responses as failures", () => {
    const missing = navigation().filter((event) => event.kind !== "camera");
    expect(
      evaluateNavigationDiagnostics(extractNavigationSamples(missing)).passed,
    ).toBe(false);
    const afterRead = navigation();
    [afterRead[1], afterRead[2]] = [afterRead[2], { ...afterRead[1], at: 693 }];
    expect(
      evaluateNavigationDiagnostics(extractNavigationSamples(afterRead)).issues,
    ).toContainEqual({
      code: "CAMERA_RESPONSE_AFTER_SOURCE_COMPLETION",
      inputId: 1,
    });
    const stale = extractNavigationSamples(navigation());
    stale[0].cameraAt = 640;
    expect(evaluateNavigationDiagnostics(stale).passed).toBe(false);
  });
});

describe("saved moving-stroke evidence and explicit probe scope", () => {
  function stroke(delayed = false) {
    return Array.from({ length: 5 }, (_, index) => ({
      ...sample(index),
      inputKind: index === 4 ? "pointerup" : "edit",
      createdAt: index * 24,
      handlerAt: index * 24 + 1,
      modelAt: index * 24 + 2,
      submissionAt: delayed ? 300 + index : index * 24 + 4,
      presentation: null,
    }));
  }
  function journal(delayed = false) {
    const events = stroke(delayed).flatMap((sample) => [
      {
        kind: "input",
        id: sample.inputId,
        inputKind: sample.inputKind,
        createdAt: sample.createdAt,
        at: sample.handlerAt,
      },
      {
        kind: sample.inputKind === "pointerup" ? "commit" : "model",
        input: sample.inputId,
        revision: sample.revision,
        at: sample.modelAt,
      },
      {
        kind: "edit-submit",
        input: sample.inputId,
        sessionId: sample.sessionId,
        revision: sample.revision,
        frame: sample.frameId,
        at: sample.submissionAt,
      },
      {
        kind: "submit",
        sessionId: sample.sessionId,
        frame: sample.frameId,
        revision: sample.revision,
        exactRevision: sample.revision,
        at: sample.submissionAt,
      },
    ]);
    // A partially uploaded frame is real, but cannot acknowledge an exact edit.
    events.push({
      kind: "submit",
      sessionId: "session-a",
      frame: 900,
      exactRevision: -1,
      at: 40,
    } as (typeof events)[number]);
    return { events, sessionId: "session-a", droppedEvents: 0 };
  }
  function scenario(delayed = false) {
    return {
      id: "M03-height-large",
      kind: "edit",
      samples: stroke(delayed),
      droppedEvents: 0,
      requestedAttempts: 1,
      collectionPassed: true,
      attempts: [
        {
          attempt: 0,
          passed: true,
          content: {
            points: [
              [-800, 0],
              [-520, 0],
              [-240, 0],
              [40, 0],
            ],
            before: [-20, -6, 8, 22],
            after: [80, 150, 160, 100],
            undone: [-20, -6, 8, 22],
          },
          changedImage: {
            pixels: [
              [140, 156, 112],
              [142, 157, 114],
            ],
          },
          undoneImage: {
            pixels: [
              [90, 143, 163],
              [134, 152, 105],
            ],
          },
        },
      ],
    };
  }
  it("rejects the saved large-brush failure despite a claimed successful collection", () => {
    const result = evaluateObservation(journal(true), {
      id: "M03-height-large",
    });
    expect(result.status).toBe("FAIL");
    expect(result.sampleCount).toBe(5);
    assert(result.live, "The replayed edit scenario must expose live evidence");
    expect(result.live[0].liveSubmissionsBeforeRelease).toBe(0);
    expect(result.failures).toContainEqual(
      expect.objectContaining({ code: "LIVE_EXACT_UPDATES_MISSING" }),
    );
    expect(result.missing).toContainEqual({
      code: "CONTENT_CHECKS_UNAVAILABLE_FROM_JOURNAL",
    });
    expect(result.blockers).toContainEqual({
      code: "EXACT_NATIVE_PRESENTATION_UNPROVEN",
    });
    const evaluated = evaluateScenario(scenario(true));
    expect(evaluated.contentPassed).toBe(true);
    assert(
      evaluated.liveFeedback,
      "An edit must expose its live feedback result",
    );
    expect(evaluated.liveFeedback.status).toBe("FAIL");
  });
  it("accepts early exact submissions, while retaining missing or stale evidence as failures", () => {
    expect(strokeEvidence({ samples: stroke() }).passed).toBe(true);
    expect(strokeEvidence({ samples: stroke().slice(0, -1) }).passed).toBe(
      false,
    );
    const regionExact = journal();
    regionExact.events.find(
      (event) => event.kind === "submit" && event.frame === 3,
    )!.exactRevision = -1;
    const exactResult = evaluateObservation(regionExact);
    assert(exactResult.live, "The replayed edit must expose live evidence");
    expect(exactResult.live[0].passed).toBe(true);
    const partial = journal();
    partial.events.find(
      (event) => event.kind === "submit" && event.frame === 3,
    )!.revision = -1;
    expect(evaluateObservation(partial).failures).toContainEqual(
      expect.objectContaining({ code: "MISSING_SUBMISSION", inputId: 1 }),
    );
    expect(evaluateObservation({ ...journal(), droppedEvents: 1 }).status).toBe(
      "FAIL",
    );
  });
  it("requires two distinct frames before release, not several inputs in one frame", () => {
    const coalesced = stroke().map((entry) => ({ ...entry, frameId: 10 }));
    const evidence = strokeEvidence({ samples: coalesced });
    expect(evidence.liveSubmissionsBeforeRelease).toBe(4);
    expect(evidence.liveFramesBeforeRelease).toBe(1);
    expect(evidence.passed).toBe(false);
  });
  it("rejects a later movement stall despite early frames and an acceptable aggregate p95", () => {
    const samples = Array.from({ length: 101 }, (_, index) => {
      const createdAt = index * 24;
      const paused = index >= 2 && index <= 8;
      return {
        ...sample(index),
        inputKind: index === 100 ? "pointerup" : "edit",
        createdAt,
        handlerAt: createdAt + 1,
        modelAt: createdAt + 2,
        submissionAt: paused ? 200 : createdAt + 4,
        frameId: paused ? 500 : 1000 + index,
        presentation: null,
      };
    });
    expect(evaluateSubmissionDiagnostics(samples).status).toBe("PROXY_ONLY");
    const evidence = strokeEvidence({ samples });
    expect(evidence.minimumFrameControlPassed).toBe(true);
    expect(evidence.continuity.maximumMovingStallMs).toBe(152);
    expect(evidence.timeline).toHaveLength(101);
    expect(evidence.passed).toBe(false);
    const result = evaluateScenario({ ...scenario(), samples });
    expect(result.contentPassed).toBe(true);
    assert(result.liveFeedback, "An edit must expose its live feedback result");
    expect(result.liveFeedback.status).toBe("FAIL");
    expect(result.status).toBe("FAIL");
    expect(result.failures).toContainEqual({
      code: "CONTINUOUS_SUBMISSION_STALL",
      attempt: 0,
      milliseconds: 152,
      limitMs: 100,
    });
  });
  it("does not treat an idle held interval with no outstanding edit as a feedback stall", () => {
    const samples = stroke().map((entry, index) => {
      const createdAt = index * 24 + (index >= 2 ? 2000 : 0);
      return {
        ...entry,
        createdAt,
        handlerAt: createdAt + 1,
        modelAt: createdAt + 2,
        submissionAt: createdAt + 4,
      };
    });
    const evidence = strokeEvidence({ samples });
    expect(evidence.passed).toBe(true);
    expect(evidence.continuity.maximumMovingStallMs).toBe(0);
    expect(evidence.continuity.maximumPendingGapMs).toBe(4);
  });
  it("requires pointerup's own commit even when its revision was already submitted", () => {
    const pending = journal();
    pending.events.find((event) => event.kind === "commit")!.kind = "model";
    expect(evaluateObservation(pending).failures).toContainEqual(
      expect.objectContaining({
        code: "MISSING_INPUT_OR_MODEL",
        inputId: 5,
      }),
    );
  });
  it("requires canonical and visible changes at the first and last positions", () => {
    const attempt = scenario().attempts[0];
    const content = {
      ...attempt.content,
      changedPixels: attempt.changedImage.pixels,
      restoredPixels: attempt.undoneImage.pixels,
    };
    expect(evaluateStrokeContent(content).passed).toBe(true);
    const initialDabOnly = {
      ...content,
      after: [...content.after.slice(0, -1), content.before.at(-1)!],
    };
    expect(evaluateStrokeContent(initialDabOnly).passed).toBe(false);
    expect(
      evaluateStrokeContent({
        ...content,
        changedPixels: [content.changedPixels[0], content.restoredPixels[1]],
      }).passed,
    ).toBe(false);
    expect(
      evaluateStrokeContent({ ...content, changedPixels: [] }).passed,
    ).toBe(false);
  });
  it("keeps a passing selected probe distinct from the fixed native manifest", () => {
    const report = {
      schemaVersion: 2,
      purpose: "probe",
      selection: "collection",
      mode: "lab",
      // A native preflight marker must not bypass the laboratory's checks.
      collectionStarted: false,
      errors: [],
      functional: { checks: [] },
      planned: [{ run: "probe-1", id: "M03-height-large", state: "completed" }],
      runs: [
        {
          id: "probe-large",
          independentRunId: "probe-1",
          instanceId: "one-process",
          scenarios: [scenario()],
        },
      ],
    };
    const result = evaluateRun(report);
    expect(result.scopePassed).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.status).toBe("BLOCKED");
    expect(result.nativeAcceptance.unmetRequirements).toContainEqual(
      expect.objectContaining({ code: "INSUFFICIENT_INDEPENDENT_RUNS" }),
    );
    report.runs[0].scenarios = [scenario(true)];
    const failed = evaluateRun(report);
    expect(failed.status).toBe("FAIL");
    expect(failed.blockers.length).toBeGreaterThan(0);
    report.runs[0].scenarios = [scenario()];
    report.planned.push({
      run: "probe-1",
      id: "M10-height-cold",
      state: "planned",
    });
    expect(evaluateRun(report).status).toBe("INCOMPLETE");
  });
});

describe("actual save and worker overlap", () => {
  function evidence() {
    const worker = { sessionId: "session-a", active: true, samples: 10 };
    return {
      sessionId: "session-a",
      timeOrigin: 1000,
      sample: { ...sample(1), inputKind: "edit" },
      intervals: [
        {
          start: {
            sessionId: "session-a",
            kind: "snapshot",
            token: "save-1",
            epochMs: 1090,
          },
          end: {
            sessionId: "session-a",
            kind: "snapshot",
            token: "save-1",
            epochMs: 1300,
            success: true,
          },
        },
      ],
      before: { sessionId: "session-a", background: worker },
      observedWorker: { sessionId: "session-a", background: worker },
      finished: { background: { ...worker, samples: 20 } },
    };
  }
  it("keeps real overlap proven when a later input was explicitly discarded", () => {
    const result = evaluateSaveOverlap(evidence());
    expect(result.passed).toBe(true);
    expect(result.matches).toHaveLength(1);
    expect(result.inputEpochMs).toBe(1100);
    expect(result.modelEpochMs).toBe(1102);
    const discarded = {
      ...sample(2),
      inputKind: "edit",
      modelChanged: false,
      accepted: false,
      noopReason: "stale",
      noopAt: 203,
      modelAt: null,
      submissionAt: null,
      frameId: null,
    };
    const strict = evaluateSubmissionDiagnostics([
      evidence().sample,
      discarded,
    ]);
    expect(strict.status).toBe("FAIL");
    expect(strict.issues).toContainEqual(
      expect.objectContaining({ code: "INPUT_NOT_ACCEPTED", inputId: 3 }),
    );
  });
  it("requires actual model acceptance inside the same successful store window", () => {
    const observed = evidence();
    observed.sample.modelAt = 301;
    expect(evaluateSaveOverlap(observed).passed).toBe(false);
    observed.sample.modelAt = 102;
    observed.intervals[0].end.success = false;
    expect(evaluateSaveOverlap(observed).passed).toBe(false);
    observed.intervals[0].end.success = true;
    observed.intervals[0].end.sessionId = "old-session";
    expect(evaluateSaveOverlap(observed).passed).toBe(false);
  });
  it("requires a current active worker and observed progress", () => {
    const observed = evidence();
    observed.finished.background.samples = 10;
    expect(evaluateSaveOverlap(observed).passed).toBe(false);
    observed.finished.background.samples = 20;
    observed.observedWorker.background.active = false;
    expect(evaluateSaveOverlap(observed).passed).toBe(false);
  });
});

function blockedEvidence(holdUntilReady = true) {
  const document = {
    revision: 0,
    sequence: 5,
    historyActions: 0,
    canUndo: false,
    canRedo: false,
    active: false,
  };
  const state = {
    sessionId: "session-a",
    document,
    readiness: { ready: true, reason: null },
    needsPress: false,
  };
  const samples = ["pointerdown", "pointermove", "pointerup"].map(
    (eventType, index) => {
      const createdAt =
        index === 2 ? (holdUntilReady ? 120 : 14) : 10 + index * 2;
      return {
        inputId: index + 1,
        inputKind: index === 2 ? "pointerup" : "edit",
        eventType,
        sessionId: state.sessionId,
        createdAt,
        handlerAt: createdAt + 1,
        noopAt: createdAt + 1,
        modelChanged: false,
        accepted: false,
        modelAt: null,
        submissionAt: null,
        noopReason:
          index === 0
            ? "terrain"
            : index === 2
              ? "no-gesture"
              : "new-press-required",
      };
    },
  );
  return {
    holdUntilReady,
    before: structuredClone(state),
    waiting: {
      ...structuredClone(state),
      readiness: { ready: false, reason: "terrain" },
      statusVisible: true,
      statusText: "Kartenbereich wird geladen …",
    },
    ready: { ...structuredClone(state), needsPress: holdUntilReady },
    heldHint: holdUntilReady
      ? {
          ...structuredClone(state),
          observedAt: 100,
          needsPress: true,
          statusVisible: true,
          statusText: "Zum Bearbeiten loslassen und erneut drücken",
        }
      : undefined,
    settled: structuredClone(state),
    gateAt: 50,
    samples,
    mutationEvents: [] as { kind: string }[],
    recovery: {
      timePassed: true,
      eventType: "pointerdown",
      createdAt: 150,
      modelAt: 151,
      heightBefore: -20,
      heightAfter: 40,
      sequenceAfter: 6,
      historyAfter: 1,
    },
  };
}

describe("D11 rejects early gestures without creating delayed work", () => {
  it.each([false, true])(
    "accepts visible blocking and a new press after release (held=%s)",
    (held) => {
      expect(evaluateBlockedInput(blockedEvidence(held))).toEqual({
        passed: true,
        issues: [],
      });
    },
  );
  it("requires the visible recovery hint while the rejected press is still held", () => {
    const missing = blockedEvidence();
    missing.heldHint = undefined;
    expect(evaluateBlockedInput(missing).issues).toContainEqual({
      code: "BLOCKED_HELD_HINT_UNPROVEN",
    });
    for (const patch of [
      { statusText: "Kartenbereich wird geladen …" },
      { statusVisible: false },
      { needsPress: false },
      { observedAt: 49 },
      { observedAt: 121 },
    ]) {
      const invalid = blockedEvidence();
      Object.assign(invalid.heldHint!, patch);
      expect(evaluateBlockedInput(invalid).issues).toContainEqual({
        code: "BLOCKED_HELD_HINT_UNPROVEN",
      });
    }
  });
  it("rejects an invisible wait, an early mutation, replay, or no deliberate recovery", () => {
    const invisible = blockedEvidence();
    invisible.waiting.statusVisible = false;
    expect(evaluateBlockedInput(invisible).issues).toContainEqual({
      code: "BLOCKED_WAIT_STATE_UNPROVEN",
    });
    const changed = blockedEvidence();
    changed.ready.document.revision++;
    expect(evaluateBlockedInput(changed).issues).toContainEqual({
      code: "BLOCKED_INPUT_CHANGED_DOCUMENT",
    });
    const replay = blockedEvidence();
    replay.mutationEvents.push({ kind: "brush-interval" });
    expect(evaluateBlockedInput(replay).issues).toContainEqual({
      code: "BLOCKED_INPUT_REPLAYED",
    });
    const missing = blockedEvidence();
    missing.recovery.timePassed = false;
    expect(evaluateBlockedInput(missing).issues).toContainEqual({
      code: "BLOCKED_INPUT_RECOVERY_FAILED",
    });
  });
});

describe("D11/M10 uses a real local gate and the ordinary edit contract", () => {
  function coldStroke(discarded: boolean) {
    const first = {
      ...coldSample(1),
      submissionAt: discarded ? 300 : 116,
      presentation: null,
    };
    const movement = Array.from({ length: 4 }, (_, index) => {
      const createdAt = 124 + index * 24;
      const entry = sample(index + 2);
      return {
        ...entry,
        inputKind: "edit",
        eventType: "pointermove",
        createdAt,
        handlerAt: createdAt + 1,
        modelAt: discarded ? null : createdAt + 2,
        modelChanged: !discarded,
        accepted: !discarded,
        noopAt: discarded ? createdAt + 2 : null,
        noopReason: discarded ? "feedback" : null,
        discardedDuringGesture: discarded,
        gestureId: first.inputId,
        submissionAt: discarded ? null : createdAt + 16,
        frameId: discarded ? null : entry.frameId,
      };
    });
    const up = {
      ...sample(6),
      inputKind: "pointerup",
      eventType: "pointerup",
      createdAt: 220,
      handlerAt: 221,
      modelAt: 222,
      submissionAt: 224,
      sequence: 1,
    };
    const samples = [first, ...movement, up];
    const stroke = strokeEvidence({ samples });
    return {
      kind: "cold",
      droppedEvents: 0,
      requestedAttempts: 1,
      samples,
      blockedInputs: { cases: [blockedEvidence(false), blockedEvidence(true)] },
      attempts: [
        {
          attempt: 0,
          passed: stroke.passed,
          stroke,
          content: {
            points: [
              [0, 0],
              [400, 0],
            ],
            before: [-20, -20],
            after: [40, 40],
            undone: [-20, -20],
          },
          changedImage: {
            pixels: [
              [20, 100, 30],
              [20, 100, 30],
            ],
          },
          undoneImage: {
            pixels: [
              [0, 10, 120],
              [0, 10, 120],
            ],
          },
        },
      ],
    };
  }

  it("retains every cold input and fails stalled feedback without calling D10 discards lost edits", () => {
    const result = evaluateScenario(coldStroke(true));
    expect(result.status).toBe("FAIL");
    expect(result.sampleCount).toBe(6);
    expect(result.liveFeedback).toMatchObject({
      inputCount: 6,
      processedNoops: 4,
      notAccepted: 4,
      maximumMovingStallMs: 120,
    });
    expect(result.failures).toContainEqual(
      expect.objectContaining({ code: "CONTINUOUS_SUBMISSION_STALL" }),
    );
    expect(result.failures).toContainEqual(
      expect.objectContaining({
        code: "COLD_FIRST_INPUT_LOWER_BOUND_EXCEEDS_LIMIT",
      }),
    );
    expect(
      result.failures.some((issue) => issue.code === "INPUT_NOT_ACCEPTED"),
    ).toBe(false);
  });

  it("uses the same live/content criteria after cold or warm readiness", () => {
    const cold = coldStroke(false);
    const result = evaluateScenario(cold);
    expect(result.status).toBe("PROXY_ONLY");
    assert(
      result.liveFeedback,
      "A cold edit must expose its live feedback result",
    );
    assert(result.submission, "A cold edit must expose submission diagnostics");
    assert(result.live, "A cold edit must expose live evidence");
    expect(result.liveFeedback.inputCount).toBe(6);
    expect(result.submission.inputToSubmissionMs.count).toBe(6);
    expect(result.live[0].passed).toBe(true);
    expect(evaluateScenario({ ...cold, kind: "edit" }).live).toEqual(
      result.live,
    );
  });

  it("permits proven movement coalescing without accepting a lost press or inventing a submit", () => {
    const scenario = coldStroke(false);
    Object.assign(scenario.samples[2], {
      modelAt: null,
      submissionAt: null,
      modelChanged: false,
      accepted: false,
      noopAt: 150,
      noopReason: "coalesced",
      discardedDuringGesture: true,
      gestureId: scenario.samples[0].inputId,
      frameId: null,
    });
    expect(evaluateScenario(scenario).status).toBe("PROXY_ONLY");
    expect(
      evaluateSubmissionDiagnostics(scenario.samples).inputToSubmissionMs.count,
    ).toBe(5);
    Object.assign(scenario.samples[2], { eventType: "pointerdown" });
    expect(evaluateScenario(scenario).failures).toContainEqual(
      expect.objectContaining({ code: "INPUT_NOT_ACCEPTED" }),
    );
  });

  it("dispatches immediately on the first product gate, not the old data-ready event", async () => {
    vi.useFakeTimers();
    try {
      const sendInputEvent = vi.fn();
      const executeJavaScript = vi
        .fn()
        .mockResolvedValueOnce({
          sessionId: "session-a",
          eventCount: 2,
          droppedEvents: 0,
          readiness: { ready: true, frame: 1, viewGeneration: 2 },
          events: [
            {
              kind: "input",
              inputKind: "navigation",
              id: 1,
              createdAt: 10,
              at: 11,
            },
            { kind: "ready", input: 1, at: 12 },
          ],
        })
        .mockResolvedValueOnce({
          sessionId: "session-a",
          eventCount: 3,
          droppedEvents: 0,
          readiness: { ready: true, frame: 5, viewGeneration: 2 },
          events: [
            {
              kind: "input-ready",
              input: 1,
              at: 30,
              sessionId: "session-a",
              frame: 5,
              viewGeneration: 2,
            },
          ],
        });
      const electron = {
        BrowserWindow: {
          getAllWindows: () => [
            { webContents: { executeJavaScript, sendInputEvent } },
          ],
        },
      };
      const session = {
        app: {
          evaluate: (
            fn: (electron: unknown, args: unknown) => unknown,
            args: unknown,
          ) => fn(electron, args),
        },
      };
      const pending = startReadyStrokeMonitor(session, {
        afterInputId: 0,
        screenPoint: { x: 400, y: 300 },
        sessionId: "session-a",
        point: [0, 0],
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(sendInputEvent).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(executeJavaScript).toHaveBeenCalledTimes(2);
      expect(sendInputEvent.mock.calls.map(([event]) => event.type)).toEqual([
        "mouseMove",
        "mouseDown",
      ]);
      await vi.advanceTimersByTimeAsync(120);
      expect((await pending).dispatched).toBe(true);
      expect(executeJavaScript).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps rare cold overshoots in the report and enforces the absolute maximum", () => {
    const samples = Array.from({ length: 100 }, (_, index) => {
      const navigationAt = index * 3000;
      const gateAt = navigationAt + (index < 5 ? 600 : 20);
      return {
        ...coldSample(index),
        navigationAt,
        sourcesAt: navigationAt + 10,
        gateAt,
        gateSubmissionAt: gateAt - 1,
        createdAt: navigationAt + 700,
        handlerAt: navigationAt + 701,
        modelAt: navigationAt + 702,
        submissionAt: navigationAt + (index < 5 ? 800 : 704),
      };
    });
    const result = evaluateColdSubmissionDiagnostics(samples);
    expect(result.status).toBe("PROXY_ONLY");
    expect(
      result.outliers.filter(
        (issue) => issue.code === "COLD_GATE_LOWER_BOUND_EXCEEDS_LIMIT",
      ),
    ).toHaveLength(5);
    expect(
      result.outliers.filter(
        (issue) => issue.code === "COLD_SUBMISSION_LOWER_BOUND_EXCEEDS_LIMIT",
      ),
    ).toHaveLength(5);
    expect(result.navigationToGateMs.p95).toBe(20);
    expect(result.navigationToSubmissionMs.p95).toBe(704);
    samples[6].submissionAt = samples[6].navigationAt + 2100;
    expect(evaluateColdSubmissionDiagnostics(samples).issues).toContainEqual(
      expect.objectContaining({ code: "COLD_MAXIMUM_EXCEEDED", inputId: 7 }),
    );
  });

  it("fails a 282.2-ms first edit despite navigation-to-edit remaining below 750 ms", () => {
    const entry = { ...coldSample(5), submissionAt: 782.2, presentation: null };
    const result = evaluateColdSubmissionDiagnostics([entry]);
    expect(result.status).toBe("FAIL");
    expect(result.presentationProven).toBe(false);
    expect(result.inputToSubmissionMs.maximum).toBeCloseTo(282.2);
    expect(result.navigationToSubmissionMs.maximum).toBeCloseTo(382.2);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "COLD_FIRST_INPUT_LOWER_BOUND_EXCEEDS_LIMIT",
        limitMs: 50,
      }),
    );
  });

  it("rejects late gates, late submission, missing gates and the old data-only ready boundary", () => {
    const entry = {
      ...coldSample(7),
      navigationAt: 0,
      sourcesAt: 20,
      gateAt: 600,
      gateSubmissionAt: 599,
    };
    expect(evaluateColdSubmissionDiagnostics([entry]).issues).toContainEqual(
      expect.objectContaining({
        code: "COLD_GATE_LOWER_BOUND_EXCEEDS_LIMIT",
        limitMs: 500,
      }),
    );
    expect(
      evaluateColdSubmissionDiagnostics([
        { ...entry, gateAt: 30, gateSubmissionAt: 29, submissionAt: 800 },
      ]).issues,
    ).toContainEqual(
      expect.objectContaining({
        code: "COLD_SUBMISSION_LOWER_BOUND_EXCEEDS_LIMIT",
        limitMs: 750,
      }),
    );
    expect(
      evaluateColdSubmissionDiagnostics([{ ...entry, gateAt: null }]).status,
    ).toBe("FAIL");
    expect(
      evaluateColdSubmissionDiagnostics([
        { ...entry, gateEvidence: null, readyAt: 20 },
      ]).issues,
    ).toContainEqual(
      expect.objectContaining({ code: "INVALID_COLD_NAVIGATION_BOUNDARY" }),
    );
  });

  const nativeRequirements = {
    ...oneCase,
    scenarios: [
      { id: "warm", kind: "cold", minSamples: 100, minTotalSamples: 100 },
    ],
  };
  function nativeCold(delay = 16) {
    const report = knownGood();
    report.runs[0].scenarios[0].samples = Array.from(
      { length: 100 },
      (_, index) => coldSample(index, delay),
    );
    return report;
  }

  it("requires ordinary 50-ms native response as well as the cold navigation budget", () => {
    expect(evaluateAcceptance(nativeCold(), nativeRequirements).status).toBe(
      "PASS",
    );
    expect(
      evaluateAcceptance(nativeCold(280), nativeRequirements).failures,
    ).toContainEqual(
      expect.objectContaining({ code: "COLD_FIRST_INPUT_P95_EXCEEDED" }),
    );
  });

  it("blocks a missing native readiness join and rejects a stale baseline or premature input", () => {
    const missing = nativeCold();
    Object.assign(missing.runs[0].scenarios[0].samples[0], {
      readyPresentation: null,
    });
    const blocked = evaluateAcceptance(missing, nativeRequirements);
    expect(blocked.status).toBe("BLOCKED");
    expect(blocked.blockers).toContainEqual(
      expect.objectContaining({ code: "MISSING_READY_PRESENTATION" }),
    );
    const stale = nativeCold();
    const staleSample = stale.runs[0].scenarios[0].samples[0] as ReturnType<
      typeof coldSample
    >;
    staleSample.readyPresentation.viewGeneration++;
    expect(
      evaluateAcceptance(stale, nativeRequirements).failures,
    ).toContainEqual(
      expect.objectContaining({
        code: "UNMATCHED_OR_STALE_READY_PRESENTATION",
      }),
    );
    const early = nativeCold();
    const earlySample = early.runs[0].scenarios[0].samples[0] as ReturnType<
      typeof coldSample
    >;
    earlySample.readyPresentation.at = earlySample.createdAt + 5;
    expect(
      evaluateAcceptance(early, nativeRequirements).failures,
    ).toContainEqual(
      expect.objectContaining({
        code: "INPUT_PRECEDES_VISIBLE_READY",
        milliseconds: 5,
      }),
    );
  });

  it("extracts the first real input once and requires its actual submitted view", () => {
    const events = [
      { kind: "input", inputKind: "navigation", id: 1, at: 10, createdAt: 9 },
      {
        kind: "view-change",
        at: 11,
        sessionId: "session-a",
        viewGeneration: 2,
      },
      { kind: "sources-ready", at: 20, sessionId: "session-a", input: 1 },
      {
        kind: "submit",
        at: 30,
        sessionId: "session-a",
        frame: 5,
        revision: 0,
        cameraGeneration: 2,
      },
      {
        kind: "input-ready",
        at: 31,
        sessionId: "session-a",
        input: 1,
        frame: 5,
        revision: 0,
        viewGeneration: 2,
      },
    ];
    const edits = [
      {
        ...sample(1),
        inputKind: "edit",
        createdAt: 32,
        handlerAt: 33,
        modelAt: 34,
        submissionAt: 36,
      },
      {
        ...sample(2),
        inputKind: "edit",
        createdAt: 50,
        handlerAt: 51,
        modelAt: 52,
        submissionAt: 54,
      },
    ];
    const extracted = extractColdSamples(events, edits, {
      sessionId: "session-a",
      coldBeforeNavigation: true,
    });
    expect(extracted).toHaveLength(2);
    expect(extracted[0]).toMatchObject({
      navigationId: 1,
      gateAt: 31,
      gateSubmissionAt: 30,
      sourcesAt: 20,
      gateEvidence: "local-terrain-submit-v1",
      readyAt: null,
    });
    expect(extracted[1]).not.toHaveProperty("navigationId");
    const stale = [
      ...events.slice(0, 4),
      {
        kind: "view-change",
        at: 30.5,
        sessionId: "session-a",
        viewGeneration: 3,
      },
      events[4],
    ];
    expect(extractColdBoundary(stale, 1, "session-a").gateEvidence).toBeNull();
    expect(
      extractColdBoundary(
        events.filter((event) => event.kind !== "input-ready"),
        1,
        "session-a",
      ).gateAt,
    ).toBeNull();
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
