import type {
  CampaignActionAttempt,
  CampaignManagementCommand
} from './campaign-action-attempt.js'
import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { useRef, useState, type FormEvent } from 'react'
import type {
  CampaignSnapshot,
  CampaignCommandReceipt
} from '../../../shared/contracts/campaign.js'
import { ModalCloseButton, ModalDialog } from '../../shell/modal-dialog.js'
import { formatMessage, message } from '../../i18n/campaign-menu-runtime.de.js'
import {
  compareCampaigns,
  formatCampaignOpenedAt
} from './campaign-presentation.js'
import './campaign-screen.css'

export interface CampaignActions {
  begin: (
    command: CampaignManagementCommand,
    maintenance?: boolean
  ) => CampaignActionAttempt
  reconciliationPending: boolean
  reconcile: (
    stayOnCampaigns?: boolean
  ) => Promise<CampaignCommandReceipt | null>
}
export interface CampaignScreenProps extends CampaignActions {
  maintenanceDependencyId?: string
  snapshot: CampaignSnapshot
  status: 'loading' | 'ready' | 'failure'
  error: string
  busy: boolean
  sessionRetry: boolean
  retryCatalog: () => Promise<void>
  retrySession: () => Promise<boolean>
}
type Popup =
  | { kind: 'new' }
  | { kind: 'edit'; id: string; originalName: string }
  | { kind: 'trash' }
  | { kind: 'delete'; id: string }

