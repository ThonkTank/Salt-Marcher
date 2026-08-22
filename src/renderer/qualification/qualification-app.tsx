import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement
} from 'react'
import {
  runtimeObservationSchema,
  type ContextRecoveryObservation
} from '../../shared/qualification/runtime-observation.js'
import {
  RendererResourceCycleTracker,
  type QualificationRenderer,
  type RendererCycleResult,
  type RendererResourceCounts
} from '../renderer-resource-cycle.js'
import { PixiQualificationView } from '../spatial-2d/pixi-qualification-view.js'
import { qualificationViewport } from '../spatial-2d/sparse-pixi-qualification.js'
import { BabylonQualificationView } from '../spatial-3d/babylon-qualification-view.js'
import {
  downloadRawQualificationSamples,
  hasCompleteQualificationPopulations,
  type QualificationPopulation
} from '../spatial-3d/render-qualification-metrics.js'
import {
  SpatialQualificationModel,
  type SpatialQualificationState
} from '../spatial-qualification-model.js'
import { capabilityApi } from '../capabilities/capability-api.js'

type WebglObservation = Readonly<{ version: string; renderer: string }>

export function QualificationApp(): ReactElement {
  const [generation, setGeneration] = useState(0)
  const [configuration, setConfiguration] = useState<
    'normal' | 'scale200Percent'
  >('normal')
  const [status, setStatus] = useState('Qualification views are starting.')
  const [samples, setSamples] = useState<
    Readonly<Partial<Record<QualificationPopulation, readonly number[]>>>
  >({})
  const [contextLoss, setContextLoss] = useState<
    Partial<Record<QualificationRenderer, ContextRecoveryObservation>>
  >({})
  const [webgl, setWebgl] = useState<
    Partial<Record<QualificationRenderer, WebglObservation>>
  >({})
  const [resourceObservation, setResourceObservation] = useState<{
    readonly result: RendererCycleResult
    readonly processMemoryBytesBefore: readonly number[]
    readonly processMemoryBytesAfterSettling: readonly number[]
  } | null>(null)
  const resources = useRef<
    Partial<Record<QualificationRenderer, RendererResourceCounts>>
  >({})
  const cycles = useRef(new RendererResourceCycleTracker())
  const model = useMemo(
    () => new SpatialQualificationModel(qualificationViewport()),
    []
  )
  const [spatialState, setSpatialState] = useState(model.state)

  useEffect(() => model.subscribe(setSpatialState), [model])

  const built = useCallback(
    (renderer: QualificationRenderer, counts: RendererResourceCounts) => {
      resources.current[renderer] = counts
      cycles.current.rendererBuilt()
    },
    []
  )
  const disposed = useCallback(
    (renderer: QualificationRenderer, counts: RendererResourceCounts) => {
      delete resources.current[renderer]
      cycles.current.rendererDisposed(counts)
    },
    []
  )
  const updateContext = useCallback(
    (
      renderer: QualificationRenderer,
      observation: ContextRecoveryObservation
    ) => setContextLoss((current) => ({ ...current, [renderer]: observation })),
    []
  )
  const updateWebgl = useCallback(
    (renderer: QualificationRenderer, observation: WebglObservation) =>
      setWebgl((current) => ({ ...current, [renderer]: observation })),
    []
  )

  const complete = hasCompleteQualificationPopulations(samples)
  const webglComplete = hasWebglObservations(webgl)

  const runResourceCycles = async (): Promise<void> => {
    try {
      cycles.current.begin(observedResources(resources.current))
      setStatus('Running 20 renderer build/dispose cycles…')
      const before = await settledWorkingSetSamples()
      for (let cycle = 1; cycle <= 20; cycle += 1) {
        setGeneration((current) => current + 1)
        await waitForRendererBuilds(cycles.current, cycle * 2)
      }
      await settleRenderer()
      const result = cycles.current.finish(observedResources(resources.current))
      const after = await settledWorkingSetSamples()
      setResourceObservation({
        result,
        processMemoryBytesBefore: before,
        processMemoryBytesAfterSettling: after
      })
      setStatus(
        result.settled && result.rendererCycles >= 20
          ? `Completed ${result.rendererCycles} renderer cycles; resource counts settled.`
          : `Resource observation failed to settle after ${result.rendererCycles} cycles.`
      )
    } catch {
      setStatus('Resource cycle observation failed before both views rebuilt.')
    }
  }

  return (
    <main className="qualification-shell">
      <header>
        <p>SaltMarcher · M1 Go/No-Go</p>
        <h1>Rendering qualification</h1>
        <p>
          Measure Pixi sparse-map interaction and Babylon dungeon interaction in
          this dedicated packaged route.
        </p>
      </header>
      <div className="qualification-grid">
        <section className="qualification-panel" key={`pixi-${generation}`}>
          <h2>2D sparse map</h2>
          <PixiQualificationView
            model={model}
            onResourcesCreated={built}
            onResourcesDisposed={disposed}
            onPopulationComplete={(population) =>
              setSamples((current) => ({ ...current, pixiPan: population }))
            }
            onContextRecoveryChange={(observation) =>
              updateContext('pixi', observation)
            }
            onWebglReady={(observation) => updateWebgl('pixi', observation)}
          />
        </section>
        <section className="qualification-panel" key={`babylon-${generation}`}>
          <h2>3D dungeon</h2>
          <BabylonQualificationView
            model={model}
            onResourcesCreated={built}
            onResourcesDisposed={disposed}
            onPopulationComplete={(population, values) =>
              setSamples((current) => ({ ...current, [population]: values }))
            }
            onContextRecoveryChange={(observation) =>
              updateContext('babylon', observation)
            }
            onWebglReady={(observation) => updateWebgl('babylon', observation)}
          />
        </section>
      </div>
      <div className="qualification-controls">
        <button type="button" onClick={() => void runResourceCycles()}>
          Run 20 renderer build/dispose cycles
        </button>
        <button
          type="button"
          disabled={!complete}
          onClick={() => downloadCompleteSamples(samples)}
        >
          Download raw timing populations
        </button>
        <label htmlFor="qualification-configuration">Configuration</label>
        <select
          id="qualification-configuration"
          value={configuration}
          onChange={(event) =>
            setConfiguration(event.target.value as 'normal' | 'scale200Percent')
          }
        >
          <option value="normal">Normal display</option>
          <option value="scale200Percent">200% display scaling</option>
        </select>
        <button
          type="button"
          disabled={!complete || !webglComplete}
          onClick={() =>
            void downloadRuntimeObservation(
              configuration,
              samples,
              contextLoss,
              webgl,
              resourceObservation
            )
          }
        >
          Download runtime observation
        </button>
      </div>
      <p className="qualification-status" aria-live="polite">
        {status}
      </p>
      <SpatialTextAlternative model={model} state={spatialState} />
    </main>
  )
}

