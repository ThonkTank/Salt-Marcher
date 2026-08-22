import { describe, expect, it, vi } from 'vitest'
import { executeRecoverableHexCommand } from '../../src/renderer/features/hex/hex-command-executor.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'

const applied = {
  status: 'applied',
  catalogRevision: 1,
  maps: [],
  changedChunks: [],
  warnings: [],
  history: {
    canUndo: false,
    canRedo: false,
    undoLabel: null,
    redoLabel: null
  }
} as const

describe('executeRecoverableHexCommand', () => {
  it('returns the receipt after an uncertain operation outcome', async () => {
    const unknownOutcome = new CapabilityError('outcome_unknown', true)
    const readReceipt = vi.fn().mockResolvedValue(applied)

    await expect(
      executeRecoverableHexCommand(
        'command-1',
        vi.fn().mockRejectedValue(unknownOutcome),
        readReceipt
      )
    ).resolves.toBe(applied)
    expect(readReceipt).toHaveBeenCalledWith('command-1')
  })

  it('does not hide a known failure or a missing receipt', async () => {
    const knownFailure = new CapabilityError('validation_failed', false)
    const unknownOutcome = new CapabilityError('outcome_unknown', true)
    const readReceipt = vi.fn().mockResolvedValue(null)

    await expect(
      executeRecoverableHexCommand(
        'command-2',
        vi.fn().mockRejectedValue(knownFailure),
        readReceipt
      )
    ).rejects.toBe(knownFailure)
    expect(readReceipt).not.toHaveBeenCalled()
    await expect(
      executeRecoverableHexCommand(
        'command-3',
        vi.fn().mockRejectedValue(unknownOutcome),
        readReceipt
      )
    ).rejects.toBe(unknownOutcome)
  })
})
