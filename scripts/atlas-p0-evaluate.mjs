import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

/**
 * The executable evaluator owns its contracts. Optional report fields remain
 * runtime-validated: a TypeScript annotation must never turn missing evidence
 * into a successful check. Consumers infer these declarations from this module.
 *
 * @typedef {object} ScenarioRequirement
 * @property {string} id
 * @property {string} kind
 * @property {number} minSamples
 * @property {number} [minDurationMs]
 * @property {number} [minTotalSamples]
 * @property {readonly string[]} [requiredInputKinds]
 *
 * @typedef {object} Requirements
 * @property {string} scope
 * @property {number} independentRuns
 * @property {readonly ScenarioRequirement[]} scenarios
 * @property {readonly string[]} [requiredChecks]
 * @property {{minimumSourceTiles: readonly number[], tileBytes: number, sourceBudgetBytes: number}} [scaling]
 * @property {readonly {fault: string, primaryCheck: string, primaryFailureCode: string}[]} [requiredFaultControls]
 *
 * @typedef {{code: string, inputId?: number | string | null, [detail: string]: unknown}} EvaluationIssue
 * @typedef {{milliseconds: number, limitMs: number, code?: string, inputId?: number | string | null, inputKind?: string, navigationId?: number}} TimingOutlier
 * @typedef {{count: number, invalid: number, p50: number | null, p95: number | null, p99: number | null, maximum: number | null}} Distribution
 *
 * @typedef {object} AcceptanceGroup
 * @property {string} run
 * @property {string} scenario
 * @property {number} sampleCount
 * @property {number} missing
 * @property {Distribution} inputToPresentationMs
 * @property {Record<string, {sampleCount: number, inputToPresentationMs: Distribution}>} [inputKinds]
 * @property {number} [navigationCount]
 * @property {Distribution} [navigationToReadyMs]
 * @property {Distribution} [readyToInputMs]
 * @property {Distribution} [navigationToPresentationMs]
 * @property {Distribution} [firstInputToPresentationMs]
 * @property {Distribution} [cpuWorkMs]
 * @property {Distribution} [presentationFrameIntervalsMs]
 *
 * @typedef {object} AcceptanceReport
 * @property {string} scope
 * @property {"FAIL" | "BLOCKED" | "PASS"} status
 * @property {boolean} passed
 * @property {EvaluationIssue[]} failures
 * @property {EvaluationIssue[]} blockers
 * @property {AcceptanceGroup[]} groups
 */

export const P0_FUNCTIONAL_CHECKS = Object.freeze([
  "canonical-fixture",
  "coarse-preserves-fine",
  "undo-redo",
  "save-reopen",
  "process-restart",
  "cold-before-navigation",
  "busy-worker-and-save",
  "terrain-pixels",
  "empty-navigation-grid-on",
  "empty-navigation-grid-off",
  "coarse-exact-values",
  "cold-edit-after-navigation",
  "worker-and-save-executed",
  "visible-zoom",
  "pan-anchor",
  "continuous-stroke-live",
  "continuous-stroke-undo",
  "held-dose-response",
  "movement-duration-response",
  "large-brush-live",
  "large-brush-dose",
  "consecutive-author-levels",
  "curved-stroke-content",
  "cold-edit-content",
  "cold-blocked-inputs",
  "world-detail-roundtrip",
]);

/**
 * These are requirements, never inferred from whichever samples happened to arrive.
 * @satisfies {Requirements}
 */
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
      id: "M03-height-max",
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
      requiredInputKinds: ["edit", "pointerup"],
    },
    {
      id: "M10-height-cold-busy",
      kind: "cold",
      minSamples: 30,
      minTotalSamples: 100,
      requiredInputKinds: ["edit", "pointerup"],
    },
  ],
  requiredChecks: P0_FUNCTIONAL_CHECKS,
  scaling: {
    minimumSourceTiles: [32, 1024, 9000],
    tileBytes: 64 * 64 * 8,
    sourceBudgetBytes: 256 * 1024 * 1024,
  },
  requiredFaultControls: [
    {
      fault: "ignore-zoom",
      primaryCheck: "visible-zoom",
      primaryFailureCode: "ZOOM_DID_NOT_CHANGE_SCALE",
    },
    {
      fault: "pointerup-render",
      primaryCheck: "continuous-stroke-live",
      primaryFailureCode: "LIVE_TERRAIN_NOT_VISIBLE_BEFORE_RELEASE",
    },
  ],
});

/**
 * One selection drives execution, fixtures, the run index and scoped checks.
 * @param {string} [selection]
 * @param {string | null} [scenarioId]
 */
export function selectP0Scope(selection = "all", scenarioId = null) {
  if (!["all", "interactions", "collection", "scaling"].includes(selection))
    throw new Error(`Unknown P0 selection: ${selection}`);
  if (
    scenarioId !== null &&
    (selection !== "collection" ||
      !P0_REQUIREMENTS.scenarios.some(
        (spec) => spec.id === scenarioId && spec.kind !== "navigation",
      ))
  )
    throw new Error(`Unknown collection selection: ${scenarioId}`);
  const interactions = selection === "all" || selection === "interactions";
  const collection = selection === "all" || selection === "collection";
  const scenarios = P0_REQUIREMENTS.scenarios.filter(
    (spec) =>
      (spec.kind === "navigation" ? interactions : collection) &&
      (scenarioId === null || spec.id === scenarioId),
  );
  const collectionChecks = new Set([
    "cold-before-navigation",
    "busy-worker-and-save",
    "cold-edit-after-navigation",
    "worker-and-save-executed",
    "cold-edit-content",
    "cold-blocked-inputs",
  ]);
  return {
    navigation: interactions,
    workflow: interactions,
    controls: interactions,
    collection,
    scaling: selection === "all" || selection === "scaling",
    scenarios,
    needsBaseFixture: interactions || collection,
    needsBusyFixture:
      collection && scenarios.some((spec) => spec.id.endsWith("-busy")),
    requiredChecks: interactions
      ? P0_FUNCTIONAL_CHECKS.filter(
          (id) => collection || !collectionChecks.has(id),
        )
      : [],
  };
}

/** @param {unknown} value @returns {value is number} */
const finite = (value) => typeof value === "number" && Number.isFinite(value);
/** @param {unknown} value @returns {value is string} */
const nonempty = (value) => typeof value === "string" && value.length > 0;

/** Missing measurements are handled by their evidence check, not a numeric limit.
 * @param {number | null} value
 * @param {number} limit
 */
const exceeds = (value, limit) => value !== null && value > limit;

/** A release run can use several processes; control processes are never repetitions. */
function releaseRuns(report, fail) {
  const processes = (Array.isArray(report.runs) ? report.runs : []).filter(
    (run) => run.role !== "control",
  );
  const identities = processes.map((run) => run.instanceId);
  if (
    identities.some((id) => !nonempty(id)) ||
    new Set(identities).size !== processes.length
  )
    fail("RUNS_NOT_INDEPENDENT");
  const groups = new Map();
  for (const process of processes) {
    if (!nonempty(process.independentRunId)) {
      fail("INDEPENDENT_RUN_ID_MISSING", { run: process.id });
      continue;
    }
    let group = groups.get(process.independentRunId);
    if (!group) {
      group = { id: process.independentRunId, scenarios: [] };
      groups.set(process.independentRunId, group);
    }
    if (!Array.isArray(process.scenarios)) {
      fail("RUN_SCENARIOS_MISSING", { run: process.id });
      continue;
    }
    group.scenarios.push(...process.scenarios);
  }
  return [...groups.values()];
}

/** Validate reported facts once; selected and native gates add their own coverage. */
function functionalFacts(report) {
  /** @type {EvaluationIssue[]} */
  const failures = [];
  const fail = (code, detail = {}) => failures.push({ code, ...detail });
  if (report.errors !== undefined && !Array.isArray(report.errors))
    fail("RUNNER_ERRORS_INVALID");
  for (const error of Array.isArray(report.errors) ? report.errors : [])
    fail("RUNNER_OR_PRODUCT_FAILURE", { error });
  const runs = releaseRuns(report, fail);
  const checks = Array.isArray(report.functional?.checks)
    ? report.functional.checks
    : [];
  const runIds = new Set(runs.map((run) => run.id));
  const checksByIdentity = new Map();
  for (const check of checks) {
    const detail = { run: check.independentRunId, check: check.id };
    if (!nonempty(check.id)) fail("FUNCTIONAL_CHECK_ID_MISSING", detail);
    if (!runIds.has(check.independentRunId))
      fail("FUNCTIONAL_RUN_IDENTITY_MISSING", detail);
    const identity = `${check.independentRunId}:${check.id}`;
    const previous = checksByIdentity.get(identity);
    if (previous) fail("DUPLICATE_FUNCTIONAL_CHECK", detail);
    checksByIdentity.set(identity, {
      check,
      count: (previous?.count ?? 0) + 1,
    });
    if (check.passed !== true) fail("FUNCTIONAL_CHECK_FAILED", detail);
    if (
      check.id === "continuous-stroke-live" &&
      (check.liveBeforeRelease !== true ||
        !finite(check.firstLiveAt) ||
        check.firstLiveAt < 0 ||
        !finite(check.releasedAt) ||
        check.firstLiveAt >= check.releasedAt ||
        !Number.isInteger(check.checkedIntermediateStates) ||
        check.checkedIntermediateStates < 2)
    )
      fail("CONTINUOUS_STROKE_LIVE_EVIDENCE_MISSING", detail);
  }
  const controls = Array.isArray(report.negativeControls)
    ? report.negativeControls
    : [];
  for (const control of controls)
    if (control.passed !== true)
      fail("FAULT_CONTROL_FAILED", { fault: control.fault });
  return {
    failures,
    runs,
    checksByIdentity,
    controls,
    scaling: report.scaling,
  };
}