function observedResources(
  records: Partial<Record<QualificationRenderer, RendererResourceCounts>>
): RendererResourceCounts {
  return {
    canvases: document.querySelectorAll('.qualification-grid canvas').length,
    meshes: Object.values(records).reduce(
      (total, value) => total + (value?.meshes ?? 0),
      0
    ),
    listeners: Object.values(records).reduce(
      (total, value) => total + (value?.listeners ?? 0),
      0
    )
  }
}

function settleRenderer(): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, 100))
}

async function settledWorkingSetSamples(): Promise<readonly number[]> {
  const values: number[] = []
  for (let sample = 0; sample < 3; sample += 1) {
    await settleRenderer()
    values.push(await capabilityApi().runtime.memory())
  }
  return values
}

async function waitForRendererBuilds(
  tracker: RendererResourceCycleTracker,
  expected: number
): Promise<void> {
  const deadline = performance.now() + 10_000
  while (tracker.rendererBuilds < expected) {
    if (performance.now() > deadline)
      throw new Error('Renderer lifecycle rebuild timed out')
    await new Promise((resolve) => globalThis.setTimeout(resolve, 25))
  }
}

function downloadCompleteSamples(
  populations: Readonly<
    Partial<Record<QualificationPopulation, readonly number[]>>
  >
): void {
  if (!hasCompleteQualificationPopulations(populations)) return
  downloadRawQualificationSamples(
    'm1-render-qualification-raw.json',
    populations
  )
}

