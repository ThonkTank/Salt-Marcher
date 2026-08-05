import { message } from '../../i18n/messages.de.js'
import { useState } from 'react'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { EncounterTableCatalogSection } from '../encounter-table/encounter-table-catalog-section.js'
import { useEncounterTableCatalogController } from '../encounter-table/encounter-table-catalog-controller.js'
import { MonsterCatalogSection } from './monster-catalog-section.js'
import { useMonsterCatalogController } from './monster-catalog-controller.js'
import { LocationCatalogSection } from './location-catalog-section.js'
import { useLocationCatalogController } from './location-catalog-controller.js'
import { FactionCatalogSection } from './faction-catalog-section.js'
import { useFactionCatalogController } from './faction-catalog-controller.js'
import './catalog.css'

type CatalogWorkspaceProps = {
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  close: () => void
  onError: (message: string) => void
  inspect: (creature: Creature) => void
}

export default function CatalogWorkspace(props: CatalogWorkspaceProps) {
  const [section, setSection] = useState<
    'monsters' | 'locations' | 'factions' | 'encounterTables'
  >('monsters')
  const monsterController = useMonsterCatalogController(
    section === 'monsters',
    props.onError,
    props.inspect
  )
  const locationController = useLocationCatalogController(
    section === 'locations',
    props.onError,
    props.setSnapshot
  )
  const factionController = useFactionCatalogController(
    section === 'factions',
    props.onError
  )
  const encounterTableController = useEncounterTableCatalogController(
    section === 'encounterTables',
    props.onError
  )
  return (
    <section className="catalog-workspace">
      <div
        className={`catalog-browser${section !== 'monsters' ? ' locations-catalog-browser' : ''}`}
      >
        <header className="catalog-section-selector">
          <button
            aria-pressed={section === 'monsters'}
            onClick={() => setSection('monsters')}
          >
            {message('ui.monster')}
          </button>
          <button
            aria-pressed={section === 'locations'}
            onClick={() => setSection('locations')}
          >
            {message('ui.orte')}
          </button>
          <button
            aria-pressed={section === 'factions'}
            onClick={() => setSection('factions')}
          >
            {message('ui.fraktionen')}
          </button>
          <button
            aria-pressed={section === 'encounterTables'}
            onClick={() => setSection('encounterTables')}
          >
            {message('ui.encounter.tabellen')}
          </button>
        </header>
        {section === 'monsters' ? (
          <MonsterCatalogSection controller={monsterController} />
        ) : section === 'locations' ? (
          <LocationCatalogSection
            visible={locationController.visible}
            total={locationController.snapshot.locations.length}
            loading={locationController.loading}
            searchInput={locationController.searchInput}
            direction={locationController.direction}
            selected={locationController.selected}
            editing={locationController.editing}
            placing={locationController.placing}
            tables={locationController.tables}
            factions={locationController.factions}
            deleteConfirm={locationController.deleteConfirm}
            setSearchInput={locationController.setSearchInput}
            commitSearch={locationController.commitSearch}
            toggleDirection={locationController.toggleDirection}
            select={locationController.setSelected}
            edit={locationController.setEditing}
            place={locationController.setPlacing}
            setDeleteConfirm={locationController.setDeleteConfirm}
            save={(draft) => void locationController.save(draft)}
            remove={() => void locationController.remove()}
            placed={() => void locationController.placed()}
            onError={props.onError}
          />
        ) : (
          <>
            <div
              className="catalog-section-host"
              hidden={section !== 'factions'}
            >
              <FactionCatalogSection
                controller={factionController}
                onError={props.onError}
                inspect={props.inspect}
              />
            </div>
            <div
              className="catalog-section-host"
              hidden={section !== 'encounterTables'}
            >
              <EncounterTableCatalogSection
                controller={encounterTableController}
                onError={props.onError}
                inspect={props.inspect}
              />
            </div>
          </>
        )}
      </div>
    </section>
  )
}
