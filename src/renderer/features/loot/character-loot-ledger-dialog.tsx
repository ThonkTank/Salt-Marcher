import { useEffect, useState } from 'react'
import type { PartyCharacter } from '../../../shared/contracts/party.js'
import type {
  CharacterLootEntry,
  CharacterLootLedger
} from '../../../shared/contracts/loot.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { ModalDialog } from '../../shell/modal-dialog.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { formatCopper } from '../../presenters/money.js'
import './loot-dialogs.css'
import { useCharacterLootPort } from './use-loot-ports.js'

export function CharacterLootLedgerDialog(props: {
  character: PartyCharacter
  close: () => void
  onError: (message: string) => void
}) {
  const loot = useCharacterLootPort()
  const { character, close, onError } = props
  const [ledger, setLedger] = useState<CharacterLootLedger | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [source, setSource] = useState('all')
  const [correction, setCorrection] = useState<{
    entry: CharacterLootEntry
    commandId: string
    itemName: string
    quantity: number
    unitValueCp: number
    status: 'received' | 'given_away' | 'sold'
    reason: string
  } | null>(null)
  useEffect(() => {
    let current = true
    void loot
      .ledger({ characterId: character.id })
      .then((value) => current && setLedger(value))
      .catch((cause: unknown) => onError(capabilityErrorText(cause)))
    return () => {
      current = false
    }
  }, [character.id, loot, onError])
  const visibleEntries = (ledger?.entries ?? []).filter(
    (entry) =>
      (status === 'all' || entry.status === status) &&
      (source === 'all' || entry.source === source) &&
      `${entry.itemName} ${provenanceText(entry)}`
        .toLocaleLowerCase('de-DE')
        .includes(query.trim().toLocaleLowerCase('de-DE'))
  )

  async function saveCorrection() {
    if (!ledger || !correction || !correction.reason.trim()) return
    try {
      setLedger(
        await loot.correctLedger({
          commandId: correction.commandId,
          characterId: character.id,
          entryId: correction.entry.id,
          expectedRevision: ledger.revision,
          itemName: correction.itemName,
          quantity: correction.quantity,
          unitValueCp: correction.unitValueCp,
          status: correction.status,
          reason: correction.reason
        })
      )
      setCorrection(null)
    } catch (cause) {
      onError(capabilityErrorText(cause))
    }
  }
  return (
    <ModalDialog
      className="character-loot-dialog"
      labelledBy="character-loot-title"
      onClose={close}
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
          onClick={close}
        >
          ×
        </button>
      </header>
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
                      {entry.itemName}
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
                    {formatCopper(entry.quantity * entry.unitValueCp)}
                  </span>
                  {!entry.supersededByEntryId && (
                    <button
                      type="button"
                      onClick={() =>
                        setCorrection({
                          entry,
                          commandId: crypto.randomUUID(),
                          itemName: entry.itemName,
                          quantity: entry.quantity,
                          unitValueCp: entry.unitValueCp,
                          status: entry.status,
                          reason: ''
                        })
                      }
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
            {message('loot.item')}
            <input
              value={correction.itemName}
              onChange={(event) =>
                setCorrection({ ...correction, itemName: event.target.value })
              }
            />
          </label>
          <label>
            {message('loot.quantity')}
            <input
              type="number"
              min={1}
              value={correction.quantity}
              onChange={(event) =>
                setCorrection({
                  ...correction,
                  quantity: Math.max(1, Number(event.target.value) || 1)
                })
              }
            />
          </label>
          <label>
            {message('loot.valueCopper')}
            <input
              type="number"
              min={0}
              value={correction.unitValueCp}
              onChange={(event) =>
                setCorrection({
                  ...correction,
                  unitValueCp: Math.max(0, Number(event.target.value) || 0)
                })
              }
            />
          </label>
          <label>
            {message('loot.status')}
            <select
              value={correction.status}
              onChange={(event) =>
                setCorrection({
                  ...correction,
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
              value={correction.reason}
              onChange={(event) =>
                setCorrection({ ...correction, reason: event.target.value })
              }
            />
          </label>
          <div>
            <button type="button" onClick={() => setCorrection(null)}>
              {message('loot.cancel')}
            </button>
            <button
              type="button"
              disabled={
                !correction.itemName.trim() || !correction.reason.trim()
              }
              onClick={() => void saveCorrection()}
            >
              {message('loot.correctSave')}
            </button>
          </div>
        </section>
      )}
      <footer>
        <button type="button" onClick={close}>
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
