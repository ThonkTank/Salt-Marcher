import { describe, expect, it } from 'vitest'
import { SpatialQualificationModel } from '../../src/renderer/spatial-qualification-model.js'

describe('spatial qualification model', () => {
  it('publishes one shared viewport and selection truth', () => {
    const model = new SpatialQualificationModel({
      x: 0,
      y: 0,
      width: 640,
      height: 360
    })
    const received: string[] = []
    const unsubscribe = model.subscribe((state) => {
      received.push(`${state.viewport.x}:${state.selectedChunk}`)
    })
    model.pan(24, 0)
    model.select('chunk-2-2')
    unsubscribe()
    model.pan(24, 0)

    expect(model.state).toMatchObject({
      viewport: { x: 48, y: 0 },
      selectedChunk: 'chunk-2-2'
    })
    expect(received).toEqual(['24:null', '24:chunk-2-2'])
  })
})
