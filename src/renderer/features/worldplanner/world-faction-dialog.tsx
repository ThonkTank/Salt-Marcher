import { formatMessage, message } from '../../i18n/worldplanner-runtime.de.js'
import { EditorDialogFrame } from '../../shell/editor-dialog-frame.js'
import { TextActionButton } from '../../shell/text-action-button.js'
import { formatChallengeRatingLabel } from '../../i18n/domain-formatters.de.js'
import {
  DiscardChangesDialog,
  ModalCloseButton
} from '../../shell/modal-dialog.js'
import { FactionTablePicker } from './faction-table-picker.js'
import type { WorldFactionEditorRenderProps } from './world-faction-editor-types.js'
import './world-faction-dialog.css'
import { useWorldFactionEditorController } from './use-world-faction-editor-controller.js'

export type { WorldFactionSaveResult } from './world-faction-editor-types.js'

const dispositionBands = [
  { minimum: -50, maximum: -21, pick: -35, key: 'faction.hostile' },
  { minimum: -20, maximum: -6, pick: -13, key: 'faction.wary' },
  { minimum: -5, maximum: 5, pick: 0, key: 'faction.neutral' },
  { minimum: 6, maximum: 20, pick: 13, key: 'faction.friendly' },
  { minimum: 21, maximum: 50, pick: 35, key: 'faction.allied' }
] as const

