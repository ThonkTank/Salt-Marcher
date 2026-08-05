// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLocationPresentationController } from '../../src/renderer/features/hex/use-location-presentation-controller.js'
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
  presentation: WorldLocationMapPresentation = basePresentation
): WorldLocationSnapshot {
  return {
    revision: 4,
    locations: [
      {
        id: locationId,
        displayName: 'Kap',
        kind: '',
        region: '',
        notes: '',
        position: 0,
        factionIds: [],
        encounterTableIds: [],
        mapPresentation: presentation
      }
    ]
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('location presentation controller', () => {
  it('updates optimistically and coalesces rapid slider changes', async () => {
    vi.useFakeTimers()
    const setLocations = vi.fn()
    const updateMapPresentation = vi.fn().mockResolvedValue({
      ...basePresentation,
      revision: 1,
      symbolSize: 60
    })
    const capabilities = {
      updateMapPresentation,
      read: vi.fn()
    } as unknown as HexCapabilities['locations']
    const { result } = renderHook(() =>
      useLocationPresentationController({
        locations: snapshot(),
        setLocations,
        capabilities,
        onError: vi.fn()
      })
    )

    act(() => {
      result.current.update(locationId, {
        ...basePresentation,
        symbolSize: 52
      })
      result.current.update(locationId, {
        ...basePresentation,
        symbolSize: 60
      })
    })
    const optimistic = setLocations.mock.lastCall?.[0] as WorldLocationSnapshot
    expect(optimistic.locations[0]?.mapPresentation.symbolSize).toBe(60)
    expect(updateMapPresentation).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(180)
    })
    expect(updateMapPresentation).toHaveBeenCalledOnce()
    expect(updateMapPresentation).toHaveBeenCalledWith(
      locationId,
      expect.objectContaining({ symbolSize: 60 }),
      0
    )
  })

  it('flushes on interaction end and restores the visible server state on conflict', async () => {
    vi.useFakeTimers()
    const remote = snapshot({
      ...basePresentation,
      revision: 3,
      symbolSize: 32
    })
    const stale = new CapabilityError('stale', true)
    const setLocations = vi.fn()
    const onError = vi.fn()
    const updateMapPresentation = vi.fn().mockRejectedValue(stale)
    const read = vi.fn().mockResolvedValue(remote)
    const capabilities = {
      updateMapPresentation,
      read
    } as unknown as HexCapabilities['locations']
    const { result } = renderHook(() =>
      useLocationPresentationController({
        locations: snapshot(),
        setLocations,
        capabilities,
        onError
      })
    )

    act(() => {
      result.current.update(locationId, {
        ...basePresentation,
        symbolSize: 70
      })
      result.current.flush(locationId)
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(updateMapPresentation).toHaveBeenCalledOnce()
    expect(read).toHaveBeenCalledOnce()
    expect(setLocations).toHaveBeenLastCalledWith(remote)
    expect(onError).toHaveBeenCalledWith(stale)
  })
})
