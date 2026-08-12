import { useRef, useState } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { Treasure } from '../../../shared/contracts/loot.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { ModalDialog } from '../../shell/modal-dialog.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { formatCopper } from '../../presenters/money.js'
import './loot-dialogs.css'
import { useRewardDistributionPort } from './use-loot-ports.js'

type ShareDraft = { characterId: string; quantity: number }

export function RewardDistributionDialog(props: {
  treasure: Treasure
  snapshot: LiveSessionSnapshot
  close: () => void
  completed: () => void
  onError: (message: string) => void
  context?: Readonly<{
    kind: 'encounter' | 'quest'
    label: string
    xp: number | null
  }>
}) {
  const loot = useRewardDistributionPort()
  const commandId = useRef(crypto.randomUUID())
  const availableItems = props.treasure.items.filter(
    (item) => item.quantity > item.allocatedQuantity
  )
  const [shares, setShares] = useState<Record<string, ShareDraft[]>>(() =>
    Object.fromEntries(
      availableItems.map((item) => [
        item.id,
        [
          {
            characterId: '',
            quantity: item.quantity - item.allocatedQuantity
          }
        ]
      ])
    )
  )
  const [submitting, setSubmitting] = useState(false)
  const activeParty = props.snapshot.party.members.filter(
    (member) => member.active
  )
  const validation = validateDistribution(availableItems, shares)
  const totalAvailable = availableItems.reduce(
    (sum, item) => sum + item.quantity - item.allocatedQuantity,
    0
  )
  const totalAssigned = availableItems.reduce(
    (sum, item) =>
      sum +
      (shares[item.id] ?? [])
        .filter((share) => share.characterId)
        .reduce((itemSum, share) => itemSum + share.quantity, 0),
    0
  )

  function changeShare(
    itemId: string,
    index: number,
    patch: Partial<ShareDraft>
  ) {
    setShares((current) => ({
      ...current,
      [itemId]: (current[itemId] ?? []).map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row
      )
    }))
  }

  async function complete() {
    if (validation) return
    setSubmitting(true)
    try {
      await loot.distribute({
        commandId: commandId.current,
        treasureId: props.treasure.id,
        expectedTreasureRevision: props.treasure.revision,
        expectedPartyRevision: props.snapshot.party.revision,
        items: availableItems.flatMap((item) => {
          const selected = (shares[item.id] ?? []).filter(
            (row) => row.characterId
          )
          return selected.length > 0
            ? [
                {
                  itemId: item.id,
                  shares: selected.map((row) => ({
                    characterId: row.characterId,
                    quantity: row.quantity
                  }))
                }
              ]
            : []
        })
      })
      props.completed()
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalDialog
      className="loot-distribution-dialog"
      labelledBy="loot-distribution-title"
      onClose={props.close}
    >
      <header>
        <div>
          <p className="section-kicker">{message('loot.distributionKicker')}</p>
          <h2 id="loot-distribution-title">{props.treasure.label}</h2>
        </div>
        <button
          type="button"
          className="compact"
          aria-label={message('ui.dialog.schliessen')}
          onClick={props.close}
        >
          ×
        </button>
      </header>
      <p className="panel-hint">{message('loot.distributionHint')}</p>
      {props.context && (
        <div className="loot-distribution-context">
          <span>
            {message(
              props.context.kind === 'encounter'
                ? 'loot.contextEncounter'
                : 'loot.contextQuest'
            )}{' '}
            · {props.context.label}
          </span>
          {props.context.xp !== null && <strong>{props.context.xp} EP</strong>}
        </div>
      )}
      <div className="loot-distribution-total" aria-live="polite">
        <strong>
          {formatMessage('loot.distributionTotal', {
            allocated: totalAssigned,
            total: totalAvailable
          })}
        </strong>
        <span>
          {formatMessage('loot.distributionRemainder', {
            count: totalAvailable - totalAssigned
          })}
        </span>
      </div>
      <div className="loot-distribution-items">
        {availableItems.length === 0 ? (
          <p className="session-empty-state">
            {message('loot.allDistributed')}
          </p>
        ) : (
          availableItems.map((item) => {
            const remaining = item.quantity - item.allocatedQuantity
            const assigned = (shares[item.id] ?? [])
              .filter((share) => share.characterId)
              .reduce((sum, share) => sum + share.quantity, 0)
            return (
              <section className="loot-distribution-item" key={item.id}>
                <header>
                  <strong>{item.name}</strong>
                  <span>
                    {formatMessage('loot.availableUnit', {
                      count: remaining,
                      value: formatCopper(item.unitValueCp)
                    })}
                  </span>
                </header>
                {(shares[item.id] ?? []).map((share, index) => (
                  <div className="loot-share-row" key={`${item.id}:${index}`}>
                    <select
                      aria-label={formatMessage('loot.recipientFor', {
                        name: item.name
                      })}
                      value={share.characterId}
                      onChange={(event) =>
                        changeShare(item.id, index, {
                          characterId: event.target.value
                        })
                      }
                    >
                      <option value="">{message('loot.unassigned')}</option>
                      {activeParty.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label={formatMessage('loot.quantityFor', {
                        name: item.name
                      })}
                      type="number"
                      min={1}
                      max={remaining}
                      value={share.quantity}
                      onChange={(event) =>
                        changeShare(item.id, index, {
                          quantity: Math.max(1, Number(event.target.value) || 1)
                        })
                      }
                    />
                    <button
                      type="button"
                      aria-label={message('loot.removeSplit')}
                      onClick={() =>
                        setShares((current) => ({
                          ...current,
                          [item.id]: current[item.id]!.filter(
                            (_, rowIndex) => rowIndex !== index
                          )
                        }))
                      }
                    >
                      −
                    </button>
                  </div>
                ))}
                {item.stackable && remaining > 1 && (
                  <button
                    type="button"
                    className="loot-split-action"
                    onClick={() =>
                      setShares((current) => ({
                        ...current,
                        [item.id]: [
                          ...(current[item.id] ?? []),
                          { characterId: '', quantity: 1 }
                        ]
                      }))
                    }
                  >
                    {message('loot.split')}
                  </button>
                )}
                <p className="loot-item-remainder">
                  {formatMessage('loot.itemRemainder', {
                    count: Math.max(0, remaining - assigned),
                    total: remaining
                  })}
                </p>
              </section>
            )
          })
        )}
      </div>
      {validation && availableItems.length > 0 && (
        <p className="loot-validation" role="status">
          {validation}
        </p>
      )}
      <footer>
        <button type="button" onClick={props.close}>
          {message('loot.cancel')}
        </button>
        <button
          type="button"
          className="primary-action"
          disabled={Boolean(validation) || submitting}
          onClick={() => void complete()}
        >
          {submitting
            ? message('loot.saving')
            : message('loot.distributionComplete')}
        </button>
      </footer>
    </ModalDialog>
  )
}

function validateDistribution(
  items: Treasure['items'],
  shares: Readonly<Record<string, readonly ShareDraft[]>>
): string | null {
  let assigned = 0
  for (const item of items) {
    const selected = (shares[item.id] ?? []).filter((row) => row.characterId)
    const recipients = new Set(selected.map((row) => row.characterId))
    const quantity = selected.reduce((sum, row) => sum + row.quantity, 0)
    if (recipients.size !== selected.length)
      return message('loot.recipientUnique')
    if (selected.some((row) => row.quantity < 1))
      return message('loot.quantityPositive')
    if (quantity > item.quantity - item.allocatedQuantity)
      return formatMessage('loot.overAllocated', { name: item.name })
    if (
      !item.stackable &&
      quantity !== 0 &&
      quantity !== item.quantity - item.allocatedQuantity
    )
      return formatMessage('loot.notStackable', { name: item.name })
    assigned += quantity
  }
  return assigned > 0 ? null : message('loot.assignmentRequired')
}
