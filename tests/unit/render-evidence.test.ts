import { describe, expect, it } from 'vitest'
import {
  validateRenderQualificationEvidence,
  type RenderQualificationEvidence
} from '../../src/shared/qualification/render-evidence.js'

const samples = Array.from({ length: 100 }, () => 1)

function evidence(): RenderQualificationEvidence {
  const result = (budgetMs: number) => ({
    samples,
    p95Ms: 1,
    budgetMs,
    passes: true
  })
  return {
    status: 'pass',
    commit: 'a'.repeat(40),
    fixtureVersion: 'm1-render-qualification-v2',
    packageSha256: 'b'.repeat(64),
    recordedAt: '2026-07-30T00:00:00.000Z',
    environment: {
      operatingSystem: 'Linux',
      architecture: 'x64',
      electronVersion: '43.2.0',
      cpuCalibration: 'recorded',
      storageMeasurement: 'recorded',
      powerMode: 'balanced',
      freeSpaceGiB: 100,
      displayWidth: 1366,
      displayHeight: 768,
      displayScalePercent: 100,
      renderingBackend: 'webgl2',
      webglVersion: 'WebGL 2.0',
      gpuModel: 'integrated',
      gpuDriver: 'recorded',
      softwareRendering: false
    },
    populations: {
      pixiPan: result(16),
      babylonCamera: result(16),
      babylonHoverPick: result(16),
      babylonVoxelPreview: result(50)
    },
    contextLoss: {
      pixi: {
        lossRequested: true,
        lossObserved: true,
        restorationObserved: true,
        rerendered: true,
        nextInteractionSucceeded: true
      },
      babylon: {
        lossRequested: true,
        lossObserved: true,
        restorationObserved: true,
        rerendered: true,
        nextInteractionSucceeded: true
      }
    },
    resources: {
      rendererCycles: 20,
      contextLossCycles: 20,
      processMemoryBytesBefore: 1,
      processMemoryBytesAfterSettling: 1,
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
      screenReader: { reader: 'test', version: '1' }
    }
  }
}

describe('render qualification evidence', () => {
  it('accepts only a complete, internally consistent end evidence record', () => {
    expect(validateRenderQualificationEvidence(evidence()).status).toBe('pass')
  })

  it('rejects missing samples and forged p95 values', () => {
    const incomplete = evidence()
    incomplete.populations.pixiPan.samples = []
    expect(() => validateRenderQualificationEvidence(incomplete)).toThrow()
    const forged = evidence()
    forged.populations.pixiPan.p95Ms = 2
    expect(() => validateRenderQualificationEvidence(forged)).toThrow(
      'incorrect p95'
    )
  })
})
