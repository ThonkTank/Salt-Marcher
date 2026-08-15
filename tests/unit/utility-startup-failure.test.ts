import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { IncompatibleDataError } from '../../src/core/persistence/sqlite/database.js'
import { classifyStartupFailure } from '../../src/utility/startup-failure.js'

describe('utility startup failures', () => {
  it.each([
    [new IncompatibleDataError(), 'incompatible-data'],
    [new ZodError([]), 'invalid-configuration'],
    [Object.assign(new Error('denied'), { code: 'EACCES' }), 'access-denied'],
    [
      Object.assign(new Error('missing'), { code: 'ENOENT' }),
      'resource-missing'
    ],
    [
      Object.assign(new Error('corrupt'), { code: 'SQLITE_CORRUPT' }),
      'corrupt-data'
    ]
  ] as const)(
    'classifies terminal failures without technical detail',
    (error, reason) => {
      expect(classifyStartupFailure(error)).toEqual({
        kind: 'core.startup-failed',
        reason,
        retryable: false
      })
    }
  )

  it('classifies an unexpected failure as retryable internal startup work', () => {
    expect(classifyStartupFailure(new Error('unexpected'))).toEqual({
      kind: 'core.startup-failed',
      reason: 'internal',
      retryable: true
    })
  })
})
