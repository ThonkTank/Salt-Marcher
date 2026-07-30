import { describe, expect, it } from 'vitest'
import {
  validateRenderQualificationEvidence,
  type RenderQualificationEvidence
} from '../../src/shared/qualification/render-evidence.js'

const samples = Array.from({ length: 100 }, () => 1)

function evidence(): RenderQualificationEvidence {
  const result = (budgetMs: number) => ({
    samples: [...samples],
    p95Ms: 1,
    budgetMs,
    passes: true
  })
  return {
    status: 'pass',
    commit: 'a'.repeat(40),
    fixtureVersion: 'm1-render-qualification-v3',
    packageSha256: 'b'.repeat(64),
    recordedAt: '2026-07-30T00:00:00.000Z',
    environment: {
      operatingSystem: 'Linux',
      architecture: 'x64',
      electronVersion: '43.2.0',
      calibration: {
        implementationRevision: 'c'.repeat(64),
        operatingSystem: 'Linux',
        architecture: 'x64',
        powerMode: 'balanced',
        freeSpaceGiB: 100,
        logicalCpuCores: 4,
        memoryAvailableGiB: 8,
        dedicatedGpu: false,
        serverClassHardware: false,
        cpu: {
          scheduling: {
            records: 100_000,
            elapsedMs: 500,
            sha256: 'd'.repeat(64)
          },
          spatial: {
            records: 2_000_000,
            elapsedMs: 5_000,
            sha256: 'e'.repeat(64)
          }
        },
        storage: {
          filesystem: 'ext4',
          storageDevice: 'test',
          cacheState: 'warm',
          fileBytes: 64 * 1024 * 1024,
          randomAlgorithm: 'splitmix64-v1',
          randomSeed: 23072026,
          sequentialWriteBytesPerSecond: 200_000_000,
          sequentialReadBytesPerSecond: 200_000_000,
          durableRandomWriteMs: Array.from({ length: 200 }, () => 1),
          randomReadMs: Array.from({ length: 1000 }, () => 1)
        },
        passes: true
      },
      powerMode: 'balanced',
      freeSpaceGiB: 100,
      displayWidth: 1366,
      displayHeight: 768,
      renderingBackend: 'webgl2',
      webglVersion: 'WebGL 2.0',
      gpuModel: 'integrated',
      gpuDriver: 'recorded',
      softwareRendering: false
    },
    populations: {
      normal: {
        pixiPan: result(16),
        babylonCamera: result(16),
        babylonHoverPick: result(16),
        babylonVoxelPreview: result(50)
      },
      scale200Percent: {
        pixiPan: result(16),
        babylonCamera: result(16),
        babylonHoverPick: result(16),
        babylonVoxelPreview: result(50)
      }
    },
    contextLoss: {
      pixi: completeRecovery(),
      babylon: completeRecovery()
    },
    resources: {
      rendererCycles: 20,
      pixiContextLossCycles: 20,
      babylonContextLossCycles: 20,
      processMemoryBytesBefore: [1, 1, 1],
      processMemoryBytesAfterSettling: [1, 1, 1],
      rpHMemoryBudgetBytes: 2,
      listenerCountBefore: 1,
      listenerCountAfter: 1,
      canvasCountBefore: 1,
      canvasCountAfter: 1,
      meshCountBefore: 1,
      meshCountAfter: 1
    },
    accessibility: {
      keyboardJourneyPassed: true,
      textAlternativePassed: true,
      screenReader: { reader: 'test', version: '1', journeyPassed: true }
    }
  }
}

describe('render qualification evidence', () => {
  it('accepts only a complete, internally consistent end evidence record', () => {
    expect(validateRenderQualificationEvidence(evidence()).status).toBe('pass')
  })

  it('rejects missing samples and forged p95 values', () => {
    const incomplete = evidence()
    incomplete.populations.normal.pixiPan.samples = []
    expect(() => validateRenderQualificationEvidence(incomplete)).toThrow()
    const forged = evidence()
    forged.populations.normal.pixiPan.p95Ms = 2
    expect(() => validateRenderQualificationEvidence(forged)).toThrow(
      'incorrect p95'
    )
  })

  it.each([
    [
      'RP-H calibration',
      (record: RenderQualificationEvidence) => {
        record.environment.calibration.passes = false
        record.environment.calibration.memoryAvailableGiB = 4
      }
    ],
    [
      'performance',
      (record: RenderQualificationEvidence) => {
        record.populations.normal.pixiPan.samples.splice(
          94,
          6,
          ...Array.from({ length: 6 }, () => 17)
        )
        record.populations.normal.pixiPan.p95Ms = 17
        record.populations.normal.pixiPan.passes = false
      }
    ],
    [
      'backend',
      (record: RenderQualificationEvidence) =>
        (record.environment.renderingBackend = 'webgl')
    ],
    [
      'software rendering',
      (record: RenderQualificationEvidence) =>
        (record.environment.softwareRendering = true)
    ],
    [
      'recovery',
      (record: RenderQualificationEvidence) =>
        (record.contextLoss.pixi.restoredCycles = 19)
    ],
    [
      'resources',
      (record: RenderQualificationEvidence) =>
        (record.resources.meshCountAfter = 2)
    ],
    [
      'keyboard journey',
      (record: RenderQualificationEvidence) =>
        (record.accessibility.keyboardJourneyPassed = false)
    ],
    [
      'screenreader journey',
      (record: RenderQualificationEvidence) =>
        (record.accessibility.screenReader.journeyPassed = false)
    ]
  ])('accepts a complete fail record for %s', (_name, mutate) => {
    const failed = evidence()
    mutate(failed)
    failed.status = 'fail'
    expect(validateRenderQualificationEvidence(failed).status).toBe('fail')
  })

  it('rejects a forged RP-H calibration verdict', () => {
    const forged = evidence()
    forged.environment.calibration.passes = false
    expect(() => validateRenderQualificationEvidence(forged)).toThrow(
      'incorrect verdict'
    )
  })
})

function completeRecovery() {
  return {
    requestedCycles: 20,
    observedLossCycles: 20,
    restoredCycles: 20,
    rerenderedCycles: 20,
    nextInteractionSucceededCycles: 20
  }
}
