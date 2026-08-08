import { describe, expect, it, vi } from 'vitest'
import {
  executePersistedSubmission,
  PersistedSubmissionLifecycle,
  retryPersistedSubmissionReconciliation
} from '../../src/renderer/features/shared/submission-lifecycle.js'

describe('persisted submission lifecycle', () => {
  it('retries reconciliation with the same receipt without repeating persistence', async () => {
    const lifecycle = new PersistedSubmissionLifecycle<{ id: string }>()
    const persist = vi.fn(() => Promise.resolve({ id: 'saved' }))
    const project = vi
      .fn<(value: { id: string }) => void>()
      .mockImplementationOnce(() => {
        throw new Error('reconciliation failed')
      })

    await expect(
      executePersistedSubmission(lifecycle, persist, project)
    ).resolves.toMatchObject({ status: 'reconciliation-failed' })
    await expect(
      executePersistedSubmission(lifecycle, persist, project)
    ).resolves.toEqual({ status: 'ignored' })
    await expect(
      retryPersistedSubmissionReconciliation(lifecycle, project)
    ).resolves.toEqual({ status: 'reconciled', value: { id: 'saved' } })
    expect(persist).toHaveBeenCalledTimes(1)
    expect(project).toHaveBeenCalledTimes(2)
    expect(lifecycle.phase).toBe('reconciled')
  })

  it('allows an explicit resubmission after persistence itself fails', async () => {
    const lifecycle = new PersistedSubmissionLifecycle<string>()
    const persist = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('saved')

    await executePersistedSubmission(lifecycle, persist, () => undefined)
    await executePersistedSubmission(lifecycle, persist, () => undefined)

    expect(persist).toHaveBeenCalledTimes(2)
    expect(lifecycle.phase).toBe('reconciled')
  })
})
