/** Type contracts for the JavaScript CLIs exercised by the TypeScript tests. */
declare module "*atlas-p0-evaluate.mjs" {
  export const P0_FUNCTIONAL_CHECKS: readonly string[];
  export const P0_REQUIREMENTS: {
    scope: string;
    independentRuns: number;
    scenarios: {
      id: string;
      kind: string;
      minSamples: number;
      minDurationMs?: number;
      minTotalSamples?: number;
      requiredInputKinds?: string[];
    }[];
    requiredChecks: readonly string[];
    scaling: {
      minimumSourceTiles: number[];
      tileBytes: number;
      sourceBudgetBytes: number;
    };
    requiredFaultControls: {
      fault: string;
      primaryCheck: string;
      primaryFailureCode: string;
    }[];
  };
  export function evaluateFunctional(
    report: unknown,
    requirements?: unknown,
  ): { status: "PASS" | "FAIL"; passed: boolean; failures: Issue[] };
  export function selectP0Scope(
    selection?: string,
    scenarioId?: string | null,
  ): {
    navigation: boolean;
    workflow: boolean;
    controls: boolean;
    collection: boolean;
    scaling: boolean;
    needsBaseFixture: boolean;
    needsBusyFixture: boolean;
    scenarios: { id: string; kind: string }[];
    requiredChecks: readonly string[];
  };
  export function checkBuildIdentity(
    workspace: unknown,
    executed: unknown,
    provenance: unknown,
  ): { passed: boolean; failures: { code: string; [key: string]: unknown }[] };
  interface Distribution {
    count: number;
    invalid: number;
    p50: number | null;
    p95: number | null;
    p99: number | null;
    maximum: number | null;
  }
  interface Issue {
    code: string;
    [key: string]: unknown;
  }
  interface Group {
    sampleCount: number;
    missing: number;
    inputToPresentationMs: Distribution;
    navigationToPresentationMs?: Distribution;
    [key: string]: unknown;
  }
  interface EditSample {
    inputId: number;
    createdAt: number | null;
    submissionAt: number | null;
    [key: string]: unknown;
  }
  export function evaluateAcceptance(
    report: unknown,
    requirements?: unknown,
  ): {
    status: "PASS" | "FAIL" | "BLOCKED";
    passed: boolean;
    failures: Issue[];
    blockers: Issue[];
    groups: Group[];
  };
  export function evaluateSubmissionDiagnostics(
    samples: unknown,
    limitMs?: number,
  ): {
    status: "FAIL" | "PROXY_ONLY";
    presentationProven: false;
    issues: Issue[];
    inputToSubmissionMs: Distribution;
    inputKinds: Record<string, Distribution>;
    outliers: Issue[];
    processedNoops: number;
    missing: number;
  };
  export function isProcessedNoop(sample: unknown): boolean;
  export function evaluateBrushTime(
    events: unknown,
    inputIds: number[],
    sessionId: string,
  ): {
    passed: boolean;
    issues: Issue[];
    acceptedMs: number;
    timedDoseMs: number;
    pressDoseMs: number;
    discardMs: Record<string, number>;
    maximumStepMs: number;
    stationary: boolean;
  };
  export function evaluateBrushPublicationOrder(
    events: unknown,
    sessionId?: string,
  ): {
    passed: boolean;
    issues: Issue[];
    steps: Record<string, unknown>[];
  };
  export function evaluateSaveOverlap(evidence: unknown): {
    passed: boolean;
    workerProven: boolean;
    matches: unknown[];
    inputEpochMs: number | null;
    modelEpochMs: number | null;
  };
  export function evaluateColdSubmissionDiagnostics(samples: unknown): {
    status: "FAIL" | "PROXY_ONLY";
    presentationProven: false;
    inputToSubmissionMs: Distribution;
    navigationToReadyMs: Distribution;
    navigationToSubmissionMs: Distribution;
    issues: Issue[];
    outliers: Issue[];
  };
  interface ScenarioEvaluation {
    status: "FAIL" | "INCOMPLETE" | "PROXY_ONLY";
    contentPassed: boolean;
    sampleCount: number;
    live: { passed: boolean; liveSubmissionsBeforeRelease: number }[];
    submission: ReturnType<typeof evaluateSubmissionDiagnostics>;
    failures: Issue[];
    missing: Issue[];
    blockers: Issue[];
    liveFeedback: {
      status: "FAIL" | "SUBMISSION_ONLY";
      presentationProven: false;
      maximumMovingStallMs: number;
      inputCount: number;
      processedNoops: number;
      notAccepted: number;
    };
  }
  export function strokeEvidence(
    edit: unknown,
    requireBeforeRelease?: boolean,
  ): {
    complete: boolean;
    passed: boolean;
    processedNoops: number;
    liveSubmissionsBeforeRelease: number;
    liveFramesBeforeRelease: number;
    minimumFrameControlPassed: boolean;
    timeline: { inputId: number; modeled: boolean; validSubmission: boolean }[];
    continuity: {
      passed: boolean;
      maximumPendingGapMs: number;
      maximumMovingStallMs: number;
      maximumNoChangeFeedbackGapMs: number;
      maximumInputBacklogMs: number | null;
    };
  };
  export function evaluateScenario(scenario: unknown): ScenarioEvaluation;
  export function evaluateObservation(
    observation: unknown,
    scenario?: { id?: string; kind?: string },
  ): ScenarioEvaluation;
  export function evaluateRun(report: unknown): {
    status: "PASS" | "FAIL" | "BLOCKED" | "INCOMPLETE";
    passed: boolean;
    scopePassed: boolean;
    failures: Issue[];
    missing: Issue[];
    blockers: Issue[];
    nativeAcceptance: {
      status: string;
      passed: boolean;
      unmetRequirements: Issue[];
    };
  };
  export function extractEditSamples(
    events: unknown,
    inputIds: number[],
    sessionId: string,
  ): EditSample[];
  export function extractNavigationSamples(
    events: unknown,
  ): Record<string, unknown>[];
  export function evaluateNavigationDiagnostics(samples: unknown): {
    passed: boolean;
    issues: Issue[];
    inputToCameraMs: Distribution;
    handlerToCameraMs: Distribution;
  };
  export function evaluateStrokeContent(content: unknown): {
    passed: boolean;
    probes: {
      index: number;
      heightChanged: boolean;
      heightRestored: boolean;
      pixelsChanged: boolean;
    }[];
  };
}

declare module "*atlas-p0-interactions.mjs" {
  export function observeStroke(
    session: unknown,
    before: unknown,
    timeout?: number,
  ): Promise<{
    timedOut: boolean;
    samples: Record<string, unknown>[];
  }>;
}

declare module "*atlas-p0-trace.mjs" {
  export function parseTrace<T = Record<string, unknown>>(text: string): T;
  export function analyzeTrace(text: string): {
    mappingStatus: "unsupported";
    exactSubmissionCandidates: { enclosingMainFrameIds: (string | number)[] }[];
    clockObservation: { calibrated: false };
  };
}
