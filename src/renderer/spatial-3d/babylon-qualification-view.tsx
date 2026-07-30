import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js'
import { Engine } from '@babylonjs/core/Engines/engine.js'
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents.js'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js'
import { Color4 } from '@babylonjs/core/Maths/math.color.js'
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js'
import { Mesh } from '@babylonjs/core/Meshes/mesh.js'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js'
import { Scene } from '@babylonjs/core/scene.js'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import {
  downloadRawQualificationSamples,
  FrameMeasurementTracker,
  InteractionSampler,
  localPreviewBudgetMs,
  recordedRunCount
} from './render-qualification-metrics.js'
import {
  createQualificationVoxelChunk,
  meshVoxelChunk,
  togglePreviewVoxel,
  type VoxelChunk
} from './voxel-chunk.js'
import {
  ContextRecoveryTracker,
  exerciseWebglContextLoss,
  webgl2Description
} from './webgl-context.js'
import { type SpatialQualificationModel } from '../spatial-qualification-model.js'
import {
  ListenerRegistrationTracker,
  type QualificationRenderer,
  type RendererResourceCounts
} from '../renderer-resource-cycle.js'

/** M1 continuous dungeon prototype: chunk meshes, camera, hover/picking and selection. */
export function BabylonQualificationView({
  model,
  onResourcesCreated,
  onResourcesDisposed,
  onPopulationComplete
}: {
  readonly model: SpatialQualificationModel
  readonly onResourcesCreated?: (
    renderer: QualificationRenderer,
    counts: RendererResourceCounts
  ) => void
  readonly onResourcesDisposed?: (
    renderer: QualificationRenderer,
    counts: RendererResourceCounts
  ) => void
  readonly onPopulationComplete?: (
    population: 'babylonCamera' | 'babylonHoverPick' | 'babylonVoxelPreview',
    samples: readonly number[]
  ) => void
}): ReactElement {
  const canvas = useRef<HTMLCanvasElement>(null)
  const downloadSamples = useRef<(() => void) | null>(null)
  const recovery = useRef(new ContextRecoveryTracker())
  const [downloadReady, setDownloadReady] = useState(false)
  const exerciseContextLoss = (): void => {
    const element = canvas.current
    if (
      element === null ||
      !exerciseWebglContextLoss(element, () => recovery.current.requested())
    )
      setStatus(
        'This browser does not expose the WebGL context-loss test extension.'
      )
  }
  const [status, setStatus] = useState(
    '3D qualification view ready. Drag to orbit; click a chunk to select.'
  )
  useEffect(() => {
    const element = canvas.current
    if (element === null) return
    try {
      const engine = new Engine(element, true, {
        preserveDrawingBuffer: false,
        stencil: false
      })
      if (webgl2Description(element) === undefined) {
        engine.dispose()
        setStatus(
          '3D qualification requires WebGL 2; this device is unavailable.'
        )
        return
      }
      const scene = new Scene(engine)
      scene.clearColor = new Color4(0.047, 0.082, 0.075, 1)
      const camera = new ArcRotateCamera(
        'camera',
        -Math.PI / 2,
        Math.PI / 3,
        24,
        Vector3.Zero(),
        scene
      )
      camera.attachControl(element, true)
      new HemisphericLight('ambient', new Vector3(0, 1, 0), scene)
      const chunks = new Map<string, ReturnType<typeof CreateBox>>()
      for (let x = -2; x <= 2; x += 1) {
        for (let z = -2; z <= 2; z += 1) {
          const chunk = CreateBox(
            `chunk-${x}-${z}`,
            { width: 3.8, height: 1, depth: 3.8 },
            scene
          )
          chunk.position.set(x * 4, -1, z * 4)
          chunk.isPickable = true
          chunks.set(chunk.name, chunk)
        }
      }
      let hoveredName: string | undefined
      let selectedName = model.state.selectedChunk ?? undefined
      const previewSampler = new InteractionSampler(localPreviewBudgetMs)
      const cameraSampler = new InteractionSampler()
      const hoverSampler = new InteractionSampler()
      const previewTracker = new FrameMeasurementTracker()
      const cameraTracker = new FrameMeasurementTracker()
      const hoverTracker = new FrameMeasurementTracker()
      const cameraInputToPresentation: number[] = []
      const hoverInputToPresentation: number[] = []
      const previewInputToPresentation: number[] = []
      downloadSamples.current = () => {
        downloadRawQualificationSamples('m1-babylon-raw.json', {
          babylonCamera: cameraSampler.samples,
          babylonHoverPick: hoverSampler.samples,
          babylonVoxelPreview: previewSampler.samples,
          babylonCameraInputToPresentation: cameraInputToPresentation,
          babylonHoverPickInputToPresentation: hoverInputToPresentation,
          babylonVoxelPreviewInputToPresentation: previewInputToPresentation,
          babylonContextRecoveryCycles: [recovery.current.completedCycles]
        })
      }
      let previewVoxels = createQualificationVoxelChunk()
      let preview = createVoxelMesh(scene, previewVoxels)
      preview.position.set(-16, 0, -16)
      const listeners = new ListenerRegistrationTracker()
      listeners.track(
        model.subscribe((state) => {
          selectedName = state.selectedChunk ?? undefined
          for (const chunk of chunks.values())
            chunk.showBoundingBox =
              chunk.name === state.selectedChunk ||
              chunk.name === state.hoveredChunk
        })
      )
      for (const chunk of chunks.values())
        chunk.showBoundingBox =
          chunk.name === model.state.selectedChunk ||
          chunk.name === model.state.hoveredChunk
      const collect = (
        tracker: FrameMeasurementTracker,
        sampler: InteractionSampler,
        diagnostics: number[],
        label: string,
        population:
          'babylonCamera' | 'babylonHoverPick' | 'babylonVoxelPreview',
        measuredDuration: (timing: {
          readonly frameWorkMs: number
          readonly inputToPresentationMs: number
        }) => number
      ): void => {
        const timing = tracker.afterRender()
        if (timing === undefined) return
        if (diagnostics.length < recordedRunCount)
          diagnostics.push(timing.inputToPresentationMs)
        const result = sampler.record(measuredDuration(timing))
        if (result !== undefined) {
          onPopulationComplete?.(population, sampler.samples)
          setStatus(
            `${label} p95 ${result.p95Ms.toFixed(2)} ms after ${recordedRunCount} samples.`
          )
        }
      }
      const beforeRenderObserver = scene.onBeforeRenderObservable.add(() => {
        cameraTracker.beforeRender()
        hoverTracker.beforeRender()
        previewTracker.beforeRender()
      })
      listeners.track(() =>
        scene.onBeforeRenderObservable.remove(beforeRenderObserver)
      )
      const afterRenderObserver = scene.onAfterRenderObservable.add(() => {
        recovery.current.observedRerender()
        collect(
          cameraTracker,
          cameraSampler,
          cameraInputToPresentation,
          '3D camera frame-work',
          'babylonCamera',
          (timing) => timing.frameWorkMs
        )
        collect(
          hoverTracker,
          hoverSampler,
          hoverInputToPresentation,
          '3D hover/pick frame-work',
          'babylonHoverPick',
          (timing) => timing.frameWorkMs
        )
        collect(
          previewTracker,
          previewSampler,
          previewInputToPresentation,
          'Local voxel preview input-to-visible',
          'babylonVoxelPreview',
          (timing) => timing.inputToPresentationMs
        )
        if (
          cameraSampler.recordedSamples === recordedRunCount &&
          hoverSampler.recordedSamples === recordedRunCount &&
          previewSampler.recordedSamples === recordedRunCount
        )
          setDownloadReady(true)
      })
      listeners.track(() =>
        scene.onAfterRenderObservable.remove(afterRenderObserver)
      )
      const noteRecoveredInteraction = (): void => {
        const completedBefore = recovery.current.completedCycles
        recovery.current.observedNextInteraction()
        if (recovery.current.completedCycles > completedBefore)
          setStatus(
            `3D context recovery cycle ${recovery.current.completedCycles} completed after a successful interaction.`
          )
      }
      const rebuildPreview = (): void => {
        if (selectedName === undefined) {
          previewTracker.cancel()
          setStatus('Select a chunk before requesting a local preview.')
          return
        }
        const selected = chunks.get(selectedName)
        if (selected === undefined) {
          previewTracker.cancel()
          return
        }
        previewVoxels = togglePreviewVoxel(previewVoxels)
        preview.dispose()
        preview = createVoxelMesh(scene, previewVoxels)
        preview.position.set(-16, 0, -16)
        previewTracker.arm()
        noteRecoveredInteraction()
        setStatus(
          `Local 32 × 32 × 16 voxel preview remeshed (${previewSampler.recordedSamples}/${recordedRunCount} recorded samples).`
        )
      }
      const cameraChangedObserver = camera.onViewMatrixChangedObservable.add(
        () => {
          cameraTracker.arm()
          noteRecoveredInteraction()
        }
      )
      listeners.track(() =>
        camera.onViewMatrixChangedObservable.remove(cameraChangedObserver)
      )
      const pointerObserver = scene.onPointerObservable.add((event) => {
        const pickedMesh = event.pickInfo?.pickedMesh
        if (
          event.type === PointerEventTypes.POINTERMOVE &&
          (pickedMesh === null ||
            pickedMesh === undefined ||
            hoveredName === pickedMesh.name)
        )
          hoverTracker.cancel()
        if (
          event.type === PointerEventTypes.POINTERMOVE &&
          pickedMesh !== null &&
          pickedMesh !== undefined
        ) {
          if (hoveredName !== pickedMesh.name) {
            hoveredName = pickedMesh.name
            model.hover(pickedMesh.name)
            hoverTracker.arm()
            noteRecoveredInteraction()
            setStatus(`Hovering ${pickedMesh.name}.`)
          }
        }
        if (
          event.type === PointerEventTypes.POINTERPICK &&
          pickedMesh !== null &&
          pickedMesh !== undefined
        ) {
          model.select(pickedMesh.name)
          setStatus(`Selected ${pickedMesh.name}.`)
        }
      })
      listeners.track(() => scene.onPointerObservable.remove(pointerObserver))
      const previewWithKeyboard = (event: KeyboardEvent): void => {
        if (event.key !== 'p' && event.key !== 'P') return
        event.preventDefault()
        if (!previewTracker.begin()) return
        rebuildPreview()
      }
      listeners.listen(element, 'keydown', previewWithKeyboard)
      const beginCameraMeasurement = (): void => {
        cameraTracker.begin()
      }
      const beginHoverMeasurement = (event: PointerEvent): void => {
        if (event.type === 'pointermove') hoverTracker.begin(event.timeStamp)
      }
      listeners.listen(element, 'pointerdown', beginCameraMeasurement, true)
      listeners.listen(element, 'pointermove', beginHoverMeasurement, true)
      const contextLostObserver = engine.onContextLostObservable.add(() => {
        recovery.current.observedLoss()
        setStatus('3D graphics context lost; waiting for restoration.')
      })
      listeners.track(() =>
        engine.onContextLostObservable.remove(contextLostObserver)
      )
      const contextRestoredObserver = engine.onContextRestoredObservable.add(
        () => {
          recovery.current.observedRestoration()
          setStatus(
            '3D graphics context restored; move the camera, hover, or rebuild a preview to complete this cycle.'
          )
        }
      )
      listeners.track(() =>
        engine.onContextRestoredObservable.remove(contextRestoredObserver)
      )
      engine.runRenderLoop(() => scene.render())
      const resize = () => engine.resize()
      listeners.listenWindow('resize', resize)
      onResourcesCreated?.('babylon', {
        canvases: document.querySelectorAll('.qualification-grid canvas')
          .length,
        meshes: scene.meshes.length,
        listeners: listeners.count
      })
      return () => {
        listeners.dispose()
        downloadSamples.current = null
        scene.dispose()
        engine.dispose()
        onResourcesDisposed?.('babylon', {
          canvases: document.querySelectorAll('.qualification-grid canvas')
            .length,
          meshes: scene.meshes.length,
          listeners: listeners.count
        })
      }
    } catch {
      queueMicrotask(() =>
        setStatus('3D graphics are unavailable on this device.')
      )
      return
    }
  }, [model, onPopulationComplete, onResourcesCreated, onResourcesDisposed])
  return (
    <>
      <canvas
        ref={canvas}
        className="qualification-canvas"
        tabIndex={0}
        aria-label="3D dungeon qualification view"
      />
      <p>Press P after selecting a chunk to rebuild its local preview.</p>
      <button type="button" onClick={exerciseContextLoss}>
        Exercise 3D WebGL context loss and restoration
      </button>
      <button
        type="button"
        onClick={() => downloadSamples.current?.()}
        disabled={!downloadReady}
      >
        Download complete 3D raw timing samples
      </button>
      <p aria-live="polite">{status}</p>
    </>
  )
}

function createVoxelMesh(scene: Scene, voxels: VoxelChunk): Mesh {
  const mesh = new Mesh('voxel-preview', scene)
  const geometry = meshVoxelChunk(voxels)
  const vertexData = new VertexData()
  vertexData.positions = [...geometry.positions]
  vertexData.indices = [...geometry.indices]
  vertexData.normals = [...geometry.normals]
  vertexData.applyToMesh(mesh)
  mesh.isPickable = false
  return mesh
}
