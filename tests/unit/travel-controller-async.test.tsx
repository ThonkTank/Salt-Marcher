// @vitest-environment jsdom

import { CapabilityError } from '../../src/shared/errors/capability-error.js'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import type { TravelController } from '../../src/renderer/features/travel/use-travel-controller.js'
import { useTravelController } from '../../src/renderer/features/travel/use-travel-controller.js'
import type {
  TravelProviderPort,
  TravelProviderReadResult,
  TravelRoutePlanSnapshot
} from '../../src/renderer/features/travel/travel-provider-port.js'

type Position = Readonly<{ id: string }>
type ProviderState = Readonly<{
  revision: number
  routePlan: TravelRoutePlanSnapshot<Position>
  status: string
  currentMapId: string | null
  mapIds: readonly string[]
  multiplier: 1 | 2 | 5 | 10
  marker: string
}>
type MapProjection = Readonly<{ id: string }>
type Evaluation = Readonly<{ status: 'ready' }>
type Port = TravelProviderPort<
  Position,
  ProviderState,
  MapProjection,
  Evaluation
>
type Controller = TravelController<
  Position,
  ProviderState,
  MapProjection,
  Evaluation
>
type ReadResult = TravelProviderReadResult<ProviderState>

afterEach(cleanup)

describe('Travel async controller boundaries', () => {
  it.each(['stale', 'outcome_unknown'] as const)(
    'delegates %s recovery to the owner without retrying Pause',
    async (code) => {
      const fixture = createFixture()
      fixture.read.mockResolvedValueOnce(
        travelResult('scene-a', 1, 'travelling')
      )
      fixture.read.mockResolvedValueOnce(
        travelResult('scene-a', 2, 'travelling')
      )
      fixture.execute.mockRejectedValueOnce(new CapabilityError(code, true))
      render(fixture.harness())
      await expectState('provider:1')
      await act(async () => fixture.controller().pauseOrResume())
      expect(fixture.execute).toHaveBeenCalledExactlyOnceWith({
        kind: 'pause',
        sceneId: 'scene-a',
        expectedRevision: 2,
        expectedSceneRevision: 2
      })
      expect(fixture.read).toHaveBeenCalledTimes(2)
      expect(fixture.onError).toHaveBeenCalledOnce()
    }
  )

  it('does not publish a late write failure into another scene', async () => {
    const pending = deferred<ReadResult>()
    const fixture = createFixture()
    fixture.read.mockResolvedValueOnce(travelResult('scene-a', 1, 'travelling'))
    fixture.read.mockResolvedValueOnce(travelResult('scene-a', 1, 'travelling'))
    fixture.read.mockResolvedValueOnce(result('scene-b', 4, 'map-b'))
    fixture.execute.mockImplementationOnce(() => pending.promise)
    const view = render(fixture.harness())
    await expectState('provider:1')
    act(() => {
      void fixture.controller().pauseOrResume()
    })
    await waitFor(() => expect(fixture.execute).toHaveBeenCalledOnce())
    view.rerender(fixture.harness(snapshot('scene-b', 4)))
    await expectState('provider:4')
    pending.reject(new CapabilityError('outcome_unknown', true))
    await act(async () => {
      await pending.promise.catch(() => undefined)
    })
    expect(fixture.execute).toHaveBeenCalledOnce()
    expect(fixture.onError).not.toHaveBeenCalled()
  })

  it('accepts only the newest out-of-order Context response', async () => {
    const first = deferred<ReadResult>()
    const second = deferred<ReadResult>()
    const fixture = createFixture()
    fixture.read.mockImplementationOnce(() => first.promise)
    fixture.read.mockImplementationOnce(() => second.promise)
    render(fixture.harness())
    await waitFor(() => expect(fixture.read).toHaveBeenCalledTimes(1))

    act(() => fixture.invalidate({ kind: 'context', sceneId: 'scene-a' }))
    await waitFor(() => expect(fixture.read).toHaveBeenCalledTimes(2))
    second.resolve(result('scene-a', 2, 'map-b'))
    await expectState('provider:2 map:map-b')

    first.resolve(result('scene-a', 1, 'map-a'))
    await act(async () => await first.promise)
    expect(screen.getByTestId('travel-state')).toHaveTextContent(
      'provider:2 map:map-b'
    )
    expect(fixture.setSnapshot).toHaveBeenLastCalledWith(snapshot('scene-a', 2))
    expect(fixture.onError).not.toHaveBeenCalled()
  })

  it('reconciles provider truth without overwriting a newer local map decision', async () => {
    const remote = deferred<ReadResult>()
    const fixture = createFixture()
    fixture.read.mockResolvedValueOnce(result('scene-a', 1, 'map-a'))
    fixture.read.mockImplementationOnce(() => remote.promise)
    render(fixture.harness())
    await expectState('provider:1 map:map-a')

    act(() => fixture.invalidate({ kind: 'context', sceneId: 'scene-a' }))
    await waitFor(() => expect(fixture.read).toHaveBeenCalledTimes(2))
    await act(async () => {
      await fixture.controller().selectMap('map-c')
    })
    expect(screen.getByTestId('travel-state')).toHaveTextContent('map:map-c')

    remote.resolve(result('scene-a', 2, 'map-b'))
    await expectState('provider:2 map:map-c')
    expect(fixture.onError).not.toHaveBeenCalled()
  })

  it('does not let an equal-revision read replace a newer local command', async () => {
    const remote = deferred<ReadResult>()
    const command = deferred<ReadResult>()
    const fixture = createFixture()
    fixture.read.mockResolvedValueOnce(
      result('scene-a', 0, 'map-a', 'initial', 1)
    )
    fixture.read.mockResolvedValueOnce(
      result('scene-a', 0, 'map-a', 'initial', 1)
    )
    fixture.read.mockImplementationOnce(() => remote.promise)
    fixture.execute.mockImplementationOnce(() => command.promise)
    render(fixture.harness())
    await expectState('marker:initial')

    act(() => fixture.controller().dropToken({ id: 'position-1' }))
    await waitFor(() => expect(fixture.execute).toHaveBeenCalledTimes(1))
    act(() => fixture.invalidate({ kind: 'context', sceneId: 'scene-a' }))
    await waitFor(() => expect(fixture.read).toHaveBeenCalledTimes(3))
    command.resolve(result('scene-a', 0, 'map-a', 'local-command', 2))
    await expectState('marker:local-command')

    remote.resolve(result('scene-a', 0, 'map-a', 'old-read', 1))
    await act(async () => await remote.promise)
    expect(screen.getByTestId('travel-state')).toHaveTextContent(
      'marker:local-command'
    )
  })

  it('aborts the old Scene scope and suppresses its obsolete failure', async () => {
    const oldScene = deferred<ReadResult>()
    const fixture = createFixture()
    fixture.read.mockImplementation(({ sceneId }) =>
      sceneId === 'scene-a'
        ? oldScene.promise
        : Promise.resolve(result('scene-b', 4, 'map-b'))
    )
    const rendered = render(fixture.harness())
    await waitFor(() => expect(fixture.read).toHaveBeenCalledTimes(1))

    rendered.rerender(fixture.harness(snapshot('scene-b', 4)))
    await expectState('provider:4 map:map-b')
    oldScene.reject(new Error('obsolete Scene failure'))
    await act(async () => {
      await oldScene.promise.catch(() => undefined)
    })

    expect(screen.getByTestId('travel-state')).toHaveTextContent(
      'provider:4 map:map-b'
    )
    expect(fixture.onError).not.toHaveBeenCalled()
    expect(fixture.unsubscribe).toHaveBeenCalled()
  })

  it('blocks additional commands while the owner is held instead of queueing them', async () => {
    const first = deferred<ReadResult>()
    const fixture = createFixture()
    fixture.read.mockResolvedValue(result('scene-a', 1, 'map-a'))
    fixture.execute.mockImplementationOnce(() => {
      fixture.block()
      return first.promise
    })
    render(fixture.harness())
    await expectState('provider:1 map:map-a')
    act(() => fixture.controller().dropToken({ id: 'position-1' }))
    await waitFor(() => expect(fixture.execute).toHaveBeenCalledOnce())
    act(() => fixture.controller().dropToken({ id: 'position-2' }))
    act(() => {
      fixture.controller().togglePlanning()
      fixture.controller().clearRoute()
      fixture.controller().activatePosition({ id: 'position-3' })
    })
    first.reject(new CapabilityError('outcome_unknown', true))
    await waitFor(() => expect(fixture.onError).toHaveBeenCalledOnce())
    expect(fixture.execute).toHaveBeenCalledOnce()
    expect(fixture.controller().state.selected).toEqual({ id: 'position-1' })
    expect(fixture.controller().state.mode).toBe('inspect')
  })

  it('refreshes a position intent before submitting its scene revision', async () => {
    const fixture = createFixture()
    fixture.read.mockResolvedValueOnce(result('scene-a', 0, 'map-a', 'old', 1))
    fixture.read.mockResolvedValueOnce(
      result('scene-a', 0, 'map-a', 'fresh', 2)
    )
    fixture.execute.mockResolvedValue(
      result('scene-a', 0, 'map-a', 'positioned', 3)
    )
    render(fixture.harness())
    await expectState('marker:old')
    act(() => fixture.controller().dropToken({ id: 'position-1' }))
    await expectState('marker:positioned')
    expect(fixture.execute).toHaveBeenCalledExactlyOnceWith({
      kind: 'position',
      sceneId: 'scene-a',
      mapId: 'map-a',
      position: { id: 'position-1' },
      expectedSceneRevision: 2
    })
  })

  it('accepts a newer scene after position resets its journey revision', async () => {
    const fixture = createFixture()
    fixture.read.mockResolvedValue(result('scene-a', 5, 'map-a', 'old', 5))
    fixture.execute.mockResolvedValue(
      result('scene-a', 0, 'map-a', 'positioned', 6)
    )
    render(fixture.harness(snapshot('scene-a', 5)))
    await expectState('provider:5')
    act(() => fixture.controller().dropToken({ id: 'position-1' }))
    await expectState('provider:0 map:map-a marker:positioned')
  })

  it('accepts a reset journey after the workspace has already refreshed to the newer scene', async () => {
    const pending = deferred<ReadResult>()
    const fixture = createFixture()
    fixture.read.mockResolvedValue(result('scene-a', 5, 'map-a', 'old', 5))
    fixture.execute.mockImplementationOnce(() => pending.promise)
    const view = render(fixture.harness(snapshot('scene-a', 5)))
    await expectState('provider:5')
    act(() => fixture.controller().dropToken({ id: 'position-1' }))
    await waitFor(() => expect(fixture.execute).toHaveBeenCalledOnce())
    view.rerender(fixture.harness(snapshot('scene-a', 6)))
    await act(async () => {
      pending.resolve(result('scene-a', 0, 'map-a', 'fresh', 6))
      await pending.promise
    })
    await expectState('provider:0 map:map-a marker:fresh')
  })

  it('accepts plan-only progress after a newer local map selection', async () => {
    const pending = deferred<ReadResult>()
    const fixture = createFixture()
    fixture.read.mockResolvedValueOnce(plannedResult(1))
    fixture.read.mockImplementationOnce(() => pending.promise)
    render(fixture.harness())
    await expectState('provider:1 map:map-a')
    act(() => fixture.invalidate({ kind: 'context', sceneId: 'scene-a' }))
    await waitFor(() => expect(fixture.read).toHaveBeenCalledTimes(2))
    await act(async () => fixture.controller().selectMap('map-c'))
    await act(async () => {
      pending.resolve(plannedResult(2))
      await pending.promise
    })
    expect(fixture.controller().state.mapId).toBe('map-c')
    expect(fixture.controller().state.providerState?.routePlan.revision).toBe(2)
    expect(fixture.execute).not.toHaveBeenCalled()
  })

  it.each(['same-scene', 'position-reset'] as const)(
    'rejects an older plan even with %s travel progress',
    async (kind) => {
      const fixture = createFixture()
      fixture.read.mockResolvedValueOnce(plannedResult(3))
      const obsolete = plannedResult(2)
      fixture.read.mockResolvedValueOnce({
        ...obsolete,
        providerState: {
          ...obsolete.providerState,
          revision: kind === 'position-reset' ? 0 : 2
        },
        session: snapshot('scene-a', kind === 'position-reset' ? 2 : 1)
      })
      render(fixture.harness())
      await expectState('provider:1 map:map-a')
      act(() => fixture.invalidate({ kind: 'context', sceneId: 'scene-a' }))
      await waitFor(() => expect(fixture.read).toHaveBeenCalledTimes(2))
      await act(() => Promise.resolve())
      expect(fixture.controller().state.providerState?.routePlan.revision).toBe(
        3
      )
      expect(fixture.controller().state.providerState?.revision).toBe(1)
    }
  )

  it('does not resurrect a cleared plan from a late command response', async () => {
    const pending = deferred<ReadResult>()
    const fixture = createFixture()
    fixture.read.mockResolvedValueOnce(plannedResult(2))
    fixture.read.mockResolvedValueOnce(plannedResult(2))
    const cleared = plannedResult(3)
    fixture.read.mockResolvedValueOnce({
      ...cleared,
      providerState: {
        ...cleared.providerState,
        routePlan: {
          sceneId: 'scene-a',
          revision: 3,
          plan: null
        }
      }
    })
    fixture.execute.mockImplementationOnce(() => pending.promise)
    render(fixture.harness())
    await expectState('provider:1 map:map-a')
    act(() => fixture.controller().dropToken({ id: 'position-1' }))
    await waitFor(() => expect(fixture.execute).toHaveBeenCalledOnce())
    act(() => fixture.invalidate({ kind: 'context', sceneId: 'scene-a' }))
    await waitFor(() =>
      expect(fixture.controller().state.providerState?.routePlan.revision).toBe(
        3
      )
    )
    await act(async () => {
      pending.resolve(plannedResult(2))
      await pending.promise
    })
    expect(fixture.controller().state.providerState?.routePlan).toEqual({
      sceneId: 'scene-a',
      revision: 3,
      plan: null
    })
  })

  it('accepts a journey reset while retaining the saved plan revision', async () => {
    const fixture = createFixture()
    const initial = plannedResult(3)
    fixture.read.mockResolvedValue(initial)
    fixture.execute.mockResolvedValue({
      ...initial,
      providerState: { ...initial.providerState, revision: 0 },
      session: snapshot('scene-a', 2)
    })
    render(fixture.harness())
    await expectState('provider:1 map:map-a')
    act(() => fixture.controller().dropToken({ id: 'position-1' }))
    await expectState('provider:0 map:map-a')
    expect(fixture.controller().state.providerState?.routePlan).toEqual(
      initial.providerState.routePlan
    )
  })

  it('terminates pending work on unmount without publishing late results', async () => {
    const pending = deferred<ReadResult>()
    const fixture = createFixture()
    fixture.read.mockImplementation(() => pending.promise)
    const rendered = render(fixture.harness())
    await waitFor(() => expect(fixture.read).toHaveBeenCalledTimes(1))
    rendered.unmount()

    pending.resolve(result('scene-a', 9, 'map-a'))
    await act(async () => await pending.promise)
    expect(fixture.setSnapshot).not.toHaveBeenCalled()
    expect(fixture.onError).not.toHaveBeenCalled()
    expect(fixture.unsubscribe).toHaveBeenCalledTimes(1)
  })
})

