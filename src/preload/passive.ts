import { contextBridge, ipcRenderer } from 'electron'
import { z } from 'zod'
import {
  passiveProjectionSchema,
  type PassiveDisplayApi
} from '../shared/contracts/passive-display.js'
import { coreProcessStatusSchema } from '../shared/contracts/runtime.js'
import { capabilityFailureSchema } from '../shared/contracts/campaign.js'
import { CapabilityError } from '../shared/errors/capability-error.js'
import {
  coreOperations,
  mainOperations
} from '../shared/contracts/operations.js'

const responseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), payload: z.unknown() }).strict(),
  z.object({ ok: z.literal(false), error: capabilityFailureSchema }).strict()
])

type PassiveE2eApi = PassiveDisplayApi & {
  __e2eProbePrivilegedChannels?: () => Promise<
    Readonly<Record<string, boolean>>
  >
}

const invokeIpc = (channel: string, input: unknown): Promise<unknown> =>
  ipcRenderer.invoke(channel, input)

const api: PassiveE2eApi = {
  async readProjection() {
    const operation = coreOperations['projection.read']
    const result = responseSchema.parse(
      await invokeIpc(operation.channel!, operation.input.parse(undefined))
    )
    if (!result.ok)
      throw new CapabilityError(result.error.code, result.error.retryable)
    return freeze(passiveProjectionSchema.parse(result.payload))
  },
  onProjectionChanged(listener) {
    const handler = (_event: Electron.IpcRendererEvent, raw: unknown) =>
      listener(freeze(passiveProjectionSchema.parse(raw)))
    ipcRenderer.on('projection:changed', handler)
    return () => ipcRenderer.removeListener('projection:changed', handler)
  },
  async coreStatus() {
    const operation = mainOperations['runtime.coreStatus']
    if (operation.channel === null)
      throw new CapabilityError('protocol_violation', false)
    return coreProcessStatusSchema.parse(
      await invokeIpc(operation.channel, undefined)
    )
  },
  onCoreStatus(listener) {
    const handler = (_event: Electron.IpcRendererEvent, raw: unknown) =>
      listener(coreProcessStatusSchema.parse(raw))
    ipcRenderer.on('runtime:core-status-changed', handler)
    return () =>
      ipcRenderer.removeListener('runtime:core-status-changed', handler)
  }
}

if (process.argv.includes('--passive-e2e-probe')) {
  api.__e2eProbePrivilegedChannels = async () => {
    const definitions = [
      ...Object.values(coreOperations),
      ...Object.values(mainOperations)
    ]
    const privilegedChannels = definitions
      .filter(
        (definition) =>
          definition.channel !== null &&
          definition.roles.includes('gm') &&
          !definition.roles.includes('passive')
      )
      .map((definition) => definition.channel!)
    return Object.freeze(
      Object.fromEntries(
        await Promise.all(
          privilegedChannels.map(async (channel) => {
            try {
              const result = await invokeIpc(channel, undefined)
              const rejected =
                result !== null &&
                typeof result === 'object' &&
                'ok' in result &&
                result.ok === false &&
                'error' in result &&
                result.error !== null &&
                typeof result.error === 'object' &&
                'code' in result.error &&
                result.error.code === 'read_only'
              return [channel, rejected] as const
            } catch {
              return [channel, true] as const
            }
          })
        )
      )
    )
  }
}

contextBridge.exposeInMainWorld('saltMarcherPassive', Object.freeze(api))

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') Object.freeze(value)
  return value
}
