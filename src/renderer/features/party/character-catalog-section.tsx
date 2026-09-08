import { CapabilityContext } from '../../capabilities/capability-context.js'
import { message, formatMessage } from '../../i18n/session-runtime.de.js'
import { lazy, Suspense, useMemo, useState, useContext } from 'react'
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
  const [editing, setEditing] = useState<{
    base: PartyCharacter | null
  } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [ledger, setLedger] = useState<PartyCharacter | null>(null)
  const [error, setError] = useState<string | null>(null)
  const target = { scope: 'character-catalog', entityKey: props.campaignId }
  const busy = commands.state(target).status === 'pending'
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
    if (busy) return
    setEditing(null)
    setConfirmDelete(null)
    setError(null)
    props.select(id)
  }
  async function mutate(
    execute: () => Promise<PartySnapshot>,
    accept: (result: PartySnapshot) => void
  ) {
    if (commands.state(target).status === 'pending') return
    setError(null)
    const outcome = await commands.run({
      ...target,
      mode: 'latest-only',
      execute,
      accept: (result) => {
        workspace.publishSession(props.campaignId, (current) =>
          result.revision < current.party.revision
            ? current
            : { ...current, party: result }
        )
        accept(result)
        void workspace.refreshActiveSession().then((outcome) => {
          if (outcome.status === 'failure')
            props.onError(capabilityErrorText(outcome.cause))
        })
      }
    })
    if (outcome.status === 'failure')
      setError(capabilityErrorText(outcome.cause))
  }
  function save(draft: PartyCharacterDraft) {
    if (!editing) return
    const base = editing.base
    const current = base && members.find((member) => member.id === base.id)
    if (
      base &&
      (!current || characterProfileKey(base) !== characterProfileKey(current))
    ) {
      setError(message('character.conflict'))
      return
    }
    void mutate(
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
      }
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
            busy={busy}
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
              <button onClick={() => setEditing({ base: selected })}>
                {message('character.edit')}
              </button>
              <button onClick={() => setLedger(selected)}>
                {message('character.loot')}
              </button>
              <button
                disabled={busy}
                onClick={() => setConfirmDelete(characterProfileKey(selected))}
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
