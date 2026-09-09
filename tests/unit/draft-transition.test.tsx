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
import { useState, useRef } from 'react'
import { ModalLayerProvider } from '../../src/renderer/shell/modal-layer.js'
import { useDraftTransition } from '../../src/renderer/shell/use-draft-transition.js'
import {
  MaintenanceDraftConcernProvider,
  useMaintenanceDraft
} from '../../src/renderer/shell/maintenance-drafts.js'
import {
  allMaintenanceDrafts,
  draftConcern,
  maintenanceDraftCoordinator
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'

const releases: (() => void)[] = []
afterEach(() => {
  cleanup()
  releases.splice(0).forEach((release) => release())
  expect(maintenanceDraftCoordinator.isLocked()).toBe(false)
  expect(maintenanceDraftCoordinator.isCoordinating()).toBe(false)
})
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function Editor({
  save,
  label = 'Charaktername'
}: {
  save: (value: string) => Promise<boolean>
  label?: string
}) {
  const [name, setName] = useState('')
  const nameRef = useRef('')
  const blocked = useMaintenanceDraft({
    label,
    isDirty: () => nameRef.current !== '',
    save: async () => {
      if (!(await save(name))) return false
      // The owning component must synchronously expose a settled draft.
      nameRef.current = ''
      setName('')
      return true
    },
    discard: () => {
      nameRef.current = ''
      setName('')
      return Promise.resolve(true)
    }
  })
  return (
    <input
      aria-label={label}
      disabled={blocked}
      value={name}
      onChange={(event) => {
        nameRef.current = event.target.value
        setName(event.target.value)
      }}
    />
  )
}
function ScopedHarness() {
  const transition = useDraftTransition('scene-a', undefined, {
    kind: 'concerns',
    concerns: []
  })
  return (
    <ModalLayerProvider>
      <MaintenanceDraftConcernProvider
        concerns={[draftConcern.scene('scene-a'), draftConcern.window('party')]}
      >
        <Editor label="Party-Entwurf" save={() => Promise.resolve(true)} />
      </MaintenanceDraftConcernProvider>
      <MaintenanceDraftConcernProvider
        concerns={[
          draftConcern.scene('scene-a'),
          draftConcern.window('groups')
        ]}
      >
        <Editor label="Gruppen-Entwurf" save={() => Promise.resolve(true)} />
      </MaintenanceDraftConcernProvider>
      <button>Party minimieren</button>
      <button
        onClick={() =>
          transition.request(() => undefined, {
            kind: 'concerns',
            concerns: [draftConcern.window('party')]
          })
        }
      >
        Party schließen
      </button>
      <button
        onClick={() =>
          transition.request(() => undefined, {
            kind: 'concerns',
            concerns: [draftConcern.scene('scene-a')]
          })
        }
      >
        Szene wechseln
      </button>
      {transition.dialog}
    </ModalLayerProvider>
  )
}
function Harness({
  save,
  identity = 'campaign-a',
  navigated = () => {}
}: {
  save: (value: string) => Promise<boolean>
  identity?: string
  navigated?: () => void
}) {
  const [moved, setMoved] = useState(false)
  const transition = useDraftTransition(
    identity,
    undefined,
    allMaintenanceDrafts
  )
  return (
    <ModalLayerProvider>
      {!moved && <Editor save={save} />}
      <button
        onClick={() =>
          transition.request(() => {
            setMoved(true)
            navigated()
          })
        }
      >
        Sitzung öffnen
      </button>
      {moved && <p>Sitzung geöffnet</p>}
      {transition.dialog}
    </ModalLayerProvider>
  )
}
async function openTransition() {
  fireEvent.change(screen.getByLabelText('Charaktername'), {
    target: { value: 'Arlik Entwurf' }
  })
  fireEvent.click(screen.getByText('Sitzung öffnen'))
  await screen.findByRole('alertdialog')
}
it('keeps a never submitted editor mounted and cancels without writes', async () => {
  const save = vi.fn().mockResolvedValue(true)
  render(<Harness save={save} />)
  await openTransition()
  expect(screen.getByLabelText('Charaktername')).toBeDisabled()
  fireEvent.click(screen.getByText('Abbrechen'))
  expect(screen.getByLabelText('Charaktername')).toHaveValue('Arlik Entwurf')
  expect(screen.getByLabelText('Charaktername')).toBeEnabled()
  expect(save).not.toHaveBeenCalled()
})
it('limits close to its window, leaves minimize alone and selects the departed scene', async () => {
  render(<ScopedHarness />)
  fireEvent.change(screen.getByLabelText('Party-Entwurf'), {
    target: { value: 'Party offen' }
  })
  fireEvent.change(screen.getByLabelText('Gruppen-Entwurf'), {
    target: { value: 'Gruppe offen' }
  })
  fireEvent.click(screen.getByText('Party minimieren'))
  expect(screen.queryByRole('alertdialog')).toBeNull()
  fireEvent.click(screen.getByText('Party schließen'))
  await screen.findByRole('alertdialog')
  expect(screen.getByText('Party-Entwurf', { selector: 'li' })).toBeVisible()
  expect(screen.queryByText('Gruppen-Entwurf', { selector: 'li' })).toBeNull()
  expect(screen.getByLabelText('Party-Entwurf')).toBeDisabled()
  expect(screen.getByLabelText('Gruppen-Entwurf')).toBeEnabled()
  fireEvent.click(screen.getByText('Abbrechen'))
  fireEvent.click(screen.getByText('Szene wechseln'))
  await screen.findByRole('alertdialog')
  expect(screen.getByText('Party-Entwurf', { selector: 'li' })).toBeVisible()
  expect(screen.getByText('Gruppen-Entwurf', { selector: 'li' })).toBeVisible()
})
it.each(['save', 'discard'] as const)(
  'resolves the original editor with %s before navigating',
  async (choice) => {
    const save = vi.fn().mockResolvedValue(true)
    render(<Harness save={save} />)
    await openTransition()
    fireEvent.click(
      screen.getByText(
        choice === 'save'
          ? 'Speichern und fortfahren'
          : 'Verwerfen und fortfahren'
      )
    )
    await screen.findByText('Sitzung geöffnet')
    expect(save).toHaveBeenCalledTimes(choice === 'save' ? 1 : 0)
    if (choice === 'save') expect(save).toHaveBeenCalledWith('Arlik Entwurf')
  }
)
it('keeps successful partial saves and retries only the failed area', async () => {
  let dirty = true
  const otherSave = vi.fn(() => {
    dirty = false
    return Promise.resolve(true)
  })
  releases.push(
    maintenanceDraftCoordinator.register('other-editor', {
      label: 'NSC',
      isDirty: () => dirty,
      save: otherSave
    })
  )
  const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
  render(<Harness save={save} />)
  await openTransition()
  expect(
    screen.getByRole('list', { name: 'Offene Änderungen' })
  ).toHaveTextContent('NSC')
  expect(
    screen.getByRole('list', { name: 'Offene Änderungen' })
  ).toHaveTextContent('Charaktername')
  fireEvent.click(screen.getByText('Speichern und fortfahren'))
  await screen.findByText(/Charaktername: Speichern wurde nicht bestätigt/)
  expect(
    screen.getByRole('list', { name: 'Offene Änderungen' })
  ).not.toHaveTextContent('NSC')
  expect(
    screen.getByRole('list', { name: 'Offene Änderungen' })
  ).toHaveTextContent('Charaktername')
  expect(screen.getByLabelText('Charaktername')).toHaveValue('Arlik Entwurf')
  fireEvent.click(screen.getByText('Speichern und fortfahren'))
  await screen.findByText('Sitzung geöffnet')
  expect(otherSave).toHaveBeenCalledOnce()
  expect(save).toHaveBeenCalledTimes(2)
})
it.each(['unmount', 'identity'] as const)(
  'does not navigate after %s during a running save',
  async (change) => {
    const pending = deferred()
    const save = vi.fn(async () => {
      await pending.promise
      return true
    })
    const navigated = vi.fn()
    const view = render(<Harness save={save} navigated={navigated} />)
    await openTransition()
    fireEvent.click(screen.getByText('Speichern und fortfahren'))
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(screen.getByText('Abbrechen')).toBeDisabled()
    if (change === 'unmount') view.unmount()
    else
      view.rerender(
        <Harness save={save} navigated={navigated} identity="campaign-b" />
      )
    await act(async () => {
      pending.resolve()
      await pending.promise
    })
    await waitFor(() =>
      expect(maintenanceDraftCoordinator.isLocked()).toBe(false)
    )
    expect(navigated).not.toHaveBeenCalled()
  }
)
it('rechecks an editor created while an autosave is finishing', async () => {
  const pending = deferred()
  let autoDirty = true
  releases.push(
    maintenanceDraftCoordinator.register('autosave', {
      label: 'Desktop',
      isDirty: () => autoDirty,
      settleBackgroundWrites: async () => {
        await pending.promise
        autoDirty = false
      }
    })
  )
  render(<Harness save={vi.fn().mockResolvedValue(true)} />)
  fireEvent.click(screen.getByText('Sitzung öffnen'))
  fireEvent.change(screen.getByLabelText('Charaktername'), {
    target: { value: 'Neuer Entwurf' }
  })
  await act(async () => {
    pending.resolve()
    await pending.promise
  })
  await screen.findByRole('alertdialog')
  expect(screen.getByLabelText('Charaktername')).toHaveValue('Neuer Entwurf')
  expect(screen.queryByText('Sitzung geöffnet')).toBeNull()
})