export function CampaignScreen(props: CampaignScreenProps) {
  const [popup, setPopupState] = useState<Popup | null>(null)
  const [name, setNameState] = useState('')
  const [confirmation, setConfirmationState] = useState('')
  const [notice, setNotice] = useState('')
  const [localBusy, setLocalBusy] = useState(false)
  const popupRef = useRef<Popup | null>(null)
  const nameRef = useRef('')
  const confirmationRef = useRef('')
  const [localError, setLocalError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const pending = useRef<Promise<boolean> | null>(null)
  const attempt = useRef<{
    handle: CampaignActionAttempt
    accepted?: () => void
  } | null>(null)
  const setPopup = (value: Popup | null) => {
    popupRef.current = value
    setPopupState(value)
  }
  const setName = (value: string) => {
    nameRef.current = value
    setNameState(value)
  }
  const setConfirmation = (value: string) => {
    confirmationRef.current = value
    setConfirmationState(value)
  }
  const createButton = useRef<HTMLButtonElement>(null)
  const maintenanceBlocked = useMaintenanceDraft({
    label: 'Kampagnenverwaltung',
    dependsOn: props.maintenanceDependencyId
      ? [props.maintenanceDependencyId]
      : [],
    isDirty: () =>
      Boolean(popupRef.current || pending.current || attempt.current),
    save: async () => {
      if (!(await drain())) return false
      if (popupRef.current?.kind === 'new' || popupRef.current?.kind === 'edit')
        return saveName(true)
      close()
      return true
    },
    discard: async () => {
      if (!(await drain())) return false
      close()
      return true
    }
  })
  const blocked =
    props.busy ||
    localBusy ||
    props.reconciliationPending ||
    uncertain ||
    maintenanceBlocked
  const publicBlocked = () =>
    Boolean(
      blocked ||
      pending.current ||
      attempt.current ||
      maintenanceDraftCoordinator.isLocked()
    )
  const editing =
    popup?.kind === 'edit'
      ? props.snapshot.campaigns.find((c) => c.id === popup.id)
      : undefined
  const deleting =
    popup?.kind === 'delete'
      ? props.snapshot.trashedCampaigns.find((c) => c.id === popup.id)
      : undefined
  const close = () => {
    setPopup(null)
    setName('')
    setConfirmation('')
    setLocalError('')
  }
  const removedFocus = () => {
    close()
    requestAnimationFrame(() => createButton.current?.focus())
  }

  function track(operation: () => Promise<boolean>): Promise<boolean> {
    if (pending.current) return pending.current
    setLocalBusy(true)
    setLocalError('')
    const request = Promise.resolve()
      .then(operation)
      .catch((cause: unknown) => {
        if (attempt.current) setUncertain(true)
        setLocalError(capabilityErrorText(cause))
        return false
      })
      .finally(() => {
        pending.current = null
        setLocalBusy(false)
      })
    pending.current = request
    return request
  }
  function run(
    input: CampaignManagementCommand,
    accepted?: () => void,
    maintenance = false
  ): Promise<boolean> {
    if (pending.current || attempt.current || (!maintenance && publicBlocked()))
      return Promise.resolve(false)
    const held = {
      handle: props.begin(input, maintenance),
      ...(accepted ? { accepted } : {})
    }
    attempt.current = held
    setNotice('')
    return track(async () => {
      if (!(await held.handle.completion)) {
        setUncertain(true)
        return false
      }
      held.accepted?.()
      attempt.current = null
      setUncertain(false)
      return true
    })
  }
  async function drain(): Promise<boolean> {
    await pending.current
    const held = attempt.current
    if (!held) return true
    return track(async () => {
      const result = await held.handle.settle()
      if (result === 'pending') {
        setUncertain(true)
        return false
      }
      if (result === 'confirmed') held.accepted?.()
      attempt.current = null
      setUncertain(false)
      if (result === 'absent') setLocalError(message('campaign.commandAbsent'))
      return true
    })
  }
  async function reconcile() {
    if (pending.current || props.busy || maintenanceDraftCoordinator.isLocked())
      return
    if (attempt.current) {
      await drain()
      return
    }
    await track(async () => {
      const receipt = await props.reconcile(true)
      if (!receipt) return false
      if (receipt.kind === 'restored') setNotice(message('campaign.restored'))
      else if (receipt.kind === 'deleted')
        setNotice(message('campaign.deleted'))
      else setNotice(message('campaign.reconciled'))
      return true
    })
  }
  function saveName(maintenance = false): Promise<boolean> {
    const original = popupRef.current
    const value = nameRef.current.trim()
    if (!original || (original.kind !== 'new' && original.kind !== 'edit'))
      return Promise.resolve(false)
    if (!value || value.length > 100) {
      setLocalError(message('campaign.nameInvalid'))
      return Promise.resolve(false)
    }
    if (original.kind === 'edit') {
      const current = props.snapshot.campaigns.find(
        (campaign) => campaign.id === original.id
      )
      if (!current || current.name !== original.originalName) {
        setLocalError(message('campaign.nameConflict'))
        return Promise.resolve(false)
      }
      if (value === original.originalName) {
        close()
        return Promise.resolve(true)
      }
      return run(
        { kind: 'rename', id: original.id, name: value },
        close,
        maintenance
      )
    }
    return run({ kind: 'create', name: value }, close, maintenance)
  }
  const status = (
    <>
      {(localError || props.error) && (
        <p role="alert" className="error-message">
          {localError || props.error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {(props.reconciliationPending || uncertain) && (
        <div className="campaign-reconciliation" role="status">
          <p>{message('campaign.reconciliationPending')}</p>
          <button
            disabled={props.busy || localBusy || maintenanceBlocked}
            onClick={() => void reconcile()}
          >
            {message('campaign.reconciliationCheck')}
          </button>
        </div>
      )}
    </>
  )
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!publicBlocked()) void saveName()
  }

  const title =
    popup?.kind === 'new'
      ? message('campaign.new')
      : popup?.kind === 'edit'
        ? message('campaign.edit')
        : popup?.kind === 'delete'
          ? message('campaign.deleteTitle')
          : message('campaign.trash')

  return (
    <section className="campaign-screen" aria-label={message('nav.campaigns')}>
      <header>
        <h2>{message('nav.campaigns')}</h2>
      </header>
      {!popup && status}
      {props.status === 'loading' && (
        <p role="status">{message('campaign.loading')}</p>
      )}
      {props.status === 'failure' && (
        <button
          disabled={blocked}
          onClick={() => {
            if (!publicBlocked()) void props.retryCatalog()
          }}
        >
          {message('campaign.retry')}
        </button>
      )}
      {props.status === 'ready' && (
        <>
          <p className="campaign-intro">
            {message(
              props.snapshot.campaigns.length
                ? 'campaign.intro'
                : 'campaign.none'
            )}
          </p>
          <button
            ref={createButton}
            className="primary"
            disabled={blocked}
            onClick={() => {
              if (publicBlocked()) return
              setName('')
              setNotice('')
              setPopup({ kind: 'new' })
            }}
          >
            {message('campaign.newButton')}
          </button>
          {props.sessionRetry && (
            <button
              disabled={blocked}
              onClick={() => {
                if (!publicBlocked()) void track(props.retrySession)
              }}
            >
              {message('campaign.sessionRetry')}
            </button>
          )}
          <ul className="campaign-screen-list">
            {[...props.snapshot.campaigns].sort(compareCampaigns).map((c) => (
              <li key={c.id}>
                <div className="campaign-identity">
                  <strong>{c.name}</strong>
                  <small>
                    {props.snapshot.activeCampaignId === c.id && (
                      <>{message('campaign.active')} · </>
                    )}
                    {formatCampaignOpenedAt(c.lastOpenedAt)}
                  </small>
                </div>
                <div className="campaign-row-actions">
                  <button
                    disabled={blocked}
                    aria-label={formatMessage('campaign.openNamed', {
                      name: c.name
                    })}
                    onClick={() => void run({ kind: 'activate', id: c.id })}
                  >
                    {message(
                      props.snapshot.activeCampaignId === c.id
                        ? 'campaign.resume'
                        : 'campaign.open'
                    )}
                  </button>
                  <button
                    disabled={blocked}
                    className="campaign-edit-trigger"
                    aria-label={formatMessage('campaign.editNamed', {
                      name: c.name
                    })}
                    onClick={() => {
                      if (publicBlocked()) return
                      setName(c.name)
                      setNotice('')
                      setPopup({ kind: 'edit', id: c.id, originalName: c.name })
                    }}
                  >
                    <span aria-hidden="true">✎</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <footer>
            <span>
              {formatMessage('campaign.count', {
                count: props.snapshot.campaigns.length
              })}
            </span>
            <button
              disabled={blocked}
              onClick={() => {
                if (publicBlocked()) return
                setNotice('')
                setPopup({ kind: 'trash' })
              }}
            >
              {formatMessage('campaign.trashCount', {
                count: props.snapshot.trashedCampaigns.length
              })}
            </button>
          </footer>
        </>
      )}
      {popup && (
        <ModalDialog
          className="campaign-management-popup"
          ariaLabel={title}
          role={popup.kind === 'delete' ? 'alertdialog' : 'dialog'}
          busy={blocked}
          dismissOnBackdrop={false}
          onClose={() => {
            if (publicBlocked()) return
            if (popup.kind === 'delete') setPopup({ kind: 'trash' })
            else close()
          }}
        >
          <header>
            <h2>{title}</h2>
            {popup.kind !== 'delete' && (
              <ModalCloseButton aria-label={message('action.close')}>
                ×
              </ModalCloseButton>
            )}
          </header>
          {status}
          {(popup.kind === 'new' || popup.kind === 'edit') && (
            <>
              <form onSubmit={submit}>
                <label htmlFor="campaign-name">
                  {message('campaign.name')}
                </label>
                <input
                  id="campaign-name"
                  autoFocus
                  value={name}
                  maxLength={100}
                  required
                  disabled={blocked}
                  placeholder={message('campaign.namePlaceholder')}
                  onChange={(e) => {
                    if (!publicBlocked()) setName(e.target.value)
                  }}
                />
                <div className="campaign-popup-actions">
                  <button
                    className="primary"
                    disabled={blocked || !name.trim()}
                  >
                    {message(
                      popup.kind === 'edit'
                        ? 'action.save'
                        : 'campaign.createOpen'
                    )}
                  </button>
                </div>
              </form>
              {editing && (
                <div className="campaign-danger-zone">
                  <p>
                    {message('campaign.trashHint')}
                    {props.snapshot.activeCampaignId === editing.id && (
                      <> {message('campaign.trashActiveHint')}</>
                    )}
                  </p>
                  <button
                    className="campaign-danger"
                    disabled={blocked}
                    onClick={() =>
                      void run({ kind: 'trash', id: editing.id }, () => {
                        removedFocus()
                        setNotice(message('campaign.trashed'))
                      })
                    }
                  >
                    {message('campaign.toTrash')}
                  </button>
                </div>
              )}
            </>
          )}
          {popup.kind === 'trash' && (
            <>
              <p>
                {message(
                  props.snapshot.trashedCampaigns.length
                    ? 'campaign.restoreHint'
                    : 'campaign.trashEmpty'
                )}
              </p>
              <ul className="campaign-screen-list">
                {props.snapshot.trashedCampaigns.map((c) => (
                  <li key={c.id}>
                    <div className="campaign-identity">
                      <strong>{c.name}</strong>
                      <small>
                        {formatMessage('campaign.trashedAt', {
                          date: new Intl.DateTimeFormat('de-DE', {
                            dateStyle: 'short'
                          }).format(new Date(c.trashedAt))
                        })}
                      </small>
                    </div>
                    <div className="campaign-row-actions">
                      <button
                        disabled={blocked}
                        onClick={() =>
                          void run({ kind: 'restore', id: c.id }, () => {
                            setNotice(message('campaign.restored'))
                            requestAnimationFrame(() =>
                              document
                                .querySelector<HTMLButtonElement>(
                                  '.campaign-management-popup header button'
                                )
                                ?.focus()
                            )
                          })
                        }
                      >
                        {message('campaign.restore')}
                      </button>
                      <button
                        className="campaign-danger"
                        disabled={blocked}
                        onClick={() => {
                          if (publicBlocked()) return
                          setConfirmation('')
                          setNotice('')
                          setPopup({ kind: 'delete', id: c.id })
                        }}
                      >
                        {message('campaign.deleteButton')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {deleting && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (
                  !publicBlocked() &&
                  confirmationRef.current === deleting.name
                )
                  void run(
                    {
                      kind: 'delete',
                      id: deleting.id,
                      confirmationName: confirmationRef.current
                    },
                    () => {
                      setPopup({ kind: 'trash' })
                      setNotice(message('campaign.deleted'))
                    }
                  )
              }}
            >
              <p>
                {formatMessage('campaign.confirmDelete', {
                  name: deleting.name
                })}
              </p>
              <label htmlFor="campaign-confirm-name">
                {message('campaign.confirmName')}
              </label>
              <input
                id="campaign-confirm-name"
                autoFocus
                disabled={blocked}
                value={confirmation}
                onChange={(e) => {
                  if (!publicBlocked()) setConfirmation(e.target.value)
                }}
              />
              <div className="campaign-popup-actions">
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => {
                    if (!publicBlocked()) setPopup({ kind: 'trash' })
                  }}
                >
                  {message('action.cancel')}
                </button>
                <button
                  className="campaign-danger"
                  disabled={blocked || confirmation !== deleting.name}
                >
                  {message('campaign.deleteForever')}
                </button>
              </div>
            </form>
          )}
        </ModalDialog>
      )}
    </section>
  )
}