/** @param {Requirements} requirements */
function functionalVerdict(facts, requirements) {
  const failures = [...facts.failures];
  const fail = (code, detail = {}) => failures.push({ code, ...detail });
  const { runs, checksByIdentity, controls } = facts;
  const required = requirements.requiredChecks ?? [];
  if (required.length && !runs.length) fail("FUNCTIONAL_RUN_MISSING");
  for (const run of runs)
    for (const id of required) {
      const match = checksByIdentity.get(`${run.id}:${id}`);
      if (match?.count !== 1 || match.check.passed !== true)
        fail("FUNCTIONAL_CHECK_MISSING_OR_FAILED", { run: run.id, check: id });
    }

  const scalingSpec = requirements.scaling;
  if (scalingSpec) {
    const scaling = facts.scaling ?? {};
    const cases = Array.isArray(scaling.cases) ? scaling.cases : [];
    const minimums = scalingSpec.minimumSourceTiles;
    if (scaling.passed !== true) fail("SCALING_FAILED_OR_MISSING");
    if (cases.length < minimums.length)
      fail("SCALING_CASES_MISSING", {
        actual: cases.length,
        required: minimums.length,
      });
    const ids = new Set();
    const sizes = new Set();
    for (const entry of cases) {
      const detail = { case: entry.id };
      if (!nonempty(entry.id) || ids.has(entry.id))
        fail("SCALING_CASE_ID_MISSING_OR_DUPLICATE", detail);
      ids.add(entry.id);
      if (
        !Number.isSafeInteger(entry.sourceTiles) ||
        entry.sourceTiles <= 0 ||
        sizes.has(entry.sourceTiles) ||
        !finite(entry.decodedBytes) ||
        entry.decodedBytes < entry.sourceTiles * scalingSpec.tileBytes
      )
        fail("SCALING_CASE_SIZE_INVALID", detail);
      sizes.add(entry.sourceTiles);
      if (entry.passed !== true || entry.error != null)
        fail("SCALING_CASE_FAILED", detail);
      // A larger fixture is only useful if interaction keeps its active working
      // set bounded. Raising the reader cap to decode the entire fixture is not
      // an implementation of the plan's coarse/fine scaling requirement.
      for (const stage of ["coarseReadiness", "coarseEdit"]) {
        for (const field of [
          "documentSourceBytes",
          "rendererSourceBytes",
          "rendererGpuBytes",
        ]) {
          const bytes = entry[stage]?.[field];
          if (!finite(bytes) || bytes < 0)
            fail("SCALING_FOOTPRINT_MISSING_OR_INVALID", {
              ...detail,
              stage,
              field,
            });
          else if (bytes > scalingSpec.sourceBudgetBytes)
            fail("SCALING_SOURCE_BUDGET_EXCEEDED", {
              ...detail,
              stage,
              field,
              actual: bytes,
              maximum: scalingSpec.sourceBudgetBytes,
            });
        }
        const delta = entry.stageReadDeltas?.[stage];
        if (
          !delta ||
          ["reads", "returnedTiles", "returnedBytes"].some(
            (field) => !Number.isSafeInteger(delta[field]) || delta[field] < 0,
          )
        )
          fail("SCALING_SOURCE_READS_MISSING_OR_INVALID", { ...detail, stage });
        else if (
          delta.returnedBytes > scalingSpec.sourceBudgetBytes ||
          delta.returnedTiles >
            Math.floor(scalingSpec.sourceBudgetBytes / scalingSpec.tileBytes)
        )
          fail("SCALING_SOURCE_READ_BUDGET_EXCEEDED", {
            ...detail,
            stage,
            returnedTiles: delta.returnedTiles,
            returnedBytes: delta.returnedBytes,
            maximumBytes: scalingSpec.sourceBudgetBytes,
          });
      }
    }
    const ordered = [...cases].sort((a, b) => a.sourceTiles - b.sourceTiles);
    for (let i = 0; i < minimums.length; i++)
      if (!(ordered[i]?.sourceTiles >= minimums[i]))
        fail("SCALING_FIXTURE_TOO_SMALL", {
          case: ordered[i]?.id,
          requiredSourceTiles: minimums[i],
        });
    if (
      !cases.some((entry) => entry.decodedBytes > scalingSpec.sourceBudgetBytes)
    )
      fail("SCALING_SOURCE_BUDGET_NOT_EXERCISED", {
        sourceBudgetBytes: scalingSpec.sourceBudgetBytes,
      });
  }

  for (const spec of requirements.requiredFaultControls ?? []) {
    const matches = controls.filter((control) => control.fault === spec.fault);
    if (matches.length !== 1) {
      fail("FAULT_CONTROL_MISSING_OR_DUPLICATE", { fault: spec.fault });
      continue;
    }
    const control = matches[0];
    if (
      control.passed !== true ||
      control.observedFault !== spec.fault ||
      control.primaryCheck !== spec.primaryCheck ||
      control.primaryPassed !== false ||
      control.primaryFailureCode !== spec.primaryFailureCode ||
      control.error != null ||
      control.mutant?.error != null ||
      control.mutant?.failure != null ||
      control.recovery?.primaryCheck !== spec.primaryCheck ||
      control.recovery?.passed !== true ||
      control.recovery?.error != null
    )
      fail("FAULT_CONTROL_NOT_PROVEN", { fault: spec.fault });
  }
  return {
    status: failures.length ? "FAIL" : "PASS",
    passed: failures.length === 0,
    failures,
  };
}

/**
 * The laboratory gate also fails closed: passing timings cannot replace behavior.
 * @param {Requirements} [requirements]
 */
export function evaluateFunctional(report, requirements = P0_REQUIREMENTS) {
  return functionalVerdict(functionalFacts(report), requirements);
}

