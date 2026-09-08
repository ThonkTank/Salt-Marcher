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
  create: (name: string) => Promise<boolean>
  activate: (id: string) => Promise<boolean>
  rename: (id: string, name: string) => Promise<boolean>
  trash: (id: string) => Promise<boolean>
  restore: (id: string) => Promise<boolean>
  deleteForever: (id: string, confirmationName: string) => Promise<boolean>
  reconciliationPending: boolean
  reconcile: () => Promise<CampaignCommandReceipt | null>
}
export interface CampaignScreenProps extends CampaignActions {
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
  | { kind: 'edit'; id: string }
  | { kind: 'trash' }
  | { kind: 'delete'; id: string }

export function CampaignScreen(props: CampaignScreenProps) {
  const [popup, setPopup] = useState<Popup | null>(null)
  const [name, setName] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [notice, setNotice] = useState('')
  const [localBusy, setLocalBusy] = useState(false)
  const pending = useRef(false)
  const createButton = useRef<HTMLButtonElement>(null)
  const blocked = props.busy || localBusy || props.reconciliationPending
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
  }
  const removedFocus = () => {
    close()
    requestAnimationFrame(() => createButton.current?.focus())
  }

  async function run(action: () => Promise<boolean>, accepted?: () => void) {
    if (pending.current || blocked) return
    pending.current = true
    setLocalBusy(true)
    setNotice('')
    try {
      if (await action()) accepted?.()
    } finally {
      pending.current = false
      setLocalBusy(false)
    }
  }
  async function reconcile() {
    if (pending.current || props.busy) return
    pending.current = true
    setLocalBusy(true)
    try {
      const receipt = await props.reconcile()
      if (!receipt) return
      if (receipt.kind === 'restored') setNotice(message('campaign.restored'))
      else if (receipt.kind === 'deleted') {
        setPopup({ kind: 'trash' })
        setNotice(message('campaign.deleted'))
      } else removedFocus()
    } finally {
      pending.current = false
      setLocalBusy(false)
    }
  }
  const status = (
    <>
      {props.error && (
        <p role="alert" className="error-message">
          {props.error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {props.reconciliationPending && (
        <div className="campaign-reconciliation" role="status">
          <p>{message('campaign.reconciliationPending')}</p>
          <button
            disabled={props.busy || localBusy}
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
    if (!name.trim()) return
    void run(
      () =>
        editing
          ? props.rename(editing.id, name.trim())
          : props.create(name.trim()),
      close
    )
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
        <button onClick={() => void props.retryCatalog()}>
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
              onClick={() => void run(props.retrySession)}
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
                    onClick={() => void run(() => props.activate(c.id))}
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
                      setName(c.name)
                      setNotice('')
                      setPopup({ kind: 'edit', id: c.id })
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
          onClose={
            popup.kind === 'delete' ? () => setPopup({ kind: 'trash' }) : close
          }
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
          {(popup.kind === 'new' || editing) && (
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
                  onChange={(e) => setName(e.target.value)}
                />
                <div className="campaign-popup-actions">
                  <button
                    className="primary"
                    disabled={blocked || !name.trim()}
                  >
                    {message(editing ? 'action.save' : 'campaign.createOpen')}
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
                      void run(
                        () => props.trash(editing.id),
                        () => {
                          removedFocus()
                          setNotice(message('campaign.trashed'))
                        }
                      )
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
                          void run(
                            () => props.restore(c.id),
                            () => {
                              setNotice(message('campaign.restored'))
                              requestAnimationFrame(() =>
                                document
                                  .querySelector<HTMLButtonElement>(
                                    '.campaign-management-popup header button'
                                  )
                                  ?.focus()
                              )
                            }
                          )
                        }
                      >
                        {message('campaign.restore')}
                      </button>
                      <button
                        className="campaign-danger"
                        disabled={blocked}
                        onClick={() => {
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
                if (confirmation === deleting.name)
                  void run(
                    () => props.deleteForever(deleting.id, confirmation),
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
                onChange={(e) => setConfirmation(e.target.value)}
              />
              <div className="campaign-popup-actions">
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => setPopup({ kind: 'trash' })}
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
