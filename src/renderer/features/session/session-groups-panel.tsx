import { message } from '../../i18n/session-runtime.de.js'
import { LootTreasureCard } from '../loot/loot-treasure-card.js'
import type {
  SessionGroupsViewModel,
  SessionLootRow,
  SessionWorkspaceActions
} from './session-workspace-model.js'
import './session-groups-panel.css'

function LootSection(props: {
  kicker: string
  title: string
  rows: readonly SessionLootRow[]
  actions: SessionWorkspaceActions
  className?: string
  empty?: string
  add?: () => void
}) {
  return (
    <section className={`location-loot-section ${props.className ?? ''}`}>
      <header>
        <div>
          <p className="section-kicker">{props.kicker}</p>
          <h3>{props.title}</h3>
        </div>
        {props.add && (
          <button type="button" onClick={props.add}>
            {message('loot.add')}
          </button>
        )}
      </header>
      {props.rows.length === 0 && props.empty ? (
        <p className="session-empty-state">{props.empty}</p>
      ) : (
        props.rows.map((row) => (
          <LootTreasureCard
            key={row.treasure.id}
            treasure={row.treasure}
            fallbackLabel={row.fallbackLabel}
            distribute={props.actions.distribute}
            edit={props.actions.editLoot}
          />
        ))
      )}
    </section>
  )
}

export function SessionLootPanel(props: {
  model: SessionGroupsViewModel
  actions: SessionWorkspaceActions
}) {
  const unplaced = props.model.inboxLoot.filter(
    (row) => row.placement === 'unplaced'
  )
  const unresolved = props.model.inboxLoot.filter(
    (row) => row.placement === 'unresolved'
  )
  return (
    <>
      {props.model.scene.locationId && (
        <LootSection
          kicker={message('loot.locationKicker')}
          title={props.model.scene.locationName}
          rows={props.model.locationLoot}
          empty={message('loot.locationEmpty')}
          add={() =>
            props.actions.createLoot({
              kind: 'location',
              locationId: props.model.scene.locationId!,
              lastKnownLabel: props.model.scene.locationName
            })
          }
          actions={props.actions}
        />
      )}
      {!props.model.inboxOpen && (
        <button type="button" onClick={props.actions.openLootInbox}>
          {message('loot.inboxOpen')}
        </button>
      )}
      {unplaced.length > 0 && (
        <LootSection
          className="unplaced-loot-section"
          kicker={message('loot.unplaced')}
          title={message('loot.unplacedTitle')}
          rows={unplaced}
          actions={props.actions}
        />
      )}
      {unresolved.length > 0 && (
        <LootSection
          className="unresolved-loot-section"
          kicker={message('loot.unresolvedKicker')}
          title={message('loot.unresolvedTitle')}
          rows={unresolved}
          actions={props.actions}
        />
      )}
      {props.model.inbox.nextCursor && (
        <button type="button" onClick={props.actions.loadMoreLoot}>
          {message('loot.inboxMore')}
        </button>
      )}
    </>
  )
}
