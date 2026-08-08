import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { CampaignSnapshot } from '../../../shared/contracts/campaign.js'
import { formatMessage, message } from '../../i18n/workspace-runtime.de.js'
import type { GeneratorPresetCapability } from '../../../shared/contracts/capability-api.js'
import { defaultGeneratorConfig } from '../../../shared/contracts/generator-presets.js'
import { ModalCloseButton, ModalDialog } from '../../shell/modal-dialog.js'

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
  generatorPresets: GeneratorPresetCapability
  onError: (message: string) => void
}

export function CampaignMenu(props: CampaignMenuProps) {
  const { dismiss, forced, open, snapshot } = props
  const { generatorPresets, onError } = props
  const menuRef = useRef<HTMLElement>(null)
  const createInputRef = useRef<HTMLInputElement>(null)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmationName, setConfirmationName] = useState('')
  const [presetSnapshot, setPresetSnapshot] = useState<Awaited<
    ReturnType<GeneratorPresetCapability['read']>
  > | null>(null)
  const [presetName, setPresetName] = useState('')
  const [presetId, setPresetId] = useState<string | null>(null)
  const [presetConfig, setPresetConfig] = useState(defaultGeneratorConfig)
  const [menuView, setMenuView] = useState<'root' | 'campaigns' | 'settings'>(
    'root'
  )
  const [settingsTab, setSettingsTab] = useState<'generator'>('generator')
  const [presetError, setPresetError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || menuView !== 'root') return
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
  }, [dismiss, forced, menuView, open])

  useEffect(() => {
    if (open && forced && snapshot.campaigns.length === 0)
      createInputRef.current?.focus()
  }, [forced, open, snapshot.campaigns.length])

  const rootMenu = (
    <section
      ref={menuRef}
      id="campaign-menu"
      className="campaign-menu"
      aria-labelledby="campaign-menu-title"
    >
      <header>
        <div>
          <p className="section-kicker">{message('app.menu')}</p>
          <h2 id="campaign-menu-title">{message('app.menu')}</h2>
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
      <div className="campaign-menu-section">
        <button
          type="button"
          className="campaign-select"
          onClick={() => setMenuView('campaigns')}
        >
          <strong>{message('menu.manageCampaigns')}</strong>
          <small>{message('menu.manageCampaignsHint')}</small>
        </button>
        <button
          type="button"
          className="campaign-select"
          onClick={() => setMenuView('settings')}
        >
          <strong>{message('menu.settings')}</strong>
          <small>{message('menu.settingsHint')}</small>
        </button>
      </div>
    </section>
  )

  const loadPresets = useCallback(async () => {
    setPresetError(null)
    try {
      const next = await generatorPresets.read()
      setPresetSnapshot(next)
      const selected =
        next.presets.find(
          (p) => p.id === (next.activePresetId ?? next.presets[0]?.id)
        ) ?? next.presets[0]
      if (selected) {
        setPresetId(selected.id)
        setPresetName(selected.name)
        setPresetConfig(selected.config)
      }
    } catch (cause) {
      const text =
        cause instanceof Error ? cause.message : message('error.unknown')
      setPresetError(text)
      onError(text)
    }
  }, [generatorPresets, onError])

  useEffect(() => {
    if (open && menuView === 'settings' && presetSnapshot === null)
      queueMicrotask(() => void loadPresets())
  }, [loadPresets, menuView, open, presetSnapshot])

  if (!open) return null
  if (menuView === 'root') return rootMenu

  const closeSubmenu = () => {
    setMenuView('root')
    dismiss()
  }

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

  const submenu = (
    <section
      ref={menuRef}
      id="campaign-menu"
      className="campaign-menu"
      aria-labelledby="campaign-menu-title"
    >
      <header>
        <div>
          <p className="section-kicker">{message('campaign.archive')}</p>
          <h2 id="campaign-menu-title">
            {menuView === 'settings'
              ? message('menu.settings')
              : message('nav.campaigns')}
          </h2>
        </div>
        <ModalCloseButton
          aria-label={message('action.close')}
          disabled={forced && menuView === 'campaigns'}
        >
          ×
        </ModalCloseButton>
      </header>

      {menuView === 'settings' && (
        <nav
          className="campaign-menu-tabs"
          aria-label={message('menu.settings')}
        >
          <button
            type="button"
            aria-current="page"
            onClick={() => setSettingsTab('generator')}
          >
            {message('menu.generatorTab')}
          </button>
        </nav>
      )}

      {menuView === 'campaigns' && (
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
      )}

      {menuView === 'campaigns' && (
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
      )}

      {menuView === 'campaigns' &&
        props.snapshot.trashedCampaigns.length > 0 && (
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

      {menuView === 'campaigns' && deleting && (
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
      {menuView === 'settings' && settingsTab === 'generator' && (
        <div className="campaign-menu-section generator-presets">
          <h3>{message('generator.advanced')}</h3>
          {presetError && <p role="alert">{presetError}</p>}
          {!presetSnapshot && !presetError && (
            <p role="status">{message('generator.loading')}</p>
          )}
          {presetError && (
            <button type="button" onClick={() => void loadPresets()}>
              {message('generator.retry')}
            </button>
          )}
          {presetSnapshot && (
            <form
              onSubmit={(event) => {
                void (async () => {
                  event.preventDefault()
                  const next =
                    presetId &&
                    !presetSnapshot.presets.find((p) => p.id === presetId)
                      ?.protected
                      ? await props.generatorPresets.update(
                          presetId,
                          presetName,
                          presetConfig,
                          presetSnapshot.revision
                        )
                      : await props.generatorPresets.create(
                          presetName || 'Neues Preset',
                          presetConfig,
                          presetSnapshot.revision
                        )
                  setPresetSnapshot(next)
                })()
              }}
            >
              <label>
                {message('generator.preset')}
                <select
                  value={presetId ?? ''}
                  onChange={(event) => {
                    const p = presetSnapshot.presets.find(
                      (x) => x.id === event.target.value
                    )
                    if (p) {
                      setPresetId(p.id)
                      setPresetName(p.name)
                      setPresetConfig(p.config)
                    }
                  }}
                >
                  {presetSnapshot.presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.protected ? ` (${message('generator.system')})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {message('generator.name')}
                <input
                  value={presetName}
                  onChange={(event) => setPresetName(event.target.value)}
                />
              </label>
              <label>
                {message('generator.autoDifficulty')}
                <select
                  value={presetConfig.autoDifficulty}
                  onChange={(event) =>
                    setPresetConfig({
                      ...presetConfig,
                      autoDifficulty: event.target
                        .value as typeof presetConfig.autoDifficulty
                    })
                  }
                >
                  <option value="easy">{message('generator.easy')}</option>
                  <option value="medium">{message('generator.medium')}</option>
                  <option value="hard">{message('generator.hard')}</option>
                  <option value="deadly">{message('generator.deadly')}</option>
                </select>
              </label>
              <label>
                {message('generator.maxStandard')}
                <input
                  type="number"
                  min="1"
                  value={presetConfig.maxCounts.standard}
                  onChange={(event) =>
                    setPresetConfig({
                      ...presetConfig,
                      maxCounts: {
                        ...presetConfig.maxCounts,
                        standard: Number(event.target.value)
                      }
                    })
                  }
                />
              </label>
              <label>
                {message('generator.maxCombination')}
                <input
                  type="number"
                  min="1"
                  max="3"
                  value={presetConfig.maxCombinationSize}
                  onChange={(event) =>
                    setPresetConfig({
                      ...presetConfig,
                      maxCombinationSize: Number(event.target.value)
                    })
                  }
                />
              </label>
              <div className="campaign-row-actions">
                <button type="submit">{message('generator.save')}</button>
                <button
                  type="button"
                  onClick={() =>
                    void props.generatorPresets
                      .assign(
                        snapshot.activeCampaignId!,
                        presetId,
                        presetSnapshot.revision
                      )
                      .then(setPresetSnapshot)
                  }
                >
                  {message('generator.assign')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  )

  return (
    <ModalDialog
      className="campaign-settings-dialog"
      ariaLabel={
        menuView === 'settings'
          ? message('menu.settings')
          : message('menu.manageCampaigns')
      }
      onClose={closeSubmenu}
    >
      {submenu}
    </ModalDialog>
  )
}
