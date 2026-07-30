import { describe, expect, it } from 'vitest'
import { runtimeObservationSchema } from '../../src/shared/qualification/runtime-observation.js'

const samples = Array.from({ length: 100 }, () => 1)

describe('runtime qualification observation', () => {
  it('requires complete timing populations and preserves raw GPU evidence', () => {
    const observation = runtimeObservationSchema.parse({
      captureKind: 'm1-runtime-observation',
      formatVersion: 'm1-runtime-observation-v1',
      recordedAt: '2026-07-30T00:00:00.000Z',
      configuration: 'normal',
      environment: {
        userAgent: 'test',
        displayWidth: 1366,
        displayHeight: 768,
        devicePixelRatio: 1,
        gpu: {
          operatingSystem: 'linux',
          architecture: 'x64',
          electronVersion: '43.2.0',
          featureStatus: { webgl: 'enabled' },
          activeGpuDevices: [
            {
              active: true,
              deviceId: '1',
              vendorId: '2',
              deviceName: 'integrated',
              vendorName: 'vendor',
              driverVendor: 'driver',
              driverVersion: '1'
            }
          ],
          softwareRendering: false
        },
        webgl: {
          pixi: { version: 'WebGL 2.0', renderer: 'integrated' },
          babylon: { version: 'WebGL 2.0', renderer: 'integrated' }
        }
      },
      populations: {
        pixiPan: samples,
        babylonCamera: samples,
        babylonHoverPick: samples,
        babylonVoxelPreview: samples
      },
      contextLoss: { pixi: recovery(), babylon: recovery() },
      resources: null
    })
    expect(observation.environment.gpu.activeGpuDevices[0]?.driverVersion).toBe(
      '1'
    )
  })

  it('rejects partial populations', () => {
    expect(() =>
      runtimeObservationSchema.parse({
        captureKind: 'm1-runtime-observation',
        formatVersion: 'm1-runtime-observation-v1',
        recordedAt: '2026-07-30T00:00:00.000Z',
        configuration: 'normal',
        environment: {
          userAgent: 'test',
          displayWidth: 1,
          displayHeight: 1,
          devicePixelRatio: 1,
          gpu: {
            operatingSystem: 'linux',
            architecture: 'x64',
            electronVersion: '43.2.0',
            featureStatus: {},
            activeGpuDevices: [],
            softwareRendering: false
          },
          webgl: {
            pixi: { version: 'WebGL 2.0', renderer: 'test' },
            babylon: { version: 'WebGL 2.0', renderer: 'test' }
          }
        },
        populations: {
          pixiPan: [],
          babylonCamera: samples,
          babylonHoverPick: samples,
          babylonVoxelPreview: samples
        },
        contextLoss: { pixi: recovery(), babylon: recovery() },
        resources: null
      })
    ).toThrow()
  })
})

function recovery() {
  return {
    requestedCycles: 0,
    observedLossCycles: 0,
    restoredCycles: 0,
    rerenderedCycles: 0,
    nextInteractionSucceededCycles: 0,
    completedCycles: 0
  }
}
