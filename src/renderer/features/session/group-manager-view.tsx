import type { KeyboardEvent } from 'react'
import type { SceneGroupDisposition } from '../../../shared/contracts/scene.js'
import { message } from '../../i18n/session-runtime.de.js'
import { CreatureCollectionManagerDialog } from '../creature-collection/creature-collection.js'
import { DiscardChangesDialog } from '../../shell/modal-dialog.js'
import { GroupEditorCatalog } from './group-editor-catalog.js'
import { GroupEditorSelection } from './group-editor-selection.js'
import type { GroupManagerController } from './use-group-manager-controller.js'
import { groupManagerHistoryShortcut } from './group-manager-shortcuts.js'
import './session-dialogs.css'
import './group-editor.css'

export function GroupManagerView({
  controller: c
}: {
  controller: GroupManagerController
}) {
  const keyboard = (event: KeyboardEvent) => {
    const target = event.target
    const direction = groupManagerHistoryShortcut({
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      editable:
        target instanceof HTMLElement &&
        (target.matches('input,textarea,select') || target.isContentEditable)
    })
    if (!direction || c.busy) return
    event.preventDefault()
    if (c.state.workspaceMode === 'loot') {
      if (direction === 'redo') c.loot.redo()
      else c.loot.undo()
    } else
      c.moveRosterHistory(direction === 'redo' ? 'redo-roster' : 'undo-roster')
  }
  return (
    <>
      <CreatureCollectionManagerDialog
        className="group-dialog session-group-manager group-editor"
        title={
          c.selectedPersistedGroup
            ? message('ui.gruppen.managen')
            : message('group.createTitle')
        }
        titleId="group-builder-title"
        closeLabel={message('ui.dialog.schliessen')}
        close={c.close}
        busy={c.busy}
        onKeyDown={keyboard}
        headerControls={
          <>
            <span className="group-editor-context">
              {[c.focused.title, c.focused.locationName]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <input
              aria-label={message('ui.gruppenname')}
              placeholder={message('group.name.placeholder')}
              maxLength={100}
              value={c.group.name}
              disabled={c.busy}
              onChange={(e) => c.setName(e.target.value)}
            />
          </>
        }
        tools={
          <>
            <div className="group-editor-line">
              <div role="tablist" aria-label={message('loot.catalogMode')}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={c.state.workspaceMode === 'group'}
                  onClick={() => c.setWorkspaceMode('group')}
                >
                  {message('ui.monster')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={c.state.workspaceMode === 'loot'}
                  onClick={() => c.setWorkspaceMode('loot')}
                >
                  {message('loot.catalogLoot')}
                </button>
              </div>
              <div className="group-editor-generation">
                {c.state.workspaceMode === 'group' ? (
                  <>
                    <button
                      type="button"
                      disabled={c.busy || !c.canGenerate}
                      onClick={() => c.generateRoster('fill')}
                    >
                      {message('ui.auffuellen')}
                    </button>
                    <button
                      type="button"
                      disabled={c.busy || !c.canGenerate}
                      onClick={() => c.generateRoster('replace')}
                    >
                      {message('ui.neu.generieren')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={c.busy || !c.canGenerateLoot}
                    onClick={c.loot.reroll}
                  >
                    {message('groupEditor.generateLoot')}
                  </button>
                )}
              </div>
            </div>
            <details>
              <summary>{message('groupEditor.details')}</summary>
              <div className="group-editor-details">
                <label>
                  {message('group.note')}
                  <textarea
                    aria-label={message('group.note')}
                    maxLength={1000}
                    rows={2}
                    value={c.group.note}
                    onChange={(e) => c.setNote(e.target.value)}
                  />
                </label>
                <label>
                  {message('groupEditor.disposition')}
                  <select
                    value={c.group.disposition}
                    onChange={(e) =>
                      c.setDisposition(e.target.value as SceneGroupDisposition)
                    }
                  >
                    {(['hostile', 'neutral', 'allied'] as const).map(
                      (value) => (
                        <option key={value} value={value}>
                          {message(`group.disposition.${value}`)}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>
            </details>
            {c.lifecycleNotice}
            {c.combatNotice}
            {c.uncertain && (
              <div role="status">
                {message('group.saveUnconfirmed')}
                {c.canReconcile && (
                  <button
                    type="button"
                    disabled={c.pending}
                    onClick={() => void c.retryUnknown()}
                  >
                    {message('group.checkSavedState')}
                  </button>
                )}
              </div>
            )}
          </>
        }
        toolsLabel={message('group.tools')}
        catalog={<GroupEditorCatalog controller={c} />}
        divider={{ kind: 'fixed' }}
        draft={<GroupEditorSelection controller={c} />}
        footer={<GroupEditorFooter controller={c} />}
      />
      {c.archiveDialog}
      {c.combatDialog}
      {c.state.pendingIntent && (
        <DiscardChangesDialog
          message={
            c.state.pendingIntent.intent.kind === 'save'
              ? message('groupEditor.excluded')
              : c.state.pendingIntent.guard === 'all-drafts'
                ? message('ui.ungespeicherte.aenderungen.verwerfen')
                : message('loot.discardQuestion')
          }
          cancelLabel={message('action.cancel')}
          discardLabel={
            c.state.pendingIntent.intent.kind === 'save'
              ? message('groupEditor.apply')
              : message('ui.aenderungen.verwerfen')
          }
          onCancel={c.cancelPendingIntent}
          onDiscard={c.confirmPendingIntent}
        />
      )}
    </>
  )
}
function GroupEditorFooter({
  controller: c
}: {
  controller: GroupManagerController
}) {
  return (
    <>
      <label className="group-editor-include">
        <input
          type="checkbox"
          checked={c.session?.includeLoot !== false}
          onChange={(e) => c.includeLoot(e.target.checked)}
        />
        {message('groupEditor.includeLoot')}
      </label>
      <div>
        {c.canJoinCombat && (
          <button
            type="button"
            disabled={c.busy || c.dirty}
            onClick={c.joinCombat}
          >
            {message('encounter.joinCombat')}
          </button>
        )}
        {c.selectedPersistedGroup && (
          <button type="button" disabled={c.busy} onClick={c.archive}>
            {message('group.archive')}
          </button>
        )}
        <button type="button" onClick={c.close}>
          {message('action.cancel')}
        </button>
        <button
          className="primary-action"
          type="button"
          disabled={c.busy || !c.active || c.session?.externalConflict}
          onClick={c.save}
        >
          {message('groupEditor.apply')}
        </button>
      </div>
    </>
  )
}
