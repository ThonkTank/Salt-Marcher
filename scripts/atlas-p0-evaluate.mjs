import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

/** These are requirements, never inferred from whichever samples happened to arrive. */
export const P0_REQUIREMENTS = Object.freeze({
  scope: "P0-height-subset",
  independentRuns: 3,
  scenarios: [
    {
      id: "M01-grid-on",
      kind: "navigation",
      minSamples: 1,
      minDurationMs: 30_000,
    },
    {
      id: "M01-grid-off",
      kind: "navigation",
      minSamples: 1,
      minDurationMs: 30_000,
    },
    {
      id: "M03-height-small",
      kind: "edit",
      minSamples: 100,
      requiredInputKinds: ["edit", "pointerup"],
    },
    {
      id: "M03-height-large",
      kind: "edit",
      minSamples: 100,
      requiredInputKinds: ["edit", "pointerup"],
    },
    {
      id: "M04-coarse-fine",
      kind: "edit",
      minSamples: 100,
      requiredInputKinds: ["edit", "pointerup"],
    },
    {
      id: "M06-height-busy",
      kind: "edit",
      minSamples: 100,
      requiredInputKinds: ["edit", "pointerup"],
    },
    {
      id: "M10-height-cold",
      kind: "cold",
      minSamples: 30,
      minTotalSamples: 100,
    },
    {
      id: "M10-height-cold-busy",
      kind: "cold",
      minSamples: 30,
      minTotalSamples: 100,
    },
  ],
  requiredChecks: [
    "canonical-fixture",
    "coarse-preserves-fine",
    "undo-redo",
    "save-reopen",
    "process-restart",
    "cold-before-navigation",
    "busy-worker-and-save",
    "terrain-pixels",
  ],
});

const finite = (value) => typeof value === "number" && Number.isFinite(value);
const nonempty = (value) => typeof value === "string" && value.length > 0;

/** A package must identify its executed code; workspace metadata is no fallback. */
export function checkBuildIdentity(workspace, executed, provenance) {
  const failures = [];
  const validHash = (value) =>
    typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  if (
    provenance?.status !== "ok" ||
    provenance?.kind !== "executed-main-sibling" ||
    !nonempty(provenance?.path) ||
    !validHash(provenance?.sha256)
  )
    failures.push({ code: "EXECUTED_BUILD_PROVENANCE_MISSING" });
  if (!executed || !nonempty(executed.commit))
    failures.push({ code: "EXECUTED_BUILD_MANIFEST_MISSING" });
  for (const field of ["sourceSha256", "lockSha256"]) {
    if (!validHash(workspace?.[field]) || !validHash(executed?.[field]))
      failures.push({ code: "BUILD_IDENTITY_FIELD_MISSING", field });
    else if (workspace[field] !== executed[field])
      failures.push({
        code: "BUILD_IDENTITY_MISMATCH",
        field,
        workspace: workspace[field],
        executed: executed[field],
      });
  }
  return { passed: failures.length === 0, failures };
}

export function distribution(values) {
  const sorted = values.filter(finite).sort((a, b) => a - b);
  const quantile = (p) =>
    sorted.length
      ? sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]
      : null;
  return {
    count: sorted.length,
    invalid: values.length - sorted.length,
    p50: quantile(0.5),
    p95: quantile(0.95),
    p99: quantile(0.99),
    maximum: sorted.at(-1) ?? null,
  };
}

