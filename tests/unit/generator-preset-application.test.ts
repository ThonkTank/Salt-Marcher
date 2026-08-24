import { describe, expect, it, vi } from 'vitest'
import {
  GeneratorPresetReconciliationPendingError,
  createGeneratorPresetApplicationOwner
} from '../../src/renderer/features/workspace/generator-preset-application.js'
import type { GeneratorPresetCapability } from '../../src/shared/contracts/capability-api.js'
import {
  systemGeneratorPresetId,
  type AssignGeneratorPresetReceipt,
  type CreateGeneratorPresetCommand,
  type CreateGeneratorPresetReceipt,
  type GeneratorPresetEditorSnapshot
} from '../../src/shared/contracts/generator-presets.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'
import { defaultGeneratorConfig } from '../../src/shared/generator/system-generator-preset.js'

const campaignId = '00000000-0000-4000-8000-000000000010'
const firstCustomId = '00000000-0000-4000-8000-000000000020'
const secondCustomId = '00000000-0000-4000-8000-000000000030'
const now = '2026-08-08T12:00:00.000Z'

describe('generator preset application owner', () => {
  it('recovers an exact receipt after an unknown mutation outcome', async () => {
    const before = snapshot()
    let command: CreateGeneratorPresetCommand | null = null
    const commandReceipt = vi.fn(({ commandId }: { commandId: string }) =>
      Promise.resolve(createReceipt(before, commandId, firstCustomId, 5))
    )
    const readEditor = vi.fn(() => Promise.resolve(before))
    const capability = capabilityStub({
      readEditor,
      create: vi.fn((input: CreateGeneratorPresetCommand) => {
        command = input
        return Promise.reject(new CapabilityError('outcome_unknown', true))
      }),
      commandReceipt
    })
    const port =
      createGeneratorPresetApplicationOwner(capability).port(campaignId)

    const result = await port.create('Recovered', defaultGeneratorConfig)

    expect(command).toMatchObject({
      expectedRegistryRevision: 4,
      name: 'Recovered'
    })
    expect(commandReceipt).toHaveBeenCalledWith({
      commandId: result.receipt.commandId
    })
    expect(result.receipt).toMatchObject({
      kind: 'created',
      saved: { id: firstCustomId }
    })
    expect(result.snapshot.registry.revision).toBe(5)
    expect(readEditor).toHaveBeenCalledOnce()
  })

  it('chooses the second concurrent revision only after first acceptance', async () => {
    const before = snapshot()
    const first = deferred<CreateGeneratorPresetReceipt>()
    const create = vi.fn((input: CreateGeneratorPresetCommand) =>
      create.mock.calls.length === 1
        ? first.promise
        : Promise.resolve(
            createReceipt(
              append(before, firstCustomId, 5),
              input.commandId,
              secondCustomId,
              6
            )
          )
    )
    const owner = createGeneratorPresetApplicationOwner(
      capabilityStub({
        create,
        readEditor: vi.fn(() => Promise.resolve(before))
      })
    )
    const port = owner.port(campaignId)
    await port.read()

    const firstResult = port.create('First', defaultGeneratorConfig)
    const secondResult = port.create('Second', defaultGeneratorConfig)
    await nextMicrotask()
    expect(create).toHaveBeenCalledOnce()
    expect(create.mock.calls[0]?.[0].expectedRegistryRevision).toBe(4)

    const firstCommand = create.mock.calls[0]?.[0]
    if (!firstCommand) throw new Error('First command was not transported.')
    first.resolve(
      createReceipt(before, firstCommand.commandId, firstCustomId, 5)
    )
    await expect(firstResult).resolves.toMatchObject({
      snapshot: { registry: { revision: 5 } }
    })
    await expect(secondResult).resolves.toMatchObject({
      snapshot: { registry: { revision: 6 } }
    })
    expect(create.mock.calls[1]?.[0].expectedRegistryRevision).toBe(5)
  })

  it('retains interrupted receipt recovery across a new port and never resends', async () => {
    const before = snapshot()
    let commandId = ''
    const recovered = () => createReceipt(before, commandId, firstCustomId, 5)
    const create = vi.fn((input: CreateGeneratorPresetCommand) => {
      commandId = input.commandId
      return Promise.reject(new CapabilityError('outcome_unknown', false))
    })
    const commandReceipt = vi
      .fn<GeneratorPresetCapability['commandReceipt']>()
      .mockRejectedValueOnce(new CapabilityError('core_unavailable', true))
      .mockImplementationOnce(() => Promise.resolve(recovered()))
    const assign = vi.fn<GeneratorPresetCapability['assign']>((input) =>
      Promise.resolve(assignReceipt(recovered(), input.commandId))
    )
    const readEditor = vi.fn(() => Promise.resolve(before))
    const owner = createGeneratorPresetApplicationOwner(
      capabilityStub({ create, commandReceipt, assign, readEditor })
    )
    const firstPort = owner.port(campaignId)

    await expect(
      firstPort.create('Recovered', defaultGeneratorConfig)
    ).rejects.toBeInstanceOf(GeneratorPresetReconciliationPendingError)

    const remountedPort = owner.port(campaignId)
    expect(remountedPort.reconciliationPending()).toBe(true)
    await expect(remountedPort.read()).resolves.toMatchObject({
      registry: { revision: 4 }
    })
    expect(readEditor).toHaveBeenCalledOnce()
    await expect(remountedPort.assign(firstCustomId)).rejects.toBeInstanceOf(
      GeneratorPresetReconciliationPendingError
    )
    expect(assign).not.toHaveBeenCalled()

    await expect(remountedPort.reconcile()).resolves.toMatchObject({
      receipt: { kind: 'created', commandId },
      snapshot: { registry: { revision: 5 } }
    })
    expect(create).toHaveBeenCalledOnce()
    expect(commandReceipt).toHaveBeenCalledTimes(2)
    expect(remountedPort.reconciliationPending()).toBe(false)

    await expect(remountedPort.assign(firstCustomId)).resolves.toMatchObject({
      receipt: { kind: 'assigned' },
      snapshot: { registry: { revision: 6 } }
    })
    expect(assign).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRegistryRevision: 5 })
    )
  })

  it('does not retry or recover a stale command', async () => {
    const create = vi.fn(() =>
      Promise.reject(new CapabilityError('stale', true))
    )
    const commandReceipt = vi.fn(() => Promise.resolve(null))
    const capability = capabilityStub({
      readEditor: vi.fn(() => Promise.resolve(snapshot())),
      create,
      commandReceipt
    })
    const port =
      createGeneratorPresetApplicationOwner(capability).port(campaignId)

    await expect(
      port.create('Stale', defaultGeneratorConfig)
    ).rejects.toMatchObject({ code: 'stale' })
    expect(create).toHaveBeenCalledOnce()
    expect(commandReceipt).not.toHaveBeenCalled()
  })
})

