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
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import { useSceneCommandOwner } from '../../src/renderer/features/session/use-scene-commands.js'
import type { SceneCommandPort } from '../../src/renderer/features/session/use-scene-command-port.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import type { SceneCommandReceipt } from '../../src/shared/contracts/scene-command.js'
import { useMaintenanceDraft } from '../../src/renderer/shell/maintenance-drafts.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftResolution
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'
let resolution: MaintenanceDraftResolution | undefined
afterEach(() => {
  resolution?.release()
  resolution = undefined
  cleanup()
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(false)
})
function fixture(dirty = true) {
  let current = {
    scene: {
      revision: 7,
      focusedSceneId: 'source',
      scenes: [{ id: 'source', locationId: null }]
    }
  } as unknown as LiveSessionSnapshot
  let receipt: SceneCommandReceipt | null = null
  const save = vi.fn(() => {
    dirty = false
    current = { ...current, scene: { ...current.scene, revision: 8 } }
    return Promise.resolve(true)
  })
  const discard = vi.fn(() => {
    dirty = false
    return Promise.resolve(true)
  })
  const execute = vi
    .fn<SceneCommandPort['execute']>()
    .mockImplementation((input) => {
      if (input.command.kind !== 'set-location')
        throw new Error('fixture command')
      current = {
        ...current,
        scene: {
          ...current.scene,
          revision: current.scene.revision + 1,
          scenes: current.scene.scenes.map((scene) => ({
            ...scene,
            locationId: 'chosen'
          }))
        }
      }
      receipt = { snapshot: current }
      return Promise.resolve(receipt)
    })
  const status = vi
    .fn<SceneCommandPort['status']>()
    .mockImplementation(() => Promise.resolve({ receipt, snapshot: current }))
  const port: SceneCommandPort = {
    execute,
    status,
    current: () => current,
    refresh: () => Promise.resolve(current)
  }
  const completed = vi.fn()
  function View() {
    useMaintenanceDraft({
      label: 'Other editor',
      isDirty: () => dirty,
      save,
      discard
    })
    const commands = useSceneCommandOwner(port, 'source', vi.fn(), completed)
    return (
      <>
        <button
          disabled={commands.busy}
          onClick={() =>
            commands.request((snapshot) => ({
              kind: 'set-location',
              input: {
                sceneId: 'source',
                locationId: 'chosen',
                expectedRevision: snapshot.scene.revision
              }
            }))
          }
        >
          Change location
        </button>
        {commands.dialog}
        {commands.notice}
      </>
    )
  }
  const view = render(
    <ModalLayerProvider>
      <View />
    </ModalLayerProvider>
  )
  return {
    view,
    execute,
    status,
    save,
    discard,
    completed,
    current: () => current
  }
}
it('changes scene location without resolving an independent editor', async () => {
  const f = fixture()
  fireEvent.click(screen.getByText('Change location'))
  await waitFor(() => expect(f.completed).toHaveBeenCalledOnce())
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(f.save).not.toHaveBeenCalled()
  expect(f.discard).not.toHaveBeenCalled()
  expect(f.execute).toHaveBeenCalledOnce()
  const submitted = f.execute.mock.calls[0]![0]
  expect(submitted.commandId).toMatch(/^[0-9a-f-]{36}$/)
  expect(submitted).toEqual({
    commandId: submitted.commandId,
    command: {
      kind: 'set-location',
      input: {
        sceneId: 'source',
        locationId: 'chosen',
        expectedRevision: 7
      }
    }
  })
  expect(f.current().scene.scenes[0]!.locationId).toBe('chosen')
})
it('keeps a committed location with a lost reply recoverable after the view unmounts', async () => {
  const f = fixture(false)
  const write = f.execute.getMockImplementation()!
  f.execute.mockImplementation(async (input) => {
    await write(input)
    throw new Error('reply lost')
  })
  fireEvent.click(screen.getByText('Change location'))
  await screen.findByRole('alert')
  f.view.unmount()
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
  resolution = maintenanceDraftCoordinator.begin()
  await act(async () => {
    expect(await resolution!.resolve('save')).toEqual([])
  })
  expect(f.status).toHaveBeenCalledOnce()
  expect(f.execute).toHaveBeenCalledOnce()
  expect(f.completed).not.toHaveBeenCalled()
  expect(f.current().scene.scenes[0]!.locationId).toBe('chosen')
})
