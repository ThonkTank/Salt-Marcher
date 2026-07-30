import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js'
import { Engine } from '@babylonjs/core/Engines/engine.js'
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents.js'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js'
import { Color4 } from '@babylonjs/core/Maths/math.color.js'
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js'
import { Scene } from '@babylonjs/core/scene.js'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import {
  InteractionSampler,
  localPreviewBudgetMs,
  recordedRunCount
} from './render-qualification-metrics.js'

/** M1 continuous dungeon prototype: chunk meshes, camera, hover/picking and selection. */
export function BabylonQualificationView(): ReactElement {
  const canvas = useRef<HTMLCanvasElement>(null)
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
      let selectedName: string | undefined
      const previewSampler = new InteractionSampler(localPreviewBudgetMs)
      const rebuildPreview = (): void => {
        if (selectedName === undefined) {
          setStatus('Select a chunk before requesting a local preview.')
          return
        }
        const selected = chunks.get(selectedName)
        if (selected === undefined) return
        const startedAt = performance.now()
        const position = selected.position.clone()
        selected.dispose()
        const preview = CreateBox(
          selectedName,
          { width: 3.8, height: 1.2, depth: 3.8 },
          scene
        )
        preview.position.copyFrom(position)
        preview.isPickable = true
        chunks.set(selectedName, preview)
        const result = previewSampler.record(performance.now() - startedAt)
        setStatus(
          result === undefined
            ? `Local preview rebuilt (${previewSampler.recordedSamples}/${recordedRunCount} recorded samples).`
            : `Local preview p95 ${result.p95Ms.toFixed(2)} ms after ${recordedRunCount} samples (${result.passes ? 'passes' : 'fails'}).`
        )
      }
      scene.onPointerObservable.add((event) => {
        const pickedMesh = event.pickInfo?.pickedMesh
        if (
          event.type === PointerEventTypes.POINTERMOVE &&
          pickedMesh !== null &&
          pickedMesh !== undefined
        ) {
          if (hoveredName !== pickedMesh.name) {
            hoveredName = pickedMesh.name
            pickedMesh.showBoundingBox = true
            setStatus(`Hovering ${pickedMesh.name}.`)
          }
        }
        if (
          event.type === PointerEventTypes.POINTERPICK &&
          pickedMesh !== null &&
          pickedMesh !== undefined
        ) {
          selectedName = pickedMesh.name
          setStatus(`Selected ${pickedMesh.name}.`)
        }
      })
      const previewWithKeyboard = (event: KeyboardEvent): void => {
        if (event.key !== 'p' && event.key !== 'P') return
        event.preventDefault()
        rebuildPreview()
      }
      element.addEventListener('keydown', previewWithKeyboard)
      engine.onContextLostObservable.add(() => {
        setStatus('3D graphics context lost; waiting for restoration.')
      })
      engine.onContextRestoredObservable.add(() => {
        setStatus('3D graphics context restored.')
      })
      engine.runRenderLoop(() => scene.render())
      const resize = () => engine.resize()
      window.addEventListener('resize', resize)
      return () => {
        window.removeEventListener('resize', resize)
        element.removeEventListener('keydown', previewWithKeyboard)
        scene.dispose()
        engine.dispose()
      }
    } catch {
      queueMicrotask(() =>
        setStatus('3D graphics are unavailable on this device.')
      )
      return
    }
  }, [])
  return (
    <>
      <canvas
        ref={canvas}
        className="qualification-canvas"
        tabIndex={0}
        aria-label="3D dungeon qualification view"
      />
      <p>Press P after selecting a chunk to rebuild its local preview.</p>
      <p aria-live="polite">{status}</p>
    </>
  )
}
