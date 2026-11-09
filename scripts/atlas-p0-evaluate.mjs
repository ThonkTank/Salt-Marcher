import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  referenceC1Stroke,
  reconstructReferenceC1Stroke,
} from "./atlas-p0-brush-reference.mjs";

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

export const HEIGHT_COMPOSITION_FACTS = Object.freeze([
  "canonicalSamples",
  "deltaSamples",
  "horizontalSamples",
  "projectionProducts",
  "basisCaptureSamples",
  "canonicalBasisBuilds",
  "colourSamples",
  "anchorCopySamples",
  "compositionWork",
]);

/**
 * Work belongs to actual terrain packets, including upload-only packets while a
 * scene fence is pending. Scene records are never counted again as terrain work.
 * Preparation is observed once per RAF, including RAFs which submit no GL work.
 * These facts do not identify a presented frame or manufacture an input receipt.
 * @param {unknown} events
 * @param {{droppedEvents?: number | null}} [options]
 */
export function evaluateRenderWork(events, { droppedEvents = null } = {}) {
  /** @type {EvaluationIssue[]} */
  const issues = [];
  const fail = (code, detail = {}) => issues.push({ code, ...detail });
  const integer = (value) => Number.isSafeInteger(value) && value >= 0;
  const positive = (value) => integer(value) && value > 0;
  const ordered = (values) =>
    values.every(
      (value, i) => finite(value) && (i === 0 || value >= values[i - 1]),
    );
  if (!Array.isArray(events)) fail("RENDER_WORK_JOURNAL_MISSING");
  if (droppedEvents !== 0)
    fail("RENDER_WORK_EVENTS_DROPPED_OR_UNKNOWN", { droppedEvents });
  const recorded = Array.isArray(events)
    ? events.filter((event) => event && typeof event === "object")
    : [];
  if (Array.isArray(events) && recorded.length !== events.length)
    fail("RENDER_WORK_EVENT_INVALID");
  const packets = recorded.filter((event) => event.kind === "height-terrain");
  const scenes = recorded.filter((event) => event.kind === "height-draw");
  const preparation = recorded.filter(
    (event) => event.kind === "height-preparation",
  );
  if (!scenes.length) fail("RENDER_SCENE_EVIDENCE_MISSING");
  if (!preparation.length) fail("RENDER_PREPARATION_EVIDENCE_MISSING");
  const key = (event, field) => `${event.sessionId}:${event[field]}`;
  const byPreparation = (records) => {
    const grouped = new Map();
    for (const record of records) {
      const identity = key(record, "preparationFrame");
      const own = grouped.get(identity) ?? [];
      own.push(record);
      grouped.set(identity, own);
    }
    return grouped;
  };
  const packetsByPreparation = byPreparation(packets);
  const scenesByPreparation = byPreparation(scenes);
  const prepByFrame = new Map();
  const packetIds = new Set();
  const sceneIds = new Set();
  const resources = (event, detail) => {
    const names = ["cpuBytes", "presentationBytes", "gpuBytes", "sourceBytes"];
    if (
      names.some((name) => !integer(event[name])) ||
      event.cpuBytes > event.presentationBytes
    )
      fail("RENDER_RESOURCE_EVIDENCE_INVALID", detail);
    for (const [field, limitBytes] of [
      ["presentationBytes", 128 * 1024 * 1024],
      ["gpuBytes", 256 * 1024 * 1024],
      ["sourceBytes", 256 * 1024 * 1024],
    ])
      if (integer(event[field]) && event[field] > limitBytes)
        fail("RENDER_RESOURCE_BUDGET_EXCEEDED", {
          ...detail,
          field,
          bytes: event[field],
          limitBytes,
        });
  };
  const slots = (event, detail) => {
    const {
      gpuSubmissions: total,
      terrainSubmissions: terrain,
      sceneSubmissions: scene,
    } = event;
    if (
      ![total, terrain, scene].every(integer) ||
      total !== terrain + scene ||
      (event.kind === "height-terrain" ? terrain !== 1 : scene !== 1)
    )
      fail("RENDER_SUBMISSION_EVIDENCE_INVALID", detail);
    if (total > 2 || terrain > 1 || scene > 1)
      fail("RENDER_SUBMISSION_BUDGET_EXCEEDED", {
        ...detail,
        total,
        terrain,
        scene,
      });
  };
  for (const event of preparation) {
    const detail = {
      sessionId: event.sessionId,
      preparationFrame: event.preparationFrame,
    };
    const identity = key(event, "preparationFrame");
    if (
      !nonempty(event.sessionId) ||
      !positive(event.preparationFrame) ||
      prepByFrame.has(identity) ||
      !ordered([event.preparationStart, event.at]) ||
      !finite(event.preparationMs) ||
      event.preparationMs < 0 ||
      !integer(event.preparationSteps) ||
      !integer(event.sourceSteps) ||
      event.sourceSteps > event.preparationSteps
    )
      fail("RENDER_PREPARATION_EVIDENCE_INVALID", detail);
    if (event.preparationSteps > 128)
      fail("RENDER_PREPARATION_STEP_BUDGET_EXCEEDED", {
        ...detail,
        steps: event.preparationSteps,
        limitSteps: 128,
      });
    prepByFrame.set(identity, event);
    resources(event, detail);
  }
  const linkedPreparation = (event, detail) => {
    const prepared = prepByFrame.get(key(event, "preparationFrame"));
    if (
      !positive(event.preparationFrame) ||
      !prepared ||
      !ordered([
        prepared?.preparationStart,
        event.submittedAt,
        event.at,
        prepared?.at,
      ])
    )
      fail("RENDER_PREPARATION_LINK_INVALID", detail);
  };
  const spans = (event, name, measure, detail) => {
    const values = event[name];
    if (
      !Array.isArray(values) ||
      (name === "uploadSpans" && !values.length) ||
      values.some(
        (span, i) =>
          !ordered([
            event.uploadStart,
            span?.start,
            span?.end,
            event.submittedAt,
          ]) ||
          !integer(span?.[measure]) ||
          (i > 0 && span.start < values[i - 1].end),
      )
    ) {
      fail("RENDER_PACKET_SPANS_INVALID", { ...detail, field: name });
      return null;
    }
    return values.reduce((sum, span) => sum + span[measure], 0);
  };
  for (const event of packets) {
    const detail = { sessionId: event.sessionId, packet: event.packet };
    const identity = key(event, "packet");
    if (
      !nonempty(event.sessionId) ||
      !positive(event.packet) ||
      packetIds.has(identity) ||
      !positive(event.renderId) ||
      !integer(event.revision) ||
      !integer(event.viewGeneration) ||
      !ordered([
        event.uploadStart,
        event.uploadedAt,
        event.submittedAt,
        event.at,
      ])
    )
      fail("RENDER_PACKET_IDENTITY_OR_CLOCK_INVALID", detail);
    packetIds.add(identity);
    linkedPreparation(event, detail);
    slots(event, detail);
    resources(event, detail);
    if (
      [
        ...HEIGHT_COMPOSITION_FACTS,
        "uploadedBytes",
        "updatedTiles",
        "composedSamples",
        "fallbackSamples",
      ].some((name) => !integer(event[name])) ||
      event.colourSamples + event.basisCaptureSamples !==
        event.composedSamples ||
      event.canonicalSamples + event.deltaSamples + event.basisCaptureSamples >
        event.composedSamples
    )
      fail("RENDER_COMPOSITION_EVIDENCE_INVALID", detail);
    const uploadBytes = spans(event, "uploadSpans", "bytes", detail);
    const composition = spans(event, "compositionSpans", "work", detail);
    if (
      uploadBytes !== event.uploadedBytes ||
      composition !== event.compositionWork ||
      !Array.isArray(event.uploadSpans) ||
      event.uploadSpans[0]?.start !== event.uploadStart ||
      event.uploadSpans.at(-1)?.end !== event.uploadedAt
    )
      fail("RENDER_PACKET_TOTALS_INCONSISTENT", detail);
    if (uploadBytes !== null && composition !== null) {
      const all = [...event.uploadSpans, ...event.compositionSpans].sort(
        (a, b) => a.start - b.start,
      );
      if (all.some((span, i) => i > 0 && span.start < all[i - 1].end))
        fail("RENDER_PACKET_SPANS_OVERLAP", detail);
    }
    if (event.uploadedBytes > 4 * 1024 * 1024)
      fail("RENDER_UPLOAD_BUDGET_EXCEEDED", {
        ...detail,
        bytes: event.uploadedBytes,
        limitBytes: 4 * 1024 * 1024,
      });
    if (event.compositionWork > 23 * 128 * 128)
      fail("RENDER_COMPOSITION_BUDGET_EXCEEDED", {
        ...detail,
        work: event.compositionWork,
        limitWork: 23 * 128 * 128,
      });
  }
  for (const event of scenes) {
    const detail = { sessionId: event.sessionId, frame: event.frame };
    const identity = key(event, "frame");
    if (
      !nonempty(event.sessionId) ||
      !positive(event.frame) ||
      sceneIds.has(identity) ||
      !integer(event.revision) ||
      !integer(event.viewGeneration) ||
      (event.renderId !== null && !positive(event.renderId)) ||
      !ordered([event.sceneStart, event.submittedAt, event.at])
    )
      fail("RENDER_SCENE_IDENTITY_OR_CLOCK_INVALID", detail);
    sceneIds.add(identity);
    linkedPreparation(event, detail);
    slots(event, detail);
    // Legacy copied scene counters cannot substitute for a missing packet.
    if (
      (event.uploadedBytes > 0 || event.compositionWork > 0) &&
      !(packetsByPreparation.get(key(event, "preparationFrame")) ?? []).some(
        (packet) =>
          packet.sessionId === event.sessionId &&
          packet.preparationFrame === event.preparationFrame &&
          packet.submittedAt <= event.sceneStart,
      )
    )
      fail("RENDER_TERRAIN_PACKET_MISSING", detail);
  }
  // The caps apply to a RAF, not separately to each claimed packet. Reject a
  // duplicated packet/frame instead of allowing a report to split excess work.
  for (const [identity, prepared] of prepByFrame) {
    const own = packetsByPreparation.get(identity) ?? [];
    const canvas = scenesByPreparation.get(identity) ?? [];
    const detail = {
      sessionId: prepared.sessionId,
      preparationFrame: prepared.preparationFrame,
    };
    if (own.length > 1 || canvas.length > 1)
      fail("RENDER_FRAME_PACKETS_DUPLICATED", {
        ...detail,
        terrainPackets: own.length,
        scenes: canvas.length,
      });
    const bytes = own.reduce(
      (sum, packet) =>
        sum + (integer(packet.uploadedBytes) ? packet.uploadedBytes : 0),
      0,
    );
    const work = own.reduce(
      (sum, packet) =>
        sum + (integer(packet.compositionWork) ? packet.compositionWork : 0),
      0,
    );
    if (own.length > 1 && bytes > 4 * 1024 * 1024)
      fail("RENDER_UPLOAD_BUDGET_EXCEEDED", {
        ...detail,
        bytes,
        limitBytes: 4 * 1024 * 1024,
      });
    if (own.length > 1 && work > 23 * 128 * 128)
      fail("RENDER_COMPOSITION_BUDGET_EXCEEDED", {
        ...detail,
        work,
        limitWork: 23 * 128 * 128,
      });
  }
  const preparationMs = distribution(
    preparation.map((event) => event.preparationMs),
  );
  const overruns = preparation
    .filter((event) => finite(event.preparationMs) && event.preparationMs > 2)
    .map((event) => ({
      sessionId: event.sessionId,
      preparationFrame: event.preparationFrame,
      milliseconds: event.preparationMs,
      limitMs: 2,
    }));
  return {
    passed: issues.length === 0,
    issues,
    terrainPackets: packets.length,
    uploadOnlyPackets: packets.filter((event) => event.compositionWork === 0)
      .length,
    scenes: scenes.length,
    preparationFrames: preparation.length,
    uploadedBytes: distribution(packets.map((event) => event.uploadedBytes)),
    totalUploadedBytes: packets.reduce(
      (sum, event) =>
        sum + (integer(event.uploadedBytes) ? event.uploadedBytes : 0),
      0,
    ),
    composedSamples: distribution(
      packets.map((event) => event.composedSamples),
    ),
    composition: Object.fromEntries(
      HEIGHT_COMPOSITION_FACTS.map((name) => [
        name,
        {
          total: packets.reduce(
            (sum, event) => sum + (integer(event[name]) ? event[name] : 0),
            0,
          ),
          perPacket: distribution(packets.map((event) => event[name])),
        },
      ]),
    ),
    preparationMs,
    preparationTiming: {
      limitMs: 2,
      met:
        preparationMs.count > 0 &&
        preparationMs.invalid === 0 &&
        overruns.length === 0,
      overruns,
    },
    interpretation:
      "Actual terrain packets and per-RAF preparation only; copied scene work is excluded. CPU timing is uncapped and requires qualified native hardware for an acceptance claim. GL submission is not native presentation.",
  };
}

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
  const renderWork = (Array.isArray(report.runs) ? report.runs : [])
    .filter((run) => run.role !== "control")
    .map((run) => ({
      run: run.id,
      ...evaluateRenderWork(run.renderPackets, {
        droppedEvents: run.renderDroppedEvents,
      }),
    }));
  for (const result of renderWork)
    for (const issue of result.issues)
      fail(issue.code, { ...issue, run: result.run });
  if (
    report.mode === "native" &&
    report.reference?.qualified === true &&
    report.reference?.softwareRendering === false
  )
    for (const work of renderWork)
      for (const overrun of work.preparationTiming.overruns)
        fail("RENDER_PREPARATION_TIME_EXCEEDED", { ...overrun, run: work.run });
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
    renderWork,
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

