import type { GeneratorPresetCapability } from '../../../shared/contracts/capability-api.js'
import type {
  AssignGeneratorPresetReceipt,
  CreateGeneratorPresetReceipt,
  DeleteGeneratorPresetReceipt,
  GeneratorPresetConfigV3,
  GeneratorPresetCommandReceipt,
  GeneratorPresetEditorSnapshot,
  UpdateGeneratorPresetReceipt
} from '../../../shared/contracts/generator-presets.js'
import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'

type MutationResult<T extends GeneratorPresetCommandReceipt> = Readonly<{
  receipt: T
  snapshot: GeneratorPresetEditorSnapshot
}>

export type GeneratorPresetApplicationPort = Readonly<{
  read: () => Promise<GeneratorPresetEditorSnapshot>
  create: (
    name: string,
    config: GeneratorPresetConfigV3
  ) => Promise<MutationResult<CreateGeneratorPresetReceipt>>
  update: (
    id: string,
    name: string,
    config: GeneratorPresetConfigV3
  ) => Promise<MutationResult<UpdateGeneratorPresetReceipt>>
  delete: (id: string) => Promise<MutationResult<DeleteGeneratorPresetReceipt>>
  assign: (
    presetId: string | null
  ) => Promise<MutationResult<AssignGeneratorPresetReceipt>>
}>

export type GeneratorPresetApplicationLoader = (
  campaignId: string | null
) => Promise<GeneratorPresetApplicationPort>

export function createGeneratorPresetApplicationPort(
  capability: GeneratorPresetCapability,
  campaignId: string | null
): GeneratorPresetApplicationPort {
  let current: GeneratorPresetEditorSnapshot | null = null

  const read = async () => {
    current = await capability.readEditor({ campaignId })
    return current
  }
  const complete = <T extends GeneratorPresetCommandReceipt>(
    receipt: T
  ): MutationResult<T> => {
    let assignment = current?.assignment ?? null
    if (receipt.kind === 'assigned') assignment = receipt.assignment
    if (
      receipt.kind === 'deleted' &&
      assignment &&
      assignment.assignedPresetId === receipt.deletedId
    ) {
      const systemPreset = receipt.registry.presets.find(
        (preset) => preset.protected
      )
      assignment = systemPreset
        ? {
            campaignId: assignment.campaignId,
            assignedPresetId: null,
            effectivePresetId: systemPreset.id
          }
        : null
    }
    current = { registry: receipt.registry, assignment }
    return { receipt, snapshot: current }
  }
  const mutate = async <T extends GeneratorPresetCommandReceipt>(
    kind: T['kind'],
    invoke: (command: {
      commandId: string
      expectedRegistryRevision: number
    }) => Promise<T>
  ): Promise<MutationResult<T>> => {
    const commandId = crypto.randomUUID()
    const revision = (current ?? (await read())).registry.revision
    let receipt: T
    try {
      receipt = await invoke({ commandId, expectedRegistryRevision: revision })
    } catch (cause) {
      if (capabilityErrorCode(cause) !== 'outcome_unknown') throw cause
      const recovered = await capability.commandReceipt({ commandId })
      if (!recovered || recovered.kind !== kind) throw cause
      receipt = recovered as T
    }
    return complete(receipt)
  }

  return {
    read,
    create: (name, config) =>
      mutate('created', (command) =>
        capability.create({ ...command, name, config })
      ),
    update: (id, name, config) =>
      mutate('updated', (command) =>
        capability.update({ ...command, id, name, config })
      ),
    delete: (id) =>
      mutate('deleted', (command) => capability.delete({ ...command, id })),
    assign: async (presetId) => {
      if (!campaignId) throw new Error('No active campaign.')
      return mutate('assigned', (command) =>
        capability.assign({ ...command, campaignId, presetId })
      )
    }
  }
}
