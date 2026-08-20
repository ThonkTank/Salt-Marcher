import { app, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { CoreProcessSupervisor } from '../core-process/core-process-supervisor.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  coreOperations,
  mainOperations,
  type CoreOperationKind,
  type MainOperationKind,
  type OperationDefinition
} from '../../shared/contracts/operations.js'
import {
  defineContextualOperationHandlers,
  operationAllowsRole
} from '../../shared/contracts/operations/registry.js'
import { runtimeGpuObservationSchema } from '../../shared/qualification/runtime-observation.js'
import { roleCanInvoke } from './operation-authorization.js'
import { roleForEvent } from './window-role.js'
import { gpuObservation } from './runtime-observation.js'
import { readLocationSymbolFile } from './location-symbol-file.js'

export function registerCapabilities(core: CoreProcessSupervisor): void {
  for (const [rawKind, definition] of Object.entries(coreOperations)) {
    if (definition.channel === null) continue
    const kind = rawKind as CoreOperationKind
    ipcMain.handle(definition.channel, (event, raw) =>
      invokeGeneric(async () => {
        if (!roleCanInvoke(roleForEvent(event), kind))
          throw new CapabilityError('read_only', false)
        const input = definition.input.safeParse(raw)
        if (!input.success)
          throw new CapabilityError('validation_failed', false)
        return core.requestOperation(kind, input.data as never)
      }, definition.output)
    )
  }

  const handlers = mainHandlers(core)
  for (const [rawKind, definition] of Object.entries(mainOperations)) {
    if (definition.channel === null) continue
    const kind = rawKind as MainOperationKind
    ipcMain.handle(definition.channel, async (event, raw) => {
      if (!operationAllowsRole(definition, roleForEvent(event)))
        throw new CapabilityError('read_only', false)
      const input = definition.input.parse(raw)
      const handler = handlers[kind] as (
        event: IpcMainInvokeEvent,
        input: unknown
      ) => unknown
      return definition.output.parse(await handler(event, input))
    })
  }
}

function mainHandlers(core: CoreProcessSupervisor) {
  return defineContextualOperationHandlers<
    typeof mainOperations,
    IpcMainInvokeEvent
  >('main_handlers', mainOperations, {
    'runtime.memory': () =>
      app
        .getAppMetrics()
        .reduce(
          (total, metric) => total + metric.memory.workingSetSize * 1024,
          0
        ),
    'runtime.gpuObservation': async () => {
      await app.getGPUInfo('complete')
      return runtimeGpuObservationSchema.parse(await gpuObservation())
    },
    'runtime.coreStatus': () => core.status(),
    'runtime.retryCore': () => {
      core.retry()
      return core.status()
    },
    'runtime.reportRendererIncident': (_event, incident) => {
      console.error(
        JSON.stringify({
          event: 'renderer-incident',
          occurredAt: new Date().toISOString(),
          ...incident
        })
      )
    },
    'runtime.reloadRenderer': (event) => {
      setImmediate(() => {
        if (!event.sender.isDestroyed()) event.sender.reload()
      })
    },
    'runtime.pickLocationSymbolFile': async () => {
      const selection = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'SVG', extensions: ['svg'] }]
      })
      if (selection.canceled || !selection.filePaths[0])
        return { status: 'cancelled' as const }
      return readLocationSymbolFile(selection.filePaths[0])
    }
  })
}

async function invokeGeneric(
  operation: () => Promise<unknown>,
  schema: OperationDefinition['output']
): Promise<unknown> {
  try {
    return { ok: true, payload: schema.parse(await operation()) }
  } catch (error) {
    const code = error instanceof CapabilityError ? error.code : 'internal'
    const retryable = error instanceof CapabilityError ? error.retryable : false
    return {
      ok: false,
      error: {
        code,
        retryable,
        ...(error instanceof CapabilityError && error.issues.length > 0
          ? { issues: error.issues }
          : {})
      }
    }
  }
}
