// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWorldLocationProjectionController } from '../../src/renderer/features/hex/use-world-location-projection-controller.js'
import type { HexCapabilities } from '../../src/renderer/features/hex/hex-capabilities.js'
import type {
  WorldLocationMapPresentation,
  WorldLocationSnapshot
} from '../../src/shared/contracts/world-location.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'

const locationId = '01900000-0000-7000-8000-000000000010'
const basePresentation: WorldLocationMapPresentation = {
  revision: 0,
  titleOverride: null,
  symbolId: 'location',
  symbolSize: 44,
  labelCurve: 0,
  labelPosition: 'below'
}

function snapshot(
  presentation: WorldLocationMapPresentation = basePresentation,
  revision = 4
): WorldLocationSnapshot {
  return {
    revision,
    locations: [
      {
        id: locationId,
        displayName: 'Kap',
        tags: ['Ort'],
        readAloud: '',
        notes: '',
        position: 0,
        factionIds: [],
        encounterTableIds: [],
        mapPresentation: presentation
      }
    ]
  }
}

function capabilities(values: Partial<HexCapabilities['locations']> = {}) {
  return {
    read: vi.fn(),
    updateMapPresentation: vi.fn(),
    onChanged: vi.fn().mockReturnValue(() => undefined),
    ...values
  } as unknown as HexCapabilities['locations']
}

afterEach(() => vi.useRealTimers())

describe('world location projection controller', () => {
  it('updates optimistically and coalesces rapid slider changes', async () => {
    vi.useFakeTimers()
    const updateMapPresentation = vi
      .fn<HexCapabilities['locations']['updateMapPresentation']>()
      .mockResolvedValue({
        ...basePresentation,
        revision: 1,
        symbolSize: 60
      })
    const { result } = renderHook(() =>
      useWorldLocationProjectionController({
        capabilities: capabilities({ updateMapPresentation }),
        onError: vi.fn()
      })
    )
    act(() => result.current.replace(snapshot()))

    act(() => {
      result.current.updatePresentation(locationId, {
        ...basePresentation,
        symbolSize: 52
      })
      result.current.updatePresentation(locationId, {
        ...basePresentation,
        symbolSize: 60
      })
    })
    expect(
      result.current.snapshot?.locations[0]?.mapPresentation.symbolSize
    ).toBe(60)
    expect(updateMapPresentation).not.toHaveBeenCalled()

    await act(async () => vi.advanceTimersByTimeAsync(180))
    expect(updateMapPresentation).toHaveBeenCalledOnce()
    const updateInput = updateMapPresentation.mock.calls[0]?.[0]
    expect(updateInput).toMatchObject({
      id: locationId,
      expectedRevision: 0
    })
    expect(updateInput?.patch.symbolSize).toBe(60)
  })

  it('restores server truth on conflict and ignores stale catalog snapshots', async () => {
    vi.useFakeTimers()
    const remote = snapshot({
      ...basePresentation,
      revision: 3,
      symbolSize: 32
    })
    const stale = new CapabilityError('stale', true)
    const read = vi.fn().mockResolvedValue(remote)
    const onError = vi.fn()
    const { result } = renderHook(() =>
      useWorldLocationProjectionController({
        capabilities: capabilities({
          read,
          updateMapPresentation: vi.fn().mockRejectedValue(stale)
        }),
        onError
      })
    )
    act(() => result.current.replace(snapshot()))
    act(() => {
      result.current.updatePresentation(locationId, {
        ...basePresentation,
        symbolSize: 70
      })
      result.current.flushPresentation(locationId)
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(read).toHaveBeenCalledOnce()
    expect(result.current.snapshot).toEqual(remote)
    expect(onError).toHaveBeenCalledWith(stale)
    act(() => result.current.mergeExternal(snapshot(basePresentation, 3)))
    expect(result.current.snapshot).toEqual(remote)
  })

  it('applies exact create and symbol results through owned actions', () => {
    const created = {
      ...snapshot().locations[0]!,
      id: '01900000-0000-7000-8000-000000000011',
      displayName: 'Neu'
    }
    const { result } = renderHook(() =>
      useWorldLocationProjectionController({
        capabilities: capabilities(),
        onError: vi.fn()
      })
    )
    act(() => result.current.replace(snapshot()))
    act(() =>
      result.current.applyCreated({
        status: 'saved',
        commandId: '01900000-0000-7000-8000-000000000099',
        snapshot: {
          revision: 5,
          locations: [...snapshot().locations, created]
        },
        saved: created,
        placement: 'unchanged'
      })
    )
    act(() => result.current.applySymbolAssignment(created.id, 'settlement', 2))
    expect(
      result.current.snapshot?.locations.find(
        (entry) => entry.id === created.id
      )?.mapPresentation
    ).toMatchObject({ symbolId: 'settlement', revision: 2 })
  })
})
