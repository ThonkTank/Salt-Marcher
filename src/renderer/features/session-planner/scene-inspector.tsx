import type {
  SavedEncounterPlanSearchResult,
  SavedEncounterPlanSummary
} from '../../../shared/contracts/encounter-plans.js'
import type { Treasure } from '../../../shared/contracts/loot.js'
import type {
  SaveSessionPlanInput,
  SessionPlannerScene,
  SessionPlannerWorkspace
} from '../../../shared/contracts/session-planner.js'
import type { GeneratedTreasure } from '../../../shared/contracts/session-generation.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { formatCopper } from '../../presenters/money.js'
import {
  generatedItemDefinitionFromList,
  generatedRewardLabel,
  generatedTreasureLabel
} from '../loot/generated-loot-presenter.js'
import {
  encounterPlanTitle,
  encounterRosterText,
  encounterSummaryText
} from './encounter-plan-presenter.js'
import type { PlannerDraftProjection } from './planner-draft.js'
import {
  normalizePlannerScenes,
  plannerSceneTitle
} from './planner-scene-helpers.js'

export type EncounterSearchState =
  | { status: 'idle' | 'searching' }
  | { status: 'ready'; hits: readonly EncounterSearchHit[]; hasMore: boolean }
  | { status: 'failed' }

export type EncounterSearchHit = Readonly<
  SavedEncounterPlanSearchResult['hits'][number] & {
    summary: SavedEncounterPlanSummary | null
  }
>

