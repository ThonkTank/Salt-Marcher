// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { GroupLifecyclePort } from '../../src/renderer/features/session/use-group-lifecycle-port.js'
import type {
  LiveSessionSnapshot,
  SceneGroupCommandResult
} from '../../src/shared/contracts/live-session.js'
import { useGroupLifecycle } from '../../src/renderer/features/session/use-group-lifecycle.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftResolution
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'
const port = vi.hoisted(() => ({
  execute: vi.fn<GroupLifecyclePort['execute']>(),
  status: vi.fn<GroupLifecyclePort['status']>(),
  refresh: vi.fn<GroupLifecyclePort['refresh']>(),
  current: vi.fn<GroupLifecyclePort['current']>()
}))
vi.mock(
  '../../src/renderer/features/session/use-group-lifecycle-port.js',
  () => ({ useGroupLifecyclePort: () => port })
)
let resolution: MaintenanceDraftResolution | undefined
afterEach(() => {
  resolution?.release()
  resolution = undefined
  cleanup()
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
})
function fixture() {
  const snapshot = {
    scene: { scenes: [{ id: 'scene', groups: [{ id: 'group', revision: 7 }] }] }
  } as unknown as LiveSessionSnapshot
  const receipt = {
    scenePatch: {},
    combat: null
  } as unknown as SceneGroupCommandResult
  port.execute.mockReset().mockRejectedValue(new Error('lost reply'))
  port.status.mockReset().mockResolvedValue({ receipt, snapshot })
  port.refresh.mockReset().mockResolvedValue(snapshot)
  const onError = vi.fn()
  function View() {
    const lifecycle = useGroupLifecycle('campaign', onError)
    return (
      <>
        {lifecycle.notice}
        <button
          disabled={lifecycle.busy}
          onClick={() =>
            lifecycle.execute({
              kind: 'archive',
              input: {
                sceneId: 'scene',
                groupId: 'group',
                expectedGroupRevision: 7,
                archived: false
              }
            })
          }
        >
          Wiederherstellen
        </button>
      </>
    )
  }
  render(<View />)
  fireEvent.click(screen.getByText('Wiederherstellen'))
  return { snapshot, receipt }
}
it('blocks new group writes and settles the original during central maintenance', async () => {
  fixture()
  await screen.findByText('Speicherstatus erneut prüfen')
  expect(screen.getByText('Wiederherstellen')).toBeDisabled()
  act(() => {
    resolution = maintenanceDraftCoordinator.begin()
  })
  expect(screen.getByText('Speicherstatus erneut prüfen')).toBeDisabled()
  await act(async () => {
    expect(await resolution!.resolve('save')).toEqual([])
  })
  expect(port.status).toHaveBeenCalledWith(port.execute.mock.calls[0]![0])
  expect(port.execute).toHaveBeenCalledOnce()
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
})
it.each([false, true])(
  'offers explicit discard after absent status (conflict=%s)',
  async (conflict) => {
    const { snapshot } = fixture()
    const current = conflict
      ? ({
          scene: { scenes: [{ id: 'scene', groups: [] }] }
        } as unknown as LiveSessionSnapshot)
      : snapshot
    port.status.mockResolvedValue({ receipt: null, snapshot: current })
    port.refresh.mockResolvedValue(current)
    fireEvent.click(await screen.findByText('Speicherstatus erneut prüfen'))
    await screen.findByText('Auftrag verwerfen')
    expect(screen.getByText('Wiederherstellen')).toBeDisabled()
    if (conflict)
      expect(screen.getByText('Auftrag erneut ausführen')).toBeDisabled()
    else expect(screen.getByText('Auftrag erneut ausführen')).toBeEnabled()
    fireEvent.click(screen.getByText('Auftrag verwerfen'))
    await waitFor(() =>
      expect(screen.getByText('Wiederherstellen')).toBeEnabled()
    )
    expect(port.execute).toHaveBeenCalledOnce()
  }
)