function capabilityStub(
  overrides: Partial<GeneratorPresetCapability>
): GeneratorPresetCapability {
  return {
    readEditor: vi.fn(() => Promise.resolve(snapshot())),
    create: vi.fn(() => Promise.reject(new Error('not used'))),
    update: vi.fn(() => Promise.reject(new Error('not used'))),
    delete: vi.fn(() => Promise.reject(new Error('not used'))),
    assign: vi.fn(() => Promise.reject(new Error('not used'))),
    commandReceipt: vi.fn(() => Promise.resolve(null)),
    ...overrides
  }
}

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

function append(
  before: GeneratorPresetEditorSnapshot,
  id: string,
  revision: number
): GeneratorPresetEditorSnapshot {
  const receipt = createReceipt(before, firstCommandId(), id, revision)
  return { ...before, registry: receipt.registry }
}

function createReceipt(
  before: GeneratorPresetEditorSnapshot,
  commandId: string,
  id: string,
  registryRevision: number
): CreateGeneratorPresetReceipt {
  const saved = {
    ...before.registry.presets[0]!,
    id,
    name: id === firstCustomId ? 'First' : 'Second',
    protected: false
  }
  return {
    kind: 'created',
    commandId,
    saved,
    registry: {
      revision: registryRevision,
      presets: [...before.registry.presets, saved]
    }
  }
}

function assignReceipt(
  created: CreateGeneratorPresetReceipt,
  commandId: string
): AssignGeneratorPresetReceipt {
  return {
    kind: 'assigned',
    commandId,
    registry: { ...created.registry, revision: 6 },
    assignment: {
      campaignId,
      assignedPresetId: firstCustomId,
      effectivePresetId: firstCustomId
    },
    effectivePreset: created.saved
  }
}

function firstCommandId(): string {
  return '00000000-0000-4000-8000-000000000040'
}

async function nextMicrotask(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void
  let reject!: (cause?: unknown) => void
  const promise = new Promise<Value>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