/** A time descriptor may be used in isolation by the timing diagnosis. */
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

const effectKey = (event, id = event.admissionId) =>
  event.sessionId + "/" + event.gestureId + "/" + id;
const gestureKey = (event) => event.sessionId + "/" + event.gestureId;
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0;
const nonnegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const boundsValid = (bounds) =>
  Array.isArray(bounds) &&
  bounds.length === 4 &&
  bounds.every(finite) &&
  bounds[0] < bounds[2] &&
  bounds[1] < bounds[3];

/** Geometry and finite causal time are admitted before source materialization. */
function validC1Admission(event) {
  if (
    !nonempty(event?.sessionId) ||
    !positiveInteger(event?.gestureId) ||
    !positiveInteger(event?.admissionId) ||
    !pointValid(event?.from) ||
    !pointValid(event?.to) ||
    !Array.isArray(event?.path) ||
    !event.path.every(pointValid) ||
    !samePoint(event.path.at(-1) ?? event.from, event.to) ||
    !Array.isArray(event?.segments) ||
    !Array.isArray(event?.samples) ||
    !finite(event?.observedAt) ||
    event.observedAt > event.at ||
    !Array.isArray(event?.inputIds) ||
    !event.inputIds.every(positiveInteger) ||
    new Set(event.inputIds).size !== event.inputIds.length ||
    ![
      event.at,
      event.fromAt,
      event.toAt,
      event.rawElapsedMs,
      event.offeredElapsedMs,
      event.rateFtPerSecond,
      event.radius,
      event.acceptedTimeEffect,
      event.discardedTimeEffect,
    ].every(finite) ||
    event.radius <= 0 ||
    !nonnegativeInteger(event.level) ||
    event.level > 21 ||
    event.toAt < event.fromAt ||
    event.at < event.toAt ||
    Math.abs(event.toAt - event.fromAt - event.rawElapsedMs) > 1e-6 ||
    Math.abs(event.offeredElapsedMs - Math.min(50, event.rawElapsedMs)) >
      1e-6 ||
    event.acceptedTimeEffect < 0 ||
    event.discardedTimeEffect < 0 ||
    !["press", "hold", "move", "terminal"].includes(event.cause) ||
    typeof event.end !== "boolean" ||
    event.end !== (event.cause === "terminal") ||
    !nonnegativeInteger(event.pointCount) ||
    event.pointCount < event.path.length ||
    (event.end && event.pointCount === 0) ||
    event.pointCount > (event.end ? 128 : 127) ||
    !nonnegativeInteger(event.pendingPoints) ||
    event.pendingPoints > 128 ||
    typeof event.reserved !== "boolean" ||
    !nonnegativeInteger(event.reservedCells) ||
    event.reserved !== event.reservedCells > 0
  )
    return false;
  if (
    event.cause !== "press" &&
    (event.samples.length !== event.path.length ||
      event.samples.length !== event.inputIds.length ||
      !event.samples.every(
        (sample, index) =>
          pointValid(sample?.point) &&
          samePoint(sample.point, event.path[index]) &&
          sample.input === event.inputIds[index] &&
          finite(sample.at) &&
          sample.at <= event.observedAt,
      ))
  )
    return false;
  let elapsed = 0;
  const geometry = [event.from, ...event.path];
  for (const segment of event.segments) {
    if (
      !pointValid(segment?.from) ||
      !pointValid(segment?.to) ||
      !finite(segment?.elapsedMs) ||
      segment.elapsedMs < 0
    )
      return false;
    if (
      !geometry.some(
        (point, index) =>
          samePoint(segment.from, point) &&
          (samePoint(segment.to, geometry[index + 1] ?? point) ||
            samePoint(segment.from, segment.to)),
      )
    )
      return false;
    elapsed += segment.elapsedMs;
  }
  return Math.abs(elapsed - event.offeredElapsedMs) <= 1e-6;
}

