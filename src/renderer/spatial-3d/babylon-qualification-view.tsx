import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js'
import { Engine } from '@babylonjs/core/Engines/engine.js'
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents.js'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js'
import { Color4 } from '@babylonjs/core/Maths/math.color.js'
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js'
import { Scene } from '@babylonjs/core/scene.js'
import { useEffect, useRef, useState, type ReactElement } from 'react'

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
      for (let x = -2; x <= 2; x += 1) {
        for (let z = -2; z <= 2; z += 1) {
          const chunk = CreateBox(
            `chunk-${x}-${z}`,
            { width: 3.8, height: 1, depth: 3.8 },
            scene
          )
          chunk.position.set(x * 4, -1, z * 4)
          chunk.isPickable = true
        }
      }
      let hoveredName: string | undefined
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
          setStatus(`Selected ${pickedMesh.name}.`)
        }
      })
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
        aria-label="3D dungeon qualification view"
      />
      <p aria-live="polite">{status}</p>
    </>
  )
}
