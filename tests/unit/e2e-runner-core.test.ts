import { describe, expect, it } from 'vitest'
import {
  classifyE2eFailure,
  classifyE2eLogLine
} from '../../scripts/e2e-runner-core.js'

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
  })

  it('distinguishes runner infrastructure from product failures', () => {
    expect(classifyE2eFailure(0, 'anything')).toBeNull()
    expect(classifyE2eFailure(1, 'session not created: Electron exited')).toBe(
      'infrastructure'
    )
    expect(
      classifyE2eFailure(
        1,
        'WebDriverError: The operation was aborted due to timeout when running "http://localhost:44289/session" with method "POST"'
      )
    ).toBe('infrastructure')
    expect(classifyE2eFailure(1, 'WebDriverError: tab crashed')).toBe(
      'infrastructure'
    )
    expect(classifyE2eFailure(1, 'AssertionError: expected button')).toBe(
      'product'
    )
  })
})
