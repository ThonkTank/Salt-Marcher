import { app, ipcMain } from 'electron'
import type { CoreProcessSupervisor } from '../core-process/core-process-supervisor.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  coreOperations,
  mainOperations,
  type CoreOperationKind,
  type MainOperationKind,
  type OperationDefinition
} from '../../shared/contracts/operations.js'
import { runtimeGpuObservationSchema } from '../../shared/qualification/runtime-observation.js'
import { roleCanInvoke } from './operation-authorization.js'
import { roleForEvent } from './window-role.js'
import { gpuObservation } from './runtime-observation.js'

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
      if (!definition.roles.includes(roleForEvent(event)))
        throw new CapabilityError('read_only', false)
      definition.input.parse(raw)
      return definition.output.parse(await handlers[kind]())
    })
  }
}

function mainHandlers(core: CoreProcessSupervisor) {
  return {
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
    }
  } satisfies Record<MainOperationKind, () => unknown>
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
        retryable
      }
    }
  }
}
