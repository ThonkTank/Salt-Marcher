import { describe, expect, it } from 'vitest'
import {
  classifyE2eFailure,
  classifyE2eLogLine
} from '../../scripts/e2e-runner-core.js'
import {
  shouldAbortE2eRun,
  shouldAttemptFailureScreenshot
} from '../../scripts/e2e-failure-diagnostics.js'

describe('E2E runner diagnostics', () => {
  it('filters only the known Webdriver compatibility fallback', () => {
    expect(
      classifyE2eLogLine(
        'WARN Browser.getWindowForTarget is not supported; using fallback'
      )
    ).toBe('known-noise')
    expect(
      classifyE2eLogLine(
        "WebDriverError: unknown command: 'Browser.getWindowForTarget' wasn't found"
      )
    ).toBe('known-noise')
    expect(
      classifyE2eLogLine('ERROR Browser.getWindowForTarget destroyed the app')
    ).toBe('diagnostic')
    expect(classifyE2eLogLine('WARN unexpected renderer warning')).toBe(
      'diagnostic'
    )
    expect(
      classifyE2eLogLine(
        'WARN electron-service: Linux Dependencies: 13 packages may be missing'
      )
    ).toBe('known-noise')
    expect(classifyE2eLogLine('WARN Shared Libraries: 1 missing library')).toBe(
      'diagnostic'
    )
    expect(
      classifyE2eLogLine('Could not verify fuse configuration: invalid binary')
    ).toBe('diagnostic')
  })

  it('distinguishes runner infrastructure from product failures', () => {
    expect(classifyE2eFailure(0, 'anything')).toBeNull()
    expect(classifyE2eFailure(1, 'session not created: Electron exited')).toBe(
      'infrastructure-runner'
    )
    expect(
      classifyE2eFailure(
        1,
        'WebDriverError: The operation was aborted due to timeout when running "http://localhost:44289/session" with method "POST"'
      )
    ).toBe('infrastructure-runner')
    expect(classifyE2eFailure(1, 'WebDriverError: tab crashed')).toBe(
      'infrastructure-tab-crash'
    )
    expect(classifyE2eFailure(1, 'AssertionError: expected button')).toBe(
      'product-assertion'
    )
    expect(classifyE2eFailure(137, 'renderer disappeared', true)).toBe(
      'infrastructure-oom'
    )
  })

  it('stops after OOM and never asks a crashed renderer for screenshots', () => {
    expect(shouldAbortE2eRun('infrastructure-oom')).toBe(true)
    expect(shouldAbortE2eRun('infrastructure-tab-crash')).toBe(false)
    expect(
      shouldAttemptFailureScreenshot(false, new Error('tab crashed'))
    ).toBe(false)
    expect(
      shouldAttemptFailureScreenshot(false, new Error('expected button'))
    ).toBe(true)
    expect(shouldAttemptFailureScreenshot(true, undefined)).toBe(false)
  })
})
