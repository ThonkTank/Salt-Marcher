import { useEffect, useState } from 'react'
import type { PartySnapshot } from '../../../shared/contracts/live-session.js'
import type {
  AdventuringDayCalculation,
  PartyCharacter,
  PartyCharacterDraft
} from '../../../shared/contracts/party.js'
import { errorText } from '../catalog/catalog-state.js'
import './party.css'

export function AdventuringDayDropdown(props: {
  party: PartySnapshot
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const day = props.party.adventuringDay
  const [rows, setRows] = useState(() => partyRows(props.party))
  const [custom, setCustom] = useState(false)
  const [mode, setMode] = useState<'budget' | 'progress'>('budget')
  const [totalXp, setTotalXp] = useState(0)
  const [calculation, setCalculation] =
    useState<AdventuringDayCalculation | null>(null)
  useEffect(() => {
    if (!props.open) return
    void window.saltMarcher.party
      .calculateAdventuringDay(rows, mode === 'progress' ? totalXp : 0)
      .then(setCalculation)
  }, [props.open, rows, totalXp, mode])
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
        {!day.available
          ? 'Kein Rastbudget'
          : `SR ${day.shortRestXp} · LR ${day.longRestXp}`}
      </button>
      {props.open && (
        <section className="party-panel day-panel" aria-label="Adventuring Day">
          <header>
            <h2>ADVENTURING DAY</h2>
            <button onClick={() => props.setOpen(false)}>×</button>
          </header>
          {!day.available ? (
            <p className="empty-state">
              Für das Rastbudget brauchen alle aktiven SC ein Level.
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
                  Aktive Party
                </button>
                <button
                  onClick={() => {
                    setRows([...rows, { level: 1, count: 1 }])
                    setCustom(true)
                  }}
                >
                  Zeile
                </button>
                <button
                  onClick={() => {
                    setRows([])
                    setCustom(true)
                  }}
                >
                  Leeren
                </button>
              </div>
              <div className="party-rest-actions">
                <button
                  className={mode === 'budget' ? 'accent' : ''}
                  onClick={() => setMode('budget')}
                >
                  Budget
                </button>
                <button
                  className={mode === 'progress' ? 'accent' : ''}
                  onClick={() => setMode('progress')}
                >
                  XP → Tage
                </button>
              </div>
              <ul className="day-rows">
                {rows.map((row, index) => (
                  <li key={`${index}-${row.level}`}>
                    <label>
                      Level
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
                      Anzahl
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
                  aria-label="Gesamt-XP"
                  type="number"
                  min="0"
                  placeholder="Gesamt-XP"
                  value={totalXp}
                  onChange={(event) =>
                    setTotalXp(Math.max(0, Number(event.target.value)))
                  }
                />
              )}
              <div className="day-summary">
                <strong>
                  {calculation?.dailyBudget.toLocaleString() ?? 0} XP
                </strong>
                <span>
                  {custom
                    ? 'Eigene Party'
                    : `Aktive Party · ${day.partySize} SC`}
                </span>
                {mode === 'progress' && calculation && (
                  <span>
                    {calculation.completedDays} volle Tage ·{' '}
                    {Math.round(calculation.dayProgress * 100)}% aktueller Tag ·{' '}
                    {calculation.shortRests} SR · {calculation.longRests} LR
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
}) {
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [editor, setEditor] = useState<PartyCharacter | 'new' | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [xpMember, setXpMember] = useState<string | null>(null)
  const [xpDelta, setXpDelta] = useState(100)
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
    `${member.name} ${member.playerName ?? ''} ${member.id}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  async function run(operation: () => Promise<PartySnapshot>) {
    setBusy(true)
    try {
      props.changed(await operation())
    } catch (cause) {
      props.onError(errorText(cause))
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
        title="Party-Panel öffnen (Alt+P)"
        onClick={() => props.setOpen(!props.open)}
      >
        {active.length === 0
          ? 'Keine Party'
          : `${active.length} SC · Ø Lv ${average ?? '—'}`}
      </button>
      {props.open && (
        <section id="party-panel" className="party-panel" aria-label="Party">
          <header>
            <h2>PARTY</h2>
            <button
              aria-label="Party-Panel schließen"
              onClick={() => props.setOpen(false)}
            >
              ×
            </button>
          </header>
          {active.length === 0 ? (
            <p className="empty-state">Keine aktiven Party-Mitglieder.</p>
          ) : (
            <ul className="party-list active-party-list">
              {active.map((member) => (
                <li key={member.id} className="party-character-card">
                  <div className="party-card-main">
                    <strong>{member.name}</strong>
                    <small>
                      {member.playerName ?? 'Kein Spieler'} · Lv{' '}
                      {member.level ?? '—'}
                    </small>
                    <progress
                      max={member.nextLevelXp ?? Math.max(1, member.xp)}
                      value={member.xp}
                    />
                    <small>
                      {member.xp.toLocaleString()} XP
                      {member.nextLevelXp
                        ? ` / ${member.nextLevelXp.toLocaleString()}`
                        : ''}
                    </small>
                  </div>
                  <div className="party-card-actions">
                    <span>
                      PP {member.passivePerception ?? '—'} · AC{' '}
                      {member.armorClass ?? '—'}
                    </span>
                    <button
                      onClick={() => {
                        setXpMember(member.id)
                        setXpDelta(100)
                      }}
                    >
                      XP
                    </button>
                    <button onClick={() => setEditor(member)}>
                      Bearbeiten
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          window.saltMarcher.party.setMembership(
                            member.id,
                            false,
                            props.party.revision
                          )
                        )
                      }
                    >
                      Entfernen
                    </button>
                  </div>
                  {xpMember === member.id && (
                    <div className="xp-popover">
                      <input
                        aria-label="XP Betrag"
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
                            window.saltMarcher.party.adjustXp(
                              member.id,
                              -xpDelta,
                              props.party.revision
                            )
                          )
                        }
                      >
                        −XP
                      </button>
                      <button
                        onClick={() =>
                          void run(() =>
                            window.saltMarcher.party.adjustXp(
                              member.id,
                              xpDelta,
                              props.party.revision
                            )
                          )
                        }
                      >
                        +XP
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
                  window.saltMarcher.party.rest('short', props.party.revision)
                )
              }
            >
              Short Rest
            </button>
            <button
              disabled={busy || active.length === 0}
              onClick={() =>
                void run(() =>
                  window.saltMarcher.party.rest('long', props.party.revision)
                )
              }
            >
              Long Rest
            </button>
          </div>
          <h3>CHARAKTER-ROSTER</h3>
          <input
            aria-label="Charakter-Roster durchsuchen"
            placeholder="Name, Spieler oder Roster-ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <ul className="party-list roster-list">
            {filtered.map((member) => (
              <li key={member.id}>
                <span>
                  <strong>{member.name}</strong>
                  <small>
                    {member.playerName ?? 'Kein Spieler'} · #
                    {member.id.slice(0, 8)} · Lv {member.level ?? '—'}
                  </small>
                </span>
                <div className="row-actions">
                  <button onClick={() => setEditor(member)}>Bearbeiten</button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        window.saltMarcher.party.setMembership(
                          member.id,
                          !member.active,
                          props.party.revision
                        )
                      )
                    }
                  >
                    {member.active ? 'Aus Party' : 'Zur Party'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button onClick={() => setEditor('new')}>
            Neuer Roster-Charakter
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
                      ? await window.saltMarcher.party.create(
                          draft,
                          props.party.revision
                        )
                      : await window.saltMarcher.party.update(
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
                        const snapshot = await window.saltMarcher.party.delete(
                          editor.id,
                          props.party.revision
                        )
                        setEditor(null)
                        setDeleteConfirm(false)
                        return snapshot
                      })
                  })}
            />
          )}
        </section>
      )}
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
  const [perception, setPerception] = useState(
    props.member?.passivePerception?.toString() ?? ''
  )
  const [armor, setArmor] = useState(props.member?.armorClass?.toString() ?? '')
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
          level: optional(level),
          passivePerception: optional(perception),
          armorClass: optional(armor),
          movementSpeedFeet: optional(movementSpeed)
        })
      }}
    >
      <h3>
        {props.member
          ? `CHARAKTER #${props.member.id.slice(0, 8)} BEARBEITEN`
          : 'CHARAKTER ERSTELLEN'}
      </h3>
      <input
        autoFocus
        required
        placeholder="Charaktername"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <input
        placeholder="Spielername"
        value={player}
        onChange={(event) => setPlayer(event.target.value)}
      />
      <div className="editor-numbers">
        <input
          aria-label="Level"
          type="number"
          min="1"
          max="20"
          placeholder="Level"
          value={level}
          onChange={(event) => setLevel(event.target.value)}
        />
        <input
          aria-label="Passive Perception"
          type="number"
          min="0"
          max="99"
          placeholder="Passive Perception"
          value={perception}
          onChange={(event) => setPerception(event.target.value)}
        />
        <input
          aria-label="Armor Class"
          type="number"
          min="0"
          max="99"
          placeholder="AC"
          value={armor}
          onChange={(event) => setArmor(event.target.value)}
        />
      </div>
      <label>
        Bewegungsrate (ft/Runde)
        <input
          aria-label="Bewegungsrate"
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
          Löschen
        </button>
      )}
      {props.deleteConfirm && (
        <div className="confirm-row">
          <span>{props.member?.name} wirklich löschen?</span>
          <button type="button" onClick={() => props.setDeleteConfirm(false)}>
            Abbrechen
          </button>
          <button type="button" className="danger" onClick={props.remove}>
            Wirklich löschen
          </button>
        </div>
      )}
      <footer>
        <button type="button" onClick={props.close}>
          Abbrechen
        </button>
        <button disabled={props.busy || !name.trim()}>
          {props.member ? 'Speichern' : 'Erstellen'}
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
