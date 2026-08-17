// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CapabilityProvider } from '../../src/renderer/capabilities/capability-provider.js'
import { SessionControlPanel } from '../../src/renderer/features/session/session-control-panel.js'
import {
  deriveSessionLayoutState,
  dividerLimits,
  measuredCenterIntrinsicWidth
} from '../../src/renderer/features/session/session-panel-layout-geometry.js'
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
  it('fits scenario first while preserving preferred widths and every minimum', () => {
    const preferred = {
      schemaVersion: 2 as const,
      controlPaneWidth: 440,
      scenarioPaneWidth: 420,
      centerTab: 'details' as const
    }
    expect(
      deriveSessionLayoutState(preferred, {
        workspaceWidth: 958,
        centerIntrinsicWidth: 360
      })
    ).toMatchObject({
      preferred,
      effective: { controlPaneWidth: 316, scenarioPaneWidth: 264 },
      mode: 'full'
    })
    expect(
      deriveSessionLayoutState(preferred, {
        workspaceWidth: 700,
        centerIntrinsicWidth: 420
      })
    ).toMatchObject({ preferred, mode: 'compact' })
    expect(
      deriveSessionLayoutState(preferred, {
        workspaceWidth: 512,
        centerIntrinsicWidth: 720
      })
    ).toMatchObject({ preferred, mode: 'stacked' })
  })

  it.each([
    {
      name: 'native frame and rail leave a wide workspace',
      workspaceWidth: 1240,
      centerIntrinsicWidth: 420,
      mode: 'full'
    },
    {
      name: '200 percent scale leaves a compact workspace',
      workspaceWidth: 720,
      centerIntrinsicWidth: 440,
      mode: 'compact'
    },
    {
      name: 'pseudolocalized content raises the measured center minimum',
      workspaceWidth: 900,
      centerIntrinsicWidth: 620,
      mode: 'compact'
    },
    {
      name: 'temporary window shrink composes panels vertically',
      workspaceWidth: 512,
      centerIntrinsicWidth: 420,
      mode: 'stacked'
    }
  ])('keeps preferences immutable when $name', (testCase) => {
    const preferred = {
      schemaVersion: 2 as const,
      controlPaneWidth: 440,
      scenarioPaneWidth: 420,
      centerTab: 'details' as const
    }
    const state = deriveSessionLayoutState(preferred, testCase)
    expect(state.mode).toBe(testCase.mode)
    expect(state.preferred).toBe(preferred)
    expect(preferred).toEqual({
      schemaVersion: 2,
      controlPaneWidth: 440,
      scenarioPaneWidth: 420,
      centerTab: 'details'
    })
  })

  it('uses the same measured geometry for divider and fitted limits', () => {
    expect(dividerLimits('left', 264, 958, 360)).toEqual({
      min: 280,
      max: 316
    })
    expect(dividerLimits('right', 316, 958, 360)).toEqual({
      min: 264,
      max: 264
    })
  })

  it('does not mistake stacked allocation for intrinsic center demand', () => {
    expect(
      measuredCenterIntrinsicWidth({ clientWidth: 1_199, scrollWidth: 1_199 })
    ).toBe(360)
    expect(
      measuredCenterIntrinsicWidth({ clientWidth: 500, scrollWidth: 620 })
    ).toBe(620)
  })

  it('shows control selectors only while their register row is edited', () => {
    render(
      <CapabilityProvider api={{} as SaltMarcherApi}>
        <SessionControlPanel
          model={{
            focusedSceneId: sceneId,
            focusedSceneTitle: 'Standardszene',
            focusedLocationId: null,
            focusedLocationLabel: 'Kein Ort',
            scenes: [{ id: sceneId, title: 'Standardszene' }],
            locationChoices: [],
            locationUnavailable: false
          }}
          actions={{
            focusScene: vi.fn(),
            setSceneLocation: vi.fn(),
            manageGroups: vi.fn()
          }}
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
            schemaVersion: 2,
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
