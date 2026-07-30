import { z } from 'zod'

const sampleSchema = z.number().finite().nonnegative()
const samplesSchema = z.array(sampleSchema).length(100)

export const runtimeObservationConfigurationSchema = z.enum([
  'normal',
  'scale200Percent'
])

export const contextRecoveryObservationSchema = z
  .object({
    requestedCycles: z.number().int().nonnegative(),
    observedLossCycles: z.number().int().nonnegative(),
    restoredCycles: z.number().int().nonnegative(),
    rerenderedCycles: z.number().int().nonnegative(),
    nextInteractionSucceededCycles: z.number().int().nonnegative(),
    completedCycles: z.number().int().nonnegative()
  })
  .strict()

export type ContextRecoveryObservation = z.infer<
  typeof contextRecoveryObservationSchema
>

export const runtimeGpuObservationSchema = z
  .object({
    operatingSystem: z.string().min(1),
    architecture: z.string().min(1),
    electronVersion: z.string().min(1),
    featureStatus: z.record(z.string(), z.string()),
    activeGpuDevices: z.array(
      z
        .object({
          active: z.boolean(),
          deviceId: z.string(),
          vendorId: z.string(),
          deviceName: z.string(),
          vendorName: z.string(),
          driverVendor: z.string(),
          driverVersion: z.string()
        })
        .strict()
    ),
    softwareRendering: z.boolean()
  })
  .strict()

export type RuntimeGpuObservation = z.infer<typeof runtimeGpuObservationSchema>

const webglCanvasObservationSchema = z
  .object({
    version: z.string().min(1),
    renderer: z.string().min(1)
  })
  .strict()

const resourceCountsSchema = z
  .object({
    canvases: z.number().int().nonnegative(),
    meshes: z.number().int().nonnegative(),
    listeners: z.number().int().nonnegative()
  })
  .strict()

export const runtimeObservationSchema = z
  .object({
    captureKind: z.literal('m1-runtime-observation'),
    formatVersion: z.literal('m1-runtime-observation-v1'),
    recordedAt: z.iso.datetime(),
    configuration: runtimeObservationConfigurationSchema,
    environment: z
      .object({
        userAgent: z.string().min(1),
        displayWidth: z.number().positive(),
        displayHeight: z.number().positive(),
        devicePixelRatio: z.number().positive(),
        gpu: runtimeGpuObservationSchema,
        webgl: z
          .object({
            pixi: webglCanvasObservationSchema,
            babylon: webglCanvasObservationSchema
          })
          .strict()
      })
      .strict(),
    populations: z
      .object({
        pixiPan: samplesSchema,
        babylonCamera: samplesSchema,
        babylonHoverPick: samplesSchema,
        babylonVoxelPreview: samplesSchema
      })
      .strict(),
    contextLoss: z
      .object({
        pixi: contextRecoveryObservationSchema,
        babylon: contextRecoveryObservationSchema
      })
      .strict(),
    resources: z
      .object({
        rendererCycles: z.number().int().nonnegative(),
        rendererBuilds: z.number().int().nonnegative(),
        rendererDisposals: z.number().int().nonnegative(),
        before: resourceCountsSchema,
        after: resourceCountsSchema,
        settled: z.boolean(),
        processMemoryBytesBefore: z.array(z.number().int().nonnegative()),
        processMemoryBytesAfterSettling: z.array(z.number().int().nonnegative())
      })
      .strict()
      .nullable()
  })
  .strict()

export type RuntimeObservation = z.infer<typeof runtimeObservationSchema>
