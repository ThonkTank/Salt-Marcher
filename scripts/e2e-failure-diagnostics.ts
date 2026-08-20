export type E2eFailureKind =
  | 'product'
  | 'product-assertion'
  | 'infrastructure-runner'
  | 'infrastructure-tab-crash'
  | 'infrastructure-oom'
  | null

const tabCrashPattern =
  /(?:tab crashed|target crashed|session deleted because of page crash)/i

const runnerInfrastructurePattern =
  /(?:session not created|operation was aborted due to timeout[^\n]*\/session[^\n]*method "POST"|ECONNREFUSED|ENOSPC|Xvfb|Electron[^\n]*exited before|unable to connect[^\n]*webdriver)/i

const assertionPattern =
  /(?:AssertionError|expect(?:ed)?\b[^\n]*(?:to|but)|assertion failed)/i

export function classifyE2eFailure(
  exitCode: number,
  log: string,
  kernelOomDetected = false
): E2eFailureKind {
  if (exitCode === 0) return null
  if (kernelOomDetected) return 'infrastructure-oom'
  if (isConfirmedTabCrash(log)) return 'infrastructure-tab-crash'
  if (runnerInfrastructurePattern.test(log)) return 'infrastructure-runner'
  return assertionPattern.test(log) ? 'product-assertion' : 'product'
}

export function isConfirmedTabCrash(value: unknown): boolean {
  return tabCrashPattern.test(errorText(value))
}

export function shouldAttemptFailureScreenshot(
  rendererUnavailable: boolean,
  error: unknown
): boolean {
  return !rendererUnavailable && !isConfirmedTabCrash(error)
}

export function shouldAbortE2eRun(kind: E2eFailureKind): boolean {
  return kind === 'infrastructure-oom'
}

function errorText(value: unknown): string {
  if (value instanceof Error) return value.stack ?? value.message
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'message' in value)
    return String(value.message)
  return ''
}
