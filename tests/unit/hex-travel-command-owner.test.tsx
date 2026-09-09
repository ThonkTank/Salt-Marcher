// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useHexTravelCommandOwner } from '../../src/renderer/features/hex/use-hex-travel-command-owner.js'
import { maintenanceDraftCoordinator as maintenance } from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import type { HexTravelCommandPort } from '../../src/renderer/features/hex/use-hex-travel-command-port.js'
import type {
  HexTravelCommand,
  HexTravelCommandState
} from '../../src/shared/contracts/hex-travel-command.js'

const input: HexTravelCommand = {
  commandId: 'original',
  command: {
    kind: 'pause',
    input: {
      sceneId: 'scene',
      expectedRevision: 3,
      expectedSceneRevision: 7
    }
  }
}
function state(revision: number): HexTravelCommandState {
  return {
    context: {
      session: { scene: { focusedSceneId: 'scene', revision } },
      travel: { sceneId: 'scene', revision: 3 }
    },
    routePlan: { sceneId: 'scene', revision: 0, plan: null }
  } as unknown as HexTravelCommandState
}
function fixture() {
  const receipt = state(8)
  const current = state(10)
  const port = {
    current: () => current.context.session,
    execute: vi
      .fn<HexTravelCommandPort['execute']>()
      .mockResolvedValue(receipt),
    status: vi
      .fn<HexTravelCommandPort['status']>()
      .mockResolvedValue({ receipt, ...current }),
    refresh: vi.fn<HexTravelCommandPort['refresh']>().mockResolvedValue(current)
  }
  const completed = vi.fn()
  let owner!: ReturnType<typeof useHexTravelCommandOwner>
  function View() {
    owner = useHexTravelCommandOwner(port, completed, 'scene')
    return (
      <>
        <button
          disabled={owner.busy}
          onClick={() => {
            void owner.executor.execute(input).catch(() => undefined)
          }}
        >
          Pause
        </button>
        {owner.notice}
      </>
    )
  }
  return { port, completed, receipt, current, owner: () => owner, View }
}
afterEach(async () => {
  cleanup()
  const resolution = maintenance.begin()
  try {
    await resolution.resolve('discard')
  } finally {
    resolution.release()
  }
  expect(maintenance.hasDirty()).toBe(false)
})

it.each(['save', 'discard'] as const)(
  'waits for an open-window command during central %s and blocks new writes',
  async (choice) => {
    const f = fixture()
    let finish!: (value: HexTravelCommandState) => void
    f.port.execute.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    render(<f.View />)
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    await waitFor(() => expect(f.port.execute).toHaveBeenCalledOnce())
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled()
    expect(maintenance.dirtyLabels()).toContain('Reiseaktionen')
    let resolution!: ReturnType<typeof maintenance.begin>
    act(() => {
      resolution = maintenance.begin()
    })
    try {
      let done = false
      const pending = resolution.resolve(choice).then((failures) => {
        done = true
        return failures
      })
      await act(async () => {
        await Promise.resolve()
      })
      expect(done).toBe(false)
      await expect(f.owner().executor.execute(input)).rejects.toMatchObject({
        code: 'stale'
      })
      await act(async () => {
        finish(f.receipt)
        expect(await pending).toEqual([])
      })
      expect(f.port.execute).toHaveBeenCalledOnce()
      expect(f.completed).toHaveBeenCalledExactlyOnceWith(f.current)
    } finally {
      act(() => resolution.release())
    }
  }
)

it('recovers a lost reply from the mounted notice without replaying or applying the old receipt', async () => {
  const f = fixture()
  f.port.execute.mockRejectedValueOnce(new Error('lost'))
  render(<f.View />)
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
  fireEvent.click(
    await screen.findByRole('button', { name: 'Speicherstatus erneut prüfen' })
  )
  await waitFor(() => expect(f.completed).toHaveBeenCalledWith(f.current))
  expect(f.completed).not.toHaveBeenCalledWith(f.receipt)
  expect(f.port.status).toHaveBeenCalledExactlyOnceWith(input)
  expect(f.port.execute).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled()
  expect(maintenance.hasDirty()).toBe(false)
})

it('retains an unresolved write after unmount for central recovery without a view callback', async () => {
  const f = fixture()
  f.port.execute.mockRejectedValueOnce(new Error('lost'))
  const view = render(<f.View />)
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
  await screen.findByRole('button', { name: 'Speicherstatus erneut prüfen' })
  view.unmount()
  const resolution = maintenance.begin()
  try {
    expect(await resolution.resolve('save')).toEqual([])
  } finally {
    resolution.release()
  }
  expect(f.port.execute).toHaveBeenCalledOnce()
  expect(f.completed).not.toHaveBeenCalled()
})

it('offers explicit retry only after confirmed absence and uses a new command id', async () => {
  const f = fixture()
  f.port.execute.mockRejectedValueOnce(new Error('lost'))
  f.port.status.mockResolvedValue({ receipt: null, ...state(7) })
  f.port.refresh.mockResolvedValue(state(7))
  render(<f.View />)
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
  fireEvent.click(
    await screen.findByRole('button', { name: 'Speicherstatus erneut prüfen' })
  )
  const retry = await screen.findByRole('button', {
    name: 'Auftrag erneut ausführen'
  })
  expect(f.port.execute).toHaveBeenCalledOnce()
  f.port.refresh.mockResolvedValueOnce(state(7)).mockResolvedValue(f.current)
  fireEvent.click(retry)
  await waitFor(() => expect(f.completed).toHaveBeenCalledWith(f.current))
  expect(f.port.execute).toHaveBeenCalledTimes(2)
  const next = f.port.execute.mock.lastCall![0]
  expect(next.commandId).not.toBe(input.commandId)
  expect(next.command).toEqual(input.command)
})

it('keeps a failed recovery read visible and blocks maintenance until it succeeds', async () => {
  const f = fixture()
  f.port.execute.mockRejectedValueOnce(new Error('lost'))
  f.port.status.mockRejectedValueOnce(new Error('read unavailable'))
  render(<f.View />)
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
  await screen.findByRole('button', { name: 'Speicherstatus erneut prüfen' })
  let resolution!: ReturnType<typeof maintenance.begin>
  act(() => {
    resolution = maintenance.begin()
  })
  try {
    await act(async () => {
      expect(await resolution.resolve('discard')).toHaveLength(1)
    })
    expect(maintenance.hasDirty()).toBe(true)
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled()
    await act(async () => {
      expect(await resolution.resolve('discard')).toEqual([])
    })
  } finally {
    act(() => resolution.release())
  }
  expect(f.port.execute).toHaveBeenCalledOnce()
})
