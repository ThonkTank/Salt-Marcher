import { useEffect, useState } from 'react'
import type {
  CreatureCatalogPage,
  CreatureCatalogQuery
} from '../../../shared/contracts/encounter.js'
import type { SceneSnapshot } from '../../../shared/contracts/scene.js'
import type { SessionLayoutPreference } from '../../../shared/contracts/session-layout.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { reportCapabilityError } from '../../capabilities/capability-errors.js'
import { CreatureInspectorCatalogTable } from '../creature-collection/creature-collection.js'
import {
  emptyCreatureOptions,
  emptyQuery,
  useCreatureSearch
} from '../creatures/creature-state.js'
import { creaturesCapabilities } from '../creatures/creatures-capabilities.js'
import { useBiomeOptionSearch } from '../creatures/use-biome-option-search.js'
import { createBiomeOptionSearchPort } from '../creatures/biome-option-search-port.js'
import { createCreatureCapabilityPort } from '../creatures/creatures-capabilities.js'
import { LazyReferenceDocument } from '../reference/lazy-reference-document.js'
import { ReadOnlyProse } from '../reference/read-only-prose.js'
import { useReferenceContext } from '../reference/reference-context.js'
import { message } from '../../i18n/session-runtime.de.js'
import type { SessionTravelSlots } from './session-travel-slots.js'
import './session-center-panel.css'
import { AccessibleTabs } from '../shared/accessible-tabs.js'

type RunningScene = SceneSnapshot['scenes'][number]

export function SessionCenterPanel(props: {
  focused: RunningScene
  layout: SessionLayoutPreference
  setLayout: (layout: SessionLayoutPreference) => void
  travel: SessionTravelSlots
  onError: (message: string) => void
  inspectCreature: (creatureId: string, context: string) => void
}) {
  const api = useCapabilityApi()
  const [catalogQuery, setCatalogQuery] = useState<CreatureCatalogQuery>({
    ...emptyQuery,
    limit: 30
  })
  const [catalogPage, setCatalogPage] = useState<CreatureCatalogPage | null>(
    null
  )
  const [catalogOptions, setCatalogOptions] = useState(emptyCreatureOptions)
  const searchBiomeOptions = useBiomeOptionSearch(
    createBiomeOptionSearchPort(api.biomes),
    setCatalogOptions,
    catalogQuery.biomes,
    props.onError
  )
  const reference = useReferenceContext()
  const history = reference.navigation
  const detail = history.document
  const breadcrumb = history.entries[history.index]?.breadcrumb ?? null
  useCreatureSearch(
    catalogQuery,
    setCatalogPage,
    props.onError,
    createCreatureCapabilityPort(api.creatures)
  )
  useEffect(() => {
    void creaturesCapabilities(api)
      .creatures.filterOptions()
      .then(setCatalogOptions)
      .catch(reportCapabilityError(props.onError))
  }, [api, props.onError])

  return (
    <section
      className={`session-detail-panel${
        props.layout.centerTab === 'map' ? ' session-detail-panel-map' : ''
      }`}
      aria-label={message('ui.detailansicht')}
    >
      <AccessibleTabs
        label={message('ui.detailansicht')}
        className="session-panel-tabs"
        panelClassName="session-center-tab-panel"
        items={[
          { value: 'details', label: message('ui.detail') },
          { value: 'catalog', label: message('nav.catalog') },
          { value: 'map', label: message('ui.karte') }
        ]}
        selected={props.layout.centerTab}
        changed={(centerTab) => props.setLayout({ ...props.layout, centerTab })}
      >
        {props.layout.centerTab === 'map' ? (
          <div className="session-center-content-slot">
            {props.travel.renderMap()}
          </div>
        ) : props.layout.centerTab === 'catalog' ? (
          <CreatureInspectorCatalogTable
            query={catalogQuery}
            options={catalogOptions}
            searchBiomeOptions={searchBiomeOptions}
            page={catalogPage}
            changed={setCatalogQuery}
            inspect={(creature) =>
              props.inspectCreature(creature.id, 'Katalog')
            }
          />
        ) : (
          <>
            <nav
              className="detail-history"
              aria-label={message('ui.detail.verlauf')}
            >
              <button
                aria-label={message('ui.zurueck')}
                disabled={history.index <= 0}
                onClick={() => reference.moveNavigation(-1)}
              >
                ‹
              </button>
              <button
                aria-label={message('ui.vor')}
                disabled={history.index >= history.entries.length - 1}
                onClick={() => reference.moveNavigation(1)}
              >
                ›
              </button>
              <span>
                <ReadOnlyProse>
                  {breadcrumb ??
                    (props.focused.locationName || props.focused.title)}
                </ReadOnlyProse>
              </span>
              <button
                className="detail-close"
                aria-label={message('ui.detail.schliessen')}
                disabled={history.index < 0}
                onClick={reference.closeNavigation}
              >
                ×
              </button>
            </nav>
            <div
              className="detail-scroll"
              tabIndex={0}
              aria-label={message('ui.detailansicht')}
            >
              {history.loading ? (
                <p className="reference-status" role="status">
                  {message('reference.loading')}
                </p>
              ) : detail ? (
                <LazyReferenceDocument document={detail} />
              ) : (
                <div className="detail-empty">
                  <p className="section-kicker">{props.focused.title}</p>
                  <h2>
                    <ReadOnlyProse>
                      {props.focused.locationName || 'Keine Detailauswahl'}
                    </ReadOnlyProse>
                  </h2>
                  <p>
                    {message(
                      'ui.waehle.ein.monster.aus.einer.gruppe.oder.spaeter'
                    )}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </AccessibleTabs>
    </section>
  )
}
