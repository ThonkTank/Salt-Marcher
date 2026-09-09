import { useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { RewardDistributionController } from './reward-distribution-controller.js'
import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { Treasure } from '../../../shared/contracts/loot.js'
import { ModalDialog } from '../../shell/modal-dialog.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { formatCopper } from '../../presenters/money.js'
import './loot-dialogs.css'
import { useRewardDistributionPort } from './use-loot-ports.js'

type RewardDistributionDialogProps = {
  treasure: Treasure
  snapshot: LiveSessionSnapshot
  close: () => void
  completed: () => void | Promise<void>
  maintenanceId?: string
  onError: (message: string) => void
  context?: Readonly<{
    kind: 'encounter' | 'quest'
    label: string
    xp: number | null
  }>
}
export function RewardDistributionDialog(props: RewardDistributionDialogProps) {
  return <RewardDistributionContent key={props.treasure.id} {...props} />
}
function RewardDistributionContent(props: RewardDistributionDialogProps) {
  const loot = useRewardDistributionPort()
  const [controller] = useState(
    () =>
      new RewardDistributionController(
        loot,
        props.treasure,
        props.snapshot.party.revision,
        { completed: props.completed, close: props.close }
      )
  )
  useLayoutEffect(() => {
    controller.updateCallbacks({
      completed: props.completed,
      close: props.close
    })
  }, [controller, props.completed, props.close])
  const {
    shares,
    busy: submitting,
    uncertain,
    closed,
    error
  } = useSyncExternalStore(controller.subscribe, controller.snapshot)
  const blocked = useMaintenanceDraft(
    {
      label: `Beuteverteilung: ${props.treasure.label}`,
      isDirty: controller.dirty,
      save: controller.maintenanceSave,
      discard: controller.maintenanceDiscard
    },
    props.maintenanceId
  )
  const editingBlocked = blocked || submitting || uncertain || closed
  const availableItems = controller.availableItems
  const close = () => {
    void controller.close()
  }
  const changeShare = controller.change
  const activeParty = props.snapshot.party.members.filter(
    (member) => member.active
  )
  const validation = controller.validation()
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

  return (
    <ModalDialog
      className="loot-distribution-dialog"
      labelledBy="loot-distribution-title"
      onClose={close}
      busy={editingBlocked}
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
          onClick={close}
          disabled={editingBlocked}
        >
          ×
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {uncertain && (
        <button
          type="button"
          disabled={blocked || submitting}
          onClick={() => void controller.retry()}
        >
          {message('loot.distributionCheck')}
        </button>
      )}
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
      <div className="loot-distribution-items" inert={editingBlocked}>
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
                  <strong>{item.definition.name}</strong>
                  <span>
                    {formatMessage('loot.availableUnit', {
                      count: remaining,
                      value: formatCopper(item.definition.unitValueCp)
                    })}
                  </span>
                </header>
                {(shares[item.id] ?? []).map((share, index) => (
                  <div className="loot-share-row" key={`${item.id}:${index}`}>
                    <select
                      aria-label={formatMessage('loot.recipientFor', {
                        name: item.definition.name
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
                        name: item.definition.name
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
                      onClick={() => controller.remove(item.id, index)}
                    >
                      −
                    </button>
                  </div>
                ))}
                {item.definition.stackable && remaining > 1 && (
                  <button
                    type="button"
                    className="loot-split-action"
                    onClick={() => controller.add(item.id)}
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
        <button type="button" onClick={close} disabled={editingBlocked}>
          {message('loot.cancel')}
        </button>
        <button
          type="button"
          className="primary-action"
          disabled={Boolean(validation) || editingBlocked}
          onClick={() => void controller.save()}
        >
          {submitting
            ? message('loot.saving')
            : message('loot.distributionComplete')}
        </button>
      </footer>
    </ModalDialog>
  )
}
