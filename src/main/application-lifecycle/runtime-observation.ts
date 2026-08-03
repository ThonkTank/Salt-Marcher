import { app } from 'electron'
import type { RuntimeGpuObservation } from '../../shared/qualification/runtime-observation.js'

export async function gpuObservation(): Promise<RuntimeGpuObservation> {
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