function validC1Work(work, rate) {
  return (
    work &&
    [work.maxOutstandingEffect, work.effectLimit].every(finite) &&
    Math.abs(work.effectLimit - Math.abs(rate) * 0.05) <= 1e-10 &&
    work.maxOutstandingEffect >= 0 &&
    work.maxOutstandingEffect <= work.effectLimit + 1e-10 &&
    nonnegativeInteger(work.pendingPoints) &&
    work.pendingPoints <= 128 &&
    nonnegativeInteger(work.pendingCells) &&
    // Repeated windows can reserve the same coefficient. Ticket storage and
    // unique author cells therefore have different finite bounds.
    work.pendingCells <= work.pendingAdmissions * 100_000 &&
    work.pendingCells * 12 <= work.bufferBytes &&
    nonnegativeInteger(work.pendingAdmissions) &&
    work.pendingAdmissions <= 128 &&
    nonnegativeInteger(work.cells) &&
    work.cells <= 100_000 &&
    nonnegativeInteger(work.tiles) &&
    work.tiles <= 512 &&
    nonnegativeInteger(work.bufferBytes) &&
    work.bufferBytes <= 32 * 1024 * 1024
  );
}

/** Exact cursor ranges prove that previously reserved cells are consumed once. */
function c1Applications(events, sessionId) {
  const admissions = new Map(),
    applications = new Map(),
    sealed = new Map(),
    completed = new Map(),
    lastAdmission = new Map();
  const issues = [];
  const fail = (code, event, details = {}) =>
    issues.push({ code, gestureId: event.gestureId, ...details });
  for (const event of events) {
    if (sessionId !== undefined && event.sessionId !== sessionId) continue;
    const key = gestureKey(event);
    if (event.kind === "brush-accepted") {
      const id = effectKey(event),
        valid = validC1Admission(event);
      if (!valid)
        fail("INVALID_C1_ADMISSION", event, { admissionId: event.admissionId });
      if (sealed.has(key) || completed.has(key))
        fail("BRUSH_ADMISSION_AFTER_SEAL", event, {
          admissionId: event.admissionId,
        });
      if (admissions.has(id)) {
        fail("DUPLICATE_BRUSH_ADMISSION", event, {
          admissionId: event.admissionId,
        });
        continue;
      }
      if (event.admissionId <= (lastAdmission.get(key) ?? -1))
        fail("UNORDERED_BRUSH_ADMISSION", event, {
          admissionId: event.admissionId,
        });
      lastAdmission.set(key, event.admissionId);
      if (
        !validC1Work(event.work, event.rateFtPerSecond) ||
        event.pendingPoints !== event.work?.pendingPoints
      )
        fail("INVALID_BRUSH_RESERVATION_PROOF", event, {
          admissionId: event.admissionId,
        });
      admissions.set(id, {
        event,
        cursor: 0,
        valid: valid && !sealed.has(key) && !completed.has(key),
      });
    } else if (event.kind === "brush-end") {
      if (sealed.has(key)) fail("DUPLICATE_BRUSH_SEAL", event);
      sealed.set(key, event);
    } else if (event.kind === "brush-complete") {
      if (completed.has(key) || !sealed.has(key))
        fail("INVALID_BRUSH_COMPLETION", event);
      if (
        event.pendingCells !== 0 ||
        event.pendingPoints !== 0 ||
        event.pendingAdmissions !== 0
      )
        fail("INCOMPLETE_BRUSH_COMPLETION", event);
      for (const entry of admissions.values())
        if (
          gestureKey(entry.event) === key &&
          entry.cursor !== entry.event.reservedCells
        )
          fail("UNMATERIALIZED_BRUSH_RESERVATION", event, {
            admissionId: entry.event.admissionId,
          });
      completed.set(key, event);
    } else if (event.kind === "brush-interval") {
      let valid =
        event.dosing === "c1" &&
        event.cause === "materialize" &&
        Array.isArray(event.applications) &&
        event.applications.length > 0 &&
        Array.isArray(event.admissionIds) &&
        Array.isArray(event.completedAdmissionIds) &&
        Array.isArray(event.inputIds) &&
        typeof event.changed === "boolean" &&
        typeof event.sealed === "boolean" &&
        event.sealed === sealed.has(key) &&
        finite(event.at) &&
        !completed.has(key);
      const ids = [],
        finished = [],
        expectedInputs = [];
      if (Array.isArray(event.applications))
        for (const part of event.applications) {
          const entry = admissions.get(effectKey(event, part?.admissionId));
          const ok =
            entry?.valid &&
            entry.event.reserved &&
            event.at >= entry.event.at &&
            positiveInteger(part.toCell) &&
            nonnegativeInteger(part.fromCell) &&
            part.fromCell === entry.cursor &&
            part.toCell > part.fromCell &&
            part.totalCells === entry.event.reservedCells &&
            part.toCell <= part.totalCells &&
            !ids.includes(part.admissionId);
          if (!ok) {
            valid = false;
            continue;
          }
          entry.cursor = part.toCell;
          ids.push(part.admissionId);
          if (part.toCell === part.totalCells) {
            finished.push(part.admissionId);
            if (entry.event.cause !== "terminal")
              expectedInputs.push(...entry.event.inputIds);
          }
        }
      const sameIds = (actual, expected) =>
        Array.isArray(actual) &&
        actual.length === expected.length &&
        actual.every((id, index) => id === expected[index]);
      valid &&=
        sameIds(event.admissionIds, ids) &&
        sameIds(event.completedAdmissionIds, finished) &&
        sameIds(event.inputIds, expectedInputs);
      if (!valid)
        fail(
          completed.has(key)
            ? "BRUSH_MUTATION_AFTER_COMPLETION"
            : "INVALID_BRUSH_MATERIALIZATION",
          event,
          { intervalId: event.intervalId },
        );
      applications.set(event, valid);
    }
  }
  for (const [key, end] of sealed)
    if (!completed.has(key)) fail("BRUSH_ACTION_INCOMPLETE", end);
  return { admissions, applications, sealed, completed, issues };
}

