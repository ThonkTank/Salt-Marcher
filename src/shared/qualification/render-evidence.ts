import { z } from 'zod'

const sampleSchema = z.number().finite().nonnegative()
const populationSchema = z.array(sampleSchema).length(100)
const resultSchema = z
  .object({
    samples: populationSchema,
    p95Ms: sampleSchema,
    budgetMs: z.number().finite().positive(),
    passes: z.boolean()
  })
  .strict()

const recoverySchema = z
  .object({
    lossRequested: z.literal(true),
    lossObserved: z.literal(true),
    restorationObserved: z.literal(true),
    rerendered: z.literal(true),
    nextInteractionSucceeded: z.literal(true)
  })
  .strict()

export const renderQualificationEvidenceSchema = z
  .object({
    status: z.enum(['pass', 'fail']),
    commit: z.string().regex(/^[0-9a-f]{40}$/),
    fixtureVersion: z.literal('m1-render-qualification-v2'),
    packageSha256: z.string().regex(/^[0-9a-f]{64}$/),
    recordedAt: z.iso.datetime(),
    environment: z
      .object({
        operatingSystem: z.string().min(1),
        architecture: z.string().min(1),
        electronVersion: z.string().min(1),
        cpuCalibration: z.string().min(1),
        storageMeasurement: z.string().min(1),
        powerMode: z.string().min(1),
        freeSpaceGiB: z.number().finite().nonnegative(),
        displayWidth: z.literal(1366),
        displayHeight: z.literal(768),
        displayScalePercent: z.union([z.literal(100), z.literal(200)]),
        renderingBackend: z.literal('webgl2'),
        webglVersion: z.string().startsWith('WebGL 2'),
        gpuModel: z.string().min(1),
        gpuDriver: z.string().min(1),
        softwareRendering: z.literal(false)
      })
      .strict(),
    populations: z
      .object({
        pixiPan: resultSchema,
        babylonCamera: resultSchema,
        babylonHoverPick: resultSchema,
        babylonVoxelPreview: resultSchema
      })
      .strict(),
    contextLoss: z
      .object({ pixi: recoverySchema, babylon: recoverySchema })
      .strict(),
    resources: z
      .object({
        rendererCycles: z.number().int().min(20),
        pixiContextLossCycles: z.number().int().min(20),
        babylonContextLossCycles: z.number().int().min(20),
        processMemoryBytesBefore: z.number().int().nonnegative(),
        processMemoryBytesAfterSettling: z.number().int().nonnegative(),
        listenerCountBefore: z.number().int().nonnegative(),
        listenerCountAfter: z.number().int().nonnegative(),
        canvasCountBefore: z.number().int().nonnegative(),
        canvasCountAfter: z.number().int().nonnegative(),
        meshCountBefore: z.number().int().nonnegative(),
        meshCountAfter: z.number().int().nonnegative()
      })
      .strict(),
    accessibility: z
      .object({
        keyboardJourneyPassed: z.literal(true),
        textAlternativePassed: z.literal(true),
        screenReader: z
          .object({ reader: z.string().min(1), version: z.string().min(1) })
          .strict()
      })
      .strict()
  })
  .strict()

export type RenderQualificationEvidence = z.infer<
  typeof renderQualificationEvidenceSchema
>

export function validateRenderQualificationEvidence(
  raw: unknown
): RenderQualificationEvidence {
  const evidence = renderQualificationEvidenceSchema.parse(raw)
  const expectedBudgets = {
    pixiPan: 16,
    babylonCamera: 16,
    babylonHoverPick: 16,
    babylonVoxelPreview: 50
  } as const
  for (const [name, budget] of Object.entries(expectedBudgets) as [
    keyof typeof expectedBudgets,
    number
  ][]) {
    const result = evidence.populations[name]
    const p95Ms = p95(result.samples)
    if (result.p95Ms !== p95Ms || result.budgetMs !== budget)
      throw new Error(`${name} has an incorrect p95 or budget`)
    if (result.passes !== p95Ms <= budget)
      throw new Error(`${name} has an incorrect verdict`)
  }
  const allPassed = Object.values(evidence.populations).every(
    (population) => population.passes
  )
  if ((evidence.status === 'pass') !== allPassed)
    throw new Error('Top-level status does not match population verdicts')
  return evidence
}

function p95(samples: readonly number[]): number {
  const ordered = [...samples].sort((left, right) => left - right)
  return ordered[94] ?? 0
}
