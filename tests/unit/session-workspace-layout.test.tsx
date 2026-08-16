// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CapabilityProvider } from '../../src/renderer/capabilities/capability-provider.js'
import { SessionControlPanel } from '../../src/renderer/features/session/session-control-panel.js'
import { fitSessionPaneWidths } from '../../src/renderer/features/session/session-panel-layout-geometry.js'
import { SessionScenarioPanel } from '../../src/renderer/features/session/session-scenario-panel.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'

const sceneId = '01900000-0000-7000-8000-000000000001'

afterEach(cleanup)

function snapshot(): LiveSessionSnapshot {
  return {
    revision: 0,
    party: { revision: 0, members: [] },
    scene: {
      revision: 0,
      defaultSceneId: sceneId,
      focusedSceneId: sceneId,
      locationChoices: [],
      unassignedPartyMemberIds: [],
      scenes: [
        {
          id: sceneId,
          title: 'Standardszene',
          defaultScene: true,
          focused: true,
          locationId: null,
          locationName: '',
          gameTimeSeconds: 0,
          partyMemberIds: [],
          groups: []
        }
      ]
    },
    travel: { kind: 'none', label: '', hint: '' },
    combat: null
  } as unknown as LiveSessionSnapshot
}

describe('session workspace layout', () => {
  it('fits oversized panes proportionally while preserving every minimum', () => {
    expect(
      fitSessionPaneWidths(
        { controlPaneWidth: 440, scenarioPaneWidth: 420 },
        958
      )
    ).toEqual({ controlPaneWidth: 298, scenarioPaneWidth: 282 })
    expect(
      fitSessionPaneWidths(
        { controlPaneWidth: 300, scenarioPaneWidth: 264 },
        958
      )
    ).toEqual({ controlPaneWidth: 300, scenarioPaneWidth: 264 })
  })

  it('shows control selectors only while their register row is edited', () => {
    const value = snapshot()
    render(
      <CapabilityProvider api={{} as SaltMarcherApi}>
        <SessionControlPanel
          snapshot={value}
          focused={value.scene.scenes[0]!}
          setSnapshot={vi.fn()}
          onError={vi.fn()}
          manageGroups={vi.fn()}
        />
      </CapabilityProvider>
    )

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wechseln' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Setzen' }))
    expect(screen.getByRole('combobox', { name: 'Scene-Ort' })).toBeVisible()
  })

  it('renders two scenario tabs without the retired empty selection', () => {
    const value = snapshot()
    const setScenario = vi.fn()
    const api = {
      encounter: { evaluate: vi.fn().mockResolvedValue(null) }
    } as unknown as SaltMarcherApi
    render(
      <CapabilityProvider api={api}>
        <SessionScenarioPanel
          snapshot={value}
          loot={{
            revision: 0,
            sceneId,
            locationId: null,
            locationTreasures: [],
            groupTreasures: []
          }}
          setSnapshot={vi.fn()}
          scenario="encounter"
          setScenario={setScenario}
          layout={{
            controlPaneWidth: 300,
            scenarioPaneWidth: 264,
            centerTab: 'details'
          }}
          setLayout={vi.fn()}
          onError={vi.fn()}
          travel={{ renderMap: vi.fn(), renderScenario: vi.fn() }}
          openReference={vi.fn()}
          manageGroups={vi.fn()}
          reinforce={vi.fn()}
          distribute={vi.fn()}
        />
      </CapabilityProvider>
    )

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Reise' }))
    expect(setScenario).toHaveBeenCalledWith('travel')
  })
})
