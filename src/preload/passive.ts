import { contextBridge, ipcRenderer } from 'electron'
import { z } from 'zod'
import {
  passiveProjectionSchema,
  type PassiveDisplayApi
} from '../shared/contracts/passive-display.js'
import { coreProcessStatusSchema } from '../shared/contracts/runtime.js'
import { capabilityFailureSchema } from '../shared/contracts/campaign.js'
import { CapabilityError } from '../shared/errors/capability-error.js'

const responseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), payload: z.unknown() }).strict(),
  z.object({ ok: z.literal(false), error: capabilityFailureSchema }).strict()
])

const api: PassiveDisplayApi = {
  async readProjection() {
    const result = responseSchema.parse(
      await ipcRenderer.invoke('projection:read')
    )
    if (!result.ok)
      throw new CapabilityError(
        result.error.code,
        result.error.retryable,
        result.error.data
      )
    return freeze(passiveProjectionSchema.parse(result.payload))
  },
  onProjectionChanged(listener) {
    const handler = (_event: Electron.IpcRendererEvent, raw: unknown) =>
      listener(freeze(passiveProjectionSchema.parse(raw)))
    ipcRenderer.on('projection:changed', handler)
    return () => ipcRenderer.removeListener('projection:changed', handler)
  },
  async coreStatus() {
    return coreProcessStatusSchema.parse(
      await ipcRenderer.invoke('runtime:core-status')
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

contextBridge.exposeInMainWorld('saltMarcherPassive', Object.freeze(api))

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') Object.freeze(value)
  return value
}