function createFixture() {
  let blocked = false
  let listener:
    | Parameters<
        TravelProviderPort<
          Position,
          ProviderState,
          MapProjection,
          Evaluation
        >['subscribe']
      >[0]
    | null = null
  let currentController: Controller | null = null
  const read = vi.fn<(input: { sceneId: string }) => Promise<ReadResult>>()
  const execute = vi.fn<Port['execute']>()
  const unsubscribe = vi.fn(() => {
    listener = null
  })
  const setSnapshot = vi.fn()
  const onError = vi.fn()
  const port: Port = {
    kind: 'hex',
    read,
    readMap: vi.fn<Port['readMap']>(({ mapId }) =>
      Promise.resolve({ id: mapId })
    ),
    evaluate: vi.fn<Port['evaluate']>(() =>
      Promise.resolve({ status: 'ready' })
    ),
    execute,
    describe: (state) => ({
      revision: state.revision,
      routePlan: state.routePlan,
      status: state.status,
      mapOptions: state.mapIds.map((id) => ({ id, label: id })),
      currentMapId: state.currentMapId,
      currentPosition: null,
      multiplier: state.multiplier
    }),
    isAuthoredPosition: () => true,
    canStart: () => true,
    subscribe: (next) => {
      listener = next
      return unsubscribe
    },
    dispose: vi.fn()
  }

  function Harness(props: { snapshot: LiveSessionSnapshot }) {
    currentController = useTravelController({
      port,
      snapshot: props.snapshot,
      setSnapshot,
      onError,
      active: true,
      commandsBlocked: () => blocked
    })
    const state = currentController.state
    return (
      <output data-testid="travel-state">
        provider:{state.providerState?.revision ?? '-'} map:{state.mapId ?? '-'}{' '}
        marker:{state.providerState?.marker ?? '-'} error:{state.error ?? '-'}
      </output>
    )
  }

  return {
    block: () => {
      blocked = true
    },
    read,
    execute,
    setSnapshot,
    onError,
    unsubscribe,
    controller: () => {
      if (!currentController) throw new Error('Controller is not mounted.')
      return currentController
    },
    invalidate: (event: Parameters<NonNullable<typeof listener>>[0]) =>
      listener?.(event),
    harness: (next = snapshot('scene-a', 1)) => <Harness snapshot={next} />
  }
}