/** One interpretation of input -> dose/commit -> local receipt -> real draw. */
export function extractSubmissionEvidence(events) {
  const admitted = c1Applications(events);
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
          !(change.dosing === "c1"
            ? admitted.applications.get(change) === true
            : validBrushGeometry(change)) ||
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
  return {
    inputs,
    frames,
    doses,
    commits,
    changesByInput,
    publication,
    admissions: admitted.admissions,
  };
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
    const prepaid =
      noop?.accepted === true &&
      noop?.reason === "prepaid" &&
      [...evidence.admissions.values()].some(
        ({ event, valid }) =>
          valid &&
          validC1Work(event.work, event.rateFtPerSecond) &&
          event.sessionId === sessionId &&
          event.gestureId === noop.gestureId &&
          event.at <= noop.at &&
          event.reserved === false &&
          event.reservedCells === 0 &&
          event.inputIds.includes(inputId),
      );
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
      noopEvidence: prepaid ? "c1-prepaid-v1" : null,
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

/** An explicitly reported capacity overflow is separate from normal brush work. */
function isD10Discard(sample) {
  return (
    isProcessedNoop(sample) &&
    sample.accepted === false &&
    sample.inputKind === "edit" &&
    sample.eventType === "pointermove" &&
    Number.isSafeInteger(sample.gestureId) &&
    sample.discardedDuringGesture === true &&
    sample.noopReason === "overflow"
  );
}

/** Prepaid input is processed, but contributes no new source effect or frame. */
function isC1PrepaidNoop(sample) {
  return (
    isProcessedNoop(sample) &&
    sample.inputKind === "edit" &&
    sample.accepted === true &&
    sample.noopReason === "prepaid" &&
    sample.noopEvidence === "c1-prepaid-v1"
  );
}
const isNonchangingInput = (sample) =>
  isD10Discard(sample) || isC1PrepaidNoop(sample);

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

/** Every materialization consumes admitted cells; only full frozen GPU receipts release effect. */
export function evaluateBrushPublicationOrder(events, sessionId) {
  const ledger = c1Applications(events, sessionId);
  const evidence = extractSubmissionEvidence(events);
  const issues = [...ledger.issues],
    steps = [];
  for (const interval of events) {
    if (
      interval.kind !== "brush-interval" ||
      interval.changed !== true ||
      (sessionId !== undefined && interval.sessionId !== sessionId)
    )
      continue;
    const receipt = evidence.publication(interval)?.receipt;
    if (!receipt)
      issues.push({
        code: "BRUSH_STEP_SUBMISSION_MISSING",
        intervalId: interval.intervalId,
      });
    steps.push({
      intervalId: interval.intervalId,
      gestureId: interval.gestureId,
      sessionId: interval.sessionId,
      modelAt: interval.at,
      frameId: receipt?.frame ?? null,
      submittedAt: receipt?.at ?? null,
      modelEvent: events.indexOf(interval),
      submitEvent: receipt ? events.indexOf(receipt) : null,
      retiredAt: null,
      retiredReason: null,
    });
  }
  const sameRender = (a, b) =>
    a &&
    b &&
    ["id", "sessionId", "viewGeneration", "preparationId", "revision"].every(
      (key) => a[key] === b[key],
    ) &&
    JSON.stringify(a.bounds) === JSON.stringify(b.bounds);
  const frozen = new Map(),
    acknowledged = new Set();
  for (const event of events) {
    if (sessionId !== undefined && event.sessionId !== sessionId) continue;
    const key = effectKey(event, event.receiptId ?? event.effectReceipt?.id);
    if (event.kind === "brush-frozen") frozen.set(key, event);
    if (event.kind !== "brush-feedback" || event.accepted !== true) continue;
    const request = frozen.get(key),
      render = event.renderReceipt;
    const completion = events.find(
      (candidate) =>
        ["gpu-completed", "render-current"].includes(candidate.kind) &&
        candidate.sessionId === event.sessionId &&
        finite(candidate.at) &&
        candidate.at <= event.at &&
        (candidate.kind === "render-current" || candidate.at >= request?.at) &&
        sameRender(candidate.renderReceipt, render),
    );
    const frame =
      completion &&
      evidence.frames.get(event.sessionId + "/" + completion.frame);
    const proven =
      request &&
      !acknowledged.has(key) &&
      finite(request.at) &&
      request.at <= event.at &&
      positiveInteger(event.receiptId ?? event.effectReceipt?.id) &&
      sameRender(request.renderReceipt, render) &&
      render.sessionId === event.sessionId &&
      Array.isArray(render.bounds) &&
      render.bounds.length > 0 &&
      render.bounds.every(boundsValid) &&
      completion &&
      frame &&
      frame.viewGeneration === render.viewGeneration &&
      frame.revision >= render.revision &&
      frame.at <= completion.at;
    if (!proven)
      issues.push({
        code: "UNPROVEN_BRUSH_EFFECT_RECEIPT",
        gestureId: event.gestureId,
      });
    acknowledged.add(key);
    const admission = [...ledger.admissions.values()].find(
      (entry) => gestureKey(entry.event) === gestureKey(event),
    );
    if (!validC1Work(event.work, admission?.event.rateFtPerSecond))
      issues.push({
        code: "INVALID_BRUSH_RESERVATION_PROOF",
        gestureId: event.gestureId,
      });
  }
  return { passed: issues.length === 0, issues, steps };
}

/** Causal windows preserve every accepted path point and may finish after seal. */
export function evaluateBrushTime(events, inputIds, sessionId) {
  const issues = [],
    wanted = new Set(inputIds),
    epsilon = 1e-6;
  const fail = (code, detail = {}) => issues.push({ code, ...detail });
  const inputs = events.filter(
    (event) => event.kind === "input" && wanted.has(event.id),
  );
  const down = inputs.find((event) => event.inputKind === "edit");
  const up = inputs.find((event) => event.inputKind === "pointerup");
  const starts = events.filter(
    (event) =>
      event.kind === "brush-start" &&
      event.sessionId === sessionId &&
      event.input === down?.id,
  );
  const start = starts[0];
  const own = (event) =>
    event.sessionId === sessionId && event.gestureId === start?.gestureId;
  const ends = events.filter(
    (event) => event.kind === "brush-end" && own(event),
  );
  const completions = events.filter(
    (event) => event.kind === "brush-complete" && own(event),
  );
  const end = ends[0],
    complete = completions[0];
  if (
    starts.length !== 1 ||
    ends.length !== 1 ||
    completions.length !== 1 ||
    start?.dosing !== "c1"
  )
    fail("BRUSH_TIME_BOUNDARIES_MISSING");
  if (!down || !up || end?.input !== up.id) fail("BRUSH_RELEASE_UNPROVEN");
  if (
    ![
      start?.startAt,
      start?.inputAt,
      end?.inputAt,
      end?.clock,
      end?.endAt,
      complete?.at,
    ].every(finite) ||
    Math.abs(start.inputAt - down?.createdAt) > epsilon ||
    Math.abs(end.inputAt - up?.createdAt) > epsilon ||
    start.startAt !== start.inputAt ||
    end.endAt < end.inputAt ||
    end.clock > end.endAt ||
    complete.at < end.at
  )
    fail("INVALID_BRUSH_TIME_CLOCK");
  const accepted = events.filter(
    (event) => event.kind === "brush-accepted" && own(event),
  );
  const intervals = events.filter(
    (event) => event.kind === "brush-interval" && own(event),
  );
  const publication = evaluateBrushPublicationOrder(events, sessionId);
  issues.push(...publication.issues);
  if (!accepted.length) fail("BRUSH_ADMISSION_MISSING");
  if (
    new Set(intervals.map((event) => event.intervalId)).size !==
    intervals.length
  )
    fail("DUPLICATE_BRUSH_INTERVAL");
  let clock = start?.startAt,
    previous = start?.point,
    terminal = false,
    acceptedMs = 0,
    cappedMs = 0,
    discardedTimeEffect = 0;
  const valid = [];
  for (const admission of accepted) {
    const detail = { admissionId: admission.admissionId };
    if (!validC1Admission(admission)) continue;
    valid.push(admission);
    if (
      ["rateFtPerSecond", "radius", "level"].some(
        (key) => admission[key] !== start?.[key],
      )
    )
      fail("BRUSH_PARAMETERS_CHANGED", detail);
    if (admission.fromAt - clock > epsilon)
      fail("UNEXPLAINED_BRUSH_TIME", detail);
    if (clock - admission.fromAt > epsilon)
      fail("OVERLAPPING_BRUSH_TIME", detail);
    if (!samePoint(admission.from, previous))
      fail("DISCONNECTED_BRUSH_PATH", detail);
    if (terminal || events.indexOf(admission) >= events.indexOf(end))
      fail("BRUSH_ADMISSION_AFTER_SEAL", detail);
    if (
      admission.cause === "press" &&
      (valid.length !== 1 ||
        admission.rawElapsedMs !== 0 ||
        admission.offeredElapsedMs !== 0 ||
        !samePoint(admission.from, admission.to))
    )
      fail("INVALID_C1_INITIAL_MINIMUM", detail);
    if (admission.end) {
      terminal = true;
      if (
        events.indexOf(admission) <= events.indexOf(up) ||
        !admission.inputIds.includes(up?.id) ||
        Math.abs(admission.toAt - Math.max(clock, up?.createdAt)) > epsilon
      )
        fail("INVALID_C1_TERMINAL_TIME", detail);
    }
    for (const id of admission.inputIds) {
      const input = inputs.find((event) => event.id === id);
      if (!wanted.has(id) || !input || input.at > admission.at)
        fail("INVALID_BRUSH_INPUT_BINDING", detail);
    }
    for (const sample of admission.samples) {
      const input = inputs.find((event) => event.id === sample.input);
      if (!input || Math.abs(input.createdAt - sample.at) > epsilon)
        fail("INVALID_BRUSH_INPUT_TIME", detail);
    }
    clock = admission.toAt;
    previous = admission.to;
    acceptedMs += admission.offeredElapsedMs;
    cappedMs += admission.rawElapsedMs - admission.offeredElapsedMs;
    discardedTimeEffect += admission.discardedTimeEffect;
  }
  if (!terminal) fail("BRUSH_TERMINAL_ADMISSION_MISSING");
  if (Math.abs(clock - end?.clock) > epsilon) fail("UNEXPLAINED_BRUSH_TIME");
  if (accepted.filter((event) => event.cause === "press").length !== 1)
    fail("INVALID_C1_INITIAL_MINIMUM");
  for (const input of inputs)
    if (!accepted.some((admission) => admission.inputIds?.includes(input.id)))
      fail("BRUSH_INPUT_NOT_ADMITTED", { inputId: input.id });
  const inputManifest = start
    ? {
        brush: {
          level: start.level,
          radius: start.radius,
          amount: start.rateFtPerSecond,
        },
        start: { point: start.point, at: start.inputAt, input: start.input },
        windows: accepted
          .filter((event) => event.cause !== "press")
          .map((event) => ({
            at: event.observedAt,
            points: event.samples,
            end: event.end,
          })),
      }
    : null;
  try {
    if (!inputManifest) throw new Error("Missing C1 input manifest");
    referenceC1Stroke(inputManifest, [start?.point]);
  } catch {
    fail("INVALID_C1_INPUT_MANIFEST");
  }
  const submissions = publication.steps.filter(
    (step) => step.gestureId === start?.gestureId && finite(step.submittedAt),
  );
  const stationary =
    pointValid(start?.point) &&
    valid.length === accepted.length &&
    accepted.every(
      (event) =>
        samePoint(event.from, start.point) &&
        event.path.every((point) => samePoint(point, start.point)) &&
        samePoint(event.to, start.point),
    );
  const feedback = [
    start?.startAt,
    ...submissions
      .map((step) => step.submittedAt)
      .filter((at) => at < end?.endAt),
    end?.endAt,
  ]
    .filter(finite)
    .sort((a, b) => a - b);
  return {
    passed: issues.length === 0,
    issues,
    gestureId: start?.gestureId ?? null,
    inputManifest,
    inputQueueMs: {
      down: start ? start.at - start.inputAt : null,
      up: end ? end.endAt - end.inputAt : null,
    },
    startAt: start?.startAt ?? null,
    endAt: end?.inputAt ?? null,
    completedAt: complete?.at ?? null,
    heldMs: start && end ? end.inputAt - start.inputAt : null,
    acceptedMs,
    timedDoseMs: acceptedMs,
    pressDoseMs: 1000 / 60,
    acceptedDoseFt:
      stationary && discardedTimeEffect <= 1e-10
        ? start.rateFtPerSecond * Math.max(1 / 60, acceptedMs / 1000)
        : null,
    discardedTimeEffect,
    discardMs: { cap: cappedMs },
    maximumStepMs: Math.max(0, ...valid.map((event) => event.offeredElapsedMs)),
    maximumRawStepMs: Math.max(0, ...valid.map((event) => event.rawElapsedMs)),
    intervalIds: intervals.map((event) => event.intervalId),
    changedSteps: intervals.filter((event) => event.changed).length,
    submittedSteps: submissions.length,
    submissionMs: distribution(
      submissions.map((step) => step.submittedAt - step.modelAt),
    ),
    retiredSteps: 0,
    maximumFeedbackGapMs: Math.max(
      0,
      ...feedback.slice(1).map((at, index) => at - feedback[index]),
    ),
    stationary,
    interpretation:
      "C1 swept minimum prepays causal time; each window offers at most 50 ms. Accepted work may materialize after seal. Submission and GPU completion do not prove native presentation.",
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

/** Fixed before candidate measurement; these are height values in feet. */
export const BRUSH_CONTENT_TOLERANCE = Object.freeze({
  absolute: 1e-10,
  relative: 1e-9,
});

/**
 * @typedef {{point: readonly number[], at: number, input: number}} BrushInputPoint
 * @typedef {{brush: {level: number, radius: number, amount: number}, start: BrushInputPoint, windows: readonly {at: number, points: readonly BrushInputPoint[], end?: boolean}[]}} BrushInputManifest
 * @typedef {{input: BrushInputManifest, mode: "normal" | "overload", probes: readonly (readonly number[])[], centerline: readonly (readonly number[])[], regions: readonly {id: string, indices: readonly number[]}[]}} BrushContentSpec
 * @typedef {{initial: readonly number[], spatial: readonly number[], time: readonly number[], total: readonly number[]}} BrushObservedChannels
 */

/**
 * @typedef {BrushObservedChannels & {floor: readonly number[], timeAccount: readonly number[]}} C1ObservedChannels
 * @typedef {C1ObservedChannels & {centerlineSpatial: readonly number[], windows: readonly (C1ObservedChannels & {fromAt:number,toAt:number})[]}} C1ContentObservation
 */

/**
 * The single justified C1 comparison keeps the same input and strength anchors.
 * Credit is counted in the cumulative time account, never as a second source
 * increment: per author coefficient H = max(floor, accepted temporal offer).
 * This equation must be checked before positive cubic surface reconstruction.
 * @param {BrushContentSpec} spec
 * @param {C1ContentObservation} observed
 */
export function evaluateC1StrokeContent(spec, observed) {
  /** @type {EvaluationIssue[]} */
  const failures = [];
  const fail = (code, details = {}) => failures.push({ code, ...details });
  const result = () => ({
    scope: "R1-model-content",
    candidate: "C1",
    status: failures.length ? "FAIL" : "PASS",
    passed: failures.length === 0,
    failures,
  });
  const point = (value) =>
    Array.isArray(value) && value.length === 2 && value.every(finite);
  if (
    !spec ||
    !["normal", "overload"].includes(spec.mode) ||
    !Array.isArray(spec.probes) ||
    !spec.probes.length ||
    !spec.probes.every(point) ||
    !Array.isArray(spec.centerline) ||
    !spec.centerline.length ||
    !spec.centerline.every(point) ||
    !Array.isArray(spec.regions) ||
    !spec.regions.length
  ) {
    fail("C1_INVALID_CONTENT_MANIFEST");
    return result();
  }
  let expected;
  let surface;
  try {
    expected = referenceC1Stroke(spec.input, spec.probes);
    surface = reconstructReferenceC1Stroke(spec.input, spec.centerline);
  } catch (error) {
    fail("C1_INVALID_INPUT_REFERENCE", { reason: String(error) });
    return result();
  }
  const width = spec.probes.length;
  const step = 5 * 2 ** spec.input.brush.level;
  if (
    spec.probes.some((probe) =>
      probe.some((axis) => !Number.isInteger(axis / step)),
    )
  )
    fail("C1_NON_AUTHOR_PROBE");
  for (const input of [
    spec.input.start,
    ...spec.input.windows.flatMap((window) => window.points),
  ])
    if (
      !spec.centerline.some(
        (probe) => probe[0] === input.point[0] && probe[1] === input.point[1],
      )
    )
      fail("C1_MISSING_PATH_VERTEX", { input: input.input });
  const ids = new Set();
  const covered = new Set();
  for (const region of spec.regions) {
    if (
      !region ||
      typeof region.id !== "string" ||
      !region.id ||
      ids.has(region.id) ||
      !Array.isArray(region.indices) ||
      !region.indices.length ||
      new Set(region.indices).size !== region.indices.length ||
      region.indices.some(
        (index) => !Number.isInteger(index) || index < 0 || index >= width,
      )
    ) {
      fail("C1_INVALID_REGION_MANIFEST");
      continue;
    }
    ids.add(region.id);
    for (const index of region.indices) covered.add(index);
  }
  if (covered.size !== width) fail("C1_UNCOVERED_AUTHOR_PROBE");
  const channels = /** @type {const} */ ([
    "initial",
    "spatial",
    "time",
    "total",
    "floor",
    "timeAccount",
  ]);
  const vector = (values, length) =>
    Array.isArray(values) && values.length === length && values.every(finite);
  if (
    !observed ||
    channels.some((channel) => !vector(observed[channel], width)) ||
    !vector(observed.centerlineSpatial, spec.centerline.length) ||
    !Array.isArray(observed.windows) ||
    observed.windows.length !== expected.timeWindows.length ||
    observed.windows.some(
      (window, index) =>
        !window ||
        window.fromAt !== expected.timeWindows[index].fromAt ||
        window.toAt !== expected.timeWindows[index].toAt ||
        channels.some((channel) => !vector(window[channel], width)),
    )
  )
    fail("C1_MISSING_OR_INVALID_OBSERVATION");
  if (failures.length) return result();

  const sign = Math.sign(spec.input.brush.amount) || 1;
  const tolerance = (value) =>
    BRUSH_CONTENT_TOLERANCE.absolute +
    BRUSH_CONTENT_TOLERANCE.relative * Math.abs(value);
  const compare = (actual, minimum, maximum, epsilon, details) => {
    if (![actual, minimum, maximum, epsilon].every(finite)) {
      fail("C1_NONFINITE_REFERENCE_OR_AGGREGATE", details);
      return;
    }
    if (sign * actual < -epsilon) fail("C1_WRONG_SIGN", details);
    if (sign * actual + epsilon < sign * minimum)
      fail("C1_CONTENT_UNDER_TARGET", { ...details, actual, minimum });
    if (sign * actual - epsilon > sign * maximum)
      fail("C1_CONTENT_OVER_TARGET", { ...details, actual, maximum });
  };
  const checkVector = (actual, minimum, maximum, channel, scope) => {
    for (let index = 0; index < width; index++)
      compare(
        actual[index],
        minimum[index],
        maximum[index],
        tolerance(maximum[index]),
        { scope, channel, index },
      );
    for (const region of [
      { id: "whole-probe-set", indices: spec.probes.map((_, index) => index) },
      ...spec.regions,
    ]) {
      const sum = (values) =>
        region.indices.reduce((total, index) => total + values[index], 0);
      const epsilon = region.indices.reduce(
        (total, index) => total + tolerance(maximum[index]),
        0,
      );
      compare(sum(actual), sum(minimum), sum(maximum), epsilon, {
        scope,
        channel,
        region: region.id,
      });
    }
  };
  const checkAccount = (actual, reference, scope) => {
    const lower = reference.uncappedTimeAccount.map((value) =>
      spec.mode === "normal" ? 0.9 * value : 0,
    );
    checkVector(
      actual.timeAccount,
      lower,
      reference.timeAccount,
      "timeAccount",
      scope,
    );
    checkVector(actual.floor, reference.floor, reference.floor, "floor", scope);
  };
  checkAccount(observed, expected, "gesture");
  for (const channel of ["initial", "spatial"])
    checkVector(
      observed[channel],
      expected[channel],
      expected[channel],
      channel,
      "gesture",
    );
  for (let index = 0; index < width; index++) {
    const total =
      sign *
      Math.max(
        sign * observed.floor[index],
        sign * observed.timeAccount[index],
      );
    const extra = total - observed.floor[index];
    compare(observed.total[index], total, total, tolerance(total), {
      scope: "gesture",
      channel: "total",
      index,
    });
    compare(observed.time[index], extra, extra, tolerance(extra), {
      scope: "gesture",
      channel: "time",
      index,
    });
    if (
      Math.abs(
        observed.initial[index] +
          observed.spatial[index] -
          observed.floor[index],
      ) > tolerance(expected.floor[index])
    )
      fail("C1_INCONSISTENT_FLOOR", { index });
  }

  // Window source changes use the carried credit. Recomputing max from each
  // window's increments would charge the same floor again at every boundary.
  const cumulative = {
    floor: new Array(width).fill(0),
    timeAccount: new Array(width).fill(0),
    total: new Array(width).fill(0),
    initial: new Array(width).fill(0),
    spatial: new Array(width).fill(0),
    time: new Array(width).fill(0),
  };
  for (
    let windowIndex = 0;
    windowIndex < expected.timeWindows.length;
    windowIndex++
  ) {
    const actual = observed.windows[windowIndex];
    const reference = expected.timeWindows[windowIndex];
    const scope = `window-${windowIndex}`;
    checkAccount(actual, reference, scope);
    for (const channel of ["initial", "spatial"])
      checkVector(
        actual[channel],
        reference[channel],
        reference[channel],
        channel,
        scope,
      );
    for (let index = 0; index < width; index++) {
      cumulative.floor[index] += actual.floor[index];
      cumulative.timeAccount[index] += actual.timeAccount[index];
      const total =
        sign *
        Math.max(
          sign * cumulative.floor[index],
          sign * cumulative.timeAccount[index],
        );
      const increment = total - cumulative.total[index];
      compare(actual.total[index], increment, increment, tolerance(total), {
        scope,
        channel: "total",
        index,
      });
      cumulative.total[index] = total;
      for (const channel of ["initial", "spatial", "time"])
        cumulative[channel][index] += actual[channel][index];
      // Final-decomposition time can decrease as newly observed geometry
      // reattributes old source effect to the floor. It is not another debit.
      const extra = total - cumulative.floor[index];
      if (Math.abs(cumulative.time[index] - extra) > tolerance(total))
        fail("C1_INCONSISTENT_WINDOW_CREDIT", { scope, index });
    }
  }
  for (let index = 0; index < width; index++)
    for (const channel of ["floor", "timeAccount", "total"])
      if (
        sign * cumulative[channel][index] >
        sign * observed[channel][index] + tolerance(observed[channel][index])
      )
        fail("C1_WINDOW_EXCEEDS_GESTURE", { channel, index });

  // The whole-stroke result must reconcile with its complete windows. Only the
  // independently known remainder may explain additional temporal credit;
  // otherwise a forged whole total could hide missing effects in the windows.
  const lastCheckpoint = expected.timeWindows.at(-1)?.after;
  const coversWholeStroke =
    expected.timeWindows.length > 0 && expected.durationMs % 1000 === 0;
  for (let index = 0; index < width; index++) {
    const floorRemainder =
      expected.floor[index] - (lastCheckpoint?.floor[index] ?? 0);
    const timeRemainder =
      expected.timeAccount[index] - (lastCheckpoint?.timeAccount[index] ?? 0);
    compare(
      observed.floor[index] - cumulative.floor[index],
      floorRemainder,
      floorRemainder,
      tolerance(expected.floor[index]),
      { scope: "remaining", channel: "floor", index },
    );
    compare(
      observed.timeAccount[index] - cumulative.timeAccount[index],
      0,
      timeRemainder,
      tolerance(expected.timeAccount[index]),
      { scope: "remaining", channel: "timeAccount", index },
    );
    if (coversWholeStroke)
      for (const channel of channels)
        if (
          Math.abs(observed[channel][index] - cumulative[channel][index]) >
          tolerance(expected[channel][index])
        )
          fail("C1_WINDOW_TOTAL_MISMATCH", { channel, index });
  }

  for (let index = 0; index < spec.centerline.length; index++) {
    const floor = surface.floor[index];
    compare(observed.centerlineSpatial[index], floor, floor, tolerance(floor), {
      scope: "centerline",
      index,
    });
    if (
      sign * observed.centerlineSpatial[index] + tolerance(floor) <
      0.5 * Math.abs(surface.click[index])
    )
      fail("C1_SPATIAL_CLICK_ANCHOR", { index });
  }
  return result();
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
      if (isNonchangingInput(sample)) continue;
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
    prepaidInputs: samples.filter(isC1PrepaidNoop).length,
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
      processedNoops.every(isNonchangingInput) &&
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
  const scenario = evaluateScenario({
    id,
    kind,
    samples: selected,
    droppedEvents: observation.droppedEvents,
    contentObserved: false,
  });
  const publication = evaluateBrushPublicationOrder(events);
  const renderWork = evaluateRenderWork(events, {
    droppedEvents: observation.droppedEvents,
  });
  const gestures = events
    .filter((event) => event.kind === "brush-start")
    .map((start) => {
      const first = events.findIndex(
        (event) => event.kind === "input" && event.id === start.input,
      );
      const last = events.findIndex(
        (event) =>
          event.kind === "brush-end" &&
          event.sessionId === start.sessionId &&
          event.gestureId === start.gestureId,
      );
      const ids = events
        .slice(Math.max(0, first), last < 0 ? undefined : last + 1)
        .filter(
          (event) =>
            event.kind === "input" &&
            ["edit", "pointerup"].includes(event.inputKind),
        )
        .map((event) => event.id);
      const own = events.filter(
        (event) =>
          event.gestureId === undefined ||
          (event.sessionId === start.sessionId &&
            event.gestureId === start.gestureId),
      );
      return evaluateBrushTime(own, ids, start.sessionId);
    });
  const unique = new Map(
    [
      ...publication.issues,
      ...gestures.flatMap((gesture) => gesture.issues),
    ].map((issue) => [JSON.stringify(issue), issue]),
  );
  const issues = [...unique.values()];
  return {
    ...scenario,
    status: issues.length || !renderWork.passed ? "FAIL" : scenario.status,
    failures: [...scenario.failures, ...issues, ...renderWork.issues],
    brushWork: { passed: issues.length === 0, issues, gestures },
    renderWork,
  };
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
          : samples.filter((sample) => !isNonchangingInput(sample));
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
            if (isNonchangingInput(sample)) continue;
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
            (s) => s.inputKind === kind && !isNonchangingInput(s),
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
    renderWork: facts.renderWork,
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
      if (source.schemaVersion !== 6)
        throw new Error(
          "Expected current P0 schema 6; evaluate historical evidence with its recorded harness commit",
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
