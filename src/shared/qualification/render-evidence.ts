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
    requestedCycles: z.number().int().min(20),
    observedLossCycles: z.number().int().nonnegative(),
    restoredCycles: z.number().int().nonnegative(),
    rerenderedCycles: z.number().int().nonnegative(),
    nextInteractionSucceededCycles: z.number().int().nonnegative()
  })
  .strict()

const calibrationRunSchema = z
  .object({
    records: z.number().int().positive(),
    elapsedMs: z.number().finite().nonnegative(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/)
  })
  .strict()
const rpHCalibrationSchema = z
  .object({
    implementationRevision: z.string().regex(/^[0-9a-f]{64}$/),
    operatingSystem: z.string().min(1),
    architecture: z.string().min(1),
    powerMode: z.string().min(1),
    freeSpaceGiB: z.number().finite().nonnegative(),
    logicalCpuCores: z.number().int().nonnegative(),
    memoryAvailableGiB: z.number().finite().nonnegative(),
    dedicatedGpu: z.boolean(),
    serverClassHardware: z.boolean(),
    cpu: z
      .object({
        scheduling: calibrationRunSchema,
        spatial: calibrationRunSchema
      })
      .strict(),
    storage: z
      .object({
        filesystem: z.string().min(1),
        storageDevice: z.string().min(1),
        cacheState: z.string().min(1),
        fileBytes: z.literal(64 * 1024 * 1024),
        randomAlgorithm: z.literal('splitmix64-v1'),
        randomSeed: z.literal(23072026),
        sequentialWriteBytesPerSecond: z.number().finite().nonnegative(),
        sequentialReadBytesPerSecond: z.number().finite().nonnegative(),
        durableRandomWriteMs: z.array(sampleSchema).length(200),
        randomReadMs: z.array(sampleSchema).length(1000)
      })
      .strict(),
    passes: z.boolean()
  })
  .strict()

export type RpHCalibration = z.infer<typeof rpHCalibrationSchema>

export const renderQualificationEvidenceSchema = z
  .object({
    status: z.enum(['pass', 'fail']),
    commit: z.string().regex(/^[0-9a-f]{40}$/),
    fixtureVersion: z.literal('m1-render-qualification-v3'),
    packageSha256: z.string().regex(/^[0-9a-f]{64}$/),
    recordedAt: z.iso.datetime(),
    environment: z
      .object({
        operatingSystem: z.string().min(1),
        architecture: z.string().min(1),
        electronVersion: z.string().min(1),
        calibration: rpHCalibrationSchema,
        powerMode: z.string().min(1),
        freeSpaceGiB: z.number().finite().nonnegative(),
        displayWidth: z.literal(1366),
        displayHeight: z.literal(768),
        renderingBackend: z.string().min(1),
        webglVersion: z.string().min(1),
        gpuModel: z.string().min(1),
        gpuDriver: z.string().min(1),
        softwareRendering: z.boolean()
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
        rendererCycles: z.number().int().nonnegative(),
        pixiContextLossCycles: z.number().int().nonnegative(),
        babylonContextLossCycles: z.number().int().nonnegative(),
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
        keyboardJourneyPassed: z.boolean(),
        textAlternativePassed: z.boolean(),
        screenReader: z
          .object({
            reader: z.string().min(1),
            version: z.string().min(1),
            journeyPassed: z.boolean()
          })
          .strict()
      })
      .strict()
  })
  .strict()

export type RenderQualificationEvidence = z.infer<
  typeof renderQualificationEvidenceSchema
>

export function rpHCalibrationPasses(calibration: RpHCalibration): boolean {
  return (
    calibration.logicalCpuCores >= 4 &&
    calibration.memoryAvailableGiB >= 8 &&
    calibration.powerMode !== 'unknown' &&
    !calibration.dedicatedGpu &&
    !calibration.serverClassHardware &&
    calibration.cpu.scheduling.records === 100_000 &&
    calibration.cpu.scheduling.elapsedMs <= 500 &&
    calibration.cpu.spatial.records === 2_000_000 &&
    calibration.cpu.spatial.elapsedMs <= 5_000 &&
    calibration.storage.filesystem !== 'unknown' &&
    calibration.storage.storageDevice !== 'unknown' &&
    calibration.storage.cacheState !== 'unknown' &&
    calibration.storage.sequentialWriteBytesPerSecond >= 200_000_000 &&
    calibration.storage.sequentialReadBytesPerSecond >= 200_000_000 &&
    p95(calibration.storage.randomReadMs) <= 2 &&
    p95(calibration.storage.durableRandomWriteMs) <= 10
  )
}

export function validateRenderQualificationEvidence(
  raw: unknown
): RenderQualificationEvidence {
  const evidence = renderQualificationEvidenceSchema.parse(raw)
  if (
    evidence.environment.calibration.passes !==
    rpHCalibrationPasses(evidence.environment.calibration)
  )
    throw new Error('RP-H calibration has an incorrect verdict')
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
  const recoveryPasses = Object.values(evidence.contextLoss).every(
    (recovery) =>
      recovery.observedLossCycles >= recovery.requestedCycles &&
      recovery.restoredCycles >= recovery.requestedCycles &&
      recovery.rerenderedCycles >= recovery.requestedCycles &&
      recovery.nextInteractionSucceededCycles >= recovery.requestedCycles
  )
  const resourcesPass =
    evidence.resources.rendererCycles >= 20 &&
    evidence.resources.pixiContextLossCycles >= 20 &&
    evidence.resources.babylonContextLossCycles >= 20 &&
    evidence.resources.listenerCountBefore ===
      evidence.resources.listenerCountAfter &&
    evidence.resources.canvasCountBefore ===
      evidence.resources.canvasCountAfter &&
    evidence.resources.meshCountBefore === evidence.resources.meshCountAfter &&
    Math.max(...evidence.resources.processMemoryBytesAfterSettling) <=
      Math.min(...evidence.resources.processMemoryBytesBefore) * 1.1 &&
    Math.max(...evidence.resources.processMemoryBytesAfterSettling) <
      evidence.resources.rpHMemoryBudgetBytes * 0.75
  const backendPasses =
    evidence.environment.renderingBackend === 'webgl2' &&
    evidence.environment.webglVersion.startsWith('WebGL 2') &&
    !evidence.environment.softwareRendering
  const accessibilityPasses =
    evidence.accessibility.keyboardJourneyPassed &&
    evidence.accessibility.textAlternativePassed &&
    evidence.accessibility.screenReader.journeyPassed
  const allPassed =
    Object.values(evidence.populations).every((configuration) =>
      Object.values(configuration).every((population) => population.passes)
    ) &&
    rpHCalibrationPasses(evidence.environment.calibration) &&
    backendPasses &&
    recoveryPasses &&
    resourcesPass &&
    accessibilityPasses
  if ((evidence.status === 'pass') !== allPassed)
    throw new Error(
      'Top-level status does not match calibration, performance, backend, recovery, resource, and accessibility verdicts'
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
    fixtureVersion: 'm1-render-qualification-v3',
    packageSha256: null,
    recordedAt: null,
    environment: {
      operatingSystem: null,
      architecture: null,
      electronVersion: null,
      calibration: null,
      powerMode: null,
      freeSpaceGiB: null,
      displayWidth: 1366,
      displayHeight: 768,
      renderingBackend: null,
      webglVersion: null,
      gpuModel: null,
      gpuDriver: null,
      softwareRendering: null
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
  return ordered[Math.ceil(ordered.length * 0.95) - 1] ?? 0
}
