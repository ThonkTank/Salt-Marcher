import { lazy, Suspense, useMemo, useState } from 'react'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { EncounterTableCatalogSection } from '../encounter-table/encounter-table-catalog-section.js'
import { useEncounterTableCatalogController } from '../encounter-table/encounter-table-catalog-controller.js'
import { createEncounterTableApplicationPort } from '../encounter-table/encounter-table-application.js'
import { MonsterCatalogSection } from './monster-catalog-section.js'
import { useMonsterCatalogController } from './monster-catalog-controller.js'
import { LocationCatalogSection } from './location-catalog-section.js'
import {
  createLocationCatalogPort,
  useLocationCatalogController
} from './location-catalog-controller.js'
import { FactionCatalogSection } from './faction-catalog-section.js'
import { useFactionCatalogController } from './faction-catalog-controller.js'
import { createWorldFactionApplicationPort } from '../worldplanner/world-faction-application.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import './catalog.css'
import type { WorldLocationEditingIntegration } from '../worldplanner/world-location-editor-types.js'
import { catalogCapabilities } from './catalog-capabilities.js'
import { useRelatedEntityDialogStack } from '../workspace/integrations/related-entity-dialog-stack.js'
import { LazyWorldFactionDialog } from '../worldplanner/lazy-world-faction-dialog.js'
import { createCatalogEditorPorts } from './catalog-editor-ports.js'
import { useNpcCatalogController } from './npc-catalog-controller.js'
import {
  CatalogSectionSelector,
  type CatalogSection
} from './catalog-section-selector.js'

const LazyNpcCatalogSection = lazy(() => import('./npc-catalog-section.js'))

type CatalogWorkspaceProps = {
  campaignId: string
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  onError: (message: string) => void
  inspect: (creature: Creature) => void
  worldLocationEditing: WorldLocationEditingIntegration
}

export default function CatalogWorkspace(props: CatalogWorkspaceProps) {
  const api = useCapabilityApi()
  const catalog = useMemo(() => catalogCapabilities(api), [api])
  const editorPorts = useMemo(() => createCatalogEditorPorts(api), [api])
  const relatedDialogs = useRelatedEntityDialogStack({
    port: api,
    inspect: props.inspect,
    onError: props.onError
  })
  const locationPort = useMemo(
    () => createLocationCatalogPort(catalog, props.campaignId),
    [catalog, props.campaignId]
  )
  const factionPort = useMemo(
    () => createWorldFactionApplicationPort(catalog),
    [catalog]
  )
  const encounterTablePort = useMemo(
    () => createEncounterTableApplicationPort(catalog),
    [catalog]
  )
  const onBiomesChanged = useMemo(
    () => (listener: Parameters<typeof api.biomes.onChanged>[0]) =>
      api.biomes.onChanged(listener),
    [api]
  )
  const onEncounterTablesChanged = useMemo(
    () => (listener: Parameters<typeof catalog.encounterTables.onChanged>[0]) =>
      catalog.encounterTables.onChanged(listener),
    [catalog]
  )
  const [section, setSection] = useState<CatalogSection>('monsters')
  const monsterController = useMonsterCatalogController(
    section === 'monsters',
    props.onError,
    props.inspect,
    editorPorts.creatures,
    editorPorts.biomes,
    onBiomesChanged,
    onEncounterTablesChanged
  )
  const locationController = useLocationCatalogController(
    section === 'locations',
    props.onError,
    props.setSnapshot,
    locationPort
  )
  const factionController = useFactionCatalogController(
    section === 'factions',
    props.onError,
    factionPort
  )
  const npcController = useNpcCatalogController(
    section === 'npcs',
    props.onError,
    catalog,
    editorPorts.creatures
  )
  const encounterTableController = useEncounterTableCatalogController(
    section === 'encounterTables',
    props.onError,
    encounterTablePort
  )
  return (
    <section className="catalog-workspace">
      <div
        className={`catalog-browser${section !== 'monsters' ? ' locations-catalog-browser' : ''}`}
      >
        <CatalogSectionSelector section={section} select={setSection} />
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
            references={locationController.references}
            deleteConfirm={locationController.deleteConfirm}
            setSearchInput={locationController.setSearchInput}
            commitSearch={locationController.commitSearch}
            toggleDirection={locationController.toggleDirection}
            select={locationController.setSelected}
            edit={locationController.setEditing}
            place={locationController.setPlacing}
            setDeleteConfirm={locationController.setDeleteConfirm}
            save={locationController.save}
            remove={() => void locationController.remove()}
            placed={() => void locationController.placed()}
            onError={props.onError}
            worldLocationEditing={props.worldLocationEditing}
            placementRecovery={locationController.placementRecovery}
            retryPlacement={() => void locationController.retryPlacement()}
          />
        ) : (
          <>
            <div
              className="catalog-section-host"
              hidden={section !== 'factions'}
            >
              <FactionCatalogSection controller={factionController} />
            </div>
            {section === 'npcs' && (
              <div className="catalog-section-host">
                <Suspense fallback={null}>
                  <LazyNpcCatalogSection controller={npcController} />
                </Suspense>
              </div>
            )}
            <div
              className="catalog-section-host"
              hidden={section !== 'encounterTables'}
            >
              <EncounterTableCatalogSection
                controller={encounterTableController}
                onError={props.onError}
                inspect={props.inspect}
                creatures={editorPorts.creatures}
                biomes={editorPorts.biomes}
              />
            </div>
          </>
        )}
      </div>
      {factionController.editing !== undefined && (
        <Suspense fallback={null}>
          <LazyWorldFactionDialog
            key={factionController.editing?.id ?? 'new-faction'}
            faction={factionController.editing}
            tableSnapshot={factionController.tableSnapshot}
            close={() => factionController.setEditing(undefined)}
            save={factionController.saveFaction}
            saved={() => factionController.setEditing(undefined)}
            requestTableCreation={(created) =>
              relatedDialogs.requestTableCreation('faction-link', created)
            }
            onError={props.onError}
            inspect={props.inspect}
            creatures={editorPorts.creatureFacts}
            invocation={{ kind: 'catalog' }}
          />
        </Suspense>
      )}
      {relatedDialogs.dialogs}
    </section>
  )
}
