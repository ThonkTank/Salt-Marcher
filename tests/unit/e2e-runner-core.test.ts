import { describe, expect, it } from 'vitest'
import {
  classifyE2eFailure,
  classifyE2eLogLine,
  countE2eRegressionWarnings,
  e2eExitCodeWithWarningRegressions
} from '../../scripts/e2e-runner-core.js'
import {
  shouldAbortE2eRun,
  shouldAttemptFailureScreenshot
} from '../../scripts/e2e-failure-diagnostics.js'

describe('E2E runner diagnostics', () => {
  it('does not hide Webdriver interaction regressions as known noise', () => {
    expect(
      classifyE2eLogLine(
        'WARN Browser.getWindowForTarget is not supported; using fallback'
      )
    ).toBe('diagnostic')
    expect(
      classifyE2eLogLine(
        "WebDriverError: unknown command: 'Browser.getWindowForTarget' wasn't found"
      )
    ).toBe('diagnostic')
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

  it('requires zero window/rect, scroll fallback and stale-element warnings', () => {
    const clean = countE2eRegressionWarnings('ordinary Webdriver output')
    expect(clean).toEqual({
      windowRect: 0,
      scrollFallback: 0,
      staleElement: 0
    })
    expect(e2eExitCodeWithWarningRegressions(0, clean)).toBe(0)

    const warnings = countE2eRegressionWarnings(
      [
        'when running "window/rect" with method "GET"',
        'Re-attempting using `Element.scrollIntoView` via Web API.',
        'WARN webdriver: Request encountered a stale element - terminating request'
      ].join('\n')
    )
    expect(warnings).toEqual({
      windowRect: 1,
      scrollFallback: 1,
      staleElement: 1
    })
    expect(e2eExitCodeWithWarningRegressions(0, warnings)).toBe(1)
    expect(e2eExitCodeWithWarningRegressions(7, warnings)).toBe(7)
    expect(
      countE2eRegressionWarnings(
        'INFO webdriver: DATA {"script":"throw new Error(\\"stale element reference\\")"}'
      ).staleElement
    ).toBe(0)
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
