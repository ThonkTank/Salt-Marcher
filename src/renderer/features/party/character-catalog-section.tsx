import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import { partyCharacterMatchesSearch } from './party-search.js'
import { message, formatMessage } from '../../i18n/session-runtime.de.js'
import {
  lazy,
  Suspense,
  useState,
  useLayoutEffect,
  useSyncExternalStore,
  useRef,
  useCallback
} from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type {
  PartyCharacter,
  PartyCharacterDraft
} from '../../../shared/contracts/party.js'
import { CharacterCommandController } from './character-command-controller.js'
import { useCharacterCommandPort } from './use-character-command-port.js'
import { CharacterProfileForm } from './character-profile-form.js'
import {
  characterFields,
  characterProfileKey,
  characterShortId
} from './character-profile.js'
import './character-catalog.css'

const Ledger = lazy(async () => ({
  default: (await import('../loot/character-loot-ledger-dialog.js'))
    .CharacterLootLedgerDialog
}))

export default function CharacterCatalogSection(props: {
  campaignId: string
  snapshot: LiveSessionSnapshot
  selectedId: string | null
  select: (id: string | null) => void
  onError: (message: string) => void
}) {
  const port = useCharacterCommandPort(props.campaignId)
  const [controller] = useState(() => new CharacterCommandController(port))
  const command = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot
  )
  const [query, setQuery] = useState('')
  const [editing, setEditingState] = useState<{
    base: PartyCharacter | null
  } | null>(null)
  const [confirmDelete, setConfirmDeleteState] = useState<string | null>(null)
  const [ledger, setLedger] = useState<PartyCharacter | null>(null)
  const [error, setError] = useState<string | null>(null)
  const editingRef = useRef(editing)
  const confirmRef = useRef<string | null>(null)
  const submitRef = useRef<(() => Promise<boolean>) | null>(null)
  const registerSave = useCallback((submit: () => Promise<boolean>) => {
    submitRef.current = submit
    return () => {
      if (submitRef.current === submit) submitRef.current = null
    }
  }, [])
  const setEditing = (value: typeof editing) => {
    editingRef.current = value
    setEditingState(value)
  }
  const setConfirmDelete = (value: string | null) => {
    confirmRef.current = value
    setConfirmDeleteState(value)
  }
  useLayoutEffect(() => {
    controller.attach((receipt, current) => {
      editingRef.current = null
      setEditingState(null)
      confirmRef.current = null
      setConfirmDeleteState(null)
      setError(null)
      props.select(
        current.party.members.some(
          (member) => member.id === receipt.characterId
        )
          ? receipt.characterId
          : null
      )
    })
  })
  useLayoutEffect(() => controller.detach, [controller])
  async function drain() {
    return controller.settle()
  }
  const blocked = useMaintenanceDraft({
    label: 'Charakterkatalog',
    isDirty: () =>
      Boolean(
        editingRef.current || confirmRef.current || controller.unresolved()
      ),
    save: async () => {
      if (!(await drain())) return false
      if (editingRef.current && !(await submitRef.current?.())) return false
      setConfirmDelete(null)
      return !editingRef.current && !controller.unresolved()
    },
    discard: async () => {
      if (!(await drain())) return false
      setEditing(null)
      setConfirmDelete(null)
      setError(null)
      controller.reset()
      return true
    }
  })
  const commandBusy = command.busy
  const uncertain = command.uncertain
  const busy = commandBusy || blocked || uncertain
  const displayedError = command.error ?? error
  const members = props.snapshot.party.members
  const selected =
    members.find((member) => member.id === props.selectedId) ?? null
  const visible = members.filter((member) =>
    partyCharacterMatchesSearch(member, query.trim())
  )
  const status = (member: PartyCharacter) =>
    props.snapshot.scene.scenes.find((scene) =>
      scene.partyMemberIds.includes(member.id)
    )?.title ??
    (member.active
      ? message('character.unassigned')
      : message('character.inactive'))
  function select(id: string | null) {
    if (
      editingRef.current ||
      confirmRef.current ||
      busy ||
      maintenanceDraftCoordinator.isLocked() ||
      controller.unresolved()
    )
      return
    setEditing(null)
    setConfirmDelete(null)
    setError(null)
    controller.reset()
    props.select(id)
  }
  function save(draft: PartyCharacterDraft): Promise<boolean> {
    if (!editingRef.current) return Promise.resolve(false)
    const base = editingRef.current.base
    const current = base && members.find((member) => member.id === base.id)
    if (
      base &&
      (!current || characterProfileKey(base) !== characterProfileKey(current))
    ) {
      setError(message('character.conflict'))
      return Promise.resolve(false)
    }
    const character = {
      ...draft,
      species: draft.species ?? null,
      characterClass: draft.characterClass ?? null,
      languages: draft.languages ?? [],
      passiveInvestigation: draft.passiveInvestigation ?? null,
      passiveInsight: draft.passiveInsight ?? null,
      movementSpeedFeet: draft.movementSpeedFeet ?? null
    }
    return controller.execute({
      commandId: crypto.randomUUID(),
      command: base
        ? {
            kind: 'update',
            input: {
              id: base.id,
              character,
              expectedRevision: props.snapshot.party.revision
            }
          }
        : {
            kind: 'create',
            input: {
              character,
              expectedRevision: props.snapshot.party.revision
            }
          }
    })
  }

  return (
    <div className="character-catalog-layout">
      <aside className="character-catalog-list">
        <div className="character-catalog-tools">
          <input
            aria-label={message('character.search')}
            placeholder={message('character.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            disabled={busy || !!editing || !!confirmDelete}
            onClick={() => {
              if (
                editingRef.current ||
                confirmRef.current ||
                maintenanceDraftCoordinator.isLocked() ||
                controller.unresolved() ||
                command.uncertain
              )
                return
              select(null)
              setEditing({ base: null })
            }}
          >
            {message('character.new')}
          </button>
        </div>
        <div
          className="character-roster"
          aria-label={message('character.roster')}
        >
          {visible.map((member) => (
            <button
              key={member.id}
              disabled={busy || !!editing || !!confirmDelete}
              aria-pressed={selected?.id === member.id}
              onClick={() => select(member.id)}
            >
              <strong>{member.name}</strong>
              <span>
                {member.playerName ?? '—'} ·{' '}
                {formatMessage('character.levelValue', {
                  level: member.level ?? '—'
                })}
              </span>
              <small>
                {status(member)}
                {members.some(
                  (other) =>
                    other.id !== member.id && other.name === member.name
                )
                  ? ` · ${characterShortId(member, members)}`
                  : ''}
              </small>
            </button>
          ))}
          {!visible.length && <p>{message('character.emptySearch')}</p>}
        </div>
      </aside>
      <section
        className="character-catalog-detail"
        aria-label={message('character.details')}
      >
        {editing ? (
          <CharacterProfileForm
            key={editing.base?.id ?? 'new'}
            member={editing.base}
            busy={commandBusy || uncertain}
            registerSave={registerSave}
            error={displayedError}
            save={save}
            close={() => {
              setEditing(null)
              setError(null)
              controller.reset()
            }}
          />
        ) : selected ? (
          <>
            <header>
              <h2>{selected.name}</h2>
              <span>
                {selected.playerName ?? '—'} · {status(selected)}
              </span>
            </header>
            <div className="character-actions">
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    !maintenanceDraftCoordinator.isLocked() &&
                    !controller.unresolved() &&
                    !command.uncertain
                  )
                    setEditing({ base: selected })
                }}
              >
                {message('character.edit')}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    !maintenanceDraftCoordinator.isLocked() &&
                    !controller.unresolved() &&
                    !command.uncertain
                  )
                    setLedger(selected)
                }}
              >
                {message('character.loot')}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    !maintenanceDraftCoordinator.isLocked() &&
                    !controller.unresolved() &&
                    !command.uncertain
                  )
                    setConfirmDelete(characterProfileKey(selected))
                }}
              >
                {message('character.delete')}
              </button>
            </div>
            {confirmDelete === characterProfileKey(selected) && (
              <div
                className="character-delete-confirm"
                role="group"
                aria-label={message('character.confirm')}
              >
                <p>
                  {formatMessage('character.confirmName', {
                    name: selected.name
                  })}
                </p>
                <div className="character-actions">
                  <button
                    disabled={busy}
                    onClick={() => setConfirmDelete(null)}
                  >
                    {message('character.cancel')}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (maintenanceDraftCoordinator.isLocked()) return
                      void controller.execute({
                        commandId: crypto.randomUUID(),
                        command: {
                          kind: 'delete',
                          input: {
                            id: selected.id,
                            expectedRevision: props.snapshot.party.revision
                          }
                        }
                      })
                    }}
                  >
                    {message('character.deleteForever')}
                  </button>
                </div>
              </div>
            )}
            <dl className="character-facts">
              {characterFields
                .filter(
                  (field) => field.key !== 'name' && field.key !== 'playerName'
                )
                .map(({ key, label }) => (
                  <div key={key}>
                    <dt>
                      {message(
                        key === 'languages' ? 'character.languagesTitle' : label
                      )}
                    </dt>
                    <dd>
                      {key === 'languages'
                        ? selected.languages.join(', ') || '—'
                        : (selected[key] ?? '—')}
                    </dd>
                  </div>
                ))}
              <div>
                <dt>XP</dt>
                <dd>
                  {selected.xp} / {selected.nextLevelXp ?? '—'}
                </dd>
              </div>
            </dl>
            <small className="character-identifier">
              {formatMessage('character.identifier', { id: selected.id })}
            </small>
            {displayedError && <p role="alert">{displayedError}</p>}
          </>
        ) : (
          <p>{message('character.select')}</p>
        )}
        {!editing && !selected && displayedError && (
          <p role="alert">{displayedError}</p>
        )}
        {uncertain && (
          <button
            disabled={commandBusy || blocked}
            onClick={() => void controller.settle()}
          >
            {message('character.checkSavedState')}
          </button>
        )}
      </section>
      <Suspense fallback={null}>
        {ledger && (
          <Ledger
            character={ledger}
            close={() => setLedger(null)}
            onError={props.onError}
          />
        )}
      </Suspense>
    </div>
  )
}
