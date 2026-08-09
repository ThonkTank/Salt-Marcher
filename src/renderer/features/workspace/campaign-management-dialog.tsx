import { useState, type FormEvent } from 'react'
import type { CampaignSnapshot } from '../../../shared/contracts/campaign.js'
import { formatMessage, message } from '../../i18n/campaign-menu-runtime.de.js'
import { ModalCloseButton, ModalDialog } from '../../shell/modal-dialog.js'

export function CampaignManagementDialog(props: {
  snapshot: CampaignSnapshot
  forced: boolean
  dismiss: () => void
  completed: () => void
  create: (name: string) => Promise<void>
  activate: (id: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  trash: (id: string) => Promise<void>
  restore: (id: string) => Promise<void>
  deleteForever: (id: string, confirmationName: string) => Promise<void>
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
    await props.create(newName)
    setNewName('')
    props.completed()
  }

  async function submitRename(event: FormEvent, id: string) {
    event.preventDefault()
    await props.rename(id, renameName)
    setRenamingId(null)
    setRenameName('')
  }

  return (
    <ModalDialog
      className="campaign-dialog"
      ariaLabel={message('nav.campaigns')}
      onClose={props.forced ? () => undefined : props.dismiss}
      dismissOnBackdrop={!props.forced}
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
                    onSubmit={(event) => void submitRename(event, campaign.id)}
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
                        void props.activate(campaign.id).then(props.completed)
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
                  <span className="campaign-trashed-name">{campaign.name}</span>
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
              {formatMessage('campaign.confirmDelete', { name: deleting.name })}
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
                    .then(() => setDeletingId(null))
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
      </section>
    </ModalDialog>
  )
}
