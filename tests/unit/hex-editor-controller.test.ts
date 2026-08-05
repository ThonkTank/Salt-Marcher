import { describe, expect, it } from 'vitest'
import {
  hexEditorReducer,
  initialHexEditorState
} from '../../src/renderer/features/hex/use-hex-editor-controller.js'

describe('hex editor state machine', () => {
  it('keeps tool choice, terrain submode and brush level independent', () => {
    const selected = hexEditorReducer(initialHexEditorState, {
      type: 'tool.selected',
      tool: 'location'
    })
    const erased = hexEditorReducer(selected, {
      type: 'terrain.mode-selected',
      mode: 'erase'
    })
    const resized = hexEditorReducer(erased, {
      type: 'brush.level-changed',
      level: 7
    })

    expect(resized.tool).toMatchObject({
      kind: 'location',
      terrainMode: 'erase',
      brushLevel: 7
    })
    expect(initialHexEditorState.tool).toMatchObject({
      kind: 'terrain',
      terrainMode: 'paint',
      brushLevel: 1
    })
  })

  it('applies functional updates only to their owning state domain', () => {
    const state = hexEditorReducer(initialHexEditorState, {
      type: 'viewport.reset',
      value: (current) => current + 1
    })
    const history = hexEditorReducer(state, {
      type: 'history.changed',
      history: (current) => ({ ...current, canUndo: true, undoLabel: 'Malen' })
    })

    expect(history.viewport.resetSignal).toBe(1)
    expect(history.command.history).toMatchObject({
      canUndo: true,
      undoLabel: 'Malen'
    })
    expect(history.activeMap).toBe(initialHexEditorState.activeMap)
  })
})
