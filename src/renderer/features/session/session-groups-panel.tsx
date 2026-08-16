import { useState } from 'react'
import type {
  LiveSessionSnapshot,
  SceneGroupCommandResult
} from '../../../shared/contracts/live-session.js'
import type {
  SceneGroup,
  SceneSnapshot
} from '../../../shared/contracts/scene.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { message } from '../../i18n/session-runtime.de.js'
import { ScenePartyCard } from './scene-party-card.js'
import { SessionGroupCard } from './session-group-card.js'
import './session-groups-panel.css'
import { sessionCapabilities } from './session-capabilities.js'
import { applySceneGroupCommandResult } from './session-patches.js'
import type {
  LootSceneProjection,
  LootInboxPage,
  Treasure,
  TreasureAnchor
} from '../../../shared/contracts/loot.js'
import { LootTreasureCard } from '../loot/loot-treasure-card.js'

type RunningScene = SceneSnapshot['scenes'][number]

export function SessionGroupsPanel(props: {
  snapshot: LiveSessionSnapshot
  loot: LootSceneProjection
  lootInbox: LootInboxPage
  lootInboxOpen: boolean
  openLootInbox: () => void
  loadMoreLoot: () => void
  focused: RunningScene
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  onError: (message: string) => void
  inspect: (creatureId: string, groupName: string) => void
  edit: (group: SceneGroup) => void
  distribute: (treasure: Treasure) => void
  createLoot: (anchor: TreasureAnchor) => void
  editLoot: (treasure: Treasure) => void
}) {
  const api = useCapabilityApi()
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null)
  const [expandedByScene, setExpandedByScene] = useState<
    Record<string, string | null>
  >({})
  const activeGroups = props.focused.groups.filter((group) => !group.archived)
  const storedExpansion = expandedByScene[props.focused.id]
  const hasStoredExpansion = Object.prototype.hasOwnProperty.call(
    expandedByScene,
    props.focused.id
  )
  const expansionIsValid =
    storedExpansion === null ||
    storedExpansion === 'party' ||
    props.focused.groups.some((group) => group.id === storedExpansion)
  const expandedRow =
    hasStoredExpansion && expansionIsValid
      ? storedExpansion
      : (activeGroups[0]?.id ?? 'party')
  const toggleRow = (rowId: string) =>
    setExpandedByScene((current) => ({
      ...current,
      [props.focused.id]: expandedRow === rowId ? null : rowId
    }))
  const groupLoot = new Map(
    props.loot.groupTreasures.map((entry) => [entry.groupId, entry.treasures])
  )
  const mutateGroup = async (
    operation: () => Promise<SceneGroupCommandResult>
  ) => {
    try {
      props.setSnapshot(
        applySceneGroupCommandResult(props.snapshot, await operation())
      )
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }
  return (
    <section className="session-groups" aria-label={message('ui.gruppen')}>
      <div className="groups-heading">
        <h2>{message('ui.gruppen')}</h2>
      </div>
      <div className="group-register">
        <GroupRegisterHeading />
        <ScenePartyCard
          snapshot={props.snapshot}
          sceneId={props.focused.id}
          setSnapshot={props.setSnapshot}
          onError={props.onError}
          expanded={expandedRow === 'party'}
          toggle={() => toggleRow('party')}
        />
        {activeGroups.map((group) => (
          <SessionGroupCard
            key={group.id}
            group={group}
            expanded={expandedRow === group.id}
            toggle={() => toggleRow(group.id)}
            inspect={(creatureId) => props.inspect(creatureId, group.name)}
            edit={() => props.edit(group)}
            treasures={groupLoot.get(group.id) ?? []}
            distribute={props.distribute}
            editLoot={props.editLoot}
            createLoot={() =>
              props.createLoot({
                kind: 'group',
                sceneId: props.focused.id,
                groupId: group.id,
                lastKnownLabel: group.name
              })
            }
          />
        ))}
      </div>
      {props.focused.locationId && (
        <section className="location-loot-section">
          <header>
            <div>
              <p className="section-kicker">{message('loot.locationKicker')}</p>
              <h3>{props.focused.locationName}</h3>
            </div>
            <button
              type="button"
              onClick={() =>
                props.createLoot({
                  kind: 'location',
                  locationId: props.focused.locationId!,
                  lastKnownLabel: props.focused.locationName
                })
              }
            >
              {message('loot.add')}
            </button>
          </header>
          {props.loot.locationTreasures.length === 0 ? (
            <p className="session-empty-state">
              {message('loot.locationEmpty')}
            </p>
          ) : (
            props.loot.locationTreasures.map((treasure) => (
              <LootTreasureCard
                key={treasure.id}
                treasure={treasure}
                distribute={props.distribute}
                edit={props.editLoot}
              />
            ))
          )}
        </section>
      )}
      {!props.lootInboxOpen && (
        <button type="button" onClick={props.openLootInbox}>
          {message('loot.inboxOpen')}
        </button>
      )}
      {props.lootInbox.entries.some((entry) => entry.reason === 'unplaced') && (
        <section className="location-loot-section unplaced-loot-section">
          <header>
            <div>
              <p className="section-kicker">{message('loot.unplaced')}</p>
              <h3>{message('loot.unplacedTitle')}</h3>
            </div>
          </header>
          {props.lootInbox.entries
            .filter((entry) => entry.reason === 'unplaced')
            .map(({ treasure }) => (
              <LootTreasureCard
                key={treasure.id}
                treasure={treasure}
                distribute={props.distribute}
                edit={props.editLoot}
              />
            ))}
        </section>
      )}
      {props.lootInbox.entries.some((entry) => entry.reason !== 'unplaced') && (
        <section className="location-loot-section unresolved-loot-section">
          <header>
            <div>
              <p className="section-kicker">
                {message('loot.unresolvedKicker')}
              </p>
              <h3>{message('loot.unresolvedTitle')}</h3>
            </div>
          </header>
          {props.lootInbox.entries
            .filter((entry) => entry.reason !== 'unplaced')
            .map((entry) => (
              <LootTreasureCard
                key={entry.treasure.id}
                treasure={entry.treasure}
                fallbackLabel={entry.lastKnownLabel ?? undefined}
                distribute={props.distribute}
                edit={props.editLoot}
              />
            ))}
        </section>
      )}
      {props.lootInbox.nextCursor && (
        <button type="button" onClick={props.loadMoreLoot}>
          {message('loot.inboxMore')}
        </button>
      )}
      {props.focused.groups.some((group) => group.archived) && (
        <div className="inactive-groups">
          <h3>{message('group.inactive')}</h3>
          <div className="group-register archived-group-register">
            <GroupRegisterHeading />
            {props.focused.groups
              .filter((group) => group.archived)
              .map((group) => (
                <SessionGroupCard
                  key={group.id}
                  group={group}
                  expanded={expandedRow === group.id}
                  toggle={() => toggleRow(group.id)}
                  inspect={(creatureId) =>
                    props.inspect(creatureId, group.name)
                  }
                  restore={() =>
                    void mutateGroup(() =>
                      sessionCapabilities(api).scene.setGroupArchived(
                        props.focused.id,
                        group.id,
                        false,
                        group.revision
                      )
                    )
                  }
                  deleteRequested={() => setDeleteGroupId(group.id)}
                  deleteConfirming={deleteGroupId === group.id}
                  cancelDelete={() => setDeleteGroupId(null)}
                  deleteGroup={() => {
                    setDeleteGroupId(null)
                    void mutateGroup(() =>
                      sessionCapabilities(api).scene.deleteGroup(
                        props.focused.id,
                        group.id,
                        group.revision
                      )
                    )
                  }}
                  treasures={groupLoot.get(group.id) ?? []}
                  distribute={props.distribute}
                  editLoot={props.editLoot}
                />
              ))}
          </div>
        </div>
      )}
    </section>
  )
}

function GroupRegisterHeading() {
  return (
    <div className="register-head" aria-hidden="true">
      <span />
      <span>{message('ui.gruppe')}</span>
      <span>{message('ui.zahl')}</span>
      <span>{message('ui.xp.2')}</span>
      <span />
    </div>
  )
}
