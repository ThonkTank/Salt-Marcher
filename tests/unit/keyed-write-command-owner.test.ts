import { describe, expect, it, vi } from 'vitest'
import { AsyncCommandCoordinator } from '../../src/renderer/async/async-command-coordinator.js'
import { KeyedWriteCommandOwner } from '../../src/renderer/async/keyed-write-command-owner.js'
import type { GeneratorPresetCapability } from '../../src/shared/contracts/capability-api.js'
import type {
  CreateGeneratorPresetReceipt,
  GeneratorPresetCommandReceipt
} from '../../src/shared/contracts/generator-presets.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'
import { defaultGeneratorConfig } from '../../src/shared/generator/system-generator-preset.js'

const firstCommandId = '00000000-0000-4000-8000-000000000001'
const secondCommandId = '00000000-0000-4000-8000-000000000002'

describe('keyed write command owner', () => {
  it('selects revisions at transport time after same-authority acceptance', async () => {
    const owner = new KeyedWriteCommandOwner(new AsyncCommandCoordinator())
    const firstGate = deferred<CreateGeneratorPresetReceipt>()
    const acceptedRevisions: number[] = []
    let revision = 4
    const create = vi.fn<GeneratorPresetCapability['create']>((input) =>
      input.commandId === firstCommandId
        ? firstGate.promise
        : Promise.resolve(receipt(input.commandId, 6, 'Second'))
    )
    const receiptRead = vi.fn<GeneratorPresetCapability['commandReceipt']>(() =>
      Promise.resolve(null)
    )
    const run = (commandId: string, name: string) =>
      owner.runReconciled({
        execution: {
          kind: 'receipt-reconciliation',
          authority: {
            scope: 'installation.generator-presets',
            entityKey: null
          },
          commandId,
          command: create,
          receiptRead
        },
        executeAtTransport: (operation) =>
          operation({
            commandId,
            expectedRegistryRevision: revision,
            name,
            config: defaultGeneratorConfig
          }),
        readReceipt: (operation, id) => operation({ commandId: id }),
        recoverReceipt: createdReceipt,
        accept: (value) => {
          revision = value.registry.revision
          acceptedRevisions.push(revision)
        }
      })

    const first = run(firstCommandId, 'First')
    const second = run(secondCommandId, 'Second')
    await nextMicrotask()

    expect(create).toHaveBeenCalledOnce()
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({ expectedRegistryRevision: 4 })
    )

    firstGate.resolve(receipt(firstCommandId, 5, 'First'))
    await expect(first).resolves.toMatchObject({ status: 'success' })
    await expect(second).resolves.toMatchObject({ status: 'success' })
    expect(create.mock.calls[1]?.[0]).toMatchObject({
      expectedRegistryRevision: 5
    })
    expect(acceptedRevisions).toEqual([5, 6])
  })

  it('keeps unrelated authority keys concurrent', async () => {
    const owner = new KeyedWriteCommandOwner(new AsyncCommandCoordinator())
    const firstGate = deferred<CreateGeneratorPresetReceipt>()
    const mapA = vi.fn<GeneratorPresetCapability['create']>(
      () => firstGate.promise
    )
    const mapB = vi.fn<GeneratorPresetCapability['create']>(() =>
      Promise.resolve(receipt(secondCommandId, 1, 'B'))
    )
    const first = owner.run(
      {
        kind: 'fifo-command',
        authority: { scope: 'test.write', entityKey: 'a' },
        operation: mapA
      },
      (operation) =>
        operation({
          commandId: firstCommandId,
          expectedRegistryRevision: 0,
          name: 'A',
          config: defaultGeneratorConfig
        }),
      () => undefined
    )
    const independent = owner.run(
      {
        kind: 'fifo-command',
        authority: { scope: 'test.write', entityKey: 'b' },
        operation: mapB
      },
      (operation) =>
        operation({
          commandId: secondCommandId,
          expectedRegistryRevision: 0,
          name: 'B',
          config: defaultGeneratorConfig
        }),
      () => undefined
    )

    await expect(independent).resolves.toMatchObject({ status: 'success' })
    expect(mapA).toHaveBeenCalledOnce()
    firstGate.resolve(receipt(firstCommandId, 1, 'A'))
    await expect(first).resolves.toMatchObject({ status: 'success' })
  })

  it('retains an interrupted receipt read and retries only that identity', async () => {
    const coordinator = new AsyncCommandCoordinator()
    const owner = new KeyedWriteCommandOwner(coordinator)
    const unknown = new CapabilityError('outcome_unknown', false)
    const recovered = receipt(firstCommandId, 5, 'Recovered')
    const create = vi.fn<GeneratorPresetCapability['create']>(() =>
      Promise.reject(unknown)
    )
    const receiptRead = vi
      .fn<GeneratorPresetCapability['commandReceipt']>()
      .mockRejectedValueOnce(new CapabilityError('core_unavailable', true))
      .mockResolvedValueOnce(recovered)
    const accepted = vi.fn()
    const options = reconciledOptions(
      create,
      receiptRead,
      firstCommandId,
      accepted
    )

    const pending = await owner.runReconciled(options)
    expect(pending).toMatchObject({
      status: 'reconciliation-pending',
      commandId: firstCommandId
    })
    if (pending.status !== 'reconciliation-pending')
      throw new Error('Expected reconciliation to remain pending')

    const blocked = await owner.runReconciled({
      ...options,
      execution: { ...options.execution, commandId: secondCommandId }
    })
    expect(blocked).toEqual({
      status: 'blocked',
      pendingCommandId: firstCommandId
    })
    expect(
      coordinator.state({
        scope: 'installation.generator-presets',
        entityKey: null
      })
    ).toMatchObject({ status: 'failure' })
    expect(create).toHaveBeenCalledOnce()

    await expect(pending.retry()).resolves.toMatchObject({
      status: 'success',
      source: 'receipt',
      value: { commandId: firstCommandId }
    })
    expect(create).toHaveBeenCalledOnce()
    expect(receiptRead).toHaveBeenCalledTimes(2)
    expect(accepted).toHaveBeenCalledOnce()
    expect(
      owner.pendingCommandId({
        scope: 'installation.generator-presets',
        entityKey: null
      })
    ).toBeNull()
  })

  it('treats an absent receipt as failure without replaying the command', async () => {
    const coordinator = new AsyncCommandCoordinator()
    const owner = new KeyedWriteCommandOwner(coordinator)
    const unknown = new CapabilityError('outcome_unknown', false)
    const create = vi.fn<GeneratorPresetCapability['create']>(() =>
      Promise.reject(unknown)
    )
    const receiptRead = vi.fn<GeneratorPresetCapability['commandReceipt']>(() =>
      Promise.resolve(null)
    )

    await expect(
      owner.runReconciled(
        reconciledOptions(create, receiptRead, firstCommandId, vi.fn())
      )
    ).resolves.toEqual({ status: 'failure', cause: unknown })
    expect(create).toHaveBeenCalledOnce()
    expect(receiptRead).toHaveBeenCalledOnce()
    expect(
      coordinator.state({
        scope: 'installation.generator-presets',
        entityKey: null
      })
    ).toMatchObject({ status: 'failure', cause: unknown })
  })
})