export function WorldFactionDialog(props: WorldFactionEditorRenderProps) {
  const controller = useWorldFactionEditorController(props)
  const {
    displayName,
    notes,
    disposition,
    primaryEncounterTableId,
    inventory
  } = controller.draft
  const {
    busy,
    persisted,
    reconciliationFailed,
    error,
    discardOpen,
    selectedTable,
    tableSummaries,
    facts,
    dispatch
  } = controller
  const activeBand = dispositionBands.find(
    (band) => disposition >= band.minimum && disposition <= band.maximum
  )!

  return (
    <>
      <EditorDialogFrame
        className="world-faction-dialog"
        ariaLabel={
          props.faction
            ? message('catalog.editFaction')
            : message('catalog.createFaction')
        }
        busy={busy}
        onClose={controller.requestClose}
        breadcrumb={
          props.invocation.kind === 'location-link'
            ? message('location.factionBreadcrumb')
            : message('faction.catalogBreadcrumb')
        }
        title={
          props.faction
            ? message('catalog.editFaction')
            : message('catalog.createFaction')
        }
        closeLabel={message('ui.dialog.schliessen')}
        onSubmit={() => void controller.submit()}
        footer={
          <>
            <div>
              <span>
                {displayName.trim()
                  ? props.faction
                    ? message('faction.readySave')
                    : message('faction.nameEnough')
                  : message('faction.nameRequired')}
              </span>
              {error && <strong role="alert">{error}</strong>}
            </div>
            <div>
              <ModalCloseButton>{message('action.cancel')}</ModalCloseButton>
              <button
                className="faction-primary-action"
                disabled={busy || persisted || !displayName.trim()}
              >
                {props.faction
                  ? message('action.save')
                  : props.invocation.kind === 'location-link'
                    ? message('action.createAndLink')
                    : message('action.create')}
              </button>
              {reconciliationFailed && (
                <button
                  type="button"
                  className="faction-primary-action"
                  disabled={busy}
                  onClick={() => void controller.retryReconciliation()}
                >
                  {message('action.retry')}
                </button>
              )}
            </div>
          </>
        }
        bodyClassName="world-faction-dialog-body-scroll"
        footerClassName="world-faction-dialog-footer"
      >
        <div className="world-faction-dialog-body">
          <div className="world-faction-sheet-pane">
            <label className="faction-name-field">
              <span>{message('ui.name')}</span>
              <input
                required
                maxLength={100}
                aria-label={message('ui.fraktionsname')}
                disabled={busy}
                value={displayName}
                onChange={(event) =>
                  dispatch({ kind: 'name', value: event.target.value })
                }
              />
            </label>
            <section className="faction-section faction-disposition">
              <div className="faction-disposition-heading">
                <span>{message('faction.disposition')}</span>
                <strong>
                  {message(activeBand.key)} · {disposition}
                </strong>
              </div>
              <div className="faction-disposition-bands">
                {dispositionBands.map((band) => (
                  <button
                    type="button"
                    key={band.key}
                    aria-pressed={band === activeBand}
                    disabled={busy}
                    onClick={() =>
                      dispatch({ kind: 'disposition', value: band.pick })
                    }
                  >
                    {message(band.key)}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={-50}
                max={50}
                aria-label={message('ui.fraktionsgesinnung')}
                disabled={busy}
                value={disposition}
                onChange={(event) =>
                  dispatch({
                    kind: 'disposition',
                    value: Number(event.target.value)
                  })
                }
              />
            </section>
            <label className="faction-section faction-notes">
              <span>{message('ui.notizen')}</span>
              <textarea
                rows={10}
                maxLength={20_000}
                aria-label={message('ui.fraktionsnotizen')}
                disabled={busy}
                value={notes}
                onChange={(event) =>
                  dispatch({ kind: 'notes', value: event.target.value })
                }
              />
            </label>
          </div>
          <div className="world-faction-dialog-divider" aria-hidden="true" />
          <div className="world-faction-link-pane">
            <section className="faction-section">
              <h3>{message('ui.primaere.encounter.tabelle')}</h3>
              <FactionTablePicker
                summaries={tableSummaries}
                value={primaryEncounterTableId}
                disabled={busy}
                changed={controller.selectPrimaryTable}
                createTable={controller.requestTableCreation}
              />
            </section>
            <section className="faction-section faction-inventory">
              <h3>{message('ui.endlicher.bestand')}</h3>
              <p>{message('faction.stockHint')}</p>
              {selectedTable?.entries.map((entry) => {
                const fact = facts.resources[entry.creatureId]
                const creature = fact?.status === 'ready' ? fact.value : null
                const name =
                  creature?.name ??
                  formatMessage('catalog.unavailableReference', {
                    id: entry.creatureId
                  })
                return (
                  <div className="faction-inventory-row" key={entry.creatureId}>
                    <span>
                      {creature ? (
                        <>
                          <TextActionButton
                            onClick={() => props.inspect(creature)}
                          >
                            {name}
                          </TextActionButton>
                          <TextActionButton
                            className="faction-inventory-cr-link"
                            onClick={() => props.inspect(creature)}
                          >
                            {formatChallengeRatingLabel(
                              creature.challengeRating
                            )}
                          </TextActionButton>
                        </>
                      ) : (
                        <strong>{name}</strong>
                      )}
                      {!creature && <small>{`${message('ui.cr')} —`}</small>}
                      {fact?.status === 'failed' && (
                        <button
                          type="button"
                          onClick={() => facts.retry(entry.creatureId)}
                        >
                          {message('action.retry')}
                        </button>
                      )}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="∞"
                      disabled={busy}
                      aria-label={formatMessage('catalog.inventoryMaximum', {
                        name
                      })}
                      value={inventory[entry.creatureId] ?? ''}
                      onChange={(event) => {
                        dispatch({
                          kind: 'stock',
                          creatureId: entry.creatureId,
                          maximum: event.target.value
                            ? Number(event.target.value)
                            : null
                        })
                      }}
                    />
                    <button
                      type="button"
                      aria-label={formatMessage('faction.clearStock', {
                        name
                      })}
                      onClick={() => {
                        dispatch({
                          kind: 'stock',
                          creatureId: entry.creatureId,
                          maximum: null
                        })
                      }}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </section>
          </div>
        </div>
      </EditorDialogFrame>
      {discardOpen && (
        <DiscardChangesDialog
          message={message('ui.ungespeicherte.aenderungen.verwerfen')}
          cancelLabel={message('action.cancel')}
          discardLabel={message('ui.aenderungen.verwerfen')}
          onCancel={() => controller.setDiscardOpen(false)}
          onDiscard={props.close}
        />
      )}
    </>
  )
}
