import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import {
  formatInteger,
  formatPercent
} from '../../i18n/domain-formatters.de.js'
import { useState } from 'react'
import type { PartySnapshot } from '../../../shared/contracts/live-session.js'
import type {
  PartyCharacter,
  PartyCharacterDraft
} from '../../../shared/contracts/party.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import './party.css'
import { partyCapabilities } from './party-capabilities.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { useAdventuringDayCalculation } from './use-adventuring-day-calculation.js'
import { lazy, Suspense } from 'react'
import { partyCharacterMatchesSearch } from './party-search.js'

const LazyCharacterLootLedgerDialog = lazy(async () => {
  const module = await import('../loot/character-loot-ledger-dialog.js')
  return { default: module.CharacterLootLedgerDialog }
})

export function AdventuringDayDropdown(props: {
  party: PartySnapshot
  open: boolean
  setOpen: (open: boolean) => void
  triggerLabel?: string
}) {
  const day = props.party.adventuringDay
  const [rows, setRows] = useState(() => partyRows(props.party))
  const [custom, setCustom] = useState(false)
  const [mode, setMode] = useState<'budget' | 'progress'>('budget')
  const [totalXp, setTotalXp] = useState(0)
  const calculation = useAdventuringDayCalculation(
    props.open,
    rows,
    mode,
    totalXp
  )
  return (
    <div className="party-dropdown day-dropdown">
      <button
        className="party-trigger"
        aria-expanded={props.open}
        onClick={() => {
          if (!props.open && !custom) setRows(partyRows(props.party))
          props.setOpen(!props.open)
        }}
      >
        {props.triggerLabel ??
          (!day.available
            ? message('party.noRestBudget')
            : formatMessage('party.restSummary', {
                shortRestXp: day.shortRestXp,
                longRestXp: day.longRestXp
              }))}
      </button>
      {props.open && (
        <section
          className="party-panel day-panel"
          aria-label={message('ui.adventuring.day')}
        >
          <header>
            <h2>{message('ui.adventuring.day.2')}</h2>
            <button onClick={() => props.setOpen(false)}>×</button>
          </header>
          {!day.available ? (
            <p className="empty-state">
              {message('ui.fuer.das.rastbudget.brauchen.alle.aktiven.sc.ein')}
            </p>
          ) : (
            <>
              <div className="party-rest-actions">
                <button
                  onClick={() => {
                    setRows(partyRows(props.party))
                    setCustom(false)
                  }}
                >
                  {message('ui.aktive.party')}
                </button>
                <button
                  onClick={() => {
                    setRows([...rows, { level: 1, count: 1 }])
                    setCustom(true)
                  }}
                >
                  {message('ui.zeile')}
                </button>
                <button
                  onClick={() => {
                    setRows([])
                    setCustom(true)
                  }}
                >
                  {message('ui.leeren')}
                </button>
              </div>
              <div className="party-rest-actions">
                <button
                  className={mode === 'budget' ? 'accent' : ''}
                  onClick={() => setMode('budget')}
                >
                  {message('ui.budget')}
                </button>
                <button
                  className={mode === 'progress' ? 'accent' : ''}
                  onClick={() => setMode('progress')}
                >
                  {message('ui.xp.tage')}
                </button>
              </div>
              <ul className="day-rows">
                {rows.map((row, index) => (
                  <li key={`${index}-${row.level}`}>
                    <label>
                      {message('ui.level')}
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={row.level}
                        onChange={(event) => {
                          const next = [...rows]
                          next[index] = {
                            ...row,
                            level: Number(event.target.value)
                          }
                          setRows(next)
                          setCustom(true)
                        }}
                      />
                    </label>
                    <label>
                      {message('ui.anzahl')}
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={row.count}
                        onChange={(event) => {
                          const next = [...rows]
                          next[index] = {
                            ...row,
                            count: Number(event.target.value)
                          }
                          setRows(next)
                          setCustom(true)
                        }}
                      />
                    </label>
                    <button
                      onClick={() => {
                        setRows(
                          rows.filter((_, position) => position !== index)
                        )
                        setCustom(true)
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              {mode === 'progress' && (
                <input
                  aria-label={message('ui.gesamt.xp')}
                  type="number"
                  min="0"
                  placeholder={message('ui.gesamt.xp')}
                  value={totalXp}
                  onChange={(event) =>
                    setTotalXp(Math.max(0, Number(event.target.value)))
                  }
                />
              )}
              <div className="day-summary">
                <strong>
                  {formatInteger(calculation?.dailyBudget ?? 0)}{' '}
                  {message('ui.xp.2')}
                </strong>
                <span>
                  {custom
                    ? message('party.custom')
                    : formatMessage('party.activeSummary', {
                        partySize: day.partySize
                      })}
                </span>
                {mode === 'progress' && calculation && (
                  <span>
                    {calculation.completedDays} {message('ui.volle.tage')}{' '}
                    {formatPercent(Math.round(calculation.dayProgress * 100))}
                    {message('ui.aktueller.tag')} {calculation.shortRests}{' '}
                    {message('ui.sr')} {calculation.longRests}{' '}
                    {message('ui.lr')}
                  </span>
                )}
              </div>
              {mode === 'progress' && calculation && (
                <>
                  <progress max="1" value={calculation.dayProgress} />
                  <div className="day-timeline">
                    {calculation.timeline.map((entry) => (
                      <span key={entry}>{entry}</span>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}

export function PartyDropdown(props: {
  party: PartySnapshot
  open: boolean
  setOpen: (open: boolean) => void
  changed: (party: PartySnapshot) => void
  onError: (message: string) => void
  triggerLabel?: string
}) {
  const api = useCapabilityApi()
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [editor, setEditor] = useState<PartyCharacter | 'new' | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [xpMember, setXpMember] = useState<string | null>(null)
  const [xpDelta, setXpDelta] = useState(100)
  const [ledgerCharacter, setLedgerCharacter] = useState<PartyCharacter | null>(
    null
  )
  const active = props.party.members.filter((member) => member.active)
  const leveled = active.filter(
    (member): member is PartyCharacter & { level: number } =>
      member.level !== null
  )
  const average = leveled.length
    ? Math.round(
        leveled.reduce((total, member) => total + member.level, 0) /
          leveled.length
      )
    : null
  const filtered = props.party.members.filter((member) =>
    partyCharacterMatchesSearch(member, search)
  )

  async function run(operation: () => Promise<PartySnapshot>) {
    setBusy(true)
    try {
      props.changed(await operation())
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="party-dropdown">
      <button
        className="party-trigger"
        aria-expanded={props.open}
        aria-controls="party-panel"
        title={message('ui.party.panel.oeffnen.alt.p')}
        onClick={() => props.setOpen(!props.open)}
      >
        {props.triggerLabel ??
          (active.length === 0
            ? message('party.none')
            : formatMessage('party.summary', {
                count: active.length,
                average: average ?? '—'
              }))}
      </button>
      {props.open && (
        <section
          id="party-panel"
          className="party-panel"
          aria-label={message('ui.party')}
        >
          <header>
            <h2>{message('ui.party.2')}</h2>
            <button
              aria-label={message('ui.party.panel.schliessen')}
              onClick={() => props.setOpen(false)}
            >
              ×
            </button>
          </header>
          {active.length === 0 ? (
            <p className="empty-state">
              {message('ui.keine.aktiven.party.mitglieder')}
            </p>
          ) : (
            <ul className="party-list active-party-list">
              {active.map((member) => (
                <li key={member.id} className="party-character-card">
                  <div className="party-card-main">
                    <strong>{member.name}</strong>
                    <small>
                      {member.playerName ?? message('party.noPlayer')}{' '}
                      {message('ui.lv')} {member.level ?? '—'}
                    </small>
                    <progress
                      max={member.nextLevelXp ?? Math.max(1, member.xp)}
                      value={member.xp}
                    />
                    <small>
                      {formatInteger(member.xp)} {message('ui.xp.2')}
                      {member.nextLevelXp
                        ? ` / ${formatInteger(member.nextLevelXp)}`
                        : ''}
                    </small>
                  </div>
                  <div className="party-card-actions">
                    <span>
                      {message('ui.pp')} {member.passivePerception ?? '—'}{' '}
                      {message('ui.ac')} {member.armorClass ?? '—'}
                    </span>
                    <button
                      onClick={() => {
                        setXpMember(member.id)
                        setXpDelta(100)
                      }}
                    >
                      {message('ui.xp.2')}
                    </button>
                    <button onClick={() => setLedgerCharacter(member)}>
                      {message('loot.ledgerOpen')}
                    </button>
                    <button onClick={() => setEditor(member)}>
                      {message('ui.bearbeiten')}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          partyCapabilities(api).party.setMembership(
                            member.id,
                            false,
                            props.party.revision
                          )
                        )
                      }
                    >
                      {message('ui.entfernen')}
                    </button>
                  </div>
                  {xpMember === member.id && (
                    <div className="xp-popover">
                      <input
                        aria-label={message('ui.xp.betrag')}
                        type="number"
                        min="1"
                        value={xpDelta}
                        onChange={(event) =>
                          setXpDelta(Math.max(1, Number(event.target.value)))
                        }
                      />
                      <button
                        onClick={() =>
                          void run(() =>
                            partyCapabilities(api).party.adjustXp(
                              member.id,
                              -xpDelta,
                              props.party.revision
                            )
                          )
                        }
                      >
                        {message('ui.xp.3')}
                      </button>
                      <button
                        onClick={() =>
                          void run(() =>
                            partyCapabilities(api).party.adjustXp(
                              member.id,
                              xpDelta,
                              props.party.revision
                            )
                          )
                        }
                      >
                        {message('ui.xp.4')}
                      </button>
                      <button onClick={() => setXpMember(null)}>×</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="party-rest-actions">
            <button
              disabled={busy || active.length === 0}
              onClick={() =>
                void run(() =>
                  partyCapabilities(api).party.rest(
                    'short',
                    props.party.revision
                  )
                )
              }
            >
              {message('ui.short.rest')}
            </button>
            <button
              disabled={busy || active.length === 0}
              onClick={() =>
                void run(() =>
                  partyCapabilities(api).party.rest(
                    'long',
                    props.party.revision
                  )
                )
              }
            >
              {message('ui.long.rest')}
            </button>
          </div>
          <h3>{message('ui.charakter.roster')}</h3>
          <input
            aria-label={message('ui.charakter.roster.durchsuchen')}
            placeholder={message('ui.name.spieler.oder.roster.id')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <ul className="party-list roster-list">
            {filtered.map((member) => (
              <li key={member.id}>
                <span>
                  <strong>{member.name}</strong>
                  <small>
                    {member.playerName ?? message('party.noPlayer')} · #
                    {member.id.slice(0, 8)} {message('ui.lv')}{' '}
                    {member.level ?? '—'}
                  </small>
                </span>
                <div className="row-actions">
                  <button onClick={() => setLedgerCharacter(member)}>
                    {message('loot.ledgerOpen')}
                  </button>
                  <button onClick={() => setEditor(member)}>
                    {message('ui.bearbeiten')}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        partyCapabilities(api).party.setMembership(
                          member.id,
                          !member.active,
                          props.party.revision
                        )
                      )
                    }
                  >
                    {member.active
                      ? message('party.leave')
                      : message('party.join')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button onClick={() => setEditor('new')}>
            {message('ui.neuer.roster.charakter')}
          </button>
          {editor && (
            <PartyEditor
              member={editor === 'new' ? null : editor}
              busy={busy}
              deleteConfirm={deleteConfirm}
              setDeleteConfirm={setDeleteConfirm}
              close={() => {
                setEditor(null)
                setDeleteConfirm(false)
              }}
              save={(draft) =>
                void run(async () => {
                  const snapshot =
                    editor === 'new'
                      ? await partyCapabilities(api).party.create(
                          draft,
                          props.party.revision
                        )
                      : await partyCapabilities(api).party.update(
                          editor.id,
                          draft,
                          props.party.revision
                        )
                  setEditor(null)
                  return snapshot
                })
              }
              {...(editor === 'new'
                ? {}
                : {
                    remove: () =>
                      void run(async () => {
                        const snapshot = await partyCapabilities(
                          api
                        ).party.delete(editor.id, props.party.revision)
                        setEditor(null)
                        setDeleteConfirm(false)
                        return snapshot
                      })
                  })}
            />
          )}
        </section>
      )}
      <Suspense fallback={null}>
        {ledgerCharacter && (
          <LazyCharacterLootLedgerDialog
            character={ledgerCharacter}
            close={() => setLedgerCharacter(null)}
            onError={props.onError}
          />
        )}
      </Suspense>
    </div>
  )
}

function PartyEditor(props: {
  member: PartyCharacter | null
  busy: boolean
  deleteConfirm: boolean
  setDeleteConfirm: (value: boolean) => void
  close: () => void
  save: (draft: PartyCharacterDraft) => void
  remove?: () => void
}) {
  const [name, setName] = useState(props.member?.name ?? '')
  const [player, setPlayer] = useState(props.member?.playerName ?? '')
  const [level, setLevel] = useState(props.member?.level?.toString() ?? '')
  const [species, setSpecies] = useState(props.member?.species ?? '')
  const [characterClass, setCharacterClass] = useState(
    props.member?.characterClass ?? ''
  )
  const [languages, setLanguages] = useState(
    props.member?.languages.join(', ') ?? ''
  )
  const [perception, setPerception] = useState(
    props.member?.passivePerception?.toString() ?? ''
  )
  const [armor, setArmor] = useState(props.member?.armorClass?.toString() ?? '')
  const [investigation, setInvestigation] = useState(
    props.member?.passiveInvestigation?.toString() ?? ''
  )
  const [insight, setInsight] = useState(
    props.member?.passiveInsight?.toString() ?? ''
  )
  const [movementSpeed, setMovementSpeed] = useState(
    props.member?.movementSpeedFeet?.toString() ?? ''
  )
  const optional = (value: string) =>
    value.trim() === '' ? null : Number(value)
  return (
    <form
      className="party-editor"
      onSubmit={(event) => {
        event.preventDefault()
        props.save({
          name,
          playerName: player.trim() || null,
          species: species.trim() || null,
          characterClass: characterClass.trim() || null,
          languages: languages
            .split(',')
            .map((value) => value.trim())
            .filter(
              (value, index, all) =>
                Boolean(value) &&
                all.findIndex(
                  (candidate) =>
                    candidate.toLocaleLowerCase() === value.toLocaleLowerCase()
                ) === index
            ),
          level: optional(level),
          passivePerception: optional(perception),
          passiveInvestigation: optional(investigation),
          passiveInsight: optional(insight),
          armorClass: optional(armor),
          movementSpeedFeet: optional(movementSpeed)
        })
      }}
    >
      <h3>
        {props.member
          ? formatMessage('party.editCharacter', {
              id: props.member.id.slice(0, 8)
            })
          : message('party.createCharacter')}
      </h3>
      <input
        autoFocus
        required
        placeholder={message('ui.charaktername')}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <input
        placeholder={message('ui.spielername')}
        value={player}
        onChange={(event) => setPlayer(event.target.value)}
      />
      <div className="editor-numbers">
        <input
          aria-label={message('ui.spezies')}
          placeholder={message('ui.spezies')}
          value={species}
          onChange={(event) => setSpecies(event.target.value)}
        />
        <input
          aria-label={message('ui.klasse')}
          placeholder={message('ui.klasse')}
          value={characterClass}
          onChange={(event) => setCharacterClass(event.target.value)}
        />
      </div>
      <input
        aria-label={message('ui.sprachen')}
        placeholder={message('ui.sprachen.kommagetrennt')}
        value={languages}
        onChange={(event) => setLanguages(event.target.value)}
      />
      <div className="editor-numbers">
        <input
          aria-label={message('ui.level')}
          type="number"
          min="1"
          max="20"
          placeholder={message('ui.level')}
          value={level}
          onChange={(event) => setLevel(event.target.value)}
        />
        <input
          aria-label={message('ui.passive.perception')}
          type="number"
          min="0"
          max="99"
          placeholder={message('ui.passive.perception')}
          value={perception}
          onChange={(event) => setPerception(event.target.value)}
        />
        <input
          aria-label={message('ui.armor.class')}
          type="number"
          min="0"
          max="99"
          placeholder={message('ui.ac.2')}
          value={armor}
          onChange={(event) => setArmor(event.target.value)}
        />
        <input
          aria-label={message('ui.passive.investigation')}
          type="number"
          min="0"
          max="99"
          placeholder={message('ui.passive.investigation')}
          value={investigation}
          onChange={(event) => setInvestigation(event.target.value)}
        />
        <input
          aria-label={message('ui.passive.insight')}
          type="number"
          min="0"
          max="99"
          placeholder={message('ui.passive.insight')}
          value={insight}
          onChange={(event) => setInsight(event.target.value)}
        />
      </div>
      <label>
        {message('ui.bewegungsrate.ft.runde')}
        <input
          aria-label={message('ui.bewegungsrate')}
          type="number"
          min="0"
          max="999"
          placeholder="30"
          value={movementSpeed}
          onChange={(event) => setMovementSpeed(event.target.value)}
        />
      </label>
      {props.member && !props.deleteConfirm && (
        <button
          type="button"
          className="danger"
          onClick={() => props.setDeleteConfirm(true)}
        >
          {message('ui.loeschen')}
        </button>
      )}
      {props.deleteConfirm && (
        <div className="confirm-row">
          <span>
            {props.member?.name} {message('ui.wirklich.loeschen.2')}
          </span>
          <button type="button" onClick={() => props.setDeleteConfirm(false)}>
            {message('action.cancel')}
          </button>
          <button type="button" className="danger" onClick={props.remove}>
            {message('ui.wirklich.loeschen')}
          </button>
        </div>
      )}
      <footer>
        <button type="button" onClick={props.close}>
          {message('action.cancel')}
        </button>
        <button disabled={props.busy || !name.trim()}>
          {props.member ? message('action.save') : message('action.create')}
        </button>
      </footer>
    </form>
  )
}

function partyRows(party: PartySnapshot): { level: number; count: number }[] {
  const counts = new Map<number, number>()
  party.members
    .filter(
      (member): member is PartyCharacter & { level: number } =>
        member.active && member.level !== null
    )
    .forEach((member) =>
      counts.set(member.level, (counts.get(member.level) ?? 0) + 1)
    )
  return [...counts].map(([level, count]) => ({ level, count }))
}
