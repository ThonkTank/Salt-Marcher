// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useRef, useState } from 'react'
import CatalogWorkspace from '../../src/renderer/features/catalog/catalog-workspace.js'
import {
  CapabilityContext,
  type CapabilityContextValue
} from '../../src/renderer/capabilities/capability-context.js'
import { useMaintenanceDraft } from '../../src/renderer/shell/maintenance-drafts.js'
import {
  maintenanceDraftCoordinator,
  type MaintenanceDraftResolution
} from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import type { WorldLocationEditingIntegration } from '../../src/renderer/features/worldplanner/world-location-editor-types.js'

vi.mock(
  '../../src/renderer/features/catalog/monster-catalog-controller.js',
  () => ({ useMonsterCatalogController: () => ({}) })
)
vi.mock(
  '../../src/renderer/features/catalog/monster-catalog-section.js',
  () => ({ MonsterCatalogSection: () => <p>Monsterbereich</p> })
)
vi.mock(
  '../../src/renderer/features/catalog/location-catalog-controller.js',
  () => ({
    createLocationCatalogPort: () => ({}),
    useLocationCatalogController: () => ({})
  })
)
vi.mock(
  '../../src/renderer/features/catalog/faction-catalog-controller.js',
  () => ({ useFactionCatalogController: () => ({}) })
)
vi.mock(
  '../../src/renderer/features/catalog/npc-catalog-controller.js',
  () => ({ useNpcCatalogController: () => ({}) })
)
vi.mock(
  '../../src/renderer/features/encounter-table/encounter-table-catalog-controller.js',
  () => ({ useEncounterTableCatalogController: () => ({}) })
)
vi.mock(
  '../../src/renderer/features/worldplanner/world-faction-application.js',
  () => ({ createWorldFactionApplicationPort: () => ({}) })
)
vi.mock(
  '../../src/renderer/features/encounter-table/encounter-table-application.js',
  () => ({ createEncounterTableApplicationPort: () => ({}) })
)
vi.mock('../../src/renderer/features/catalog/catalog-editor-ports.js', () => ({
  createCatalogEditorPorts: () => ({})
}))
vi.mock(
  '../../src/renderer/features/workspace/integrations/related-entity-dialog-stack.js',
  () => ({ useRelatedEntityDialogStack: () => ({ dialogs: null }) })
)
vi.mock(
  '../../src/renderer/features/party/character-catalog-section.js',
  () => ({
    default: function CharacterDraft() {
      const [draft, setDraft] = useState('')
      const current = useRef('')
      useMaintenanceDraft({
        label: 'Testcharakter',
        isDirty: () => !!current.current,
        discard: () => {
          current.current = ''
          setDraft('')
          return Promise.resolve(true)
        }
      })
      return (
        <input
          aria-label="Erhaltener Charakterentwurf"
          value={draft}
          onChange={(event) => {
            current.current = event.target.value
            setDraft(event.target.value)
          }}
        />
      )
    }
  })
)
let resolution: MaintenanceDraftResolution | undefined
afterEach(() => {
  resolution?.release()
  resolution = undefined
  cleanup()
})
it('retains the character draft and maintenance owner when switching catalog sections', async () => {
  const context = { api: {} } as CapabilityContextValue
  render(
    <CapabilityContext.Provider value={context}>
      <CatalogWorkspace
        campaignId="campaign"
        snapshot={{} as LiveSessionSnapshot}
        setSnapshot={vi.fn()}
        onError={vi.fn()}
        inspect={vi.fn()}
        worldLocationEditing={{} as WorldLocationEditingIntegration}
      />
    </CapabilityContext.Provider>
  )
  expect(
    screen.queryByLabelText('Erhaltener Charakterentwurf')
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Charaktere'))
  const field = await screen.findByLabelText('Erhaltener Charakterentwurf')
  fireEvent.change(field, { target: { value: 'Ungespeichert' } })
  fireEvent.click(screen.getByRole('button', { name: 'Monster' }))
  expect(field).not.toBeVisible()
  expect(maintenanceDraftCoordinator.hasDirty()).toBe(true)
  fireEvent.click(screen.getByText('Charaktere'))
  expect(screen.getByLabelText('Erhaltener Charakterentwurf')).toHaveValue(
    'Ungespeichert'
  )
  act(() => {
    resolution = maintenanceDraftCoordinator.begin()
  })
  expect(screen.getByRole('button', { name: 'Monster' })).toBeDisabled()
  await act(async () => {
    expect(await resolution!.resolve('discard')).toEqual([])
  })
  expect(screen.getByLabelText('Erhaltener Charakterentwurf')).toHaveValue('')
})
