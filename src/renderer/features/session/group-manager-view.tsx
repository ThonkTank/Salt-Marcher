import type { KeyboardEvent, ReactNode } from 'react'
import type { SceneGroupDisposition } from '../../../shared/contracts/scene.js'
import {
  formatMessage,
  message as uiMessage
} from '../../i18n/session-runtime.de.js'
import { CreatureCollectionManagerDialog } from '../creature-collection/creature-collection.js'
import { DiscardChangesDialog } from '../../shell/modal-dialog.js'
import { newGroupDraftKey } from './group-draft.js'
import {
  GroupManagerCatalogPane,
  GroupManagerCatalogTools
} from './group-manager-catalog.js'
import { GroupManagerDraftPane } from './group-manager-draft-pane.js'
import type { GroupManagerController } from './use-group-manager-controller.js'
import { groupManagerHistoryShortcut } from './group-manager-shortcuts.js'
import './session-dialogs.css'
import './group-dialog-frame.css'
import './group-dialog-generator.css'
import './group-dialog-draft.css'
import './group-dialog-footer.css'

export function GroupManagerView(props: {
  controller: GroupManagerController
}) {
  const controller = props.controller
  const { state, group, loot } = controller
  const totalInDraft = Object.fromEntries(
    Array.from(
      new Set([
        ...Object.keys(group.quantities),
        ...Object.keys(group.deadQuantities)
      ])
    ).map((id) => [
      id,
      (group.quantities[id] ?? 0) + (group.deadQuantities[id] ?? 0)
    ])
  )
  const filteredCount = state.creatureCatalog.page?.total ?? 0
  const filterSummary = formatMessage('group.catalogCount', {
    filtered: filteredCount,
    total: state.creatureCatalog.total
  })
  const catalogFooterStatus = [
    state.creatureCatalog.page?.message ||
      formatMessage('group.filteredMonsters', { count: filteredCount }),
    group.generationSummary
  ]
    .filter(Boolean)
    .join(' · ')
  const sceneContext = [
    controller.focused.title,
    controller.focused.locationName
  ]
    .filter(Boolean)
    .join(' · ')
  const levelContext = controller.assigned
    .map((member) => member.level?.toString() ?? '—')
    .join(' / ')
  const keyboard = (event: KeyboardEvent): void => {
    const direction = groupManagerHistoryShortcut({
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      editable: isEditableTarget(event.target)
    })
    if (!direction) return
    event.preventDefault()
    if (state.workspaceMode === 'loot') {
      if (direction === 'redo') loot.redo()
      else loot.undo()
    } else
      controller.moveRosterHistory(
        direction === 'redo' ? 'redo-roster' : 'undo-roster'
      )
  }

  return (
    <>
      <CreatureCollectionManagerDialog
        className="group-dialog session-group-manager"
        headerClassName="group-manager-header"
        toolsClassName="group-manager-tools"
        layoutClassName="group-manager-workspace"
        footerClassName="group-manager-footer"
        title={uiMessage('ui.gruppen.managen')}
        titleId="group-builder-title"
        heading={<GroupManagerHeading />}
        closeLabel={uiMessage('ui.dialog.schliessen')}
        closeClassName="close"
        close={controller.close}
        busy={controller.busy}
        onKeyDown={keyboard}
        toolsLabel={uiMessage('group.tools')}
        headerControls={
          <GroupManagerHeader
            controller={controller}
            sceneContext={sceneContext}
          />
        }
        tools={
          <GroupManagerCatalogTools
            mode={controller.effectiveCatalogMode}
            lootAvailable={Boolean(loot.run)}
            query={state.creatureCatalog.query}
            options={state.creatureCatalog.options}
            searchBiomeOptions={controller.searchBiomeOptions}
            queryChanged={controller.setCreatureQuery}
            modeChanged={controller.setCatalogMode}
            filterSummary={filterSummary}
            busy={controller.busy}
            canGenerate={controller.canGenerate}
            generate={controller.generateRoster}
          />
        }
        catalog={
          <GroupManagerCatalogPane
            mode={controller.effectiveCatalogMode}
            lootAvailable={Boolean(loot.run)}
            query={state.creatureCatalog.query}
            options={state.creatureCatalog.options}
            page={state.creatureCatalog.page}
            queryChanged={controller.setCreatureQuery}
            addCreature={controller.addCreature}
            inspectCreature={(creature) =>
              void controller.inspectCreature(creature)
            }
            quantities={totalInDraft}
            footerStatus={catalogFooterStatus}
            lootQuery={state.lootCatalog.query}
            lootPage={state.lootCatalog.page}
            lootError={state.lootCatalog.error}
            lootQueryChanged={controller.setLootQuery}
          />
        }
        divider={{
          kind: 'resizable',
          value: state.draftPaneWidth,
          minimum: 400,
          maximum: 620,
          label: uiMessage('group.draftWidth'),
          changed: controller.setDraftPaneWidth
        }}
        draft={
          <GroupManagerDraftPane
            mode={state.workspaceMode}
            modeChanged={controller.setWorkspaceMode}
            lootAvailable={controller.active}
            active={controller.active}
            name={group.name}
            note={group.note}
            message={group.message}
            externalConflict={Boolean(controller.session?.externalConflict)}
            entries={controller.entries}
            facts={group.facts}
            evaluation={group.evaluation}
            canUndoRoster={group.history.past.length > 0}
            canRedoRoster={group.history.future.length > 0}
            canGenerateLoot={controller.canGenerateLoot}
            loot={loot}
            moveRosterHistory={controller.moveRosterHistory}
            changeQuantity={controller.changeQuantity}
            removeCreature={controller.removeCreature}
            retryLoot={loot.retry}
            rerollLoot={loot.reroll}
            commitLoot={loot.commit}
            noteChanged={controller.setNote}
          />
        }
        footer={
          <GroupManagerFooter
            controller={controller}
            levelContext={levelContext}
          />
        }
      />
      {state.pendingIntent && (
        <DiscardChangesDialog
          message={
            state.pendingIntent.guard === 'all-drafts'
              ? uiMessage('ui.ungespeicherte.aenderungen.verwerfen')
              : uiMessage('loot.discardQuestion')
          }
          cancelLabel={uiMessage('action.cancel')}
          discardLabel={uiMessage('ui.aenderungen.verwerfen')}
          onCancel={controller.cancelPendingIntent}
          onDiscard={controller.confirmPendingIntent}
        />
      )}
    </>
  )
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.matches('input, textarea, select') || target.isContentEditable)
  )
}

