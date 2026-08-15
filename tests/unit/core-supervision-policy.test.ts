import { describe, expect, it } from 'vitest'
import {
  coreOperationMode,
  coreRestartDelay,
  interruptedOperationError
} from '../../src/main/core-process/supervision-policy.js'

describe('core supervision policy', () => {
  it('never presents an interrupted write as safely retryable', () => {
    expect(coreOperationMode('campaign.create')).toBe('write')
    expect(interruptedOperationError('write', 'timeout')).toMatchObject({
      code: 'outcome_unknown',
      retryable: false
    })
    expect(interruptedOperationError('write', 'exit')).toMatchObject({
      code: 'outcome_unknown',
      retryable: false
    })
  })

  it('keeps interrupted reads retryable and distinguishes timeouts', () => {
    expect(coreOperationMode('hex.readChunks')).toBe('read')
    expect(interruptedOperationError('read', 'timeout')).toMatchObject({
      code: 'timeout',
      retryable: true
    })
    expect(interruptedOperationError('read', 'exit')).toMatchObject({
      code: 'core_unavailable',
      retryable: true
    })
  })

  it('backs off three times and then requires explicit recovery', () => {
    expect([1, 2, 3, 4].map(coreRestartDelay)).toEqual([
      1_000,
      5_000,
      15_000,
      null
    ])
  })
})
