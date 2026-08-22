import { contextBridge, ipcRenderer } from 'electron'
import type {
  CapabilityBridge,
  IpcResult
} from '../../shared/contracts/ipc-result.js'
import { ipcResultSchema } from '../../shared/contracts/ipc-result.js'
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
import {
  assertExactOperationKeys,
  operationAllowsRole,
  operationKindsForRole
} from '../../shared/contracts/operations/registry.js'

const invokeIpc = (channel: string, input: unknown): Promise<unknown> =>
  ipcRenderer.invoke(channel, input)

async function invokeCore<K extends CoreOperationKind>(
  kind: K,
  input: CoreOperationInput<K>
): Promise<IpcResult<CoreOperationOutput<K>>> {
  const operation = coreOperations[kind]
  if (operation.channel === null) return failure('protocol_violation', false)
  const request = operation.input.safeParse(input)
  if (!request.success) return failure('validation_failed', false)
  try {
    const raw = await invokeIpc(operation.channel, request.data)
    const result = ipcResultSchema.parse(raw)
    if (!result.ok) return freezeDeep(result)
    const value = operation.output.safeParse(result.payload)
    if (!value.success) return failure('protocol_violation', false)
    return freezeDeep({ ok: true, payload: value.data }) as IpcResult<
      CoreOperationOutput<K>
    >
  } catch {
    return failure('core_unavailable', true)
  }
}

async function invokeMain<K extends MainOperationKind>(
  kind: K,
  input: MainOperationInput<K>
): Promise<IpcResult<MainOperationOutput<K>>> {
  const operation = mainOperations[kind]
  if (operation.channel === null) return failure('protocol_violation', false)
  const request = operation.input.safeParse(input)
  if (!request.success) return failure('validation_failed', false)
  try {
    const result = ipcResultSchema.parse(
      await invokeIpc(operation.channel, request.data)
    )
    if (!result.ok) return freezeDeep(result)
    const output = operation.output.safeParse(result.payload)
    if (!output.success) return failure('protocol_violation', false)
    return freezeDeep({ ok: true, payload: output.data }) as IpcResult<
      MainOperationOutput<K>
    >
  } catch {
    return failure('core_unavailable', true)
  }
}

type Facade = Record<string, Record<string, unknown>>

const facade: Facade = {}
const exposedOperationKinds: string[] = []

for (const [kind, operation] of Object.entries(coreOperations)) {
  if (operation.channel === null || !operationAllowsRole(operation, 'gm'))
    continue
  exposedOperationKinds.push(kind)
  installMethod(kind, (input) =>
    invokeCore(kind as CoreOperationKind, input as never)
  )
}

for (const [kind, operation] of Object.entries(mainOperations)) {
  if (operation.channel === null || !operationAllowsRole(operation, 'gm'))
    continue
  exposedOperationKinds.push(kind)
  installMethod(kind, (input) =>
    invokeMain(kind as MainOperationKind, input as never)
  )
}

assertExactOperationKeys(
  'preload',
  [
    ...operationKindsForRole(coreOperations, 'gm'),
    ...operationKindsForRole(mainOperations, 'gm')
  ],
  exposedOperationKinds
)

for (const [kind, event] of Object.entries(capabilityEvents)) {
  if (!event.roles.includes('gm')) continue
  installMethod(kind, (listener: unknown) => {
    if (typeof listener !== 'function')
      throw new TypeError('Capability event listener must be a function')
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

const api = freezeDeep(facade) as CapabilityBridge
contextBridge.exposeInMainWorld('saltMarcherBridge', api)
if (process.argv.includes('--salt-marcher-e2e'))
  contextBridge.exposeInMainWorld(
    '__saltMarcherE2e',
    Object.freeze({
      terminateUtility: () =>
        invokeIpc(
          'salt-marcher-e2e:terminate-utility',
          undefined
        ) as Promise<boolean>,
      runtimeEvidence: () =>
        invokeIpc('salt-marcher-e2e:runtime-evidence', undefined)
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

function failure(
  code: import('../../shared/errors/capability-error-code.js').CapabilityErrorCode,
  retryable: boolean
): IpcResult<never> {
  return Object.freeze({ ok: false, error: Object.freeze({ code, retryable }) })
}