function GroupManagerHeading() {
  return (
    <div className="title-group">
      <span className="illuminated-initial" aria-hidden="true">
        {uiMessage('ui.gruppen.managen').charAt(0)}
      </span>
      <h2 id="group-builder-title">
        {uiMessage('ui.gruppen.managen').slice(1)}
      </h2>
    </div>
  )
}

function GroupManagerHeader(props: {
  controller: GroupManagerController
  sceneContext: string
}): ReactNode {
  const { controller } = props
  return (
    <>
      <span className="scene-crumb" title={props.sceneContext}>
        {props.sceneContext}
      </span>
      <select
        className="group-manager-selection"
        aria-label={uiMessage('group.select')}
        value={controller.selection ?? ''}
        onChange={(event) => controller.activate(event.target.value || null)}
      >
        <option value="">{uiMessage('group.selectPlaceholder')}</option>
        {controller.activeGroups.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name}
            {controller.groupInCombat(candidate.id)
              ? ` · ${uiMessage('encounter.inCombat')}`
              : ''}
          </option>
        ))}
        <option value={newGroupDraftKey}>
          {uiMessage('group.createTitle')}
        </option>
      </select>
      <button
        className="group-manager-new"
        type="button"
        onClick={() => controller.activate(newGroupDraftKey)}
      >
        + {uiMessage('group.createTitle')}
      </button>
      <input
        className="group-manager-name"
        aria-label={uiMessage('ui.gruppenname')}
        placeholder={uiMessage('group.name.placeholder')}
        maxLength={100}
        disabled={!controller.active}
        value={controller.group.name}
        onChange={(event) => controller.setName(event.target.value)}
      />
      <select
        className="group-manager-disposition"
        aria-label={uiMessage('group.disposition')}
        disabled={!controller.active}
        value={controller.group.disposition}
        onChange={(event) =>
          controller.setDisposition(event.target.value as SceneGroupDisposition)
        }
      >
        <option value="hostile">
          {uiMessage('group.disposition.hostile')}
        </option>
        <option value="neutral">
          {uiMessage('group.disposition.neutral')}
        </option>
        <option value="allied">{uiMessage('group.disposition.allied')}</option>
      </select>
    </>
  )
}

function GroupManagerFooter(props: {
  controller: GroupManagerController
  levelContext: string
}) {
  const { controller } = props
  return (
    <>
      <span>
        {controller.focused.locationName || uiMessage('ui.kein.ort.gesetzt')} ·{' '}
        {controller.assigned.length} {uiMessage('ui.zugewiesene.pcs')}
        {controller.assigned.length > 0
          ? ` · ${uiMessage('group.levels')} ${props.levelContext}`
          : ''}
        {controller.anyDirty ? ` · ${uiMessage('group.unsaved')}` : ''}
      </span>
      <div>
        {controller.canJoinCombat && (
          <button
            type="button"
            disabled={controller.busy || controller.dirty}
            onClick={controller.joinCombat}
          >
            {uiMessage('encounter.joinCombat')}
          </button>
        )}
        {controller.selectedPersistedGroup && (
          <button
            className="danger"
            type="button"
            disabled={controller.busy}
            onClick={controller.archive}
          >
            {uiMessage('group.archive')}
          </button>
        )}
        <button className="secondary" type="button" onClick={controller.close}>
          {uiMessage('action.cancel')}
        </button>
        <button
          className="primary-action"
          type="button"
          disabled={controller.busy || !controller.active}
          onClick={controller.save}
        >
          {uiMessage('action.save')}
        </button>
      </div>
    </>
  )
}
