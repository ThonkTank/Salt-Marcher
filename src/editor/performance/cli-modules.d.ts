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
  };
  export function evaluateColdSubmissionDiagnostics(samples: unknown): {
    status: "FAIL" | "PROXY_ONLY";
    presentationProven: false;
    inputToSubmissionMs: Distribution;
    navigationToReadyMs: Distribution;
    navigationToSubmissionMs: Distribution;
    issues: Issue[];
  };
  export function extractEditSamples(
    events: unknown,
    inputIds: number[],
    sessionId: string,
  ): EditSample[];
}

declare module "*atlas-p0-trace.mjs" {
  export function parseTrace<T = Record<string, unknown>>(text: string): T;
  export function analyzeTrace(text: string): {
    mappingStatus: "unsupported";
    exactSubmissionCandidates: { enclosingMainFrameIds: (string | number)[] }[];
    clockObservation: { calibrated: false };
  };
}
