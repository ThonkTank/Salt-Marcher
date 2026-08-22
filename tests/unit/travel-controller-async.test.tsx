// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import type { TravelController } from '../../src/renderer/features/travel/use-travel-controller.js'
import { useTravelController } from '../../src/renderer/features/travel/use-travel-controller.js'
import type {
  TravelProviderPort,
  TravelProviderReadResult
} from '../../src/renderer/features/travel/travel-provider-port.js'

type Position = Readonly<{ id: string }>
type ProviderState = Readonly<{
  revision: number
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
    fixture.read.mockImplementationOnce(() => remote.promise)
    fixture.execute.mockImplementationOnce(() => command.promise)
    render(fixture.harness())
    await expectState('marker:initial')

    act(() => fixture.controller().dropToken({ id: 'position-1' }))
    await waitFor(() => expect(fixture.execute).toHaveBeenCalledTimes(1))
    act(() => fixture.invalidate({ kind: 'context', sceneId: 'scene-a' }))
    await waitFor(() => expect(fixture.read).toHaveBeenCalledTimes(2))
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

  it('preserves FIFO command order and exposes a domain failure', async () => {
    const first = deferred<ReadResult>()
    const second = deferred<ReadResult>()
    const fixture = createFixture()
    fixture.read.mockResolvedValue(result('scene-a', 1, 'map-a'))
    fixture.execute.mockImplementationOnce(() => first.promise)
    fixture.execute.mockImplementationOnce(() => second.promise)
    render(fixture.harness())
    await expectState('provider:1 map:map-a')

    act(() => fixture.controller().dropToken({ id: 'position-1' }))
    await waitFor(() => expect(fixture.execute).toHaveBeenCalledTimes(1))
    act(() => fixture.controller().dropToken({ id: 'position-2' }))
    await act(async () => await Promise.resolve())
    expect(fixture.execute).toHaveBeenCalledTimes(1)

    first.reject({ code: 'stale' })
    await waitFor(() => expect(fixture.execute).toHaveBeenCalledTimes(2))
    expect(fixture.onError).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('travel-state')).not.toHaveTextContent('error:-')

    second.resolve(result('scene-a', 2, 'map-a'))
    await expectState('provider:2 map:map-a')
    expect(fixture.execute.mock.calls.map(([command]) => command)).toEqual([
      expect.objectContaining({ position: { id: 'position-1' } }),
      expect.objectContaining({ position: { id: 'position-2' } })
    ])
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
      active: true
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
