// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useWorldLocationDraft } from '../../src/renderer/features/worldplanner/use-world-location-draft.js'

describe('useWorldLocationDraft', () => {
  it('uses canonical reference ordering and pending tag input for dirty state', () => {
    const hook = renderHook(
      ({ externalDirty }) => useWorldLocationDraft(null, externalDirty),
      { initialProps: { externalDirty: false } }
    )
    expect(hook.result.current.dirty).toBe(false)
    act(() => hook.result.current.change('factionIds', ['b', 'a']))
    expect(hook.result.current.dirty).toBe(true)
    act(() => hook.result.current.change('factionIds', []))
    act(() => hook.result.current.setTagInput('  Küste  '))
    expect(hook.result.current.dirty).toBe(true)
    act(() => hook.result.current.setTagInput(''))
    expect(hook.result.current.dirty).toBe(false)
    hook.rerender({ externalDirty: true })
    expect(hook.result.current.dirty).toBe(true)
  })

  it('converts only valid form state to the IPC draft', () => {
    const hook = renderHook(() => useWorldLocationDraft(null))
    expect(hook.result.current.validation.draft).toBeNull()
    act(() => hook.result.current.change('displayName', '  Kap  '))
    act(() => hook.result.current.change('tags', [' Küste ']))
    expect(hook.result.current.validation.draft).toMatchObject({
      displayName: 'Kap',
      tags: ['Küste']
    })
  })
})
