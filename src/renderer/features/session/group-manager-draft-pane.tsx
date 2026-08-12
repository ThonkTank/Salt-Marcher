import { lazy, Suspense } from 'react'
import { formatInteger } from '../../i18n/domain-formatters.de.js'
import {
  formatMessage,
  message as uiMessage
} from '../../i18n/session-runtime.de.js'
import type { DraftCreatureFact, GroupDraftState } from './group-draft.js'
import { GroupDraftEvaluation } from './group-draft-evaluation.js'
import type { GroupManagerController } from './use-group-manager-controller.js'
import type { GroupWorkspaceMode } from './group-manager-state.js'

const LazyGroupLootInlinePanel = lazy(async () => {
  const module = await import('../loot/group-loot-inline-panel.js')
  return { default: module.GroupLootInlinePanel }
})

type DraftEntry = Readonly<{
  creatureId: string
  quantity: number
  deadQuantity: number
}>

type LootDraftController = Pick<
  GroupManagerController['loot'],
  | 'run'
  | 'draft'
  | 'phase'
  | 'error'
  | 'issues'
  | 'canUndo'
  | 'canRedo'
  | 'generate'
  | 'patchLabel'
  | 'patchItem'
  | 'removeItem'
  | 'patchContainer'
  | 'removeContainer'
  | 'undo'
  | 'redo'
  | 'beginEdit'
  | 'endEdit'
>

