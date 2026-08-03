import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { CoreProcessSupervisor } from '../core-process/core-process-supervisor.js'
import { createMainWindow } from '../windows/main-window.js'
import {
  createSecondaryWindow,
  isReadOnlyWindow
} from '../windows/secondary-window.js'
import { configureSecurity } from '../security/security.js'
import { outputPath } from './runtime-paths.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  coreOperations,
  type CoreOperationKind,
  type OperationDefinition,
  type WindowRole
} from '../../shared/contracts/operations.js'
import {
  runtimeGpuObservationSchema,
  type RuntimeGpuObservation
} from '../../shared/qualification/runtime-observation.js'
import { coreProcessStatusSchema } from '../../shared/contracts/runtime.js'
import { roleCanInvoke } from './operation-authorization.js'
import {
  emptyPassiveProjection,
  passiveProjectionSchema
} from '../../shared/contracts/passive-display.js'

let core: CoreProcessSupervisor | undefined

export async function startApplication(): Promise<void> {
  await app.whenReady()
  configureSecurity()
  core = new CoreProcessSupervisor(
    join(app.getPath('userData'), 'development-data'),
    outputPath('main', 'utility.js')
  )
  core.onStatus((status) => {
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send(
        'runtime:core-status-changed',
        coreProcessStatusSchema.parse(status)
      )
  })
  core.onSessionChanged((notice) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('session:changed', notice)
      if (isReadOnlyWindow(window.webContents))
        window.webContents.send(
          'projection:changed',
          passiveProjectionSchema.parse(emptyPassiveProjection)
        )
    }
  })
  void core.waitUntilReady().catch(() => {
    // The shell stays visible and exposes explicit recovery through core status.
  })

  registerCoreOperations()
  registerRuntimeOperations()
  createMainWindow()
  if (process.argv.includes('--passive-e2e')) createSecondaryWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
}

function registerCoreOperations(): void {
  for (const [rawKind, definition] of Object.entries(coreOperations)) {
    if (definition.channel === null) continue
    const kind = rawKind as CoreOperationKind
    ipcMain.handle(definition.channel, (event, raw) =>
      invokeGeneric(async () => {
        authorizeCoreOperation(event, kind)
        const input = definition.input.safeParse(raw)
        if (!input.success)
          throw new CapabilityError('validation_failed', false)
        return requestCore(kind, input.data)
      }, definition.output)
    )
  }
}

function requestCore(
  kind: CoreOperationKind,
  input: unknown
): Promise<unknown> {
  // The operation table validates here and the supervisor validates again at
  // the process boundary.
  return requireCore().requestOperation(kind, input as never)
}

function registerRuntimeOperations(): void {
  ipcMain.handle('runtime:memory', (event) => {
    authorize(event, ['gm', 'qualification'], false)
    return app
      .getAppMetrics()
      .reduce((total, metric) => total + metric.memory.workingSetSize * 1024, 0)
  })
  ipcMain.handle('runtime:gpu-observation', async (event) => {
    authorize(event, ['gm', 'qualification'], false)
    await app.getGPUInfo('complete')
    return runtimeGpuObservationSchema.parse(await gpuObservation())
  })
  ipcMain.handle('runtime:core-status', (event) => {
    authorize(event, ['gm', 'passive', 'qualification'], false)
    return coreProcessStatusSchema.parse(requireCore().status())
  })
  ipcMain.handle('runtime:retry-core', (event) => {
    authorize(event, ['gm', 'qualification'], false)
    const current = requireCore()
    current.retry()
    return coreProcessStatusSchema.parse(current.status())
  })
}

async function gpuObservation(): Promise<RuntimeGpuObservation> {
  const [featureStatus, info] = await Promise.all([
    Promise.resolve(app.getGPUFeatureStatus()),
    app.getGPUInfo('complete')
  ])
  const devices = gpuDevices(info)
  return {
    operatingSystem: process.platform,
    architecture: process.arch,
    electronVersion: process.versions.electron,
    featureStatus: Object.fromEntries(
      Object.entries(featureStatus).map(([key, value]) => [key, String(value)])
    ),
    activeGpuDevices: devices.filter((device) => device.active),
    softwareRendering: usesSoftwareRendering(featureStatus, devices)
  }
}

function gpuDevices(info: unknown): RuntimeGpuObservation['activeGpuDevices'] {
  const records = objectValue(info)['gpuDevice']
  if (!Array.isArray(records)) return []
  return records.map((record) => {
    const device = objectValue(record)
    return {
      active: device['active'] === true,
      deviceId: stringValue(device['deviceId']),
      vendorId: stringValue(device['vendorId']),
      deviceName: stringValue(device['deviceString']),
      vendorName: stringValue(device['vendorString']),
      driverVendor: stringValue(device['driverVendor']),
      driverVersion: stringValue(device['driverVersion'])
    }
  })
}

function usesSoftwareRendering(
  status: Electron.GPUFeatureStatus,
  devices: RuntimeGpuObservation['activeGpuDevices']
): boolean {
  const webgl = String(status.webgl ?? '').toLowerCase()
  const names = devices
    .flatMap((device) => [
      device.deviceName,
      device.vendorName,
      device.driverVendor
    ])
    .join(' ')
    .toLowerCase()
  return (
    webgl.includes('software') || /swiftshader|llvmpipe|software/.test(names)
  )
}

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export async function stopApplication(): Promise<void> {
  await core?.closeGracefully()
  core = undefined
}

export function waitForCoreReady(): Promise<void> {
  return requireCore().waitUntilReady()
}

function requireCore(): CoreProcessSupervisor {
  if (core === undefined) throw new CapabilityError('core_unavailable', true)
  return core
}

function authorize(
  event: IpcMainInvokeEvent,
  allowedRoles: readonly WindowRole[],
  requiresWrite: boolean
): void {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (window === null || window.isDestroyed())
    throw new CapabilityError('protocol_violation', false)
  const role: WindowRole = isReadOnlyWindow(event.sender)
    ? 'passive'
    : process.argv.includes('--m1-qualification')
      ? 'qualification'
      : 'gm'
  if (!allowedRoles.includes(role) || (requiresWrite && role !== 'gm'))
    throw new CapabilityError('read_only', false)
}

function authorizeCoreOperation(
  event: IpcMainInvokeEvent,
  kind: CoreOperationKind
): void {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (window === null || window.isDestroyed())
    throw new CapabilityError('protocol_violation', false)
  const role: WindowRole = isReadOnlyWindow(event.sender)
    ? 'passive'
    : process.argv.includes('--m1-qualification')
      ? 'qualification'
      : 'gm'
  if (!roleCanInvoke(role, kind)) throw new CapabilityError('read_only', false)
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
        ...(error instanceof CapabilityError && error.data
          ? { data: error.data }
          : {})
      }
    }
  }
}