export function SceneInspector(props: {
  workspace: SessionPlannerWorkspace
  draft: SaveSessionPlanInput
  selectedScene: SessionPlannerScene | null
  selectedProjection: PlannerDraftProjection['scenes'][number] | undefined
  encounterQuery: string
  encounterSearch: EncounterSearchState
  setEncounterQuery: (query: string) => void
  mutate: (
    update: (draft: SaveSessionPlanInput) => SaveSessionPlanInput
  ) => void
  patchScene: (sceneId: string, patch: Partial<SessionPlannerScene>) => void
  materializeReward: (
    runId: string,
    generatedTreasureId: string,
    label: string,
    edit: boolean,
    placed: Treasure | null
  ) => void
  distribute: (treasure: Treasure) => void
}) {
  const selected = props.selectedScene
  return (
    <div className="planner-inspector">
      {selected ? (
        <>
          <header className="planner-inspector-header">
            <div>
              <p className="section-kicker">
                {message('planner.selectedScene')}
              </p>
              <h2>
                {plannerSceneTitle(
                  selected,
                  props.draft.scenes.findIndex(
                    (scene) => scene.id === selected.id
                  )
                )}
              </h2>
            </div>
            <button
              type="button"
              onClick={() =>
                props.mutate((current) => {
                  const scenes = normalizePlannerScenes(
                    current.scenes.filter((scene) => scene.id !== selected.id)
                  )
                  return {
                    ...current,
                    scenes,
                    selectedSceneId: scenes[0]?.id ?? null
                  }
                })
              }
            >
              {message('planner.sceneRemove')}
            </button>
          </header>
          <div className="planner-fields">
            <label>
              {message('planner.sceneTitle')}
              <input
                value={selected.title ?? ''}
                onChange={(event) =>
                  props.patchScene(selected.id, {
                    titleKind: 'authored',
                    title: event.target.value
                  })
                }
              />
            </label>
            <label>
              {message('planner.location')}
              <select
                value={selected.locationId ?? ''}
                onChange={(event) =>
                  props.patchScene(selected.id, {
                    locationId: event.target.value || null
                  })
                }
              >
                <option value="">{message('planner.noLocation')}</option>
                {props.workspace.availableLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="planner-notes-field">
              {message('planner.notes')}
              <textarea
                rows={5}
                value={selected.notes}
                onChange={(event) =>
                  props.patchScene(selected.id, { notes: event.target.value })
                }
              />
            </label>
          </div>

          <section className="planner-inspector-section">
            <header>
              <h3>{message('planner.encounterPlan')}</h3>
              {selected.encounterPlanId && (
                <button
                  type="button"
                  onClick={() =>
                    props.patchScene(selected.id, {
                      encounterPlanId: null,
                      allocatedXp: 0
                    })
                  }
                >
                  {message('planner.detach')}
                </button>
              )}
            </header>
            {props.selectedProjection?.encounter?.status === 'ready' ? (
              <EncounterSummary
                summary={props.selectedProjection.encounter.summary}
              />
            ) : selected.encounterPlanId ? (
              <p className="planner-unavailable">
                {message('planner.encounterUnavailable')}
              </p>
            ) : (
              <p className="planner-empty">{message('planner.noEncounter')}</p>
            )}
            <label className="planner-search-field">
              {message('planner.encounterSearch')}
              <input
                type="search"
                value={props.encounterQuery}
                placeholder={message('planner.encounterSearchPlaceholder')}
                onChange={(event) =>
                  props.setEncounterQuery(event.target.value)
                }
              />
            </label>
            <EncounterSearchResults
              state={props.encounterSearch}
              attach={(hit) => {
                props.patchScene(selected.id, {
                  encounterPlanId: hit.planId,
                  allocatedXp: hit.summary?.adjustedXp ?? 0
                })
                props.setEncounterQuery('')
              }}
            />
            {selected.encounterPlanId && (
              <label className="planner-allocation-field">
                {message('planner.allocation')}
                <input
                  type="number"
                  min={0}
                  value={selected.allocatedXp}
                  onChange={(event) =>
                    props.patchScene(selected.id, {
                      allocatedXp: Math.max(0, Number(event.target.value) || 0)
                    })
                  }
                />
              </label>
            )}
          </section>

          <section className="planner-inspector-section">
            <header>
              <h3>{message('planner.generatedRewards')}</h3>
              <span>
                {props.selectedProjection?.generatedRewards.length ?? 0}
              </span>
            </header>
            {props.selectedProjection?.generatedRewards.length ? (
              <div className="planner-reward-list">
                {props.selectedProjection.generatedRewards.map((reward) =>
                  reward.generatedTreasure ? (
                    <GeneratedRewardCard
                      key={`${reward.runId}:${reward.generatedTreasureId}`}
                      treasure={reward.generatedTreasure}
                      runId={reward.runId}
                      itemDefinitions={reward.itemDefinitions}
                      ordinal={reward.treasureOrdinal}
                      placed={reward.placedTreasure}
                      place={() =>
                        props.materializeReward(
                          reward.runId,
                          reward.generatedTreasureId,
                          generatedTreasureLabel(
                            reward.generatedTreasure!,
                            reward.treasureOrdinal
                          ),
                          false,
                          reward.placedTreasure
                        )
                      }
                      edit={() =>
                        props.materializeReward(
                          reward.runId,
                          reward.generatedTreasureId,
                          generatedTreasureLabel(
                            reward.generatedTreasure!,
                            reward.treasureOrdinal
                          ),
                          true,
                          reward.placedTreasure
                        )
                      }
                      distribute={() =>
                        reward.placedTreasure &&
                        props.distribute(reward.placedTreasure)
                      }
                    />
                  ) : (
                    <article
                      className="planner-reward-card unavailable"
                      key={`${reward.runId}:${reward.generatedTreasureId}`}
                    >
                      <strong>
                        {generatedRewardLabel(
                          reward.rewardChannel,
                          reward.anchorEncounterNumber,
                          reward.treasureOrdinal
                        )}
                      </strong>
                      <p>{message('planner.generatedMissing')}</p>
                    </article>
                  )
                )}
              </div>
            ) : (
              <p className="planner-empty">
                {message('planner.generatedEmpty')}
              </p>
            )}
          </section>

          <section className="planner-inspector-section">
            <header>
              <h3>{message('planner.manualNotes')}</h3>
              <button
                type="button"
                onClick={() =>
                  props.patchScene(selected.id, {
                    manualLootNotes: [
                      ...selected.manualLootNotes,
                      {
                        id: crypto.randomUUID(),
                        text: message('planner.newNote'),
                        position: selected.manualLootNotes.length
                      }
                    ]
                  })
                }
              >
                {message('planner.noteAdd')}
              </button>
            </header>
            <div className="planner-manual-notes">
              {selected.manualLootNotes.map((note, position) => (
                <div key={note.id}>
                  <textarea
                    aria-label={formatMessage('planner.lootNoteLabel', {
                      number: position + 1
                    })}
                    value={note.text}
                    onChange={(event) =>
                      props.patchScene(selected.id, {
                        manualLootNotes: selected.manualLootNotes.map(
                          (candidate) =>
                            candidate.id === note.id
                              ? { ...candidate, text: event.target.value }
                              : candidate
                        )
                      })
                    }
                  />
                  <button
                    type="button"
                    aria-label={formatMessage('planner.lootNoteRemove', {
                      number: position + 1
                    })}
                    onClick={() =>
                      props.patchScene(selected.id, {
                        manualLootNotes: selected.manualLootNotes
                          .filter((candidate) => candidate.id !== note.id)
                          .map((candidate, notePosition) => ({
                            ...candidate,
                            position: notePosition
                          }))
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="planner-empty-inspector">
          <p className="section-kicker">{message('planner.title')}</p>
          <h2>{message('planner.selectScene')}</h2>
          <p>{message('planner.selectSceneHint')}</p>
        </div>
      )}
    </div>
  )
}

function EncounterSummary(props: { summary: SavedEncounterPlanSummary }) {
  return (
    <article className="planner-encounter-summary">
      <strong>{encounterPlanTitle(props.summary)}</strong>
      <span>
        {props.summary.difficulty} · {props.summary.adjustedXp} EP ·{' '}
        {formatMessage('planner.creatureCount', {
          count: props.summary.creatureCount
        })}
      </span>
      <p>{encounterRosterText(props.summary)}</p>
    </article>
  )
}

function EncounterSearchResults(props: {
  state: EncounterSearchState
  attach: (hit: EncounterSearchHit) => void
}) {
  if (props.state.status === 'idle') return null
  if (props.state.status === 'searching')
    return <p role="status">{message('planner.searching')}</p>
  if (props.state.status === 'failed')
    return <p role="alert">{message('planner.searchFailed')}</p>
  if (props.state.status !== 'ready') return null
  if (props.state.hits.length === 0)
    return <p className="planner-empty">{message('planner.searchEmpty')}</p>
  return (
    <div className="planner-search-results">
      {props.state.hits.map((hit) => (
        <button
          key={hit.planId}
          type="button"
          onClick={() => props.attach(hit)}
        >
          <strong>{encounterPlanTitle(hit)}</strong>
          <small>
            {hit.summary
              ? encounterSummaryText(hit.summary)
              : encounterRosterText(hit)}
          </small>
        </button>
      ))}
      {props.state.hasMore && <small>{message('planner.searchMore')}</small>}
    </div>
  )
}

function GeneratedRewardCard(props: {
  runId: string
  itemDefinitions: SessionPlannerWorkspace['session']['scenes'][number]['generatedRewards'][number]['itemDefinitions']
  treasure: GeneratedTreasure
  ordinal: number
  placed: Treasure | null
  place: () => void
  edit: () => void
  distribute: () => void
}) {
  const remaining = props.placed?.items.reduce(
    (sum, item) => sum + item.quantity - item.allocatedQuantity,
    0
  )
  return (
    <article className="planner-reward-card">
      <header>
        <div>
          <strong>
            {generatedTreasureLabel(props.treasure, props.ordinal)}
          </strong>
          <small>
            {channelLabel(props.treasure.rewardChannel)} ·{' '}
            {formatCopper(props.treasure.actualValueCp)}
          </small>
        </div>
        <span className={props.placed ? 'placed' : ''}>
          {props.placed
            ? remaining === 0
              ? message('loot.distributionDone')
              : formatMessage('loot.unitsOpen', { count: remaining ?? 0 })
            : message('loot.notPlaced')}
        </span>
      </header>
      <ul>
        {props.treasure.items.map((item) => {
          const definition = generatedItemDefinitionFromList(
            props.runId,
            props.itemDefinitions,
            item
          )
          return (
            <li key={item.id}>
              <span>
                {item.quantity}× {definition.name}
              </span>
              <small>
                {definition.magic
                  ? formatMessage('loot.magicRarity', {
                      rarity: definition.rarity ?? message('loot.generated')
                    })
                  : formatCopper(item.quantity * definition.unitValueCp)}
                {definition.curse
                  ? ` · ${formatMessage('loot.curseNamed', {
                      name: definition.curse.name
                    })}`
                  : ''}
              </small>
            </li>
          )
        })}
      </ul>
      {props.treasure.containers.length > 0 && (
        <p className="planner-packing">
          {formatMessage('loot.packing', {
            containers: props.treasure.containers
              .map((container) => container.name)
              .join(', ')
          })}
        </p>
      )}
      <footer>
        {!props.placed && (
          <button type="button" onClick={props.place}>
            {message('loot.placeUnassigned')}
          </button>
        )}
        <button type="button" onClick={props.edit}>
          {props.placed
            ? message('loot.edit')
            : message('loot.editBeforePlace')}
        </button>
        {props.placed && remaining !== 0 && (
          <button type="button" onClick={props.distribute}>
            {message('loot.distribute')}
          </button>
        )}
      </footer>
    </article>
  )
}

function channelLabel(channel: GeneratedTreasure['rewardChannel']): string {
  return channel === 'encounter'
    ? message('planner.channelEncounter')
    : channel === 'quest'
      ? message('planner.channelQuest')
      : message('planner.channelEnvironment')
}
