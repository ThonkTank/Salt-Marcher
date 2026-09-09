// @vitest-environment jsdom
import { useState } from 'react'
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
import { useCombatCommandOwner } from '../../src/renderer/features/encounter/use-combat-commands.js'
import { useCombatDraft } from '../../src/renderer/features/encounter/use-combat-draft.js'
import type { CombatCommandPort } from '../../src/renderer/features/encounter/use-combat-command-port.js'
import type {
  LiveSessionSnapshot,
  CombatCommandResult
} from '../../src/shared/contracts/live-session.js'
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
function fixture(kind: 'initiative' | 'hp' | 'resolution') {
  let current = {
    scene: { focusedSceneId: 'scene' },
    combat: {
      revision: 7,
      phase: kind === 'hp' ? 'combat' : kind,
      initiativeRows: [{ id: 'row', initiative: 10 }]
    }
  } as unknown as LiveSessionSnapshot
  let receipt: CombatCommandResult | null = null
  const execute = vi
    .fn<CombatCommandPort['execute']>()
    .mockImplementation((input) => {
      const command = input.command
      current = {
        ...current,
        combat: {
          ...current.combat!,
          revision: current.combat!.revision + 1,
          ...(command.kind === 'confirmInitiative'
            ? { phase: 'combat' as const }
            : {}),
          ...(command.kind === 'saveInitiative'
            ? {
                initiativeRows: command.input.values.map((value) => ({
                  ...value,
                  kind: 'party' as const,
                  label: 'Party'
                }))
              }
            : {})
        }
      }
      receipt = {
        combat: current.combat,
        scenePatch: null
      } as unknown as CombatCommandResult
      return Promise.resolve(receipt)
    })
  const status = vi
    .fn<CombatCommandPort['status']>()
    .mockImplementation(() => Promise.resolve({ receipt, snapshot: current }))
  const port: CombatCommandPort = {
    execute,
    status,
    current: () => current,
    refresh: () => Promise.resolve(current)
  }
  function View() {
    const [source, setSource] = useState(current)
    const commands = useCombatCommandOwner(port, 'scene', vi.fn(), setSource)
    const draft = useCombatDraft(
      commands,
      kind,
      kind === 'initiative' ? source.combat!.initiativeRows[0]!.initiative : 1,
      source.combat!.revision,
      kind === 'hp'
        ? undefined
        : (amount, snapshot) =>
            kind === 'initiative'
              ? {
                  kind: 'saveInitiative',
                  input: {
                    values: [{ id: 'row', initiative: amount }],
                    expectedRevision: snapshot.combat!.revision
                  }
                }
              : {
                  kind: 'updateResolution',
                  input: {
                    selectedEnemyIds: [],
                    mode: 'manual',
                    xpFraction: amount / 100,
                    expectedRevision: snapshot.combat!.revision
                  }
                }
    )
    return (
      <>
        <input
          aria-label="draft"
          value={draft.value}
          disabled={commands.busy}
          onChange={(event) => draft.set(Number(event.target.value))}
        />
        <button
          onClick={() =>
            commands.request((snapshot) => ({
              kind: 'confirmInitiative',
              input: {
                values: snapshot.combat!.initiativeRows.map((row) => ({
                  id: row.id,
                  initiative: row.initiative
                })),
                expectedRevision: snapshot.combat!.revision
              }
            }))
          }
        >
          Start
        </button>
        <button
          disabled={commands.busy}
          onClick={() => {
            void commands.perform(
              (snapshot) => ({
                kind: 'changeHp',
                input: {
                  cardId: 'card',
                  amount: draft.value,
                  healing: false,
                  expectedRevision: snapshot.combat!.revision
                }
              }),
              draft.clear
            )
          }}
        >
          Damage
        </button>
        {commands.notice}
        {commands.dialog}
      </>
    )
  }
  render(
    <ModalLayerProvider>
      <View />
    </ModalLayerProvider>
  )
  return { execute, status, current: () => current }
}
it.each(['initiative', 'resolution'] as const)(
  'saves a %s draft without advancing or awarding XP',
  async (kind) => {
    const f = fixture(kind)
    fireEvent.change(screen.getByLabelText('draft'), { target: { value: 15 } })
    act(() => {
      resolution = maintenanceDraftCoordinator.begin()
    })
    await act(async () => {
      expect(await resolution!.resolve('save')).toEqual([])
    })
    expect(f.execute).toHaveBeenCalledOnce()
    expect(f.execute.mock.calls[0]![0].command.kind).toBe(
      kind === 'initiative' ? 'saveInitiative' : 'updateResolution'
    )
    expect(f.current().combat!.phase).toBe(kind)
  }
)
it.each(['save', 'discard', 'cancel'] as const)(
  'resolves initiative before a user-requested start with %s',
  async (choice) => {
    const f = fixture('initiative')
    fireEvent.change(screen.getByLabelText('draft'), { target: { value: 15 } })
    fireEvent.click(screen.getByText('Start'))
    fireEvent.click(
      await screen.findByText(
        choice === 'save'
          ? 'Speichern und fortfahren'
          : choice === 'discard'
            ? 'Verwerfen und fortfahren'
            : 'Abbrechen'
      )
    )
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    if (choice === 'cancel') {
      expect(f.execute).not.toHaveBeenCalled()
      act(() => {
        resolution = maintenanceDraftCoordinator.begin()
      })
      await act(async () => {
        expect(await resolution!.resolve('discard')).toEqual([])
      })
      return
    }
    await waitFor(() => expect(f.current().combat!.phase).toBe('combat'))
    expect(f.execute.mock.calls.map(([input]) => input.command.kind)).toEqual(
      choice === 'save'
        ? ['saveInitiative', 'confirmInitiative']
        : ['confirmInitiative']
    )
  }
)
it('does not infer damage or healing from an unsubmitted HP amount', async () => {
  const f = fixture('hp')
  fireEvent.change(screen.getByLabelText('draft'), { target: { value: 9 } })
  act(() => {
    resolution = maintenanceDraftCoordinator.begin()
  })
  await act(async () => {
    const failures = await resolution!.resolve('save')
    expect(failures[0]?.message).toContain('Schaden oder Heilung')
    expect(await resolution!.resolve('discard')).toEqual([])
  })
  expect(f.execute).not.toHaveBeenCalled()
})
it('settles lost damage once before clearing its HP draft during maintenance', async () => {
  const f = fixture('hp')
  const write = f.execute.getMockImplementation()!
  f.execute.mockImplementation(async (input) => {
    await write(input)
    throw new Error('lost response')
  })
  fireEvent.change(screen.getByLabelText('draft'), { target: { value: 9 } })
  fireEvent.click(screen.getByText('Damage'))
  await screen.findByText('Speicherstatus erneut prüfen')
  act(() => {
    resolution = maintenanceDraftCoordinator.begin()
  })
  await act(async () => {
    expect(await resolution!.resolve('save')).toEqual([])
  })
  expect(f.execute).toHaveBeenCalledOnce()
  expect(f.status).toHaveBeenCalledWith(f.execute.mock.calls[0]![0])
})
