import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { ReferenceTarget } from '../../../shared/contracts/reference.js'
import type { SessionLayoutPreference } from '../../../shared/contracts/session-layout.js'
import {
  EncounterCrumbs,
  SessionEncounterPanel
} from '../encounter/encounter-panels.js'
import { message } from '../../i18n/session-runtime.de.js'
import type { SessionTravelSlots } from './session-travel-slots.js'
import './session-scenario-panel.css'
import type {
  LootSceneProjection,
  Treasure
} from '../../../shared/contracts/loot.js'
import type { WorkspaceScenario } from '../workspace/workspace-surface-props.js'

export function SessionScenarioPanel(props: {
  snapshot: LiveSessionSnapshot
  loot: LootSceneProjection
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  scenario: WorkspaceScenario
  setScenario: (scenario: WorkspaceScenario) => void
  layout: SessionLayoutPreference
  setLayout: (layout: SessionLayoutPreference) => void
  onError: (message: string) => void
  travel: SessionTravelSlots
  openReference: (target: ReferenceTarget, breadcrumb: string) => void
  manageGroups: () => void
  reinforce: () => void
  distribute: (treasure: Treasure) => void
}) {
  return (
    <aside className="scenario-panel" aria-label={message('ui.szenario.panel')}>
      <header>
        <div
          className="session-panel-tabs scenario-tabs"
          role="tablist"
          aria-label={message('ui.szenario.auswahl')}
        >
          {(['encounter', 'travel'] as const).map((scenario) => {
            const selected = props.scenario === scenario
            return (
              <button
                key={scenario}
                id={`scenario-tab-${scenario}`}
                type="button"
                role="tab"
                aria-controls="scenario-tab-panel"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => props.setScenario(scenario)}
                onKeyDown={(event) => {
                  if (
                    !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
                      event.key
                    )
                  )
                    return
                  event.preventDefault()
                  const next =
                    event.key === 'ArrowLeft' || event.key === 'Home'
                      ? 'encounter'
                      : 'travel'
                  props.setScenario(next)
                  requestAnimationFrame(() =>
                    document.getElementById(`scenario-tab-${next}`)?.focus()
                  )
                }}
              >
                {message(
                  scenario === 'encounter' ? 'ui.encounter' : 'ui.reise'
                )}
              </button>
            )
          })}
        </div>
        {props.scenario === 'encounter' && (
          <EncounterCrumbs
            snapshot={props.snapshot}
            loot={props.loot}
            setSnapshot={props.setSnapshot}
            onError={props.onError}
          />
        )}
      </header>
      <div
        id="scenario-tab-panel"
        className="scenario-tab-panel"
        role="tabpanel"
        aria-labelledby={`scenario-tab-${props.scenario}`}
      >
        {props.scenario === 'travel' ? (
          <div className="session-scenario-content-slot">
            {props.travel.renderScenario({
              openMap: () =>
                props.setLayout({ ...props.layout, centerTab: 'map' }),
              mapActive: props.layout.centerTab === 'map'
            })}
          </div>
        ) : (
          <SessionEncounterPanel
            snapshot={props.snapshot}
            loot={props.loot}
            setSnapshot={props.setSnapshot}
            onError={props.onError}
            manageGroups={props.manageGroups}
            reinforce={props.reinforce}
            distribute={props.distribute}
            inspect={(creature) => {
              props.openReference(
                { scope: 'creature', creatureId: creature.id },
                `Encounter › ${creature.name}`
              )
            }}
          />
        )}
      </div>
    </aside>
  )
}
