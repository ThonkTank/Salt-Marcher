import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import { CapabilityContext } from '../../capabilities/capability-context.js'
import { message, formatMessage } from '../../i18n/session-runtime.de.js'
import {
  lazy,
  Suspense,
  useMemo,
  useState,
  useContext,
  useRef,
  useCallback
} from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type {
  PartyCharacter,
  PartyCharacterDraft,
  PartySnapshot
} from '../../../shared/contracts/party.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { useAsyncCommandCoordinator } from '../../async/use-async-command-coordinator.js'
import { partyCapabilities } from './party-capabilities.js'
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
  const api = useCapabilityApi()
  const workspace = useContext(CapabilityContext)!.campaignWorkspace
  const party = useMemo(() => partyCapabilities(api).party, [api])
  const commands = useAsyncCommandCoordinator()
  const [query, setQuery] = useState('')
  const [editing, setEditingState] = useState<{
    base: PartyCharacter | null
  } | null>(null)
  const [confirmDelete, setConfirmDeleteState] = useState<string | null>(null)
  const [ledger, setLedger] = useState<PartyCharacter | null>(null)
  const [error, setError] = useState<string | null>(null)
  const editingRef = useRef(editing)
  const confirmRef = useRef<string | null>(null)
  const pending = useRef<Promise<boolean> | null>(null)
  const unknown = useRef(false)
  const [uncertain, setUncertain] = useState(false)
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
  async function drain() {
    await pending.current
    if (unknown.current)
      throw new Error(
        'Der Ausgang der Charakterspeicherung ist unbekannt. Die Wartung kann noch nicht fortgesetzt werden.'
      )
  }
  const blocked = useMaintenanceDraft({
    label: 'Charakterkatalog',
    isDirty: () =>
      Boolean(
        editingRef.current ||
        confirmRef.current ||
        pending.current ||
        unknown.current
      ),
    save: async () => {
      await drain()
      if (editingRef.current && !(await submitRef.current?.())) return false
      setConfirmDelete(null)
      return !editingRef.current && !unknown.current
    },
    discard: async () => {
      await drain()
      setEditing(null)
      setConfirmDelete(null)
      setError(null)
      return true
    }
  })
  const target = { scope: 'character-catalog', entityKey: props.campaignId }
  const commandBusy = commands.state(target).status === 'pending'
  const busy = commandBusy || blocked || uncertain
  const members = props.snapshot.party.members
  const selected =
    members.find((member) => member.id === props.selectedId) ?? null
  const visible = members.filter((member) =>
    `${member.name} ${member.playerName ?? ''} ${member.id}`
      .toLocaleLowerCase('de-DE')
      .includes(query.trim().toLocaleLowerCase('de-DE'))
  )
  const status = (member: PartyCharacter) =>
    props.snapshot.scene.scenes.find((scene) =>
      scene.partyMemberIds.includes(member.id)
    )?.title ?? message('character.inactive')
  function select(id: string | null) {
    if (busy || maintenanceDraftCoordinator.isLocked() || pending.current)
      return
    setEditing(null)
    setConfirmDelete(null)
    setError(null)
    props.select(id)
  }
  function mutate(
    execute: () => Promise<PartySnapshot>,
    accept: (result: PartySnapshot) => void,
    maintenanceSave = false
  ): Promise<boolean> {
    if (
      pending.current ||
      unknown.current ||
      (!maintenanceSave && maintenanceDraftCoordinator.isLocked())
    )
      return Promise.resolve(false)
    const request = executeMutation(execute, accept).finally(() => {
      pending.current = null
    })
    pending.current = request
    return request
  }
  async function executeMutation(
    execute: () => Promise<PartySnapshot>,
    accept: (result: PartySnapshot) => void
  ): Promise<boolean> {
    setError(null)
    const outcome = await commands.run({
      ...target,
      mode: 'latest-only',
      execute: async () => {
        const result = await execute()
        workspace.publishSession(props.campaignId, (current) =>
          result.revision < current.party.revision
            ? current
            : { ...current, party: result }
        )
        try {
          const refresh = await workspace.refreshActiveSession()
          if (refresh.status === 'failure')
            props.onError(capabilityErrorText(refresh.cause))
        } catch (cause) {
          props.onError(capabilityErrorText(cause))
        }
        return result
      },
      accept
    })
    if (outcome.status === 'failure') {
      if (capabilityErrorCode(outcome.cause) === 'outcome_unknown') {
        unknown.current = true
        setUncertain(true)
      }
      setError(capabilityErrorText(outcome.cause))
    }
    return outcome.status === 'success'
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
    return mutate(
      () =>
        base
          ? party.update(base.id, draft, props.snapshot.party.revision)
          : party.create(draft, props.snapshot.party.revision),
      (result) => {
        setEditing(null)
        props.select(
          base?.id ??
            result.members.find(
              (member) => !members.some((existing) => existing.id === member.id)
            )?.id ??
            null
        )
      },
      true
    )
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
            disabled={busy}
            onClick={() => {
              if (
                maintenanceDraftCoordinator.isLocked() ||
                pending.current ||
                unknown.current
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
              disabled={busy}
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
            error={error}
            save={save}
            close={() => {
              setEditing(null)
              setError(null)
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
                    !pending.current &&
                    !unknown.current
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
                    !pending.current &&
                    !unknown.current
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
                    !pending.current &&
                    !unknown.current
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
                    onClick={() =>
                      void mutate(
                        () =>
                          party.delete(
                            selected.id,
                            props.snapshot.party.revision
                          ),
                        () => {
                          setConfirmDelete(null)
                          props.select(null)
                        }
                      )
                    }
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
            {error && <p role="alert">{error}</p>}
          </>
        ) : (
          <p>{message('character.select')}</p>
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