/** Missing inputs remain explicit samples; never flatMap away failed observations. */
export function extractEditSamples(events, inputIds, sessionId) {
  return inputIds.map((inputId) => {
    const input = events.find((e) => e.kind === "input" && e.id === inputId);
    const model = events.find(
      (e) => (e.kind === "model" || e.kind === "commit") && e.input === inputId,
    );
    const edits = events.filter(
      (e) =>
        e.kind === "edit-submit" &&
        e.input === inputId &&
        e.sessionId === sessionId &&
        e.revision === model?.revision,
    );
    const edit = edits.find((candidate) =>
      events.some(
        (e) =>
          e.kind === "submit" &&
          e.frame === candidate.frame &&
          e.sessionId === sessionId &&
          e.at >= (model?.at ?? Infinity),
      ),
    );
    const submit =
      edit &&
      events.find(
        (e) =>
          e.kind === "submit" &&
          e.frame === edit.frame &&
          e.sessionId === sessionId,
      );
    return {
      inputId,
      inputKind: input?.inputKind ?? null,
      sessionId,
      createdAt: input?.createdAt ?? null,
      handlerAt: input?.at ?? null,
      modelAt: model?.at ?? null,
      revision: model?.revision ?? null,
      sequence: model?.sequence ?? null,
      submissionAt: submit?.at ?? null,
      frameId: edit?.frame ?? null,
      submittedRevision: edit?.revision ?? null,
      presentation: null,
      presentationStatus: "unproven",
    };
  });
}

/** Submission can disprove a deadline; submission alone can never prove visibility. */
export function evaluateSubmissionDiagnostics(samples, limitMs = 50) {
  const issues = [];
  const values = [];
  if (!samples.length) issues.push({ code: "NO_INPUT_SAMPLES" });
  for (const sample of samples) {
    const detail = { inputId: sample.inputId };
    if (!finite(sample.createdAt) || !finite(sample.modelAt))
      issues.push({ code: "MISSING_INPUT_OR_MODEL", ...detail });
    if (!finite(sample.submissionAt)) {
      issues.push({ code: "MISSING_SUBMISSION", ...detail });
      continue;
    }
    if (!finite(sample.createdAt)) continue;
    if (
      sample.submittedRevision !== sample.revision ||
      sample.submissionAt < sample.modelAt ||
      sample.modelAt < sample.createdAt
    ) {
      issues.push({ code: "STALE_OR_INVALID_SUBMISSION", ...detail });
      continue;
    }
    const duration = sample.submissionAt - sample.createdAt;
    values.push(duration);
    if (duration > limitMs)
      issues.push({
        code: "SUBMISSION_LOWER_BOUND_EXCEEDS_LIMIT",
        milliseconds: duration,
        limitMs,
        ...detail,
      });
  }
  return {
    status: issues.length ? "FAIL" : "PROXY_ONLY",
    presentationProven: false,
    sampleCount: samples.length,
    missing: samples.filter((s) => !finite(s.submissionAt)).length,
    inputToSubmissionMs: distribution(values),
    issues,
  };
}

/** M10 starts at target navigation; a cold first edit is not a warm M03 sample. */
export function evaluateColdSubmissionDiagnostics(samples) {
  const base = evaluateSubmissionDiagnostics(samples, Infinity);
  const issues = [...base.issues];
  const readiness = [],
    submission = [];
  for (const sample of samples) {
    const detail = {
      inputId: sample.inputId,
      navigationId: sample.navigationId,
    };
    if (sample.timeout === true)
      issues.push({ code: "SAMPLE_TIMEOUT", ...detail });
    if (
      sample.coldBeforeNavigation !== true ||
      !finite(sample.navigationAt) ||
      !finite(sample.readyAt) ||
      !finite(sample.createdAt) ||
      sample.readyAt < sample.navigationAt ||
      sample.createdAt < sample.readyAt
    ) {
      issues.push({ code: "INVALID_COLD_NAVIGATION_BOUNDARY", ...detail });
      continue;
    }
    const readyMs = sample.readyAt - sample.navigationAt;
    readiness.push(readyMs);
    if (readyMs > 500)
      issues.push({
        code: "COLD_READINESS_TARGET_EXCEEDED",
        milliseconds: readyMs,
        limitMs: 500,
        ...detail,
      });
    if (readyMs > 2000)
      issues.push({
        code: "COLD_MAXIMUM_EXCEEDED",
        milliseconds: readyMs,
        limitMs: 2000,
        ...detail,
      });
    if (finite(sample.submissionAt)) {
      const submissionMs = sample.submissionAt - sample.navigationAt;
      submission.push(submissionMs);
      if (submissionMs > 750)
        issues.push({
          code: "COLD_SUBMISSION_LOWER_BOUND_EXCEEDS_LIMIT",
          milliseconds: submissionMs,
          limitMs: 750,
          ...detail,
        });
      if (submissionMs > 2000)
        issues.push({
          code: "COLD_MAXIMUM_EXCEEDED",
          milliseconds: submissionMs,
          limitMs: 2000,
          ...detail,
        });
    }
  }
  return {
    ...base,
    status: issues.length ? "FAIL" : "PROXY_ONLY",
    contract:
      "M10 cold: navigation to readiness 500 ms, navigation to exact presentation 750 ms; submission is only a lower bound",
    navigationToReadyMs: distribution(readiness),
    navigationToSubmissionMs: distribution(submission),
    inputToSubmissionInterpretation:
      "informational cold-edit duration; no warm 50-ms judgment",
    issues,
  };
}