function result(
  sceneId: string,
  revision: number,
  currentMapId: string,
  marker = `revision-${revision}`,
  sessionRevision = revision
): ReadResult {
  return {
    providerState: {
      revision,
      routePlan: { sceneId, revision: 0, plan: null },
      status: 'ready',
      currentMapId,
      mapIds: ['map-a', 'map-b', 'map-c'],
      multiplier: 1,
      marker
    },
    session: snapshot(sceneId, sessionRevision)
  }
}

function snapshot(sceneId: string, revision: number): LiveSessionSnapshot {
  return {
    scene: { focusedSceneId: sceneId, revision }
  } as unknown as LiveSessionSnapshot
}

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void
  let reject!: (cause?: unknown) => void
  const promise = new Promise<Value>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

async function expectState(text: string): Promise<void> {
  await waitFor(() =>
    expect(screen.getByTestId('travel-state')).toHaveTextContent(text)
  )
}

function travelResult(
  sceneId: string,
  revision: number,
  status: string
): ReadResult {
  const value = result(sceneId, revision, 'map-a')
  return { ...value, providerState: { ...value.providerState, status } }
}

function plannedResult(revision: number): ReadResult {
  const value = result('scene-a', 1, 'map-a')
  return {
    ...value,
    providerState: {
      ...value.providerState,
      routePlan: {
        sceneId: 'scene-a',
        revision,
        plan: {
          mapId: 'map-b',
          waypoints: [{ id: `stop-${revision}` }],
          multiplier: 2
        }
      }
    }
  }
}