export function GroupManagerDraftPane(props: {
  mode: GroupWorkspaceMode
  modeChanged: (mode: GroupWorkspaceMode) => void
  lootAvailable: boolean
  active: boolean
  name: string
  note: string
  message: string
  externalConflict: boolean
  entries: readonly DraftEntry[]
  facts: Readonly<Record<string, DraftCreatureFact>>
  evaluation: GroupDraftState['evaluation']
  canUndoRoster: boolean
  canRedoRoster: boolean
  canGenerateLoot: boolean
  loot: LootDraftController
  moveRosterHistory: (direction: 'undo-roster' | 'redo-roster') => void
  changeQuantity: (
    creatureId: string,
    delta: number,
    kind?: 'alive' | 'dead'
  ) => void
  removeCreature: (creatureId: string) => void
  retryLoot: () => void
  rerollLoot: () => void
  commitLoot: () => void
  noteChanged: (note: string) => void
}) {
  return (
    <section
      className="group-manager-draft-rim"
      aria-label={uiMessage('ui.aktuelle.gruppe')}
    >
      <div className="group-manager-draft-sheet">
        <div
          className="group-workspace-mode-tabs"
          role="tablist"
          aria-label={uiMessage('loot.workspaceMode')}
        >
          <button
            type="button"
            role="tab"
            aria-selected={props.mode === 'group'}
            onClick={() => props.modeChanged('group')}
          >
            {uiMessage('loot.workspaceGroup')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={props.mode === 'loot'}
            disabled={!props.lootAvailable}
            onClick={() => props.modeChanged('loot')}
          >
            {uiMessage('loot.workspaceLoot')}
          </button>
        </div>
        {props.mode === 'group' && (
          <GroupDraftEvaluation
            evaluation={props.evaluation}
            canUndo={props.canUndoRoster}
            canRedo={props.canRedoRoster}
            undo={() => props.moveRosterHistory('undo-roster')}
            redo={() => props.moveRosterHistory('redo-roster')}
          />
        )}
        <div
          className="group-draft-scroll"
          tabIndex={0}
          aria-label={
            props.mode === 'group'
              ? uiMessage('ui.aktuelle.gruppe')
              : uiMessage('loot.workspaceLoot')
          }
        >
          {props.externalConflict && (
            <p className="group-draft-message" role="alert">
              {uiMessage('group.externalConflict')}
            </p>
          )}
          {props.mode === 'loot' && props.active ? (
            <Suspense fallback={null}>
              <LazyGroupLootInlinePanel
                groupName={props.name}
                run={props.loot.run}
                draft={props.loot.draft}
                phase={props.loot.phase}
                error={props.loot.error}
                issues={props.loot.issues}
                canGenerate={props.canGenerateLoot}
                canUndo={props.loot.canUndo}
                canRedo={props.loot.canRedo}
                generate={() => void props.loot.generate()}
                retry={props.retryLoot}
                reroll={props.rerollLoot}
                commit={props.commitLoot}
                patchLabel={props.loot.patchLabel}
                patchItem={props.loot.patchItem}
                removeItem={props.loot.removeItem}
                patchContainer={props.loot.patchContainer}
                removeContainer={props.loot.removeContainer}
                undo={props.loot.undo}
                redo={props.loot.redo}
                beginEdit={props.loot.beginEdit}
                endEdit={props.loot.endEdit}
              />
            </Suspense>
          ) : !props.active ? (
            <p className="session-group-empty">
              {uiMessage('ui.waehle.eine.gruppe.aus.oder.lege.eine.neue')}
            </p>
          ) : props.entries.length === 0 ? (
            <p className="session-group-empty">
              {uiMessage('ui.monster.links.mit')} <strong>+</strong>{' '}
              {uiMessage('ui.hinzufuegen.oder.eine.gruppe.generieren')}
            </p>
          ) : (
            <ul className="creature-collection-roster">
              {props.entries.map((entry) => {
                const fact = props.facts[entry.creatureId]
                const displayName = fact?.displayName ?? entry.creatureId
                return (
                  <li
                    key={entry.creatureId}
                    className={fact?.available === false ? 'unavailable' : ''}
                  >
                    <span>
                      <strong>{displayName}</strong>
                      <small>
                        {uiMessage('ui.cr')} {fact?.cr ?? '—'} ·{' '}
                        {formatInteger(fact?.xp ?? 0)} {uiMessage('ui.xp.2')}
                        {fact?.available === false
                          ? ` · ${uiMessage('group.unavailable')}`
                          : ''}
                      </small>
                    </span>
                    <div className="group-roster-counts">
                      <QuantityControl
                        label={uiMessage('group.alive')}
                        value={entry.quantity}
                        decreaseLabel={formatMessage('group.decreaseAlive', {
                          name: displayName
                        })}
                        increaseLabel={formatMessage('group.increaseAlive', {
                          name: displayName
                        })}
                        decrease={() =>
                          props.changeQuantity(entry.creatureId, -1)
                        }
                        increase={() =>
                          props.changeQuantity(entry.creatureId, 1)
                        }
                      />
                      <QuantityControl
                        label={uiMessage('group.dead')}
                        value={entry.deadQuantity}
                        decreaseLabel={formatMessage('group.decreaseDead', {
                          name: displayName
                        })}
                        increaseLabel={formatMessage('group.increaseDead', {
                          name: displayName
                        })}
                        decrease={() =>
                          props.changeQuantity(entry.creatureId, -1, 'dead')
                        }
                        increase={() =>
                          props.changeQuantity(entry.creatureId, 1, 'dead')
                        }
                      />
                    </div>
                    <button
                      className="remove"
                      type="button"
                      aria-label={formatMessage('group.removeCreature', {
                        name: displayName
                      })}
                      onClick={() => props.removeCreature(entry.creatureId)}
                    >
                      ×
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {props.mode === 'group' && props.message && (
            <p className="group-draft-message" role="status">
              {props.message}
            </p>
          )}
        </div>
        {props.mode === 'group' && (
          <label className="group-manager-note">
            <span>{uiMessage('group.note')}</span>
            <textarea
              aria-label={uiMessage('group.note')}
              maxLength={1000}
              rows={2}
              disabled={!props.active}
              value={props.note}
              onChange={(event) => props.noteChanged(event.target.value)}
            />
          </label>
        )}
      </div>
    </section>
  )
}

function QuantityControl(props: {
  label: string
  value: number
  decreaseLabel: string
  increaseLabel: string
  decrease: () => void
  increase: () => void
}) {
  return (
    <div className="creature-collection-quantity">
      <small>{props.label}</small>
      <button
        type="button"
        aria-label={props.decreaseLabel}
        onClick={props.decrease}
      >
        −
      </button>
      <strong>{props.value}</strong>
      <button
        type="button"
        aria-label={props.increaseLabel}
        onClick={props.increase}
      >
        +
      </button>
    </div>
  )
}
