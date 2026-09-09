import { useEffect, useState, useSyncExternalStore } from 'react'
import { CharacterLedgerController } from './character-ledger-controller.js'
import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import type { PartyCharacter } from '../../../shared/contracts/party.js'
import type { CharacterLootEntry } from '../../../shared/contracts/loot.js'
import { itemDefinitionLineValueCp } from '../../../shared/values/item-definition-values.js'
import { ModalDialog } from '../../shell/modal-dialog.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { formatCopper } from '../../presenters/money.js'
import './loot-dialogs.css'
import { useCharacterLootPort } from './use-loot-ports.js'

type CharacterLootLedgerDialogProps = {
  character: PartyCharacter
  close: () => void
  onError: (message: string) => void
}
export function CharacterLootLedgerDialog(
  props: CharacterLootLedgerDialogProps
) {
  return <CharacterLootLedgerContent key={props.character.id} {...props} />
}
function CharacterLootLedgerContent(props: CharacterLootLedgerDialogProps) {
  const loot = useCharacterLootPort()
  const { character } = props
  const [controller] = useState(
    () => new CharacterLedgerController(loot, character.id)
  )
  const { ledger, correction, busy, uncertain, error } = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot
  )
  const blocked = useMaintenanceDraft({
    label: `Persönliche Beute: ${character.name}`,
    isDirty: controller.dirty,
    save: controller.maintenanceSave,
    discard: controller.maintenanceDiscard
  })
  const editingBlocked = blocked || busy || uncertain
  const close = () => {
    if (!controller.blocked()) {
      controller.cancel()
      props.close()
    }
  }
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [source, setSource] = useState('all')
  useEffect(() => {
    void controller.load()
  }, [controller])
  const visibleEntries = (ledger?.entries ?? []).filter(
    (entry) =>
      (status === 'all' || entry.status === status) &&
      (source === 'all' || entry.source === source) &&
      `${entry.definition.name} ${provenanceText(entry)}`
        .toLocaleLowerCase('de-DE')
        .includes(query.trim().toLocaleLowerCase('de-DE'))
  )

  return (
    <ModalDialog
      className="character-loot-dialog"
      labelledBy="character-loot-title"
      onClose={close}
      busy={editingBlocked}
    >
      <header>
        <div>
          <p className="section-kicker">{message('loot.ledger')}</p>
          <h2 id="character-loot-title">{character.name}</h2>
        </div>
        <button
          type="button"
          className="compact"
          aria-label={message('ui.dialog.schliessen')}
          disabled={editingBlocked}
          onClick={close}
        >
          ×
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {uncertain && (
        <button
          type="button"
          disabled={blocked || busy}
          onClick={() => void controller.retry()}
        >
          {message('loot.correctionCheck')}
        </button>
      )}
      {!ledger && !uncertain && (
        <button
          type="button"
          disabled={blocked || busy}
          onClick={() => void controller.load()}
        >
          {message('loot.ledgerReload')}
        </button>
      )}
      {!ledger ? (
        <p className="session-empty-state">{message('loot.ledgerLoading')}</p>
      ) : ledger.entries.length === 0 ? (
        <p className="session-empty-state">{message('loot.ledgerEmpty')}</p>
      ) : (
        <>
          <div className="character-loot-filters">
            <input
              type="search"
              aria-label={message('loot.search')}
              placeholder={message('loot.search')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              aria-label={message('loot.filterStatus')}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">{message('loot.statusAll')}</option>
              <option value="received">{message('loot.statusReceived')}</option>
              <option value="given_away">
                {message('loot.statusGivenAway')}
              </option>
              <option value="sold">{message('loot.statusSold')}</option>
            </select>
            <select
              aria-label={message('loot.filterSource')}
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="all">{message('loot.sourceAll')}</option>
              <option value="award">{message('loot.sourceAward')}</option>
              <option value="manual">{message('loot.sourceManual')}</option>
              <option value="purchase">{message('loot.sourcePurchase')}</option>
              <option value="correction">
                {message('loot.sourceCorrection')}
              </option>
            </select>
          </div>
          {visibleEntries.length === 0 ? (
            <p className="session-empty-state">{message('loot.filterEmpty')}</p>
          ) : (
            <ul className="character-loot-list">
              {visibleEntries.map((entry) => (
                <li
                  key={entry.id}
                  className={entry.supersededByEntryId ? 'superseded' : ''}
                >
                  <span>
                    <strong>
                      {entry.quantity > 1 ? `${entry.quantity}× ` : ''}
                      {entry.definition.name}
                    </strong>
                    <small>
                      {provenanceText(entry)} · {statusLabel(entry.status)}
                    </small>
                    {entry.rewardProvenance && (
                      <small>
                        {formatMessage('loot.generatedProvenance', {
                          channel: entry.rewardProvenance.rewardChannel,
                          run: entry.rewardProvenance.runId.slice(0, 8)
                        })}
                      </small>
                    )}
                    {entry.correctionReason && (
                      <small>
                        {formatMessage('loot.correctionReason', {
                          reason: entry.correctionReason
                        })}
                      </small>
                    )}
                    {entry.supersededByEntryId && (
                      <small>{message('loot.superseded')}</small>
                    )}
                  </span>
                  <span>
                    {formatCopper(
                      itemDefinitionLineValueCp(
                        entry.definition,
                        entry.quantity
                      )
                    )}
                  </span>
                  {!entry.supersededByEntryId && (
                    <button
                      type="button"
                      disabled={editingBlocked || Boolean(correction)}
                      onClick={() => controller.open(entry)}
                    >
                      {message('loot.correct')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {correction && (
        <section className="character-loot-correction">
          <h3>{message('loot.correctTitle')}</h3>
          <label>
            {message('loot.quantity')}
            <input
              type="number"
              min={1}
              disabled={editingBlocked}
              value={correction.quantity}
              onChange={(event) =>
                controller.patch({
                  quantity: Math.max(1, Number(event.target.value) || 1)
                })
              }
            />
          </label>
          <label>
            {message('loot.status')}
            <select
              disabled={editingBlocked}
              value={correction.status}
              onChange={(event) =>
                controller.patch({
                  status: event.target.value as typeof correction.status
                })
              }
            >
              <option value="received">{message('loot.statusReceived')}</option>
              <option value="given_away">
                {message('loot.statusGivenAway')}
              </option>
              <option value="sold">{message('loot.statusSold')}</option>
            </select>
          </label>
          <label className="character-loot-correction-reason">
            {message('loot.reason')}
            <input
              disabled={editingBlocked}
              maxLength={500}
              value={correction.reason}
              onChange={(event) =>
                controller.patch({ reason: event.target.value })
              }
            />
          </label>
          <div>
            <button
              type="button"
              disabled={editingBlocked}
              onClick={controller.cancel}
            >
              {message('loot.cancel')}
            </button>
            <button
              type="button"
              disabled={editingBlocked || !correction.reason.trim()}
              onClick={() => void controller.save()}
            >
              {message('loot.correctSave')}
            </button>
          </div>
        </section>
      )}
      <footer>
        <button type="button" disabled={editingBlocked} onClick={close}>
          {message('loot.close')}
        </button>
      </footer>
    </ModalDialog>
  )
}

function provenanceText(entry: CharacterLootEntry): string {
  return `${entry.provenance.treasureLabel} → ${entry.provenance.recipientName}`
}

function statusLabel(status: CharacterLootEntry['status']): string {
  return {
    received: message('loot.statusReceived'),
    given_away: message('loot.statusGivenAway'),
    sold: message('loot.statusSold')
  }[status]
}
