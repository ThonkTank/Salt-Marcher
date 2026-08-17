import { describe, expect, it, vi } from 'vitest'
import { createGeneratorPresetApplicationPort } from '../../src/renderer/features/workspace/generator-preset-application.js'
import type { GeneratorPresetCapability } from '../../src/shared/contracts/capability-api.js'
import {
  systemGeneratorPresetId,
  type CreateGeneratorPresetCommand,
  type GeneratorPresetEditorSnapshot
} from '../../src/shared/contracts/generator-presets.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'
import { defaultGeneratorConfig } from '../../src/shared/generator/system-generator-preset.js'

const campaignId = '00000000-0000-4000-8000-000000000010'
const customId = '00000000-0000-4000-8000-000000000020'
const now = '2026-08-08T12:00:00.000Z'

function snapshot(revision = 4): GeneratorPresetEditorSnapshot {
  return {
    registry: {
      revision,
      presets: [
        {
          id: systemGeneratorPresetId,
          name: 'System-Default',
          schemaVersion: 5,
          revision: 0,
          protected: true,
          createdAt: now,
          updatedAt: now,
          config: defaultGeneratorConfig
        }
      ]
    },
    assignment: {
      campaignId,
      assignedPresetId: null,
      effectivePresetId: systemGeneratorPresetId
    }
  }
}

describe('generator preset application port', () => {
  it('recovers an exact receipt after an unknown mutation outcome', async () => {
    const before = snapshot()
    let command: CreateGeneratorPresetCommand | null = null
    let commandId = ''
    const commandReceipt = vi.fn(
      ({ commandId: receiptCommandId }: { commandId: string }) => {
        const saved = {
          ...before.registry.presets[0]!,
          id: customId,
          name: 'Recovered',
          protected: false
        }
        return Promise.resolve({
          kind: 'created' as const,
          commandId: receiptCommandId,
          saved,
          registry: {
            revision: 5,
            presets: [...before.registry.presets, saved]
          }
        })
      }
    )
    const readEditor = vi.fn(() => Promise.resolve(before))
    const capability = {
      readEditor,
      create: vi.fn((input: CreateGeneratorPresetCommand) => {
        command = input
        commandId = input.commandId
        return Promise.reject(new CapabilityError('outcome_unknown', true))
      }),
      commandReceipt
    } as unknown as GeneratorPresetCapability
    const port = createGeneratorPresetApplicationPort(capability, campaignId)

    const result = await port.create('Recovered', defaultGeneratorConfig)

    expect(command).toMatchObject({
      expectedRegistryRevision: 4,
      name: 'Recovered'
    })
    expect(commandReceipt).toHaveBeenCalledWith({ commandId })
    expect(result.receipt).toMatchObject({
      kind: 'created',
      saved: { id: customId }
    })
    expect(result.snapshot.registry.revision).toBe(5)
    expect(readEditor).toHaveBeenCalledOnce()
  })

  it('does not retry or recover a stale command', async () => {
    const create = vi.fn(() =>
      Promise.reject(new CapabilityError('stale', true))
    )
    const commandReceipt = vi.fn(() => Promise.resolve(null))
    const capability = {
      readEditor: vi.fn(() => Promise.resolve(snapshot())),
      create,
      commandReceipt
    } as unknown as GeneratorPresetCapability
    const port = createGeneratorPresetApplicationPort(capability, campaignId)

    await expect(
      port.create('Stale', defaultGeneratorConfig)
    ).rejects.toMatchObject({
      code: 'stale'
    })
    expect(create).toHaveBeenCalledOnce()
    expect(commandReceipt).not.toHaveBeenCalled()
  })
})
