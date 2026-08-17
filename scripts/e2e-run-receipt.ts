export type E2eSuiteAttempt = Readonly<{
  attempt: number
  status: 'passed' | 'failed'
  exitCode: number
  durationMs: number
  logPath: string
  artifactDirectory: string
}>

export type E2eSuiteResult<Name extends string = string> = Readonly<{
  name: Name
  status: 'pending' | 'passed' | 'failed'
  exitCode: number | null
  durationMs: number | null
  attempts: readonly E2eSuiteAttempt[]
}>

export type E2eRunSummary<Name extends string = string> = Readonly<{
  version: 2
  runId: string
  buildIdentity: string
  registryIdentity: string
  selectedSuites: readonly Name[]
  updatedAt: string
  results: readonly E2eSuiteResult<Name>[]
}>

export function initializeE2eResults<Name extends string>(
  names: readonly Name[],
  resumed: E2eRunSummary<Name> | null
): E2eSuiteResult<Name>[] {
  return names.map(
    (name) =>
      resumed?.results.find((result) => result.name === name) ?? {
        name,
        status: 'pending',
        exitCode: null,
        durationMs: null,
        attempts: []
      }
  )
}

export function recordE2eAttempt<Name extends string>(
  results: readonly E2eSuiteResult<Name>[],
  name: Name,
  attempt: E2eSuiteAttempt
): E2eSuiteResult<Name>[] {
  return results.map((result) =>
    result.name === name
      ? {
          name,
          status: attempt.status,
          exitCode: attempt.exitCode,
          durationMs: attempt.durationMs,
          attempts: [...result.attempts, attempt]
        }
      : result
  )
}

export function validateE2eResumeIdentity<Name extends string>(
  summary: E2eRunSummary<Name>,
  expected: Readonly<{
    buildIdentity: string
    registryIdentity: string
    selectedSuites: readonly Name[]
  }>
): void {
  if (
    summary.buildIdentity !== expected.buildIdentity ||
    summary.registryIdentity !== expected.registryIdentity ||
    JSON.stringify(summary.selectedSuites) !==
      JSON.stringify(expected.selectedSuites)
  )
    throw new Error(
      'Cannot resume: build, suite registry, or selected suite set changed.'
    )
}