function reconciledOptions(
  create: GeneratorPresetCapability['create'],
  receiptRead: GeneratorPresetCapability['commandReceipt'],
  commandId: string,
  accept: (value: CreateGeneratorPresetReceipt) => unknown
) {
  return {
    execution: {
      kind: 'receipt-reconciliation' as const,
      authority: {
        scope: 'installation.generator-presets' as const,
        entityKey: null
      },
      commandId,
      command: create,
      receiptRead
    },
    executeAtTransport: (operation: GeneratorPresetCapability['create']) =>
      operation({
        commandId,
        expectedRegistryRevision: 4,
        name: 'Recovered',
        config: defaultGeneratorConfig
      }),
    readReceipt: (
      operation: GeneratorPresetCapability['commandReceipt'],
      id: string
    ) => operation({ commandId: id }),
    recoverReceipt: createdReceipt,
    accept
  }
}

function createdReceipt(
  value: GeneratorPresetCommandReceipt | null
): CreateGeneratorPresetReceipt | null {
  return value?.kind === 'created' ? value : null
}

function receipt(
  commandId: string,
  revision: number,
  name: string
): CreateGeneratorPresetReceipt {
  return {
    kind: 'created',
    commandId,
    registry: {
      revision,
      presets: [
        {
          id: commandId,
          name,
          schemaVersion: 5,
          revision: 0,
          protected: false,
          createdAt: '2026-08-24T12:00:00.000Z',
          updatedAt: '2026-08-24T12:00:00.000Z',
          config: defaultGeneratorConfig
        }
      ]
    },
    saved: {
      id: commandId,
      name,
      schemaVersion: 5,
      revision: 0,
      protected: false,
      createdAt: '2026-08-24T12:00:00.000Z',
      updatedAt: '2026-08-24T12:00:00.000Z',
      config: defaultGeneratorConfig
    }
  }
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