/** A package must identify its executed code; workspace metadata is no fallback. */
export function checkBuildIdentity(workspace, executed, provenance) {
  /** @type {EvaluationIssue[]} */
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

/** @param {readonly unknown[]} values @returns {Distribution} */
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

const pointValid = (point) =>
  Array.isArray(point) && point.length === 2 && point.every(finite);
const samePoint = (a, b) =>
  pointValid(a) &&
  pointValid(b) &&
  a.every((value, index) => Math.abs(value - b[index]) <= 1e-6);

/** Schema 5 records the complete accepted polyline, including zero-time anchors. */
function validBrushGeometry(interval) {
  const segments = interval?.segments;
  if (
    !pointValid(interval?.from) ||
    !pointValid(interval?.to) ||
    !finite(interval?.acceptedElapsedMs) ||
    !Array.isArray(segments) ||
    !segments.length
  )
    return false;
  let previous = interval.from;
  let elapsedMs = 0;
  for (const segment of segments) {
    if (
      !pointValid(segment?.from) ||
      !pointValid(segment?.to) ||
      !samePoint(previous, segment.from) ||
      !finite(segment?.elapsedMs) ||
      segment.elapsedMs < 0
    )
      return false;
    previous = segment.to;
    elapsedMs += segment.elapsedMs;
  }
  return (
    samePoint(previous, interval.to) &&
    Math.abs(elapsedMs - interval.acceptedElapsedMs) <= 1e-6
  );
}

/** One interpretation of input -> dose/commit -> local receipt -> real draw. */
export function extractSubmissionEvidence(events) {
  const inputs = new Map();
  const frames = new Map();
  const changesByInput = new Map();
  const doses = [];
  const commits = [];
  const receipts = [];
  for (const event of events) {
    if (event.kind === "input") inputs.set(event.id, event);
    if (event.kind === "submit")
      frames.set(`${event.sessionId}/${event.frame}`, event);
    if (event.kind === "brush-interval" && event.changed === true) {
      doses.push(event);
      for (const input of event.inputIds ?? [])
        changesByInput.set(input, event);
    }
    if (event.kind === "commit") {
      commits.push(event);
      changesByInput.set(event.input, event);
    }
    if (["brush-submit", "edit-submit"].includes(event.kind))
      receipts.push(event);
  }
  const publication = (change) => {
    const boundsValid = (bounds) =>
      Array.isArray(bounds) &&
      bounds.length === 4 &&
      bounds.every(finite) &&
      bounds[0] < bounds[2] &&
      bounds[1] < bounds[3];
    if (
      !nonempty(change?.sessionId) ||
      !Number.isSafeInteger(change.revision) ||
      change.revision < 0 ||
      !Number.isSafeInteger(change.gestureId)
    )
      return null;
    if (
      change.kind === "brush-interval"
        ? !Number.isSafeInteger(change.intervalId) ||
          !Array.isArray(change.inputIds) ||
          !validBrushGeometry(change) ||
          !boundsValid(change.bounds)
        : !Number.isSafeInteger(change.sequence) ||
          !Array.isArray(change.bounds) ||
          !change.bounds.length ||
          !change.bounds.every(boundsValid)
    )
      return null;
    const projectedAt =
      change.kind === "brush-interval" ? change.projectedAt : change.at;
    if (!finite(change.at) || !finite(projectedAt) || projectedAt < change.at)
      return null;
    for (const receipt of receipts) {
      if (
        receipt.sessionId !== change.sessionId ||
        receipt.revision !== change.revision
      )
        continue;
      if (
        change.kind === "brush-interval"
          ? receipt.kind !== "brush-submit" ||
            receipt.gestureId !== change.gestureId ||
            receipt.intervalId !== change.intervalId
          : receipt.kind !== "edit-submit" ||
            receipt.input !== change.input ||
            receipt.sequence !== change.sequence
      )
        continue;
      const frame = frames.get(`${receipt.sessionId}/${receipt.frame}`);
      const completion =
        change.kind === "commit" &&
        receipt.completionEvidence === "commit-current-terrain-v1" &&
        receipt.gestureId === change.gestureId &&
        receipt.submittedAt === frame?.at &&
        finite(receipt.completedAt) &&
        receipt.completedAt === Math.max(change.at, frame?.at) &&
        receipt.completedAt <= receipt.at;
      const ordinarySubmission =
        receipt.completionEvidence === undefined &&
        receipt.completedAt === undefined &&
        receipt.submittedAt === undefined &&
        frame?.at >= projectedAt;
      if (
        frame &&
        Number.isSafeInteger(frame.frame) &&
        frame.frame > 0 &&
        Number.isSafeInteger(frame.viewGeneration) &&
        frame.viewGeneration >= 0 &&
        receipt.viewGeneration === frame.viewGeneration &&
        frame.revision >= change.revision &&
        (completion || ordinarySubmission) &&
        finite(receipt.at) &&
        frame.at <= receipt.at
      )
        return {
          receipt,
          frame,
          completedAt: completion ? receipt.completedAt : null,
        };
    }
    return null;
  };
  return { inputs, frames, doses, commits, changesByInput, publication };
}

/** Missing inputs remain explicit samples; never flatMap away failed observations. */
export function extractEditSamples(
  events,
  inputIds,
  sessionId,
  evidence = extractSubmissionEvidence(events),
) {
  return inputIds.map((inputId) => {
    const input = evidence.inputs.get(inputId);
    const candidate = evidence.changesByInput.get(inputId);
    const model =
      candidate?.sessionId === sessionId &&
      candidate.kind ===
        (input?.inputKind === "pointerup" ? "commit" : "brush-interval")
        ? candidate
        : null;
    const noop = events.find(
      (e) =>
        e.kind === "noop" &&
        e.input === inputId &&
        (e.sessionId === undefined || e.sessionId === sessionId),
    );
    const published = evidence.publication(model);
    const edit = published?.receipt;
    const submit = published?.frame;
    const gesture = events.find(
      (start) =>
        start.kind === "brush-start" &&
        start.sessionId === sessionId &&
        start.input <= inputId &&
        start.at <= input?.at &&
        events.some(
          (end) =>
            end.kind === "brush-end" &&
            end.sessionId === sessionId &&
            end.gestureId === start.gestureId &&
            end.at >= (noop?.at ?? input?.at),
        ),
    );
    return {
      inputId,
      inputKind: input?.inputKind ?? null,
      eventType: input?.eventType ?? null,
      sessionId,
      gestureId: model?.gestureId ?? gesture?.gestureId ?? null,
      discardedDuringGesture: Boolean(noop && gesture),
      createdAt: input?.createdAt ?? null,
      handlerAt: input?.at ?? null,
      modelAt:
        model?.kind === "brush-interval"
          ? (model.projectedAt ?? null)
          : (model?.at ?? null),
      appliedAt: model?.at ?? null,
      modelChanged: model ? true : noop ? false : null,
      noopAt: noop?.at ?? null,
      accepted: model ? true : noop ? noop.accepted !== false : null,
      noopReason: noop?.reason ?? null,
      revision: model?.revision ?? null,
      sequence: model?.sequence ?? null,
      submissionAt: submit?.at ?? null,
      completedAt: published?.completedAt ?? null,
      completionEvidence: edit?.completionEvidence ?? null,
      completionObservedAt:
        published?.completedAt === null ? null : (edit?.at ?? null),
      frameId: edit?.frame ?? null,
      submittedRevision: edit?.revision ?? null,
      presentation: null,
      presentationStatus: "unproven",
    };
  });
}

/** A commit can finish on an earlier actual draw; an edit never can. */
function responseAt(sample) {
  if (sample.completionEvidence == null && sample.completedAt == null)
    return sample.submissionAt;
  if (
    sample.inputKind !== "pointerup" ||
    sample.completionEvidence !== "commit-current-terrain-v1" ||
    ![
      sample.modelAt,
      sample.submissionAt,
      sample.completedAt,
      sample.completionObservedAt,
    ].every(finite) ||
    sample.completedAt !== Math.max(sample.modelAt, sample.submissionAt) ||
    sample.completionObservedAt < sample.completedAt
  )
    return null;
  return sample.completedAt;
}

/** One navigation/gate extraction for collection, failed trials and journal replay. */
export function extractColdBoundary(events, navigationId, sessionId) {
  const navigation = events.find(
    (event) =>
      event.kind === "input" &&
      event.inputKind === "navigation" &&
      event.id === navigationId,
  );
  const sources = events.find(
    (event) =>
      event.kind === "sources-ready" &&
      event.input === navigationId &&
      event.sessionId === sessionId,
  );
  const gate = events.find(
    (event) =>
      event.kind === "input-ready" &&
      event.input === navigationId &&
      event.sessionId === sessionId,
  );
  const submit =
    gate &&
    events.find(
      (event) =>
        event.kind === "submit" &&
        event.sessionId === sessionId &&
        event.frame === gate.frame &&
        event.viewGeneration === gate.viewGeneration &&
        event.revision >= gate.revision &&
        event.at <= gate.at &&
        event.at >= navigation?.at,
    );
  const view =
    gate &&
    events.findLast(
      (event) =>
        event.kind === "view-change" &&
        event.sessionId === sessionId &&
        event.at <= gate.at,
    );
  return {
    coldFirst: true,
    navigationId,
    navigationAt: navigation?.createdAt ?? null,
    sourcesAt: sources?.at ?? null,
    gateAt: gate?.at ?? null,
    gateSubmissionAt: submit?.at ?? null,
    gateFrameId: gate?.frame ?? null,
    gateRevision: gate?.revision ?? null,
    gateViewGeneration: gate?.viewGeneration ?? null,
    gateSessionId: gate?.sessionId ?? null,
    gateEvidence:
      submit && view?.viewGeneration === gate.viewGeneration
        ? "local-terrain-submit-v1"
        : null,
    // These require a separate native frame join. A product gate is not a
    // presentation receipt, and neither a screenshot nor a later input fills it.
    readyAt: null,
    readyPresentation: null,
  };
}

/**
 * @param events Raw observation journal; evidence is checked below.
 * @param samples Extracted samples, including explicitly missing evidence.
 * @param {{sessionId?: string, afterInputId?: number, coldBeforeNavigation?: boolean}} [options]
 */
export function extractColdSamples(
  events,
  samples,
  { sessionId, afterInputId = -1, coldBeforeNavigation = false } = {},
) {
  const navigation = events.filter(
    (event) =>
      event.kind === "input" &&
      event.inputKind === "navigation" &&
      event.id > afterInputId,
  );
  const firsts = new Map();
  for (let index = 0; index < navigation.length; index++) {
    const event = navigation[index];
    const first = samples.find(
      (sample) =>
        sample.inputKind === "edit" &&
        sample.inputId > event.id &&
        sample.inputId < (navigation[index + 1]?.id ?? Infinity),
    );
    if (first)
      firsts.set(first.inputId, {
        ...extractColdBoundary(events, event.id, first.sessionId ?? sessionId),
        coldBeforeNavigation,
      });
  }
  return samples.map((sample) => ({
    ...sample,
    ...firsts.get(sample.inputId),
  }));
}

const coldFirstSamples = (samples) =>
  samples.filter(
    (sample) => sample.coldFirst === true || sample.navigationId !== undefined,
  );

function validColdGate(sample) {
  return (
    sample.coldBeforeNavigation === true &&
    sample.gateEvidence === "local-terrain-submit-v1" &&
    sample.gateSessionId === sample.sessionId &&
    Number.isSafeInteger(sample.navigationId) &&
    Number.isSafeInteger(sample.gateFrameId) &&
    Number.isSafeInteger(sample.gateRevision) &&
    Number.isSafeInteger(sample.gateViewGeneration) &&
    [
      sample.navigationAt,
      sample.sourcesAt,
      sample.gateSubmissionAt,
      sample.gateAt,
      sample.createdAt,
    ].every(finite) &&
    sample.sourcesAt >= sample.navigationAt &&
    sample.sourcesAt <= sample.gateAt &&
    sample.gateSubmissionAt >= sample.navigationAt &&
    sample.gateAt >= sample.gateSubmissionAt &&
    sample.createdAt >= sample.gateAt &&
    sample.gateRevision < sample.revision
  );
}

/** An explicit processed no-op is complete input evidence, never an edit/submit. */
export function isProcessedNoop(sample) {
  return (
    sample.modelChanged === false &&
    nonempty(sample.sessionId) &&
    [sample.createdAt, sample.handlerAt, sample.noopAt].every(finite) &&
    sample.createdAt <= sample.handlerAt &&
    sample.handlerAt <= sample.noopAt &&
    !finite(sample.modelAt) &&
    !finite(sample.submissionAt)
  );
}

/** D10 may discard sampled movement; it never certifies an edit or a lost press. */
function isD10Discard(sample) {
  return (
    isProcessedNoop(sample) &&
    sample.accepted === false &&
    sample.inputKind === "edit" &&
    sample.eventType === "pointermove" &&
    Number.isSafeInteger(sample.gestureId) &&
    sample.discardedDuringGesture === true &&
    ["coalesced", "stale", "feedback", "overflow"].includes(sample.noopReason)
  );
}

/** D11 rejection is a separate behavior case, never a successful edit sample. */
export function evaluateBlockedInput(evidence = {}) {
  /** @type {EvaluationIssue[]} */
  const issues = [];
  const fail = (code) => issues.push({ code });
  if (evidence.error) fail("BLOCKED_INPUT_COLLECTION_ERROR");
  const samples = Array.isArray(evidence.samples) ? evidence.samples : [];
  const first = samples[0];
  const up = samples.at(-1);
  if (
    samples.length < 3 ||
    first?.eventType !== "pointerdown" ||
    up?.eventType !== "pointerup" ||
    !samples.some((sample) => sample.eventType === "pointermove") ||
    !samples.every(isProcessedNoop) ||
    !samples.every((sample) => sample.accepted === false) ||
    !["sources", "terrain"].includes(first?.noopReason) ||
    !finite(evidence.gateAt) ||
    !(first?.createdAt < evidence.gateAt) ||
    typeof evidence.holdUntilReady !== "boolean" ||
    (evidence.holdUntilReady
      ? !(up?.createdAt >= evidence.gateAt)
      : !(up?.createdAt < evidence.gateAt))
  )
    fail("BLOCKED_INPUT_RECEIPTS_INVALID");
  const waiting = evidence.waiting;
  if (
    waiting?.readiness?.ready !== false ||
    !["sources", "terrain"].includes(waiting?.readiness?.reason) ||
    waiting?.statusVisible !== true ||
    !/geladen|lädt/i.test(waiting?.statusText ?? "")
  )
    fail("BLOCKED_WAIT_STATE_UNPROVEN");
  if (
    evidence.ready?.readiness?.ready !== true ||
    evidence.settled?.readiness?.ready !== true ||
    (evidence.holdUntilReady && evidence.ready?.needsPress !== true) ||
    evidence.settled?.needsPress !== false
  )
    fail("BLOCKED_READINESS_OR_RELEASE_UNPROVEN");
  const heldHint = evidence.heldHint;
  if (
    evidence.holdUntilReady &&
    (heldHint?.readiness?.ready !== true ||
      heldHint?.needsPress !== true ||
      heldHint?.statusVisible !== true ||
      !(heldHint?.statusText ?? "").includes(
        "Zum Bearbeiten loslassen und erneut drücken",
      ) ||
      !finite(heldHint?.observedAt) ||
      !(heldHint.observedAt >= evidence.gateAt) ||
      !(heldHint.observedAt <= up?.createdAt))
  )
    fail("BLOCKED_HELD_HINT_UNPROVEN");
  const before = evidence.before;
  for (const stage of [
    evidence.ready,
    ...(evidence.holdUntilReady && heldHint ? [heldHint] : []),
    evidence.settled,
  ]) {
    if (
      !before ||
      !stage ||
      stage.sessionId !== before.sessionId ||
      stage.document?.active !== false ||
      ["revision", "sequence", "historyActions", "canUndo", "canRedo"].some(
        (key) =>
          before.document?.[key] === undefined ||
          stage.document?.[key] !== before.document[key],
      )
    ) {
      fail("BLOCKED_INPUT_CHANGED_DOCUMENT");
      break;
    }
  }
  if (!Array.isArray(evidence.mutationEvents) || evidence.mutationEvents.length)
    fail("BLOCKED_INPUT_REPLAYED");
  const recovery = evidence.recovery;
  if (
    recovery?.timePassed !== true ||
    recovery?.eventType !== "pointerdown" ||
    !(recovery?.createdAt > up?.createdAt) ||
    !(recovery?.modelAt >= recovery?.createdAt) ||
    !(recovery?.heightAfter > recovery?.heightBefore) ||
    recovery?.sequenceAfter !== before?.document?.sequence + 1 ||
    recovery?.historyAfter !== before?.document?.historyActions + 1
  )
    fail("BLOCKED_INPUT_RECOVERY_FAILED");
  return { passed: issues.length === 0, issues };
}

/** One unpublished dose per session, including across gesture boundaries. */
export function evaluateBrushPublicationOrder(events, sessionId) {
  const evidence = extractSubmissionEvidence(events);
  const intervals = events.filter(
    (e) =>
      e.kind === "brush-interval" &&
      (sessionId === undefined || e.sessionId === sessionId) &&
      e.changed === true,
  );
  const issues = [],
    steps = [];
  const previousBySession = new Map();
  for (const interval of intervals) {
    const previous = previousBySession.get(interval.sessionId);
    const receipt = evidence.publication(interval)?.receipt;
    const validBounds = (bounds) =>
      Array.isArray(bounds) &&
      bounds.length === 4 &&
      bounds.every(finite) &&
      bounds[0] < bounds[2] &&
      bounds[1] < bounds[3];
    const retired = events.find(
      (e) =>
        e.kind === "brush-feedback-obsolete" &&
        e.sessionId === interval.sessionId &&
        e.gestureId === interval.gestureId &&
        e.intervalId === interval.intervalId &&
        e.revision === interval.revision &&
        e.reason === "outside-view" &&
        Number.isSafeInteger(e.viewGeneration) &&
        e.at >= interval.at &&
        validBounds(e.bounds) &&
        validBounds(e.viewBounds) &&
        !(
          e.bounds[0] < e.viewBounds[2] &&
          e.bounds[2] > e.viewBounds[0] &&
          e.bounds[1] < e.viewBounds[3] &&
          e.bounds[3] > e.viewBounds[1]
        ) &&
        events.some(
          (view, index) =>
            index > events.indexOf(interval) &&
            index < events.indexOf(e) &&
            view.kind === "view-change" &&
            view.sessionId === interval.sessionId &&
            view.viewGeneration === e.viewGeneration &&
            view.at <= e.at &&
            validBounds(view.bounds) &&
            view.bounds.every((value, i) => value === e.viewBounds[i]),
        ),
    );
    const resolvedEvent = Math.min(
      receipt ? events.indexOf(receipt) : Infinity,
      retired ? events.indexOf(retired) : Infinity,
    );
    const step = {
      intervalId: interval.intervalId,
      gestureId: interval.gestureId,
      sessionId: interval.sessionId,
      modelAt: interval.at,
      frameId: receipt?.frame ?? null,
      submittedAt: receipt?.at ?? null,
      retiredAt: retired?.at ?? null,
      retiredReason: retired?.reason ?? null,
      modelEvent: events.indexOf(interval),
      submitEvent: receipt ? events.indexOf(receipt) : null,
      resolvedEvent: Number.isFinite(resolvedEvent) ? resolvedEvent : null,
    };
    if (!receipt && !retired)
      issues.push({
        code: "BRUSH_STEP_SUBMISSION_MISSING",
        intervalId: interval.intervalId,
      });
    if (
      previous &&
      (previous.resolvedEvent === null ||
        previous.resolvedEvent >= step.modelEvent)
    )
      issues.push({
        code: "MULTIPLE_UNPUBLISHED_BRUSH_STEPS",
        intervalId: interval.intervalId,
        previousIntervalId: previous.intervalId,
      });
    steps.push(step);
    previousBySession.set(interval.sessionId, step);
  }
  return { passed: issues.length === 0, issues, steps };
}

/** Account for real accepted/discarded time; nominal press dose is separate. */
export function evaluateBrushTime(events, inputIds, sessionId) {
  const issues = [],
    wanted = new Set(inputIds),
    epsilon = 1e-6;
  const inputs = events.filter((e) => e.kind === "input" && wanted.has(e.id));
  const down = inputs.find((e) => e.inputKind === "edit");
  const up = inputs.find((e) => e.inputKind === "pointerup");
  const starts = events.filter(
    (e) =>
      e.kind === "brush-start" &&
      e.sessionId === sessionId &&
      e.input === down?.id,
  );
  const start = starts[0];
  const own = (e) =>
    e.sessionId === sessionId && e.gestureId === start?.gestureId;
  const ends = events.filter((e) => e.kind === "brush-end" && own(e));
  const end = ends[0];
  // Input facts precede the handler's effects. Tie this release to this
  // gesture's end; a final dose inside the release handler is already too late.
  const releaseEvent = up && end?.input === up.id ? events.indexOf(up) : -1;
  const fail = (code, detail = {}) => issues.push({ code, ...detail });
  if (starts.length !== 1 || ends.length !== 1)
    fail("BRUSH_TIME_BOUNDARIES_MISSING");
  if (!down || !up || end?.input !== up.id) fail("BRUSH_RELEASE_UNPROVEN");
  if (
    ![start?.startAt, end?.endAt, start?.inputAt, end?.inputAt].every(finite) ||
    end.endAt < start.startAt ||
    Math.abs(start.inputAt - down?.createdAt) > epsilon ||
    Math.abs(end.inputAt - up?.createdAt) > epsilon ||
    start.startAt < start.inputAt ||
    end.endAt < end.inputAt
  )
    fail("INVALID_BRUSH_TIME_CLOCK");
  const intervals = events.filter((e) => e.kind === "brush-interval" && own(e));
  const discarded = events.filter((e) => e.kind === "brush-discard" && own(e));
  if (!intervals.length) fail("BRUSH_DOSE_MISSING");
  if (new Set(intervals.map((e) => e.intervalId)).size !== intervals.length)
    fail("DUPLICATE_BRUSH_INTERVAL");
  const point = (p) => Array.isArray(p) && p.length === 2 && p.every(finite);
  const validIntervals = [],
    spans = [],
    submissions = [];
  const publication = evaluateBrushPublicationOrder(events, sessionId);
  issues.push(...publication.issues);
  let acceptedMs = 0,
    timedDoseMs = 0,
    pressDoseMs = 0,
    acceptedDoseFt = 0;
  for (const interval of intervals) {
    const detail = { intervalId: interval.intervalId };
    const press = interval.cause === "press";
    const valid =
      [
        interval.fromAt,
        interval.toAt,
        interval.acceptedElapsedMs,
        interval.rawElapsedMs,
        interval.rateFtPerSecond,
        interval.at,
      ].every(finite) &&
      interval.toAt >= interval.fromAt &&
      interval.fromAt >= start?.startAt - epsilon &&
      interval.toAt <= end?.endAt + epsilon &&
      interval.at >= interval.toAt &&
      interval.acceptedElapsedMs > 0 &&
      interval.acceptedElapsedMs <= 50 + epsilon &&
      Number.isSafeInteger(interval.intervalId) &&
      Number.isSafeInteger(interval.revision) &&
      typeof interval.changed === "boolean" &&
      interval.rateFtPerSecond === start?.rateFtPerSecond &&
      validBrushGeometry(interval) &&
      Array.isArray(interval.inputIds) &&
      interval.inputIds.every((id) => wanted.has(id)) &&
      (press
        ? interval.nominalDose === true &&
          interval.fromAt === interval.toAt &&
          interval.rawElapsedMs === 0 &&
          Math.abs(interval.acceptedElapsedMs - 1000 / 60) < epsilon
        : interval.nominalDose === false &&
          ["hold", "move"].includes(interval.cause) &&
          interval.rawElapsedMs + epsilon >= interval.acceptedElapsedMs &&
          Math.abs(
            interval.toAt - interval.fromAt - interval.acceptedElapsedMs,
          ) < epsilon);
    if (!valid) {
      fail("INVALID_OR_EXCESSIVE_BRUSH_DOSE", detail);
      continue;
    }
    if (
      (releaseEvent >= 0 && events.indexOf(interval) > releaseEvent) ||
      events.indexOf(interval) >= events.indexOf(end) ||
      interval.at > end?.at + epsilon
    )
      fail("BRUSH_DOSE_AFTER_RELEASE", detail);
    if (
      !press &&
      interval.rawElapsedMs > 50 + epsilon &&
      interval.segments.some((segment) => !samePoint(segment.from, segment.to))
    )
      fail("BRUSH_CAPPED_PATH_REPLAY", detail);
    validIntervals.push(interval);
    acceptedMs += interval.acceptedElapsedMs;
    acceptedDoseFt +=
      (interval.rateFtPerSecond * interval.acceptedElapsedMs) / 1000;
    if (press) pressDoseMs += interval.acceptedElapsedMs;
    else {
      timedDoseMs += interval.acceptedElapsedMs;
      spans.push(interval);
    }
    if (!interval.changed) continue;
    const step = publication.steps.find(
      (step) =>
        step.intervalId === interval.intervalId &&
        step.gestureId === interval.gestureId,
    );
    if (step && finite(step.submittedAt))
      submissions.push({
        intervalId: interval.intervalId,
        frame: step.frameId,
        at: step.submittedAt,
        elapsedMs: step.submittedAt - interval.at,
      });
  }
  if (intervals.filter((e) => e.cause === "press").length > 1)
    fail("DUPLICATE_PRESS_DOSE");
  const discardMs = {};
  for (const span of discarded) {
    if (
      ![span.fromAt, span.toAt].every(finite) ||
      span.toAt < span.fromAt ||
      span.fromAt < start?.startAt - epsilon ||
      span.toAt > end?.endAt + epsilon ||
      ![
        "feedback",
        "cap",
        "sources",
        "end",
        "cancel",
        "blur",
        "visibility",
        "project",
        "destroy",
        "error",
        "pointerup",
        "press",
        "history",
        "save",
        "escape",
        "input-limit",
        "stale",
        "overflow",
        "navigation",
      ].includes(span.reason)
    ) {
      fail("INVALID_BRUSH_DISCARD");
      continue;
    }
    discardMs[span.reason] =
      (discardMs[span.reason] ?? 0) + span.toAt - span.fromAt;
    if (span.toAt > span.fromAt) spans.push(span);
  }
  let cursor = start?.startAt;
  for (const span of spans.sort(
    (a, b) => a.fromAt - b.fromAt || a.toAt - b.toAt,
  )) {
    if (span.fromAt - cursor > epsilon)
      fail("UNEXPLAINED_BRUSH_TIME", { fromAt: cursor, toAt: span.fromAt });
    if (cursor - span.fromAt > epsilon)
      fail("OVERLAPPING_BRUSH_TIME", { fromAt: span.fromAt, toAt: cursor });
    cursor = Math.max(cursor, span.toAt);
  }
  if (end?.endAt - cursor > epsilon)
    fail("UNEXPLAINED_BRUSH_TIME", { fromAt: cursor, toAt: end.endAt });
  const feedback = [
    start?.startAt,
    ...submissions.map((s) => s.at).filter((at) => at < end?.endAt),
    end?.endAt,
  ]
    .filter(finite)
    .sort((a, b) => a - b);
  return {
    passed: issues.length === 0,
    issues,
    gestureId: start?.gestureId ?? null,
    inputQueueMs: {
      down: start ? start.startAt - start.inputAt : null,
      up: end ? end.endAt - end.inputAt : null,
    },
    startAt: start?.startAt ?? null,
    endAt: end?.endAt ?? null,
    heldMs: end && start ? end.endAt - start.startAt : null,
    acceptedMs,
    timedDoseMs,
    pressDoseMs,
    acceptedDoseFt,
    discardMs,
    maximumStepMs: Math.max(
      0,
      ...validIntervals.map((e) => e.acceptedElapsedMs),
    ),
    maximumRawStepMs: Math.max(0, ...validIntervals.map((e) => e.rawElapsedMs)),
    intervalIds: intervals.map((e) => e.intervalId),
    changedSteps: intervals.filter((e) => e.changed).length,
    submittedSteps: submissions.length,
    submissionMs: distribution(submissions.map((s) => s.elapsedMs)),
    retiredSteps: publication.steps.filter(
      (step) => step.gestureId === start?.gestureId && finite(step.retiredAt),
    ).length,
    maximumFeedbackGapMs: Math.max(
      0,
      ...feedback.slice(1).map((at, i) => at - feedback[i]),
    ),
    stationary:
      point(start?.point) &&
      validIntervals.length === intervals.length &&
      intervals.every((e) =>
        e.segments.every(
          (segment) =>
            samePoint(segment.from, start.point) &&
            samePoint(segment.to, start.point),
        ),
      ),
    interpretation:
      "Accepted time and explicit discarded time; nominal press dose is additional. Input queue delay is never accumulated. Submission is not native presentation.",
  };
}

/** Gesture-start pointerdown is not a camera change; wheel/move/click remain mandatory. */
export function extractNavigationSamples(events) {
  return events.flatMap((input, index) => {
    if (
      input.kind !== "input" ||
      input.inputKind !== "navigation" ||
      input.eventType === "pointerdown"
    )
      return [];
    const cameras = events.filter(
      (event) => event.kind === "camera" && event.input === input.id,
    );
    const camera = cameras[0];
    const cameraIndex = camera ? events.indexOf(camera) : -1;
    return [
      {
        inputId: input.id,
        eventType: input.eventType,
        createdAt: input.createdAt,
        handlerAt: input.at,
        cameraAt: camera?.at ?? null,
        camera: camera?.camera ?? null,
        cameraMatches: cameras.length,
        cameraAfterInput: cameraIndex > index,
        sourceCompletionsBeforeCamera:
          cameraIndex < 0
            ? null
            : events
                .slice(index + 1, cameraIndex)
                .filter((event) => event.kind === "sources").length,
        presentation: null,
      },
    ];
  });
}

export function evaluateNavigationDiagnostics(samples) {
  const issues = [],
    latency = [],
    handler = [];
  if (!samples.length) issues.push({ code: "NO_NAVIGATION_SAMPLES" });
  for (const sample of samples) {
    const detail = { inputId: sample.inputId };
    if (
      !finite(sample.createdAt) ||
      !finite(sample.handlerAt) ||
      !finite(sample.cameraAt) ||
      sample.handlerAt < sample.createdAt ||
      sample.cameraAt < sample.handlerAt ||
      sample.cameraMatches !== 1 ||
      sample.cameraAfterInput !== true ||
      ![sample.camera?.x, sample.camera?.y, sample.camera?.scale].every(
        finite,
      ) ||
      sample.camera.scale <= 0
    ) {
      issues.push({ code: "MISSING_OR_INVALID_CAMERA_RESPONSE", ...detail });
      continue;
    }
    // A source completion inside the input→camera interval is not silently
    // accepted as an independent response. Reads after camera application are
    // allowed and are reported separately from this chronology check.
    if (sample.sourceCompletionsBeforeCamera !== 0)
      issues.push({
        code: "CAMERA_RESPONSE_AFTER_SOURCE_COMPLETION",
        ...detail,
      });
    latency.push(sample.cameraAt - sample.createdAt);
    handler.push(sample.cameraAt - sample.handlerAt);
  }
  return {
    passed: !issues.length,
    issues,
    inputToCameraMs: distribution(latency),
    handlerToCameraMs: distribution(handler),
  };
}

/** Endpoints and pixels are checked after timing, against the restored baseline. */
/** Actual store/worker overlap is independent of whether every input succeeded. */
export function evaluateSaveOverlap({
  sample,
  timeOrigin,
  sessionId,
  intervals,
  before,
  observedWorker,
  finished,
}) {
  const inputEpochMs =
    finite(timeOrigin) && finite(sample?.createdAt)
      ? timeOrigin + sample.createdAt
      : null;
  const modelEpochMs =
    finite(timeOrigin) && finite(sample?.modelAt)
      ? timeOrigin + sample.modelAt
      : null;
  const matches = (intervals ?? []).filter(
    ({ start, end }) =>
      sample?.accepted !== false &&
      sample?.modelChanged !== false &&
      finite(inputEpochMs) &&
      finite(modelEpochMs) &&
      modelEpochMs >= inputEpochMs &&
      start.sessionId === sessionId &&
      end?.sessionId === sessionId &&
      end.token === start.token &&
      end.kind === start.kind &&
      end.success === true &&
      inputEpochMs >= start.epochMs &&
      modelEpochMs <= end.epochMs,
  );
  const workerProven = Boolean(
    typeof sessionId === "string" &&
    before?.sessionId === sessionId &&
    before.background?.sessionId === sessionId &&
    before.background.active === true &&
    observedWorker?.sessionId === sessionId &&
    observedWorker.background?.sessionId === sessionId &&
    observedWorker.background.active === true &&
    finished?.background?.sessionId === sessionId &&
    finite(before.background.samples) &&
    before.background.samples > 0 &&
    finite(finished.background.samples) &&
    finished.background.samples > before.background.samples,
  );
  return {
    passed: matches.length > 0 && workerProven,
    workerProven,
    matches,
    inputEpochMs,
    modelEpochMs,
  };
}

/**
 * @param {{points?: readonly (readonly number[])[], before?: readonly number[], after?: readonly number[], undone?: readonly number[], changedPixels?: readonly (readonly number[])[], restoredPixels?: readonly (readonly number[])[]}} [evidence]
 */
export function evaluateStrokeContent({
  points,
  before,
  after,
  undone,
  changedPixels,
  restoredPixels,
} = {}) {
  if (
    !Array.isArray(points) ||
    points.length < 2 ||
    !Array.isArray(before) ||
    !Array.isArray(after) ||
    !Array.isArray(undone) ||
    [before, after, undone].some((values) => values.length !== points.length)
  )
    return { passed: false, probes: [] };
  const indices = [0, points.length - 1];
  const probes = indices.map((index, probe) => ({
    index,
    point: points[index],
    before: before[index],
    after: after[index],
    undone: undone[index],
    heightChanged:
      finite(before[index]) &&
      finite(after[index]) &&
      after[index] > before[index],
    heightRestored:
      finite(undone[index]) && Math.abs(undone[index] - before[index]) < 1e-7,
    pixelsChanged:
      Array.isArray(changedPixels?.[probe]) &&
      Array.isArray(restoredPixels?.[probe]) &&
      changedPixels[probe].length >= 3 &&
      restoredPixels[probe].length >= 3 &&
      changedPixels[probe].slice(0, 3).every(finite) &&
      restoredPixels[probe].slice(0, 3).every(finite) &&
      changedPixels[probe]
        .slice(0, 3)
        .some((channel, c) => channel !== restoredPixels[probe][c]),
  }));
  const distinct =
    points.length >= 2 &&
    Math.hypot(
      points[0][0] - points.at(-1)[0],
      points[0][1] - points.at(-1)[1],
    ) > 0;
  return {
    passed:
      distinct &&
      probes.every(
        (probe) =>
          probe.heightChanged && probe.heightRestored && probe.pixelsChanged,
      ),
    probes,
  };
}

/** Submission can disprove a deadline; submission alone can never prove visibility. */
export function evaluateSubmissionDiagnostics(samples, limitMs = 50) {
  /** @type {EvaluationIssue[]} */
  const issues = [];
  const values = [];
  const submissionValues = [];
  const completionValues = [];
  const byInputKind = new Map();
  /** @type {TimingOutlier[]} */
  const outliers = [];
  if (!samples.length) issues.push({ code: "NO_INPUT_SAMPLES" });
  for (const sample of samples) {
    const detail = { inputId: sample.inputId };
    if (sample.modelChanged === false) {
      if (isD10Discard(sample)) continue;
      issues.push({
        code: isProcessedNoop(sample)
          ? sample.accepted === false
            ? "INPUT_NOT_ACCEPTED"
            : "EXPECTED_EDIT_NO_CHANGE"
          : "INVALID_NOOP_RECEIPT",
        modelChanged: false,
        ...(sample.accepted === false
          ? { accepted: false, reason: sample.noopReason }
          : {}),
        ...detail,
      });
      continue;
    }
    if (finite(sample.noopAt)) {
      issues.push({ code: "CONFLICTING_EDIT_RESULT", ...detail });
      continue;
    }
    if (!finite(sample.createdAt) || !finite(sample.modelAt)) {
      issues.push({ code: "MISSING_INPUT_OR_MODEL", ...detail });
      continue;
    }
    if (!finite(sample.submissionAt)) {
      issues.push({ code: "MISSING_SUBMISSION", ...detail });
      continue;
    }
    if (!finite(sample.createdAt)) continue;
    if (
      !nonempty(sample.sessionId) ||
      !Number.isSafeInteger(sample.revision) ||
      !Number.isSafeInteger(sample.frameId)
    ) {
      issues.push({ code: "MISSING_SUBMISSION_IDENTITY", ...detail });
      continue;
    }
    const completedAt = responseAt(sample);
    if (
      sample.submittedRevision !== sample.revision ||
      !finite(completedAt) ||
      completedAt < sample.modelAt ||
      sample.modelAt < sample.createdAt
    ) {
      issues.push({ code: "STALE_OR_INVALID_SUBMISSION", ...detail });
      continue;
    }
    const duration = completedAt - sample.createdAt;
    values.push(duration);
    const kind = sample.inputKind ?? "unspecified";
    if (kind === "pointerup") completionValues.push(duration);
    else submissionValues.push(duration);
    if (!byInputKind.has(kind)) byInputKind.set(kind, []);
    byInputKind.get(kind).push(duration);
    if (duration > limitMs)
      outliers.push({
        milliseconds: duration,
        limitMs,
        inputKind: kind,
        ...detail,
      });
  }
  const inputToResponseMs = distribution(values);
  const inputToSubmissionMs = distribution(submissionValues);
  const pointerupToCompletionMs = distribution(completionValues);
  const inputKinds = Object.fromEntries(
    [...byInputKind].map(([kind, durations]) => [
      kind,
      distribution(durations),
    ]),
  );
  for (const [inputKind, stats] of Object.entries({
    all: inputToResponseMs,
    ...inputKinds,
  }))
    if (stats.p95 > limitMs)
      issues.push({
        code: "SUBMISSION_LOWER_BOUND_EXCEEDS_LIMIT",
        metric: "p95",
        inputKind,
        milliseconds: stats.p95,
        limitMs,
      });
  return {
    status: issues.length ? "FAIL" : "PROXY_ONLY",
    presentationProven: false,
    sampleCount: samples.length,
    processedNoops: samples.filter(isProcessedNoop).length,
    d10DiscardedInputs: samples.filter(isD10Discard).length,
    notAccepted: samples.filter(
      (sample) => isProcessedNoop(sample) && sample.accepted === false,
    ).length,
    noopProcessingMs: distribution(
      samples.filter(isProcessedNoop).map((s) => s.noopAt - s.createdAt),
    ),
    missing: samples.filter(
      (s) => !isProcessedNoop(s) && !finite(s.submissionAt),
    ).length,
    inputToSubmissionMs,
    pointerupToCompletionMs,
    inputToResponseMs,
    latencyEndpoints: {
      edit: "actual terrain submission",
      pointerup: "commit completed on its current actual terrain submission",
    },
    inputKinds,
    outliers,
    issues,
  };
}

/** D11 adds navigation/gate timing to the ordinary 50-ms edit contract. */
export function evaluateColdSubmissionDiagnostics(samples) {
  const base = evaluateSubmissionDiagnostics(samples);
  const issues = [...base.issues];
  const sources = [],
    gate = [],
    gateToInput = [],
    firstInput = [],
    submission = [];
  const outliers = [...base.outliers];
  const firsts = coldFirstSamples(samples);
  if (!firsts.length) issues.push({ code: "COLD_NAVIGATION_SAMPLES_MISSING" });
  for (const sample of firsts) {
    const detail = {
      inputId: sample.inputId,
      navigationId: sample.navigationId,
    };
    if (sample.timeout === true)
      issues.push({ code: "SAMPLE_TIMEOUT", ...detail });
    if (sample.coldBeforeNavigation !== true)
      issues.push({ code: "COLD_SOURCE_STATE_UNPROVEN", ...detail });
    if (!validColdGate(sample)) {
      issues.push({ code: "INVALID_COLD_NAVIGATION_BOUNDARY", ...detail });
      continue;
    }
    const gateMs = sample.gateAt - sample.navigationAt;
    sources.push(sample.sourcesAt - sample.navigationAt);
    gate.push(gateMs);
    gateToInput.push(sample.createdAt - sample.gateAt);
    if (gateMs > 500)
      outliers.push({
        code: "COLD_GATE_LOWER_BOUND_EXCEEDS_LIMIT",
        milliseconds: gateMs,
        limitMs: 500,
        ...detail,
      });
    if (gateMs > 2000)
      issues.push({
        code: "COLD_MAXIMUM_EXCEEDED",
        milliseconds: gateMs,
        limitMs: 2000,
        ...detail,
      });
    if (finite(sample.submissionAt)) {
      firstInput.push(sample.submissionAt - sample.createdAt);
      const submissionMs = sample.submissionAt - sample.navigationAt;
      submission.push(submissionMs);
      if (submissionMs > 750)
        outliers.push({
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
  const navigationToGateMs = distribution(gate);
  const navigationToSubmissionMs = distribution(submission);
  const firstInputToSubmissionMs = distribution(firstInput);
  if (exceeds(firstInputToSubmissionMs.p95, 50))
    issues.push({
      code: "COLD_FIRST_INPUT_LOWER_BOUND_EXCEEDS_LIMIT",
      metric: "p95",
      milliseconds: firstInputToSubmissionMs.p95,
      limitMs: 50,
    });
  if (exceeds(navigationToGateMs.p95, 500))
    issues.push({
      code: "COLD_GATE_LOWER_BOUND_EXCEEDS_LIMIT",
      metric: "p95",
      milliseconds: navigationToGateMs.p95,
      limitMs: 500,
    });
  if (exceeds(navigationToSubmissionMs.p95, 750))
    issues.push({
      code: "COLD_SUBMISSION_LOWER_BOUND_EXCEEDS_LIMIT",
      metric: "p95",
      milliseconds: navigationToSubmissionMs.p95,
      limitMs: 750,
    });
  return {
    ...base,
    status: issues.length ? "FAIL" : "PROXY_ONLY",
    contract:
      "D11/M10: p95 navigation to visible readiness 500 ms, accepted edit/pointerup 50 ms, navigation to first exact presentation 750 ms; gate/submit are lower bounds only",
    navigationCount: firsts.length,
    navigationToSourcesMs: distribution(sources),
    navigationToGateMs,
    gateToInputMs: distribution(gateToInput),
    firstInputToSubmissionMs,
    navigationToSubmissionMs,
    inputToSubmissionInterpretation:
      "ordinary 50-ms reaction after product gate; native visible readiness requires its own presented frame",
    issues,
    outliers,
  };
}

/** The same exact, revision-bound live criterion is used by collection and replay. */
export function strokeEvidence(edit) {
  const samples = edit.samples ?? [];
  const live = samples.filter((sample) => sample.inputKind === "edit");
  const up = samples.filter((sample) => sample.inputKind === "pointerup");
  const releasedAt = up[0]?.createdAt;
  const structural = evaluateSubmissionDiagnostics(samples, Infinity);
  const invalidInputs = new Set(
    structural.issues.map((issue) => issue.inputId),
  );
  const validSubmission = (sample) =>
    !invalidInputs.has(sample.inputId) && finite(sample.submissionAt);
  const processedNoops = samples.filter(isProcessedNoop);
  const complete =
    !edit.timedOut &&
    live.length >= 3 &&
    up.length === 1 &&
    new Set(samples.map((sample) => sample.inputId)).size === samples.length &&
    structural.issues.every((issue) =>
      ["EXPECTED_EDIT_NO_CHANGE", "INPUT_NOT_ACCEPTED"].includes(issue.code),
    );
  const beforeRelease = live.filter(
    (sample) => validSubmission(sample) && sample.submissionAt < releasedAt,
  );
  const beforeReleaseFrames = new Set(
    beforeRelease.map((sample) => `${sample.sessionId}:${sample.frameId}`),
  );
  const startedAt = live[0]?.createdAt;
  const relative = (at) =>
    finite(at) && finite(startedAt) ? at - startedAt : null;
  const timeline = samples.map((sample) => ({
    inputId: sample.inputId,
    inputKind: sample.inputKind,
    inputMs: relative(sample.createdAt),
    modelMs: relative(sample.modelAt),
    modelChanged: sample.modelChanged ?? (finite(sample.modelAt) ? true : null),
    accepted: sample.accepted ?? (finite(sample.modelAt) ? true : null),
    noopReason: sample.noopReason ?? null,
    noopMs: isProcessedNoop(sample) ? relative(sample.noopAt) : null,
    processedNoop: isProcessedNoop(sample),
    submittedMs: validSubmission(sample) ? relative(sample.submissionAt) : null,
    frameId: validSubmission(sample) ? sample.frameId : null,
    modeled: finite(sample.modelAt),
    validSubmission: validSubmission(sample),
  }));
  const changes = live
    .flatMap((sample) => [
      { at: sample.createdAt, inputId: sample.inputId, input: true },
      ...(validSubmission(sample)
        ? [{ at: sample.submissionAt, inputId: sample.inputId, input: false }]
        : isProcessedNoop(sample)
          ? [{ at: sample.noopAt, inputId: sample.inputId, noop: true }]
          : []),
    ])
    .filter((event) => finite(event.at) && event.at < releasedAt)
    .sort(
      (a, b) =>
        a.at - b.at || Number(Boolean(b.input)) - Number(Boolean(a.input)),
    );
  const pending = new Set();
  let pendingSince = null,
    newInputs = 0,
    maximumPendingGapMs = 0,
    maximumMovingStallMs = 0;
  const measureGap = (at) => {
    if (pending.size && finite(pendingSince) && finite(at)) {
      const gap = at - pendingSince;
      maximumPendingGapMs = Math.max(maximumPendingGapMs, gap);
      // A single delayed input is not a new 100-ms input deadline. This catches
      // a pause in exact feedback while further movement inputs keep arriving.
      if (newInputs >= 2)
        maximumMovingStallMs = Math.max(maximumMovingStallMs, gap);
    }
  };
  for (const event of changes) {
    measureGap(event.at);
    if (event.input) {
      if (!pending.size) {
        pendingSince = event.at;
        newInputs = 0;
      }
      pending.add(event.inputId);
      newInputs++;
    } else if (event.noop) {
      // Processing a no-op ends its queue residence, but is not visible progress.
      pending.delete(event.inputId);
      if (!pending.size) {
        pendingSince = null;
        newInputs = 0;
      }
    } else {
      pending.delete(event.inputId);
      pendingSince = pending.size ? event.at : null;
      newInputs = 0;
    }
  }
  measureGap(releasedAt);
  // No-op movement can leave no queued work while the terrain still fails to
  // advance. Preserve those real inter-submit gaps, separately from backlog.
  // No-noop cases retain exactly the existing pending-input calculation.
  const feedbackBoundaries = [
    startedAt,
    ...new Set(
      beforeRelease.map((sample) => sample.submissionAt).sort((a, b) => a - b),
    ),
    releasedAt,
  ];
  const noChangeFeedbackGaps = [];
  for (let i = 1; i < feedbackBoundaries.length; i++) {
    const from = feedbackBoundaries[i - 1],
      to = feedbackBoundaries[i];
    const movement = live.filter(
      (sample) => sample.createdAt >= from && sample.createdAt < to,
    );
    if (
      finite(from) &&
      finite(to) &&
      movement.length >= 2 &&
      movement.some(isProcessedNoop)
    )
      noChangeFeedbackGaps.push({
        fromMs: relative(from),
        toMs: relative(to),
        milliseconds: to - from,
        inputs: movement.length,
        processedNoops: movement.filter(isProcessedNoop).length,
      });
  }
  const maximumNoChangeFeedbackGapMs = Math.max(
    0,
    ...noChangeFeedbackGaps.map((gap) => gap.milliseconds),
  );
  maximumMovingStallMs = Math.max(
    maximumMovingStallMs,
    maximumNoChangeFeedbackGapMs,
  );
  const maximumInputBacklogMs = finite(releasedAt)
    ? Math.max(
        0,
        ...live
          .filter((sample) => finite(sample.createdAt))
          .map((sample) =>
            Math.max(
              0,
              Math.min(
                isProcessedNoop(sample)
                  ? sample.noopAt
                  : validSubmission(sample)
                    ? sample.submissionAt
                    : Infinity,
                releasedAt,
              ) - sample.createdAt,
            ),
          ),
      )
    : null;
  const continuous = maximumMovingStallMs <= 100;
  return {
    complete,
    passed:
      complete &&
      processedNoops.every(isD10Discard) &&
      beforeReleaseFrames.size >= 2 &&
      continuous,
    minimumFrameControlPassed: beforeReleaseFrames.size >= 2,
    minimumFrameControlMeaning:
      "Two distinct frames only establish the minimum live control; all input timings and feedback pauses are evaluated too.",
    timeline,
    continuity: {
      enforced: true,
      passed: continuous,
      startedAt,
      releasedAt,
      maximumPendingGapMs,
      maximumMovingStallMs,
      maximumNoChangeFeedbackGapMs,
      noChangeFeedbackGaps,
      maximumInputBacklogMs,
      movingStallLimitMs: 100,
      evidence:
        "exact regional submission lower bound; native presentation remains unproven",
    },
    liveInputs: live.length,
    processedNoops: processedNoops.length,
    pointerups: up.length,
    liveSubmissionsBeforeRelease: beforeRelease.length,
    liveFramesBeforeRelease: beforeReleaseFrames.size,
    releasedAt,
    timedOut: edit.timedOut === true,
  };
}

function strokesFromSamples(samples) {
  const strokes = [];
  let current = [];
  for (const sample of [...samples].sort((a, b) => a.inputId - b.inputId)) {
    current.push(sample);
    if (sample.inputKind === "pointerup") {
      strokes.push(current);
      current = [];
    }
  }
  if (current.length) strokes.push(current);
  return strokes;
}

/** Content and timing claims use the already interpreted gesture. */
function attemptVerdict(attempt, live) {
  const failures = [];
  if (attempt.error || attempt.observationError)
    failures.push({
      code: "CONTENT_OR_INTERACTION_FAILED",
      error: attempt.error ?? attempt.observationError,
    });
  const content = evaluateStrokeContent({
    ...attempt.content,
    changedPixels: attempt.changedImage?.pixels,
    restoredPixels: attempt.undoneImage?.pixels,
  });
  if (!content.passed)
    failures.push({ code: "MOVING_STROKE_ENDPOINT_CONTENT_UNPROVEN" });
  if (!attempt.time || attempt.time.passed !== true)
    failures.push(
      ...(attempt.time?.issues?.length
        ? attempt.time.issues
        : [{ code: "BRUSH_TIME_EVIDENCE_INVALID" }]),
    );
  if (attempt.overlapRequired && attempt.overlapProven !== true)
    failures.push({ code: "BUSY_OVERLAP_UNPROVEN" });
  if (!live?.passed || attempt.timedOut)
    failures.push({ code: "ATTEMPT_LIVE_FEEDBACK_FAILED" });
  return {
    passed: failures.length === 0,
    failures,
    content,
    live,
  };
}

/** The collector and final evaluator use this same decision for an attempt. */
export function evaluateAttempt(attempt, samples) {
  return attemptVerdict(
    attempt,
    strokeEvidence({ samples, timedOut: attempt.timedOut }),
  );
}

/** Evaluate the selected scenario now, independently of a later complete run. */
export function evaluateScenario(scenario) {
  /** @type {EvaluationIssue[]} */
  const failures = [];
  /** @type {EvaluationIssue[]} */
  const missing = [];
  const samples = scenario.samples ?? [];
  const fail = (code, detail = {}) => failures.push({ code, ...detail });
  if (scenario.droppedEvents !== 0)
    fail("OBSERVATION_EVENTS_DROPPED_OR_UNKNOWN", {
      droppedEvents: scenario.droppedEvents ?? null,
    });
  if (scenario.aborted || scenario.error)
    fail("SCENARIO_ABORTED", { error: scenario.error });
  if (scenario.kind === "navigation") {
    if (
      !(scenario.inputCount > 0) ||
      !(scenario.wheelChecks?.length >= 8) ||
      !scenario.wheelChecks.every((check) => check.passed) ||
      scenario.storeCommits !== 0 ||
      scenario.cameraMoved !== true
    )
      fail("NAVIGATION_BEHAVIOR_FAILED");
    const navigation = evaluateNavigationDiagnostics(samples);
    failures.push(...navigation.issues);
    if (scenario.authorChanges !== 0) fail("NAVIGATION_CHANGED_DOCUMENT");
    const cpuWorkMs = distribution(scenario.cpuWorkMs ?? []);
    if (!cpuWorkMs.count) fail("NAVIGATION_CPU_SAMPLES_MISSING");
    else if (exceeds(cpuWorkMs.p95, 8))
      fail("NAVIGATION_CPU_P95_EXCEEDED", {
        milliseconds: cpuWorkMs.p95,
        limitMs: 8,
      });
    return {
      status: failures.length ? "FAIL" : "PROXY_ONLY",
      contentPassed: failures.length === 0,
      presentationProven: false,
      sampleCount: samples.length,
      navigation,
      cpuWorkMs,
      rafFrameIntervalsMs: distribution(scenario.rafFrameIntervalsMs ?? []),
      failures,
      missing,
      blockers: [{ code: "EXACT_NATIVE_PRESENTATION_UNPROVEN" }],
    };
  }
  const attempts = scenario.attempts ?? [];
  if (!attempts.length && scenario.contentObserved !== false)
    missing.push({ code: "SCENARIO_CONTENT_EVIDENCE_MISSING" });
  // Interpret every recorded input, including any omitted from an attempt's
  // index. Attempts reference complete gestures; they do not choose samples.
  const strokes = strokesFromSamples(samples);
  const live = strokes.map((stroke, attempt) => ({
    attempt,
    ...strokeEvidence({ samples: stroke }),
  }));
  const gestureKey = (ids) => JSON.stringify([...ids].sort((a, b) => a - b));
  const gestures = new Map(
    strokes.map((stroke, index) => [
      gestureKey(stroke.map((sample) => sample.inputId)),
      { evidence: live[index], attempts: 0 },
    ]),
  );
  if (new Set(samples.map((sample) => sample.inputId)).size !== samples.length)
    fail("DUPLICATE_INPUT_SAMPLES");
  if (scenario.kind === "cold" && scenario.contentObserved !== false) {
    const cases = scenario.blockedInputs?.cases ?? [];
    if (
      cases.length !== 2 ||
      new Set(cases.map((entry) => entry.holdUntilReady)).size !== 2
    )
      fail("BLOCKED_INPUT_EVIDENCE_MISSING");
    for (const entry of cases)
      for (const issue of evaluateBlockedInput(entry).issues)
        fail(issue.code, { holdUntilReady: entry.holdUntilReady });
  }
  if (
    scenario.requestedAttempts !== undefined &&
    attempts.length !== scenario.requestedAttempts
  )
    missing.push({
      code: "ATTEMPTS_MISSING",
      requested: scenario.requestedAttempts,
      observed: attempts.length,
    });
  const attemptResults = attempts.map((attempt) => {
    const gesture = Array.isArray(attempt.inputIds)
      ? gestures.get(gestureKey(attempt.inputIds))
      : undefined;
    if (!gesture || gesture.attempts++)
      fail("ATTEMPT_INPUT_ASSIGNMENT_INVALID", { attempt: attempt.attempt });
    return attemptVerdict(attempt, gesture?.evidence);
  });
  if (attempts.length)
    for (const { evidence, attempts: assigned } of gestures.values())
      if (assigned === 0)
        fail("UNASSIGNED_GESTURE_INPUTS", { attempt: evidence.attempt });
  attemptResults.forEach((result, index) => {
    for (const issue of result.failures)
      fail(issue.code, { ...issue, attempt: attempts[index].attempt });
  });
  if (scenario.contentObserved === false)
    missing.push({ code: "CONTENT_CHECKS_UNAVAILABLE_FROM_JOURNAL" });
  for (const stroke of live)
    if (!stroke.passed) {
      if (!stroke.continuity.passed)
        fail("CONTINUOUS_SUBMISSION_STALL", {
          attempt: stroke.attempt,
          milliseconds: stroke.continuity.maximumMovingStallMs,
          limitMs: 100,
        });
      if (stroke.complete && stroke.minimumFrameControlPassed) continue;
      fail(
        stroke.complete ? "LIVE_EXACT_UPDATES_MISSING" : "INCOMPLETE_STROKE",
        {
          attempt: stroke.attempt,
          liveSubmissionsBeforeRelease: stroke.liveSubmissionsBeforeRelease,
          liveFramesBeforeRelease: stroke.liveFramesBeforeRelease,
          required: 2,
        },
      );
    }
  const submission =
    scenario.kind === "cold"
      ? evaluateColdSubmissionDiagnostics(samples)
      : evaluateSubmissionDiagnostics(samples);
  failures.push(...submission.issues);
  return {
    status: failures.length
      ? "FAIL"
      : missing.length
        ? "INCOMPLETE"
        : "PROXY_ONLY",
    contentPassed:
      attempts.length > 0 &&
      scenario.contentObserved !== false &&
      attemptResults.every((result) => result.content.passed),
    liveFeedback: {
      status:
        live.some((stroke) => !stroke.passed) || submission.status === "FAIL"
          ? "FAIL"
          : "SUBMISSION_ONLY",
      presentationProven: false,
      inputLatencyLimit:
        "p95 <= 50 ms for ordinary accepted edit/pointerup and separately the first cold edit after the product gate; D11 also adds M10 navigation bounds",
      inputCount: live.reduce((sum, stroke) => sum + stroke.timeline.length, 0),
      processedNoops: live.reduce(
        (sum, stroke) => sum + stroke.processedNoops,
        0,
      ),
      notAccepted: live.reduce(
        (sum, stroke) =>
          sum +
          stroke.timeline.filter((entry) => entry.accepted === false).length,
        0,
      ),
      maximumMovingStallMs: Math.max(
        0,
        ...live.map((stroke) => stroke.continuity.maximumMovingStallMs),
      ),
    },
    presentationProven: false,
    sampleCount: samples.length,
    attempted: attempts.length || live.length,
    live,
    submission,
    failures,
    missing,
    blockers: [{ code: "EXACT_NATIVE_PRESENTATION_UNPROVEN" }],
  };
}

/**
 * Re-evaluate saved raw observations without rerunning the product.
 * @param observation Raw recorded evidence; never trusted as an accepted result.
 * @param {{id?: string, kind?: string}} [options]
 */
export function evaluateObservation(observation, { id, kind = "edit" } = {}) {
  const events = observation.events ?? [];
  const evidence = extractSubmissionEvidence(events);
  const inputs = events.filter(
    (event) =>
      event.kind === "input" && ["edit", "pointerup"].includes(event.inputKind),
  );
  const samples = inputs.map((input) => {
    const model = evidence.changesByInput.get(input.id);
    return extractEditSamples(
      events,
      [input.id],
      model?.sessionId ?? observation.sessionId,
      evidence,
    )[0];
  });
  let selected = samples;
  if (kind === "cold") {
    selected = extractColdSamples(events, samples, {
      sessionId: observation.sessionId,
      // The journal alone cannot prove an empty application cache before a
      // target switch. Do not manufacture that independent fixture evidence.
      coldBeforeNavigation: observation.coldBeforeNavigation === true,
    });
  }
  return evaluateScenario({
    id,
    kind,
    samples: selected,
    droppedEvents: observation.droppedEvents,
    contentObserved: false,
  });
}

/** Each collected case is interpreted once, independently of the selected gate. */
function scenarioResults(runs) {
  const results = new Map();
  for (const run of runs) {
    if (run.role === "control") continue;
    for (const scenario of run.scenarios ?? [])
      results.set(scenario, evaluateScenario(scenario));
  }
  return results;
}

/**
 * Native reference, presentation and sampling requirements extend the same
 * functional and case results; they never reinterpret recorded gestures.
 * @param {Requirements} requirements
 * @returns {AcceptanceReport}
 */
function nativeVerdict(report, requirements, facts, functional, cases) {
  /** @type {EvaluationIssue[]} */
  const failures = [];
  /** @type {EvaluationIssue[]} */
  const blockers = [];
  /** @type {AcceptanceGroup[]} */
  const groups = [];
  const fail = (code, detail = {}) => failures.push({ code, ...detail });
  const block = (code, detail = {}) => blockers.push({ code, ...detail });
  if (report.selection && report.selection !== "all")
    block("PARTIAL_EXECUTION_SCOPE", { selection: report.selection });
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
  failures.push(...functional.failures);
  const { runs } = facts;
  if (runs.length < requirements.independentRuns)
    fail("INSUFFICIENT_INDEPENDENT_RUNS", {
      actual: runs.length,
      required: requirements.independentRuns,
    });
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
      if (scenario.error || scenario.aborted === true)
        fail("SCENARIO_COLLECTION_FAILED", context);
      if (requirements === P0_REQUIREMENTS && spec.kind !== "navigation") {
        if (!Array.isArray(scenario.attempts) || !scenario.attempts.length)
          fail("SCENARIO_CONTENT_EVIDENCE_MISSING", context);
        const evaluated = cases.get(scenario);
        for (const issue of evaluated.failures)
          fail(issue.code, { ...issue, ...context });
        for (const issue of evaluated.missing)
          fail(issue.code, { ...issue, ...context });
      }
      const samples = Array.isArray(scenario.samples) ? scenario.samples : [];
      const firstCold = spec.kind === "cold" ? coldFirstSamples(samples) : [];
      const countedSamples =
        spec.kind === "cold"
          ? firstCold
          : samples.filter((sample) => !isD10Discard(sample));
      total += countedSamples.length;
      if (countedSamples.length < spec.minSamples)
        fail("INSUFFICIENT_SAMPLES", {
          ...context,
          actual: countedSamples.length,
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
        (!firstCold.length ||
          firstCold.some((s) => s.navigationId === undefined) ||
          new Set(firstCold.map((s) => `${s.sessionId}:${s.navigationId}`))
            .size !== firstCold.length)
      )
        fail("COLD_TARGETS_NOT_INDEPENDENT", context);
      const latency = [],
        ready = [],
        readyToInput = [],
        firstColdLatency = [],
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
          if (sample.modelChanged === false) {
            if (isD10Discard(sample)) continue;
            fail(
              isProcessedNoop(sample)
                ? sample.accepted === false
                  ? "INPUT_NOT_ACCEPTED"
                  : "EXPECTED_EDIT_NO_CHANGE"
                : "INVALID_NOOP_RECEIPT",
              detail,
            );
            continue;
          }
          if (!finite(sample.modelAt) || !finite(sample.submissionAt)) {
            fail("MISSING_MODEL_OR_SUBMISSION", detail);
            missing++;
          } else if (
            sample.modelAt < sample.createdAt ||
            !finite(responseAt(sample)) ||
            responseAt(sample) < sample.modelAt ||
            sample.submittedRevision !== sample.revision
          )
            fail("STALE_OR_INVALID_SUBMISSION", detail);
        }
        let validColdBoundary = true;
        const isFirstCold = firstCold.includes(sample);
        if (isFirstCold) {
          validColdBoundary = validColdGate(sample);
          if (!validColdBoundary)
            fail("INVALID_COLD_NAVIGATION_BOUNDARY", detail);
          else {
            if (sample.gateAt - sample.navigationAt > 2000)
              fail("COLD_MAXIMUM_EXCEEDED", detail);
            const baseline = sample.readyPresentation;
            if (!baseline || !finite(baseline.at)) {
              block("MISSING_READY_PRESENTATION", detail);
              missing++;
            } else if (
              baseline.evidence !== "chromium-presented-frame" ||
              baseline.state !== "presented-all" ||
              baseline.inputId !== sample.navigationId ||
              baseline.frameId !== sample.gateFrameId ||
              baseline.sessionId !== sample.gateSessionId ||
              baseline.revision !== sample.gateRevision ||
              baseline.viewGeneration !== sample.gateViewGeneration ||
              !nonempty(baseline.surfaceFrameTraceId) ||
              !nonempty(baseline.displayTraceId)
            ) {
              fail("UNMATCHED_OR_STALE_READY_PRESENTATION", detail);
            } else if (baseline.at < sample.gateSubmissionAt) {
              fail("INVALID_READY_PRESENTATION_CLOCK", detail);
            } else {
              // The product gate and native presentation are distinct clocks.
              // An immediately dispatched event may precede the latter; it
              // cannot then be called an input after visible readiness.
              const readyAt = Math.max(sample.gateAt, baseline.at);
              ready.push(readyAt - sample.navigationAt);
              readyToInput.push(sample.createdAt - readyAt);
              if (sample.createdAt < readyAt)
                fail("INPUT_PRECEDES_VISIBLE_READY", {
                  ...detail,
                  milliseconds: readyAt - sample.createdAt,
                });
              if (readyAt - sample.navigationAt > 2000)
                fail("COLD_MAXIMUM_EXCEEDED", detail);
            }
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
          (p.at < sample.createdAt &&
            sample.completionEvidence !== "commit-current-terrain-v1")
        ) {
          fail("INVALID_PRESENTATION_CLOCK", detail);
          continue;
        }
        // A final frame already presented before Up remains valid only with
        // the separately proven commit/current-frame completion association.
        const duration =
          (sample.completionEvidence === "commit-current-terrain-v1"
            ? Math.max(sample.modelAt, p.at)
            : p.at) - sample.createdAt;
        latency.push(duration);
        const kindSamples = byInputKind.get(sample.inputKind) ?? [];
        kindSamples.push(duration);
        byInputKind.set(sample.inputKind, kindSamples);
        if (isFirstCold && validColdBoundary) {
          firstColdLatency.push(duration);
          totalCold.push(p.at - sample.navigationAt);
          if (p.at - sample.navigationAt > 2000)
            fail("COLD_MAXIMUM_EXCEEDED", detail);
        }
      }
      /** @type {AcceptanceGroup} */
      const result = {
        ...context,
        sampleCount: samples.length,
        missing,
        inputToPresentationMs: distribution(latency),
      };
      if (
        spec.kind !== "navigation" &&
        exceeds(result.inputToPresentationMs.p95, 50)
      )
        fail("WARM_P95_EXCEEDED", {
          ...context,
          actual: result.inputToPresentationMs.p95,
        });
      if (spec.requiredInputKinds) {
        result.inputKinds = {};
        for (const kind of spec.requiredInputKinds) {
          const count = samples.filter(
            (s) => s.inputKind === kind && !isD10Discard(s),
          ).length;
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
          if (spec.kind !== "navigation" && exceeds(timings.p95, 50))
            fail("INPUT_KIND_P95_EXCEEDED", {
              ...context,
              inputKind: kind,
              actual: timings.p95,
            });
        }
      }
      if (spec.kind === "cold") {
        result.navigationCount = firstCold.length;
        result.navigationToReadyMs = distribution(ready);
        result.readyToInputMs = distribution(readyToInput);
        result.navigationToPresentationMs = distribution(totalCold);
        result.firstInputToPresentationMs = distribution(firstColdLatency);
        if (exceeds(result.firstInputToPresentationMs.p95, 50))
          fail("COLD_FIRST_INPUT_P95_EXCEEDED", context);
        if (exceeds(result.navigationToReadyMs.p95, 500))
          fail("COLD_READY_P95_EXCEEDED", context);
        if (exceeds(result.navigationToPresentationMs.p95, 750))
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
        if (
          exceeds(cpu.p95, 8) ||
          exceeds(frames.p95, 20) ||
          exceeds(frames.maximum, 100)
        )
          fail("NAVIGATION_TARGET_EXCEEDED", context);
        if (scenario.authorChanges !== 0)
          fail("NAVIGATION_CHANGED_DOCUMENT", context);
        for (const issue of evaluateNavigationDiagnostics(samples).issues)
          fail(issue.code, { ...context, ...issue });
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

/**
 * Pure fail-closed evaluator. The CLI always uses the fixed P0 requirements above.
 * @param {Requirements} [requirements]
 * @returns {AcceptanceReport}
 */
export function evaluateAcceptance(report, requirements = P0_REQUIREMENTS) {
  const facts = functionalFacts(report);
  return nativeVerdict(
    report,
    requirements,
    facts,
    functionalVerdict(facts, requirements),
    requirements === P0_REQUIREMENTS ? scenarioResults(facts.runs) : new Map(),
  );
}

/**
 * Collection did not start: missing samples are neither measured failures nor passes.
 * @param {{errors?: EvaluationIssue[], blockers?: EvaluationIssue[], [detail: string]: unknown} | null | undefined} preflight
 * @param {EvaluationIssue[]} [runnerErrors]
 */
export function evaluateNativePreflight(preflight, runnerErrors = []) {
  const failures = [...(preflight?.errors ?? []), ...runnerErrors];
  const blockers = preflight?.blockers ?? [
    { code: "NATIVE_PREFLIGHT_PENDING" },
  ];
  return {
    phase: "preflight",
    status: failures.length ? "FAIL" : "BLOCKED",
    passed: false,
    scopePassed: false,
    collectionStarted: false,
    failures,
    missing: [],
    blockers,
    nativeAcceptance: {
      status: "BLOCKED",
      passed: false,
      evaluated: false,
      unmetRequirements: [],
    },
  };
}

/** Selected execution and fixed native acceptance are separate, explicit claims. */
export function evaluateRun(report) {
  if (
    report.collectionStarted === false &&
    (report.mode === "native" ||
      report.purpose === "native-presentation-investigation")
  )
    return evaluateNativePreflight(report.preflight, report.errors);
  const selection = report.selection ?? "all";
  const scope = selectP0Scope(
    selection,
    report.diagnosticSelection?.scenarioId ?? null,
  );
  const scopedRequirements =
    selection === "all"
      ? P0_REQUIREMENTS
      : {
          ...P0_REQUIREMENTS,
          requiredChecks: scope.requiredChecks,
          scaling: scope.scaling ? P0_REQUIREMENTS.scaling : undefined,
          requiredFaultControls: scope.controls
            ? P0_REQUIREMENTS.requiredFaultControls
            : [],
        };
  /** @type {EvaluationIssue[]} */
  const failures = [];
  /** @type {EvaluationIssue[]} */
  const missing = [];
  const facts = functionalFacts(report);
  const functional = functionalVerdict(facts, scopedRequirements);
  const cases = scenarioResults(report.runs ?? []);
  for (const issue of functional.failures) {
    if (
      issue.code === "RUNNER_OR_PRODUCT_FAILURE" &&
      issue.error?.code === "NO_NATIVE_DISPLAY"
    )
      continue;
    const missingCheck =
      issue.code === "FUNCTIONAL_CHECK_MISSING_OR_FAILED" &&
      !(report.functional?.checks ?? []).some(
        (check) =>
          check.id === issue.check && check.independentRunId === issue.run,
      );
    const absent =
      missingCheck ||
      issue.code === "FUNCTIONAL_RUN_MISSING" ||
      (issue.code === "FAULT_CONTROL_MISSING_OR_DUPLICATE" &&
        !(report.negativeControls ?? []).some(
          (control) => control.fault === issue.fault,
        )) ||
      (issue.code.startsWith("SCALING_") && !report.scaling) ||
      ([
        "SCALING_FAILED_OR_MISSING",
        "SCALING_CASES_MISSING",
        "SCALING_FIXTURE_TOO_SMALL",
        "SCALING_SOURCE_BUDGET_NOT_EXERCISED",
      ].includes(issue.code) &&
        (report.scaling?.cases ?? []).length <
          P0_REQUIREMENTS.scaling.minimumSourceTiles.length &&
        !(report.scaling?.cases ?? []).some((entry) => entry.error));
    (absent ? missing : failures).push(issue);
  }
  for (const run of report.runs ?? []) {
    if (run.role === "control") continue;
    for (const scenario of run.scenarios ?? []) {
      const evaluated = cases.get(scenario);
      const detail = { run: run.id, scenario: scenario.id };
      failures.push(
        ...evaluated.failures.map((issue) => ({ ...issue, ...detail })),
      );
      missing.push(
        ...evaluated.missing.map((issue) => ({ ...issue, ...detail })),
      );
    }
  }
  for (const entry of report.planned ?? [])
    if (!["completed", "failed"].includes(entry.state))
      missing.push({
        code: "PLANNED_CASE_NOT_COMPLETED",
        run: entry.run,
        scenario: entry.id,
        state: entry.state,
      });
  const acceptance = nativeVerdict(
    report,
    P0_REQUIREMENTS,
    facts,
    scopedRequirements === P0_REQUIREMENTS
      ? functional
      : functionalVerdict(facts, P0_REQUIREMENTS),
    cases,
  );
  const scopePassed = failures.length === 0 && missing.length === 0;
  return {
    purpose: report.purpose ?? "acceptance",
    selection,
    status: failures.length
      ? "FAIL"
      : missing.length
        ? "INCOMPLETE"
        : acceptance.passed
          ? "PASS"
          : "BLOCKED",
    scopePassed,
    passed: scopePassed && acceptance.passed,
    failures,
    missing,
    blockers: acceptance.blockers,
    nativeAcceptance: {
      status: failures.length ? "FAIL" : acceptance.passed ? "PASS" : "BLOCKED",
      passed: acceptance.passed,
      // This fixed manifest is never reduced by --case or the short probe profile.
      unmetRequirements: acceptance.failures,
      groups: report.purpose === "acceptance" ? acceptance.groups : undefined,
    },
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const file = process.argv[2];
  if (!file) {
    console.error(
      "Usage: node scripts/atlas-p0-evaluate.mjs <report.json|observation.json> [evaluation.json] [--scenario scenario-id]",
    );
    process.exitCode = 2;
  } else {
    try {
      const source = JSON.parse(await readFile(file, "utf8"));
      const scenarioIndex = process.argv.indexOf("--scenario");
      const id = scenarioIndex < 0 ? null : process.argv[scenarioIndex + 1];
      const spec = P0_REQUIREMENTS.scenarios.find(
        (scenario) => scenario.id === id,
      );
      if (Array.isArray(source.events) && !spec)
        throw new Error(
          "Raw observations require --scenario with a fixed P0 scenario ID",
        );
      if (source.schemaVersion !== 5)
        throw new Error(
          "Expected current P0 schema 5; evaluate historical evidence with its recorded harness commit",
        );
      const result = Array.isArray(source.events)
        ? evaluateObservation(source, spec)
        : evaluateRun(source);
      if (process.argv[3] && !process.argv[3].startsWith("--"))
        await writeFile(process.argv[3], JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result, null, 2));
      process.exitCode =
        "passed" in result && result.passed
          ? 0
          : ["BLOCKED", "INCOMPLETE", "PROXY_ONLY"].includes(result.status)
            ? 2
            : 1;
    } catch (error) {
      console.error(String(error));
      process.exitCode = 1;
    }
  }
}
