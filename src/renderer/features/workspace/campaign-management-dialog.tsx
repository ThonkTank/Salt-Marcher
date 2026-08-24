import { useState, type FormEvent } from 'react'
import type {
  CampaignCommandReceipt,
  CampaignSnapshot
} from '../../../shared/contracts/campaign.js'
import { formatMessage, message } from '../../i18n/campaign-menu-runtime.de.js'
import { ModalCloseButton, ModalDialog } from '../../shell/modal-dialog.js'

export function CampaignManagementDialog(props: {
  snapshot: CampaignSnapshot
  forced: boolean
  dismiss: () => void
  completed: () => void
  create: (name: string) => Promise<boolean>
  activate: (id: string) => Promise<boolean>
  rename: (id: string, name: string) => Promise<boolean>
  trash: (id: string) => Promise<boolean>
  restore: (id: string) => Promise<boolean>
  deleteForever: (id: string, confirmationName: string) => Promise<boolean>
  reconciliationPending: boolean
  reconcile: () => Promise<CampaignCommandReceipt | null>
}) {
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmationName, setConfirmationName] = useState('')
  const deleting = props.snapshot.trashedCampaigns.find(
    (campaign) => campaign.id === deletingId
  )

  async function submitCreate(event: FormEvent) {
    event.preventDefault()
    if (!(await props.create(newName))) return
    setNewName('')
    props.completed()
  }

  async function submitRename(event: FormEvent, id: string) {
    event.preventDefault()
    if (!(await props.rename(id, renameName))) return
    setRenamingId(null)
    setRenameName('')
  }

  async function reconcilePending(): Promise<void> {
    const receipt = await props.reconcile()
    if (!receipt) return
    switch (receipt.kind) {
      case 'created':
        setNewName('')
        props.completed()
        return
      case 'activated':
        props.completed()
        return
      case 'renamed':
        setRenamingId(null)
        setRenameName('')
        return
      case 'deleted':
        setDeletingId(null)
        setConfirmationName('')
        return
      case 'trashed':
      case 'restored':
        return
    }
  }

  return (
    <ModalDialog
      className="campaign-dialog"
      ariaLabel={message('nav.campaigns')}
      onClose={props.forced ? () => undefined : props.dismiss}
      dismissOnBackdrop={!props.forced}
      busy={props.reconciliationPending}
    >
      <section id="campaign-menu" className="campaign-dialog-content">
        <header>
          <h2>{message('nav.campaigns')}</h2>
          {!props.forced && (
            <ModalCloseButton aria-label={message('action.close')}>
              ×
            </ModalCloseButton>
          )}
        </header>
        {props.reconciliationPending && (
          <div className="campaign-reconciliation" role="status">
            <p>{message('campaign.reconciliationPending')}</p>
            <button type="button" onClick={() => void reconcilePending()}>
              {message('campaign.reconciliationCheck')}
            </button>
          </div>
        )}
        <fieldset
          className="campaign-reconciliation-scope"
          disabled={props.reconciliationPending}
        >
          <form
            className="campaign-create"
            onSubmit={(event) => void submitCreate(event)}
          >
            <input
              id="campaign-name"
              aria-label={message('campaign.name')}
              placeholder={message('campaign.namePlaceholder')}
              value={newName}
              required
              maxLength={100}
              onChange={(event) => setNewName(event.target.value)}
            />
            <button className="primary">{message('action.add')}</button>
          </form>
          <div className="campaign-menu-section">
            {props.snapshot.campaigns.length === 0 && (
              <p className="campaign-empty">{message('campaign.none')}</p>
            )}
            <ul className="campaign-menu-list">
              {props.snapshot.campaigns.map((campaign) => (
                <li key={campaign.id}>
                  {renamingId === campaign.id ? (
                    <form
                      className="campaign-rename"
                      onSubmit={(event) =>
                        void submitRename(event, campaign.id)
                      }
                    >
                      <input
                        aria-label={message('campaign.rename')}
                        value={renameName}
                        required
                        maxLength={100}
                        autoFocus
                        onChange={(event) => setRenameName(event.target.value)}
                      />
                      <button>{message('action.save')}</button>
                      <button type="button" onClick={() => setRenamingId(null)}>
                        {message('action.cancel')}
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="campaign-select"
                        aria-label={campaign.name}
                        aria-current={
                          props.snapshot.activeCampaignId === campaign.id
                            ? 'page'
                            : undefined
                        }
                        onClick={() =>
                          void props.activate(campaign.id).then((completed) => {
                            if (completed) props.completed()
                          })
                        }
                      >
                        <strong>{campaign.name}</strong>
                        <small>
                          {props.snapshot.activeCampaignId === campaign.id
                            ? message('campaign.active')
                            : message('campaign.open')}
                        </small>
                      </button>
                      <div className="campaign-row-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingId(campaign.id)
                            setRenameName(campaign.name)
                          }}
                        >
                          {message('campaign.rename')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void props.trash(campaign.id)}
                        >
                          {message('campaign.toTrash')}
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {props.snapshot.trashedCampaigns.length > 0 && (
            <details className="campaign-trash">
              <summary>
                {message('campaign.trash')} (
                {props.snapshot.trashedCampaigns.length})
              </summary>
              <ul className="campaign-menu-list">
                {props.snapshot.trashedCampaigns.map((campaign) => (
                  <li key={campaign.id}>
                    <span className="campaign-trashed-name">
                      {campaign.name}
                    </span>
                    <div className="campaign-row-actions">
                      <button
                        type="button"
                        onClick={() => void props.restore(campaign.id)}
                      >
                        {message('campaign.restore')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeletingId(campaign.id)
                          setConfirmationName('')
                        }}
                      >
                        {message('campaign.deleteForever')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {deleting && (
            <div className="campaign-delete-confirm" role="alertdialog">
              <p>
                {formatMessage('campaign.confirmDelete', {
                  name: deleting.name
                })}
              </p>
              <input
                aria-label={message('campaign.confirmName')}
                value={confirmationName}
                autoFocus
                onChange={(event) => setConfirmationName(event.target.value)}
              />
              <div className="campaign-row-actions">
                <button
                  type="button"
                  disabled={confirmationName !== deleting.name}
                  onClick={() => {
                    void props
                      .deleteForever(deleting.id, confirmationName)
                      .then((completed) => {
                        if (completed) setDeletingId(null)
                      })
                  }}
                >
                  {message('campaign.deleteForever')}
                </button>
                <button type="button" onClick={() => setDeletingId(null)}>
                  {message('action.cancel')}
                </button>
              </div>
            </div>
          )}
        </fieldset>
      </section>
    </ModalDialog>
  )
}
