import { contextBridge, ipcRenderer } from 'electron'
import { z } from 'zod'
import { capabilityFailureSchema } from '../../shared/contracts/campaign.js'
import type { SaltMarcherApi } from '../../shared/contracts/capability-api.js'
import {
  capabilityEvents,
  type CapabilityEventKind,
  type CapabilityEventPayload
} from '../../shared/contracts/events.js'
import {
  coreOperations,
  mainOperations,
  type CoreOperationInput,
  type CoreOperationKind,
  type CoreOperationOutput,
  type MainOperationInput,
  type MainOperationKind,
  type MainOperationOutput
} from '../../shared/contracts/operations.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'

const invokeIpc = (channel: string, input: unknown): Promise<unknown> =>
  ipcRenderer.invoke(channel, input)

async function invokeCore<K extends CoreOperationKind>(
  kind: K,
  input: CoreOperationInput<K>
): Promise<CoreOperationOutput<K>> {
  const operation = coreOperations[kind]
  if (operation.channel === null)
    throw new CapabilityError('protocol_violation', false)
  const request = operation.input.safeParse(input)
  if (!request.success) throw new CapabilityError('validation_failed', false)
  try {
    const raw = await invokeIpc(operation.channel, request.data)
    const result = z
      .discriminatedUnion('ok', [
        z.object({ ok: z.literal(true), payload: z.unknown() }).passthrough(),
        z
          .object({ ok: z.literal(false), error: capabilityFailureSchema })
          .passthrough()
      ])
      .parse(raw)
    if (!result.ok)
      throw new CapabilityError(result.error.code, result.error.retryable)
    const value = operation.output.safeParse(result.payload)
    if (!value.success) throw new CapabilityError('protocol_violation', false)
    return freezeDeep(value.data) as CoreOperationOutput<K>
  } catch (error) {
    if (error instanceof CapabilityError) throw error
    throw new CapabilityError('core_unavailable', true)
  }
}

async function invokeMain<K extends MainOperationKind>(
  kind: K,
  input: MainOperationInput<K>
): Promise<MainOperationOutput<K>> {
  const operation = mainOperations[kind]
  if (operation.channel === null)
    throw new CapabilityError('protocol_violation', false)
  const request = operation.input.safeParse(input)
  if (!request.success) throw new CapabilityError('validation_failed', false)
  try {
    return freezeDeep(
      operation.output.parse(await invokeIpc(operation.channel, request.data))
    ) as MainOperationOutput<K>
  } catch (error) {
    if (error instanceof CapabilityError) throw error
    throw new CapabilityError('core_unavailable', true)
  }
}

type Facade = Record<string, Record<string, unknown>>

const facade: Facade = {}

for (const [kind, operation] of Object.entries(coreOperations)) {
  if (operation.channel === null || !operation.roles.includes('gm')) continue
  installMethod(kind, (input) =>
    invokeCore(kind as CoreOperationKind, input as never)
  )
}

for (const [kind, operation] of Object.entries(mainOperations)) {
  if (operation.channel === null || !operation.roles.includes('gm')) continue
  installMethod(kind, (input) =>
    invokeMain(kind as MainOperationKind, input as never)
  )
}

for (const [kind, event] of Object.entries(capabilityEvents)) {
  if (!event.roles.includes('gm')) continue
  installMethod(kind, (listener: unknown) => {
    if (typeof listener !== 'function')
      throw new CapabilityError('validation_failed', false)
    const handler = (_event: Electron.IpcRendererEvent, raw: unknown): void => {
      const definition = capabilityEvents[kind as CapabilityEventKind]
      const notice = definition.payload.parse(
        raw
      ) as CapabilityEventPayload<CapabilityEventKind>
      ;(listener as (payload: unknown) => void)(freezeDeep(notice))
    }
    ipcRenderer.on(event.channel, handler)
    return () => ipcRenderer.removeListener(event.channel, handler)
  })
}

facade['runtime'] = Object.freeze({
  ...facade['runtime'],
  readOnly: process.argv.includes('--salt-marcher-read-only'),
  e2e: process.argv.includes('--salt-marcher-e2e')
})

const api = freezeDeep(facade) as SaltMarcherApi
contextBridge.exposeInMainWorld('saltMarcher', api)
if (process.argv.includes('--salt-marcher-e2e'))
  contextBridge.exposeInMainWorld(
    '__saltMarcherE2e',
    Object.freeze({
      terminateUtility: () =>
        invokeIpc(
          'salt-marcher-e2e:terminate-utility',
          undefined
        ) as Promise<boolean>
    })
  )

function installMethod(
  kind: string,
  implementation: (input: unknown) => unknown
): void {
  const separator = kind.indexOf('.')
  const rawNamespace = kind.slice(0, separator)
  const namespace = rawNamespace === 'campaign' ? 'campaigns' : rawNamespace
  const method = kind.slice(separator + 1)
  const target = (facade[namespace] ??= {})
  target[method] = implementation
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child)
    Object.freeze(value)
  }
  return value
}
