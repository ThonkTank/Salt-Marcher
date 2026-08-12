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

export function SessionScenarioPanel(props: {
  snapshot: LiveSessionSnapshot
  loot: LootSceneProjection
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  scenario: '' | 'encounter' | 'travel'
  setScenario: (scenario: '' | 'encounter' | 'travel') => void
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
    <aside
      className={`scenario-panel${
        props.scenario === 'travel' ? ' scenario-panel-travel' : ''
      }`}
      aria-label={message('ui.szenario.panel')}
    >
      <header>
        <select
          aria-label={message('ui.szenario.auswahl')}
          value={props.scenario}
          onChange={(event) =>
            props.setScenario(event.target.value as typeof props.scenario)
          }
        >
          <option value="">{message('ui.szenario.auswaehlen')}</option>
          <option value="encounter">{message('ui.encounter')}</option>
          <option value="travel">{message('ui.reise')}</option>
        </select>
        {props.scenario === 'encounter' && (
          <EncounterCrumbs
            snapshot={props.snapshot}
            loot={props.loot}
            setSnapshot={props.setSnapshot}
            close={() => props.setScenario('')}
            onError={props.onError}
          />
        )}
      </header>
      {!props.scenario ? (
        <div className="scenario-empty">{message('ui.szenario.panel')}</div>
      ) : props.scenario === 'travel' ? (
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
          close={() => props.setScenario('')}
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
    </aside>
  )
}