function hasWebglObservations(
  observations: Partial<Record<QualificationRenderer, WebglObservation>>
): observations is Record<QualificationRenderer, WebglObservation> {
  return observations.pixi !== undefined && observations.babylon !== undefined
}

async function downloadRuntimeObservation(
  configuration: 'normal' | 'scale200Percent',
  populations: Readonly<
    Partial<Record<QualificationPopulation, readonly number[]>>
  >,
  contextLoss: Partial<
    Record<QualificationRenderer, ContextRecoveryObservation>
  >,
  webgl: Partial<Record<QualificationRenderer, WebglObservation>>,
  resources: {
    readonly result: RendererCycleResult
    readonly processMemoryBytesBefore: readonly number[]
    readonly processMemoryBytesAfterSettling: readonly number[]
  } | null
): Promise<void> {
  if (
    !hasCompleteQualificationPopulations(populations) ||
    !hasWebglObservations(webgl)
  )
    return
  const artifact = runtimeObservationSchema.parse({
    captureKind: 'm1-runtime-observation',
    formatVersion: 'm1-runtime-observation-v1',
    recordedAt: new Date().toISOString(),
    configuration,
    environment: {
      userAgent: navigator.userAgent,
      displayWidth: window.screen.width,
      displayHeight: window.screen.height,
      devicePixelRatio: window.devicePixelRatio,
      gpu: await capabilityApi().runtime.gpuObservation(),
      webgl
    },
    populations,
    contextLoss: {
      pixi: contextLoss.pixi ?? emptyRecoveryObservation(),
      babylon: contextLoss.babylon ?? emptyRecoveryObservation()
    },
    resources:
      resources === null
        ? null
        : {
            rendererCycles: resources.result.rendererCycles,
            rendererBuilds: resources.result.rendererBuilds,
            rendererDisposals: resources.result.rendererDisposals,
            before: resources.result.before,
            after: resources.result.after,
            settled: resources.result.settled,
            processMemoryBytesBefore: resources.processMemoryBytesBefore,
            processMemoryBytesAfterSettling:
              resources.processMemoryBytesAfterSettling
          }
  })
  downloadJson(`m1-runtime-observation-${configuration}.json`, artifact)
}

function downloadJson(name: string, value: unknown): void {
  const anchor = document.createElement('a')
  const objectUrl = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  )
  anchor.href = objectUrl
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

function emptyRecoveryObservation(): ContextRecoveryObservation {
  return {
    requestedCycles: 0,
    observedLossCycles: 0,
    restoredCycles: 0,
    rerenderedCycles: 0,
    nextInteractionSucceededCycles: 0,
    completedCycles: 0
  }
}

function SpatialTextAlternative({
  model,
  state
}: {
  readonly model: SpatialQualificationModel
  readonly state: SpatialQualificationState
}): ReactElement {
  return (
    <section aria-labelledby="spatial-text-heading">
      <h2 id="spatial-text-heading">Accessible spatial alternative</h2>
      <p>
        2D position:{' '}
        <output>{`${state.viewport.x}, ${state.viewport.y}`}</output>
      </p>
      <div className="qualification-inline" aria-label="Move 2D alternative">
        <button type="button" onClick={() => model.pan(-24, 0)}>
          Move west
        </button>
        <button type="button" onClick={() => model.pan(24, 0)}>
          Move east
        </button>
      </div>
      <p>
        3D selection: <output>{state.selectedChunk ?? 'none'}</output>
      </p>
      <div className="qualification-inline" aria-label="Select dungeon chunk">
        <button type="button" onClick={() => model.select('chunk--2--2')}>
          Select northwest chunk
        </button>
        <button type="button" onClick={() => model.select('chunk-2-2')}>
          Select southeast chunk
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        Alternative updated: {state.viewport.x}, {state.viewport.y};{' '}
        {state.selectedChunk ?? 'no selection'}.
      </p>
    </section>
  )
}
