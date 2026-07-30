import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { CoreProcessClient } from '../core-process/core-process-client.js'
import { createMainWindow } from '../windows/main-window.js'
import {
  createSecondaryWindow,
  isReadOnlyWindow
} from '../windows/secondary-window.js'
import { configureSecurity } from '../security/security.js'
import { outputPath } from './runtime-paths.js'
import { isE2eRuntime } from './e2e-runtime.js'
import {
  activateCampaignInputSchema,
  campaignCapabilityResponseSchema,
  createCampaignInputSchema,
  type CampaignSnapshot
} from '../../shared/contracts/campaign.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  runtimeGpuObservationSchema,
  type RuntimeGpuObservation
} from '../../shared/qualification/runtime-observation.js'

let core: CoreProcessClient | undefined

export async function startApplication(): Promise<void> {
  await app.whenReady()
  configureSecurity()
  core = new CoreProcessClient(
    join(app.getPath('userData'), 'development-data'),
    outputPath('main', 'utility.js')
  )
  await core.waitUntilReady()
  ipcMain.handle('campaign:list', (event) =>
    invokeCapability(() => {
      authorize(event, false)
      return requireCore().list()
    })
  )
  ipcMain.handle('campaign:create', (event, raw) =>
    invokeCapability(() => {
      authorize(event, true)
      const input = createCampaignInputSchema.safeParse(raw)
      if (!input.success) throw new CapabilityError('validation_failed', false)
      return requireCore().create(input.data.name)
    })
  )
  ipcMain.handle('campaign:activate', (event, raw) =>
    invokeCapability(() => {
      authorize(event, true)
      const input = activateCampaignInputSchema.safeParse(raw)
      if (!input.success) throw new CapabilityError('validation_failed', false)
      return requireCore().activate(input.data.id)
    })
  )
  ipcMain.handle('runtime:memory', (event) => {
    authorize(event, false)
    return app
      .getAppMetrics()
      .reduce((total, metric) => total + metric.memory.workingSetSize * 1024, 0)
  })
  ipcMain.handle('runtime:gpu-observation', async (event) => {
    authorize(event, false)
    await app.getGPUInfo('complete')
    return runtimeGpuObservationSchema.parse(await gpuObservation())
  })
  createMainWindow()
  if (!isE2eRuntime()) createSecondaryWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
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
  return records.flatMap((record) => {
    const device = objectValue(record)
    return [
      {
        active: device['active'] === true,
        deviceId: stringValue(device['deviceId']),
        vendorId: stringValue(device['vendorId']),
        deviceName: stringValue(device['deviceString']),
        vendorName: stringValue(device['vendorString']),
        driverVendor: stringValue(device['driverVendor']),
        driverVersion: stringValue(device['driverVersion'])
      }
    ]
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

export function stopApplication(): void {
  core?.close()
  core = undefined
}

function requireCore(): CoreProcessClient {
  if (core === undefined) throw new CapabilityError('core_unavailable', true)
  return core
}

function authorize(event: IpcMainInvokeEvent, requiresWrite: boolean): void {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (window === null || window.isDestroyed())
    throw new CapabilityError('protocol_violation', false)
  if (requiresWrite && isReadOnlyWindow(event.sender)) {
    throw new CapabilityError('read_only', false)
  }
}

async function invokeCapability(
  operation: () => Promise<CampaignSnapshot>
): Promise<unknown> {
  try {
    return campaignCapabilityResponseSchema.parse({
      ok: true,
      snapshot: await operation()
    })
  } catch (error) {
    const failure =
      error instanceof CapabilityError
        ? { code: error.code, retryable: error.retryable }
        : { code: 'internal' as const, retryable: false }
    return campaignCapabilityResponseSchema.parse({ ok: false, error: failure })
  }
}
