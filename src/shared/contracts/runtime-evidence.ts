import { z } from 'zod'
import { coreRuntimeMetricsSchema } from './core-protocol.js'
import { coreProcessStatusSchema } from './runtime.js'

export const runtimeProcessMetricSchema = z
  .object({
    pid: z.number().int().positive(),
    type: z.string().min(1),
    cpuPercent: z.number().nonnegative(),
    idleWakeupsPerSecond: z.number().nonnegative(),
    workingSetSizeKiB: z.number().nonnegative()
  })
  .strict()
  .readonly()

export const runtimeEvidenceSchema = z
  .object({
    capturedAt: z.iso.datetime(),
    supervisor: z
      .object({
        generation: z.number().int().positive(),
        status: coreProcessStatusSchema,
        utility: coreRuntimeMetricsSchema
      })
      .strict()
      .readonly(),
    processes: z.array(runtimeProcessMetricSchema).readonly()
  })
  .strict()
  .readonly()

export type RuntimeEvidence = z.infer<typeof runtimeEvidenceSchema>
