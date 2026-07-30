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
const resultsSchema = z
  .object({
    pixiPan: resultSchema,
    babylonCamera: resultSchema,
    babylonHoverPick: resultSchema,
    babylonVoxelPreview: resultSchema
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
        renderingBackend: z.literal('webgl2'),
        webglVersion: z.string().startsWith('WebGL 2'),
        gpuModel: z.string().min(1),
        gpuDriver: z.string().min(1),
        softwareRendering: z.literal(false)
      })
      .strict(),
    populations: z
      .object({ normal: resultsSchema, scale200Percent: resultsSchema })
      .strict(),
    contextLoss: z
      .object({ pixi: recoverySchema, babylon: recoverySchema })
      .strict(),
    resources: z
      .object({
        rendererCycles: z.number().int().min(20),
        pixiContextLossCycles: z.number().int().min(20),
        babylonContextLossCycles: z.number().int().min(20),
        processMemoryBytesBefore: z
          .array(z.number().int().nonnegative())
          .min(3),
        processMemoryBytesAfterSettling: z
          .array(z.number().int().nonnegative())
          .min(3),
        rpHMemoryBudgetBytes: z.number().int().positive(),
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
          .object({
            reader: z.string().min(1),
            version: z.string().min(1),
            journeyPassed: z.literal(true)
          })
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
  for (const configuration of Object.values(evidence.populations))
    for (const [name, budget] of Object.entries(expectedBudgets) as [
      keyof typeof expectedBudgets,
      number
    ][]) {
      const result = configuration[name]
      const measuredP95 = p95(result.samples)
      if (result.p95Ms !== measuredP95 || result.budgetMs !== budget)
        throw new Error(`${name} has an incorrect p95 or budget`)
      if (result.passes !== measuredP95 <= budget)
        throw new Error(`${name} has an incorrect verdict`)
    }
  const resourcesPass =
    evidence.resources.listenerCountBefore ===
      evidence.resources.listenerCountAfter &&
    evidence.resources.canvasCountBefore ===
      evidence.resources.canvasCountAfter &&
    evidence.resources.meshCountBefore === evidence.resources.meshCountAfter &&
    Math.max(...evidence.resources.processMemoryBytesAfterSettling) <=
      Math.min(...evidence.resources.processMemoryBytesBefore) * 1.1 &&
    Math.max(...evidence.resources.processMemoryBytesAfterSettling) <
      evidence.resources.rpHMemoryBudgetBytes * 0.75
  const allPassed =
    Object.values(evidence.populations).every((configuration) =>
      Object.values(configuration).every((population) => population.passes)
    ) && resourcesPass
  if ((evidence.status === 'pass') !== allPassed)
    throw new Error(
      'Top-level status does not match performance, recovery, resource, and accessibility verdicts'
    )
  return evidence
}

export function renderQualificationJsonSchema(): object {
  return z.toJSONSchema(renderQualificationEvidenceSchema)
}

export function renderQualificationTemplate(): object {
  const pendingResult = {
    samples: [],
    p95Ms: null,
    budgetMs: null,
    passes: null
  }
  const pendingConfiguration = {
    pixiPan: pendingResult,
    babylonCamera: pendingResult,
    babylonHoverPick: pendingResult,
    babylonVoxelPreview: pendingResult
  }
  return {
    $comment:
      'Copy this worksheet to a dated file and replace every placeholder. It intentionally fails validation until the complete M1 measurement is recorded.',
    status: 'fail',
    commit: null,
    fixtureVersion: 'm1-render-qualification-v2',
    packageSha256: null,
    recordedAt: null,
    environment: {
      operatingSystem: null,
      architecture: null,
      electronVersion: null,
      cpuCalibration: null,
      storageMeasurement: null,
      powerMode: null,
      freeSpaceGiB: null,
      displayWidth: 1366,
      displayHeight: 768,
      renderingBackend: 'webgl2',
      webglVersion: null,
      gpuModel: null,
      gpuDriver: null,
      softwareRendering: false
    },
    populations: {
      normal: pendingConfiguration,
      scale200Percent: pendingConfiguration
    },
    contextLoss: { pixi: null, babylon: null },
    resources: {
      rendererCycles: null,
      pixiContextLossCycles: null,
      babylonContextLossCycles: null,
      processMemoryBytesBefore: null,
      processMemoryBytesAfterSettling: null,
      rpHMemoryBudgetBytes: null,
      listenerCountBefore: null,
      listenerCountAfter: null,
      canvasCountBefore: null,
      canvasCountAfter: null,
      meshCountBefore: null,
      meshCountAfter: null
    },
    accessibility: {
      keyboardJourneyPassed: null,
      textAlternativePassed: null,
      screenReader: { reader: null, version: null, journeyPassed: null }
    }
  }
}

function p95(samples: readonly number[]): number {
  const ordered = [...samples].sort((left, right) => left - right)
  return ordered[94] ?? 0
}