/** Pure fail-closed evaluator. The CLI always uses the fixed P0 requirements above. */
export function evaluateAcceptance(report, requirements = P0_REQUIREMENTS) {
  const failures = [],
    blockers = [],
    groups = [];
  const fail = (code, detail = {}) => failures.push({ code, ...detail });
  const block = (code, detail = {}) => blockers.push({ code, ...detail });
  const reference = report.reference ?? {};
  if (
    report.mode !== "native" ||
    reference.qualified !== true ||
    reference.softwareRendering !== false ||
    !finite(reference.displayHz) ||
    reference.displayHz < 59
  )
    block("NATIVE_REFERENCE_UNQUALIFIED");
  if (
    reference.viewport?.width !== 1440 ||
    reference.viewport?.height !== 960 ||
    reference.viewport?.dpr !== 1
  )
    block("REFERENCE_VIEWPORT_UNQUALIFIED");
  if (
    !reference.hardware?.cpu ||
    !reference.hardware?.gpu ||
    !reference.hardware?.os ||
    !finite(reference.hardware?.ramBytes)
  )
    block("REFERENCE_METADATA_MISSING");
  if (!report.build?.commit || !report.build?.sha256 || !report.fixture?.sha256)
    block("BUILD_OR_FIXTURE_IDENTITY_MISSING");
  const mapping = report.presentationMapping ?? {};
  if (
    mapping.status !== "supported" ||
    mapping.method !== "chromium-surface-frame-id-v1" ||
    !nonempty(mapping.traceSha256) ||
    mapping.clock?.calibrated !== true
  )
    block("EXACT_PRESENTATION_MAPPING_UNAVAILABLE");
  for (const id of requirements.requiredChecks ?? []) {
    const check = report.functional?.checks?.find((c) => c.id === id);
    if (!check || check.passed !== true)
      fail("FUNCTIONAL_CHECK_MISSING_OR_FAILED", { check: id });
  }
  const runs = Array.isArray(report.runs) ? report.runs : [];
  if (runs.length < requirements.independentRuns)
    fail("INSUFFICIENT_INDEPENDENT_RUNS", {
      actual: runs.length,
      required: requirements.independentRuns,
    });
  const identities = runs.map((r) => r.instanceId);
  if (
    identities.some((id) => !nonempty(id)) ||
    new Set(identities).size !== runs.length
  )
    fail("RUNS_NOT_INDEPENDENT");
  for (const spec of requirements.scenarios) {
    let total = 0;
    for (const run of runs) {
      const context = { run: run.id, scenario: spec.id };
      const scenarios = (run.scenarios ?? []).filter((s) => s.id === spec.id);
      if (scenarios.length !== 1) {
        fail("MISSING_OR_DUPLICATE_SCENARIO", context);
        continue;
      }
      const scenario = scenarios[0];
      const samples = Array.isArray(scenario.samples) ? scenario.samples : [];
      total += samples.length;
      if (samples.length < spec.minSamples)
        fail("INSUFFICIENT_SAMPLES", {
          ...context,
          actual: samples.length,
          required: spec.minSamples,
        });
      if (
        spec.minDurationMs &&
        (!finite(scenario.durationMs) ||
          scenario.durationMs < spec.minDurationMs)
      )
        fail("INSUFFICIENT_NAVIGATION_DURATION", context);
      if (scenario.droppedEvents !== 0)
        fail("OBSERVATION_EVENTS_MISSING", context);
      if (new Set(samples.map((s) => s.inputId)).size !== samples.length)
        fail("DUPLICATE_INPUT_SAMPLES", context);
      if (
        spec.kind === "cold" &&
        (samples.some((s) => s.navigationId === undefined) ||
          new Set(samples.map((s) => s.navigationId)).size !== samples.length)
      )
        fail("COLD_TARGETS_NOT_INDEPENDENT", context);
      const latency = [],
        ready = [],
        totalCold = [];
      const byInputKind = new Map();
      let missing = 0;
      for (const sample of samples) {
        const detail = { ...context, inputId: sample.inputId };
        if (sample.timeout === true) fail("SAMPLE_TIMEOUT", detail);
        if (
          !finite(sample.createdAt) ||
          !finite(sample.handlerAt) ||
          sample.handlerAt < sample.createdAt
        ) {
          fail("INVALID_INPUT_CLOCK", detail);
          continue;
        }
        if (spec.kind !== "navigation") {
          if (!finite(sample.modelAt) || !finite(sample.submissionAt)) {
            fail("MISSING_MODEL_OR_SUBMISSION", detail);
            missing++;
          } else if (
            sample.modelAt < sample.createdAt ||
            sample.submissionAt < sample.modelAt ||
            sample.submittedRevision !== sample.revision
          )
            fail("STALE_OR_INVALID_SUBMISSION", detail);
        }
        let validColdBoundary = true;
        if (spec.kind === "cold") {
          validColdBoundary =
            sample.coldBeforeNavigation === true &&
            finite(sample.navigationAt) &&
            finite(sample.readyAt) &&
            sample.readyAt >= sample.navigationAt &&
            sample.createdAt >= sample.readyAt;
          if (!validColdBoundary)
            fail("INVALID_COLD_NAVIGATION_BOUNDARY", detail);
          else {
            ready.push(sample.readyAt - sample.navigationAt);
            if (sample.readyAt - sample.navigationAt > 2000)
              fail("COLD_MAXIMUM_EXCEEDED", detail);
          }
        }
        const p = sample.presentation;
        if (!p || !finite(p.at)) {
          block("MISSING_PRESENTATION", detail);
          missing++;
          continue;
        }
        if (
          p.evidence !== "chromium-presented-frame" ||
          p.state !== "presented-all" ||
          p.inputId !== sample.inputId ||
          p.frameId !== sample.frameId ||
          p.sessionId !== sample.sessionId ||
          p.revision !== sample.revision ||
          !nonempty(p.surfaceFrameTraceId) ||
          !nonempty(p.displayTraceId)
        ) {
          fail("UNMATCHED_OR_STALE_PRESENTATION", detail);
          continue;
        }
        if (
          !finite(sample.submissionAt) ||
          p.at < sample.submissionAt ||
          p.at < sample.createdAt
        ) {
          fail("INVALID_PRESENTATION_CLOCK", detail);
          continue;
        }
        const duration = p.at - sample.createdAt;
        latency.push(duration);
        const kindSamples = byInputKind.get(sample.inputKind) ?? [];
        kindSamples.push(duration);
        byInputKind.set(sample.inputKind, kindSamples);
        if (spec.kind === "cold" && validColdBoundary) {
          totalCold.push(p.at - sample.navigationAt);
          if (p.at - sample.navigationAt > 2000)
            fail("COLD_MAXIMUM_EXCEEDED", detail);
        }
      }
      const result = {
        ...context,
        sampleCount: samples.length,
        missing,
        inputToPresentationMs: distribution(latency),
      };
      if (spec.kind === "edit" && result.inputToPresentationMs.p95 > 50)
        fail("WARM_P95_EXCEEDED", {
          ...context,
          actual: result.inputToPresentationMs.p95,
        });
      if (spec.requiredInputKinds) {
        result.inputKinds = {};
        for (const kind of spec.requiredInputKinds) {
          const count = samples.filter((s) => s.inputKind === kind).length;
          const timings = distribution(byInputKind.get(kind) ?? []);
          result.inputKinds[kind] = {
            sampleCount: count,
            inputToPresentationMs: timings,
          };
          if (count < spec.minSamples)
            fail("INSUFFICIENT_INPUT_KIND_SAMPLES", {
              ...context,
              inputKind: kind,
              actual: count,
              required: spec.minSamples,
            });
          if (spec.kind === "edit" && timings.p95 > 50)
            fail("INPUT_KIND_P95_EXCEEDED", {
              ...context,
              inputKind: kind,
              actual: timings.p95,
            });
        }
      }
      if (spec.kind === "cold") {
        result.navigationToReadyMs = distribution(ready);
        result.navigationToPresentationMs = distribution(totalCold);
        if (result.navigationToReadyMs.p95 > 500)
          fail("COLD_READY_P95_EXCEEDED", context);
        if (result.navigationToPresentationMs.p95 > 750)
          fail("COLD_PRESENTATION_P95_EXCEEDED", context);
      }
      if (spec.kind === "navigation") {
        if (
          !Array.isArray(scenario.cpuWorkMs) ||
          scenario.cpuWorkMs.some((v) => !finite(v) || v < 0) ||
          !Array.isArray(scenario.presentationFrameIntervalsMs) ||
          scenario.presentationFrameIntervalsMs.some((v) => !finite(v) || v < 0)
        )
          fail("INVALID_NAVIGATION_SAMPLES", context);
        const cpu = distribution(
            Array.isArray(scenario.cpuWorkMs) ? scenario.cpuWorkMs : [],
          ),
          frames = distribution(
            Array.isArray(scenario.presentationFrameIntervalsMs)
              ? scenario.presentationFrameIntervalsMs
              : [],
          );
        result.cpuWorkMs = cpu;
        result.presentationFrameIntervalsMs = frames;
        if (!cpu.count || !frames.count)
          block("NAVIGATION_MEASUREMENT_MISSING", context);
        if (cpu.p95 > 8 || frames.p95 > 20 || frames.maximum > 100)
          fail("NAVIGATION_TARGET_EXCEEDED", context);
        if (
          scenario.authorChanges !== 0 ||
          scenario.cameraBlockedOnStore !== false
        )
          fail("NAVIGATION_AUTHOR_OR_STORE_DEPENDENCY", context);
      }
      groups.push(result);
    }
    if (spec.minTotalSamples && total < spec.minTotalSamples)
      fail("INSUFFICIENT_TOTAL_SAMPLES", {
        scenario: spec.id,
        actual: total,
        required: spec.minTotalSamples,
      });
  }
  return {
    scope: requirements.scope,
    status: failures.length ? "FAIL" : blockers.length ? "BLOCKED" : "PASS",
    passed: failures.length === 0 && blockers.length === 0,
    failures,
    blockers,
    groups,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const file = process.argv[2];
  if (!file) {
    console.error(
      "Usage: node scripts/atlas-p0-evaluate.mjs <report.json> [evaluation.json]",
    );
    process.exitCode = 2;
  } else {
    try {
      const result = evaluateAcceptance(
        JSON.parse(await readFile(file, "utf8")),
      );
      if (process.argv[3])
        await writeFile(process.argv[3], JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.passed
        ? 0
        : result.status === "BLOCKED"
          ? 2
          : 1;
    } catch (error) {
      console.error(String(error));
      process.exitCode = 1;
    }
  }
}
