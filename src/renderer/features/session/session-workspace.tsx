import { message as uiMessage } from '../../i18n/messages.de.js'
import { useEffect, useRef, useState } from 'react'
import type {
  CreatureCatalogPage,
  CreatureCatalogQuery
} from '../../../shared/contracts/encounter.js'
import type { SceneGroup } from '../../../shared/contracts/scene.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { SessionLayoutPreference } from '../../../shared/contracts/session-layout.js'
import type { ReferenceTarget } from '../../../shared/contracts/reference.js'
import { SessionHexMap, TravelScenario } from '../hex/hex-workspaces.js'
import {
  EncounterCrumbs,
  SessionEncounterPanel
} from '../encounter/encounter-panels.js'
import { applySceneGroupCommandResult } from './session-patches.js'
import {
  emptyCreatureOptions,
  emptyQuery,
  useCreatureSearch
} from '../catalog/catalog-state.js'
import {
  capabilityErrorText,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'
import {
  ReferenceDocumentView,
  ReferenceText
} from '../reference/reference-ui.js'
import './session.css'
import { sessionCapabilities } from './session-capabilities.js'
import { useSessionDetailHistory } from './use-session-detail-history.js'
import { SessionPanelLayout } from './session-panel-layout.js'
import { SessionGroupCard } from './session-group-card.js'
import { ScenePartyCard } from './scene-party-card.js'
import { CreatureCollectionCatalogPane, GroupDialog } from './group-dialog.js'

export default function SessionWorkspace(props: {
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  groupDialogOpen: boolean
  setGroupDialogOpen: (open: boolean) => void
  scenario: '' | 'encounter' | 'travel'
  setScenario: (scenario: '' | 'encounter' | 'travel') => void
  layout: SessionLayoutPreference
  setLayout: (layout: SessionLayoutPreference) => void
  referenceRequest: Readonly<{
    target: ReferenceTarget
    breadcrumb: string
    nonce: number
  }> | null
  referenceOpened: (nonce: number) => void
  onError: (message: string) => void
}) {
  const [editingGroup, setEditingGroup] = useState<SceneGroup | null>(null)
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null)
  const [reinforcementMode, setReinforcementMode] = useState(false)
  const [catalogQuery, setCatalogQuery] = useState<CreatureCatalogQuery>({
    ...emptyQuery,
    limit: 30
  })
  const [catalogPage, setCatalogPage] = useState<CreatureCatalogPage | null>(
    null
  )
  const [catalogOptions, setCatalogOptions] = useState(emptyCreatureOptions)
  const followedCombatCard = useRef<string | null>(null)
  const focused = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.snapshot.scene.focusedSceneId
  )!
  const { history, detail, breadcrumb, openDetail, moveHistory, closeDetail } =
    useSessionDetailHistory(focused.id)
  useCreatureSearch(catalogQuery, setCatalogPage, props.onError)
  useEffect(() => {
    void sessionCapabilities()
      .creatures.filterOptions()
      .then(setCatalogOptions)
      .catch(reportCapabilityError(props.onError))
  }, [props.onError])
  async function openReferenceTarget(
    target: ReferenceTarget,
    breadcrumb: string
  ) {
    try {
      openDetail(
        await sessionCapabilities().references.detail(target),
        breadcrumb
      )
      props.setLayout({ ...props.layout, centerTab: 'details' })
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }
  async function openCreature(creatureId: string, context: string) {
    try {
      const document = await sessionCapabilities().references.detail({
        kind: 'creature',
        id: creatureId
      })
      openDetail(document, `${context} › ${document.title}`)
      props.setLayout({ ...props.layout, centerTab: 'details' })
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }
  useEffect(() => {
    const request = props.referenceRequest
    if (!request) return
    void openReferenceTarget(request.target, request.breadcrumb).finally(() =>
      props.referenceOpened(request.nonce)
    )
    // The request nonce is the external navigation identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.referenceRequest?.nonce])
  const activeCombatCard = props.snapshot.combat?.cards.find(
    (card) => card.active && !card.playerCharacter && card.creatureId
  )
  useEffect(() => {
    if (!activeCombatCard?.creatureId) {
      followedCombatCard.current = null
      return
    }
    if (followedCombatCard.current === activeCombatCard.id) return
    followedCombatCard.current = activeCombatCard.id
    const group = focused.groups.find((candidate) =>
      candidate.entries.some(
        (entry) => entry.creatureId === activeCombatCard.creatureId
      )
    )
    void openCreature(activeCombatCard.creatureId, group?.name ?? 'Encounter')
    // The active card identity deliberately controls this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCombatCard?.id, activeCombatCard?.creatureId])
  const control = (
    <section
      className="session-control-panel"
      aria-label={uiMessage('ui.session.steuerung')}
    >
      <div className="panel-heading">
        <h2>{uiMessage('ui.session.steuerung')}</h2>
        <button
          onClick={() => {
            setReinforcementMode(false)
            setEditingGroup(null)
            props.setGroupDialogOpen(true)
          }}
        >
          {uiMessage('ui.gruppen.managen')}
        </button>
      </div>
      <label>
        {uiMessage('ui.aktive.szene')}
        <select
          aria-label={uiMessage('ui.aktive.szene')}
          value={focused.id}
          disabled={props.snapshot.scene.scenes.length < 2}
          onChange={(event) =>
            void scenarioAction(props, () =>
              sessionCapabilities().scene.focus(
                event.target.value,
                props.snapshot.scene.revision
              )
            )
          }
        >
          {props.snapshot.scene.scenes.map((scene) => (
            <option key={scene.id} value={scene.id}>
              {scene.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        {uiMessage('ui.ort')}
        <select
          aria-label={uiMessage('ui.scene.ort')}
          value={focused.locationId ?? ''}
          onChange={(event) =>
            void scenarioAction(props, () =>
              sessionCapabilities().scene.setLocation(
                focused.id,
                event.target.value || null,
                props.snapshot.scene.revision
              )
            )
          }
        >
          <option value="">{uiMessage('ui.kein.ort')}</option>
          {focused.locationId &&
            !props.snapshot.scene.locationChoices.some(
              (location) => location.id === focused.locationId
            ) && (
              <option value={focused.locationId}>
                {uiMessage('ui.nicht.verfuegbarer.ort')}
              </option>
            )}
          {props.snapshot.scene.locationChoices.map((location) => (
            <option key={location.id} value={location.id}>
              {location.displayName}
            </option>
          ))}
        </select>
      </label>
      <p className="panel-hint">
        {props.snapshot.scene.scenes.length > 1
          ? uiMessage('session.independentHint')
          : uiMessage('session.additionalHint')}
      </p>
    </section>
  )

  const groups = (
    <section className="session-groups" aria-label={uiMessage('ui.gruppen')}>
      <div className="groups-heading">
        <h2>{uiMessage('ui.gruppen')}</h2>
      </div>
      <ScenePartyCard
        snapshot={props.snapshot}
        sceneId={focused.id}
        setSnapshot={props.setSnapshot}
        onError={props.onError}
      />
      {focused.groups
        .filter((group) => !group.archived)
        .map((group) => (
          <SessionGroupCard
            key={group.id}
            group={group}
            inspect={(creatureId) => void openCreature(creatureId, group.name)}
            edit={() => {
              setReinforcementMode(false)
              setEditingGroup(group)
              props.setGroupDialogOpen(true)
            }}
          />
        ))}
      {focused.groups.some((group) => group.archived) && (
        <div className="inactive-groups">
          <h3>{uiMessage('group.inactive')}</h3>
          {focused.groups
            .filter((group) => group.archived)
            .map((group) => (
              <SessionGroupCard
                key={group.id}
                group={group}
                inspect={(creatureId) =>
                  void openCreature(creatureId, group.name)
                }
                restore={() =>
                  void (async () => {
                    try {
                      props.setSnapshot(
                        applySceneGroupCommandResult(
                          props.snapshot,
                          await sessionCapabilities().scene.setGroupArchived(
                            focused.id,
                            group.id,
                            false,
                            group.revision
                          )
                        )
                      )
                    } catch (cause) {
                      props.onError(capabilityErrorText(cause))
                    }
                  })()
                }
                deleteRequested={() => setDeleteGroupId(group.id)}
                deleteConfirming={deleteGroupId === group.id}
                cancelDelete={() => setDeleteGroupId(null)}
                deleteGroup={() => {
                  setDeleteGroupId(null)
                  void (async () => {
                    try {
                      props.setSnapshot(
                        applySceneGroupCommandResult(
                          props.snapshot,
                          await sessionCapabilities().scene.deleteGroup(
                            focused.id,
                            group.id,
                            group.revision
                          )
                        )
                      )
                    } catch (cause) {
                      props.onError(capabilityErrorText(cause))
                    }
                  })()
                }}
              />
            ))}
        </div>
      )}
    </section>
  )

  const details = (
    <section
      className="session-detail-panel"
      aria-label={uiMessage('ui.detailansicht')}
    >
      <div className="session-panel-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={props.layout.centerTab === 'details'}
          onClick={() =>
            props.setLayout({ ...props.layout, centerTab: 'details' })
          }
        >
          {uiMessage('ui.detail')}
        </button>
        <button
          role="tab"
          aria-selected={props.layout.centerTab === 'catalog'}
          onClick={() =>
            props.setLayout({ ...props.layout, centerTab: 'catalog' })
          }
        >
          {uiMessage('nav.catalog')}
        </button>
        <button
          role="tab"
          aria-selected={props.layout.centerTab === 'map'}
          onClick={() => props.setLayout({ ...props.layout, centerTab: 'map' })}
        >
          {uiMessage('ui.karte')}
        </button>
      </div>
      {props.layout.centerTab === 'map' ? (
        <SessionHexMap
          snapshot={props.snapshot}
          setSnapshot={props.setSnapshot}
          onError={props.onError}
        />
      ) : props.layout.centerTab === 'catalog' ? (
        <CreatureCollectionCatalogPane
          query={catalogQuery}
          options={catalogOptions}
          page={catalogPage}
          changed={setCatalogQuery}
          inspect={(creature) => void openCreature(creature.id, 'Katalog')}
          variant="inspector"
        />
      ) : (
        <>
          <nav
            className="detail-history"
            aria-label={uiMessage('ui.detail.verlauf')}
          >
            <button
              aria-label={uiMessage('ui.zurueck')}
              disabled={history.index <= 0}
              onClick={() => moveHistory(-1)}
            >
              ‹
            </button>
            <button
              aria-label={uiMessage('ui.vor')}
              disabled={history.index >= history.entries.length - 1}
              onClick={() => moveHistory(1)}
            >
              ›
            </button>
            <span>
              <ReferenceText>
                {breadcrumb ?? (focused.locationName || focused.title)}
              </ReferenceText>
            </span>
            <button
              className="detail-close"
              aria-label={uiMessage('ui.detail.schliessen')}
              disabled={!detail}
              onClick={closeDetail}
            >
              ×
            </button>
          </nav>
          <div
            className="detail-scroll"
            tabIndex={0}
            aria-label={uiMessage('ui.detailansicht')}
          >
            {detail ? (
              <ReferenceDocumentView document={detail} />
            ) : (
              <div className="detail-empty">
                <p className="section-kicker">{focused.title}</p>
                <h2>
                  <ReferenceText>
                    {focused.locationName || 'Keine Detailauswahl'}
                  </ReferenceText>
                </h2>
                <p>
                  {uiMessage(
                    'ui.waehle.ein.monster.aus.einer.gruppe.oder.spaeter'
                  )}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )

  const scenarioPanel = (
    <aside
      className="scenario-panel"
      aria-label={uiMessage('ui.szenario.panel')}
    >
      <header>
        <select
          aria-label={uiMessage('ui.szenario.auswahl')}
          value={props.scenario}
          onChange={(event) =>
            props.setScenario(event.target.value as '' | 'encounter' | 'travel')
          }
        >
          <option value="">{uiMessage('ui.szenario.auswaehlen')}</option>
          <option value="encounter">{uiMessage('ui.encounter')}</option>
          <option value="travel">{uiMessage('ui.reise')}</option>
        </select>
        {props.scenario === 'encounter' && (
          <EncounterCrumbs
            snapshot={props.snapshot}
            setSnapshot={props.setSnapshot}
            close={() => props.setScenario('')}
            onError={props.onError}
          />
        )}
      </header>
      {!props.scenario ? (
        <div className="scenario-empty">{uiMessage('ui.szenario.panel')}</div>
      ) : props.scenario === 'travel' ? (
        <TravelScenario
          snapshot={props.snapshot}
          setSnapshot={props.setSnapshot}
          openMap={() => props.setLayout({ ...props.layout, centerTab: 'map' })}
          onError={props.onError}
        />
      ) : (
        <SessionEncounterPanel
          {...props}
          inspect={(creature) => {
            void openReferenceTarget(
              { kind: 'creature', id: creature.id },
              `Encounter › ${creature.name}`
            )
          }}
          close={() => props.setScenario('')}
          manageGroups={() => {
            setReinforcementMode(false)
            setEditingGroup(null)
            props.setGroupDialogOpen(true)
          }}
          reinforce={() => {
            setReinforcementMode(true)
            setEditingGroup(null)
            props.setGroupDialogOpen(true)
          }}
        />
      )}
    </aside>
  )

  return (
    <section
      className="session-mockup"
      aria-label={uiMessage('ui.session.workspace')}
    >
      <div className="session-layout">
        <SessionPanelLayout
          preference={props.layout}
          changed={props.setLayout}
          control={control}
          groups={groups}
          details={details}
          scenario={scenarioPanel}
        />
      </div>
      {props.groupDialogOpen && (
        <GroupDialog
          snapshot={props.snapshot}
          group={editingGroup}
          close={() => props.setGroupDialogOpen(false)}
          saved={(snapshot) => {
            props.setSnapshot(snapshot)
            props.setGroupDialogOpen(false)
          }}
          inspect={(creature) => {
            void openReferenceTarget(
              { kind: 'creature', id: creature.id },
              `Katalog › ${creature.name}`
            )
          }}
          onError={props.onError}
          reinforcementMode={reinforcementMode}
        />
      )}
    </section>
  )
}

async function scenarioAction(
  props: {
    setSnapshot: (snapshot: LiveSessionSnapshot) => void
    onError: (message: string) => void
  },
  operation: () => Promise<LiveSessionSnapshot>
): Promise<void> {
  try {
    props.setSnapshot(await operation())
  } catch (cause) {
    props.onError(capabilityErrorText(cause))
  }
}
