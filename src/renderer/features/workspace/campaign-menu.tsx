import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { CampaignSnapshot } from '../../../shared/contracts/campaign.js'
import { formatMessage, message } from '../../i18n/messages.de.js'

interface CampaignMenuProps {
  snapshot: CampaignSnapshot
  open: boolean
  forced: boolean
  dismiss: () => void
  create: (name: string) => Promise<void>
  activate: (id: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  trash: (id: string) => Promise<void>
  restore: (id: string) => Promise<void>
  deleteForever: (id: string, confirmationName: string) => Promise<void>
}

export function CampaignMenu(props: CampaignMenuProps) {
  const { dismiss, forced, open, snapshot } = props
  const menuRef = useRef<HTMLElement>(null)
  const createInputRef = useRef<HTMLInputElement>(null)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmationName, setConfirmationName] = useState('')

  useEffect(() => {
    if (!open) return
    const dismissOnPointer = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (
        !forced &&
        !menuRef.current?.contains(target) &&
        !(target instanceof Element && target.closest('.menu-button'))
      )
        dismiss()
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !forced) dismiss()
    }
    document.addEventListener('pointerdown', dismissOnPointer)
    document.addEventListener('keydown', dismissOnEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOnPointer)
      document.removeEventListener('keydown', dismissOnEscape)
    }
  }, [dismiss, forced, open])

  useEffect(() => {
    if (open && forced && snapshot.campaigns.length === 0)
      createInputRef.current?.focus()
  }, [forced, open, snapshot.campaigns.length])

  if (!open) return null

  async function submitCreate(event: FormEvent) {
    event.preventDefault()
    await props.create(newName)
    setNewName('')
  }

  async function submitRename(event: FormEvent, id: string) {
    event.preventDefault()
    await props.rename(id, renameName)
    setRenamingId(null)
    setRenameName('')
  }

  const deleting = snapshot.trashedCampaigns.find(
    (campaign) => campaign.id === deletingId
  )

  return (
    <section
      ref={menuRef}
      id="campaign-menu"
      className="campaign-menu"
      aria-labelledby="campaign-menu-title"
    >
      <header>
        <div>
          <p className="section-kicker">{message('campaign.archive')}</p>
          <h2 id="campaign-menu-title">{message('nav.campaigns')}</h2>
        </div>
        {!forced && (
          <button
            type="button"
            className="compact"
            onClick={dismiss}
            aria-label={message('action.close')}
          >
            ×
          </button>
        )}
      </header>

      <form
        className="campaign-create"
        onSubmit={(event) => void submitCreate(event)}
      >
        <label htmlFor="campaign-name">{message('campaign.new')}</label>
        <div className="inline-form">
          <input
            ref={createInputRef}
            id="campaign-name"
            placeholder={message('campaign.name')}
            value={newName}
            required
            maxLength={100}
            onChange={(event) => setNewName(event.target.value)}
          />
          <button>{message('action.createCampaign')}</button>
        </div>
      </form>

      <div className="campaign-menu-section">
        <h3>{message('campaign.available')}</h3>
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
                    onClick={() => void props.activate(campaign.id)}
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
  )
}
