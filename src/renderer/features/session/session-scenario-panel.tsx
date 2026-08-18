import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { ReferenceTarget } from '../../../shared/contracts/reference.js'
import type { SessionLayoutPreference } from '../../../shared/contracts/session-layout.js'
import {
  EncounterCrumbs,
  SessionEncounterPanel
} from '../encounter/encounter-panels.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import type { SessionTravelSlots } from './session-travel-slots.js'
import './session-scenario-panel.css'
import type {
  LootSceneProjection,
  Treasure
} from '../../../shared/contracts/loot.js'
import type { SessionScenario } from './session-scenario.js'
import { AccessibleTabs } from '../shared/accessible-tabs.js'

export function SessionScenarioPanel(props: {
  snapshot: LiveSessionSnapshot
  loot: LootSceneProjection
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  scenario: SessionScenario
  setScenario: (scenario: SessionScenario) => void
  layout: SessionLayoutPreference
  setLayout: (layout: SessionLayoutPreference) => void
  onError: (message: string) => void
  travel: SessionTravelSlots
  openReference: (target: ReferenceTarget, breadcrumb: string) => void
  createGroup: () => void
  distribute: (treasure: Treasure) => void
}) {
  return (
    <aside className="scenario-panel" aria-label={message('ui.szenario.panel')}>
      <AccessibleTabs
        label={message('ui.szenario.auswahl')}
        className="session-panel-tabs scenario-tabs"
        headerClassName="scenario-panel-header"
        panelClassName="scenario-tab-panel"
        items={[
          { value: 'encounter', label: message('ui.encounter') },
          { value: 'travel', label: message('ui.reise') }
        ]}
        selected={props.scenario}
        changed={props.setScenario}
        afterTabs={
          props.scenario === 'encounter' ? (
            <EncounterCrumbs
              snapshot={props.snapshot}
              loot={props.loot}
              setSnapshot={props.setSnapshot}
              onError={props.onError}
            />
          ) : null
        }
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
            createGroup={props.createGroup}
            distribute={props.distribute}
            inspect={(creature) => {
              props.openReference(
                { scope: 'creature', creatureId: creature.id },
                formatMessage('reference.encounterCreature', {
                  name: creature.name
                })
              )
            }}
          />
        )}
      </AccessibleTabs>
    </aside>
  )
}
