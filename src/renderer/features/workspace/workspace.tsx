import {
  useEffect,
  lazy,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from 'react'
import type { CampaignSnapshot } from '../../../shared/contracts/campaign.js'
import type {
  Creature,
  CreatureCatalogPage,
  CreatureCatalogQuery,
  CreatureFilterOptions
} from '../../../shared/contracts/encounter.js'
import type { EncounterTuning } from '../../../shared/contracts/encounter-tuning.js'
import type {
  EncounterSelectionEvaluation,
  SceneGroup,
  SceneGroupDraftEvaluation
} from '../../../shared/contracts/scene.js'
import type {
  CombatSnapshot,
  LiveSessionSnapshot,
  PartySnapshot
} from '../../../shared/contracts/live-session.js'
import type {
  AdventuringDayCalculation,
  PartyCharacter,
  PartyCharacterDraft
} from '../../../shared/contracts/party.js'
import { type SessionLayoutPreference } from '../../../shared/contracts/session-layout.js'
import type {
  WorldLocation,
  WorldLocationDraft,
  WorldLocationSnapshot
} from '../../../shared/contracts/world-location.js'
import type {
  EncounterTable,
  EncounterTableDraft,
  EncounterTableSnapshot,
  WorldFaction,
  WorldFactionDraft,
  WorldFactionSnapshot
} from '../../../shared/contracts/encounter-source.js'
import type { CoreProcessStatus } from '../../../shared/contracts/runtime.js'
import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'
import {
  HexLocationPlacementDialog,
  SessionHexMap,
  TravelScenario
} from '../hex/hex-workspaces.js'
import { useInstallationPreferences } from '../../shell/use-installation-preferences.js'
import campaignIcon from '../../assets/icons/campaign.svg?url'
import sessionIcon from '../../assets/icons/session.svg?url'
import hexIcon from '../../assets/icons/hex.svg?url'
import catalogIcon from '../../assets/icons/catalog.svg?url'
import { capabilityErrorMessage, message } from '../../i18n/messages.de.js'

type FantasyIconName = 'campaign' | 'session' | 'hex' | 'catalog'

const LazyHexEditor = lazy(async () => {
  return import('../hex/hex-editor.js')
})

const fantasyIconAssets: Record<FantasyIconName, string> = {
  campaign: campaignIcon,
  session: sessionIcon,
  hex: hexIcon,
  catalog: catalogIcon
}

function FantasyIcon(props: { name: FantasyIconName }) {
  return <img src={fantasyIconAssets[props.name]} alt="" aria-hidden="true" />
}

function IlluminatedHeading(props: { title: string }) {
  const [initial = '', ...rest] = Array.from(props.title)

  return (
    <div className="illuminated" aria-label={props.title}>
      <span className="initial" aria-hidden="true">
        {initial}
      </span>
      <h2 aria-label={props.title}>{rest.join('')}</h2>
    </div>
  )
}

declare global {
  interface Window {
    saltMarcher: import('../../../shared/contracts/capability-api.js').SaltMarcherApi
  }
}

const emptyCampaigns: CampaignSnapshot = {
  activeCampaignId: null,
  campaigns: []
}

const emptyQuery: CreatureCatalogQuery = {
  name: '',
  sizes: [],
  types: [],
  subtypes: [],
  biomes: [],
  alignments: [],
  encounterTableIds: [],
  factionIds: [],
  locationId: null,
  sort: 'name',
  direction: 'asc',
  offset: 0,
  limit: 50
}

const emptyCreatureOptions: CreatureFilterOptions = {
  challengeRatings: [],
  sizes: [],
  types: [],
  subtypes: [],
  biomes: [],
  alignments: [],
  encounterTables: [],
  factions: [],
  locations: []
}

export function WorkspaceApp() {
  const [campaigns, setCampaigns] = useState(emptyCampaigns)
  const [session, setSession] = useState<LiveSessionSnapshot | null>(null)
  const [campaignName, setCampaignName] = useState('')
  const [workspace, setWorkspace] = useState<'session' | 'catalog' | 'hex'>(
    'session'
  )
  const [partyOpen, setPartyOpen] = useState(false)
  const [dayOpen, setDayOpen] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [scenarios, setScenarios] = useState<
    Record<string, '' | 'encounter' | 'travel'>
  >({})
  const [inspected, setInspected] = useState<Creature | null>(null)
  const [error, setError] = useState('')
  const { theme, toggleTheme, sessionLayout, setSessionLayout } =
    useInstallationPreferences(setError)
  const [coreStatus, setCoreStatus] = useState<CoreProcessStatus>('starting')
  const [readbackKey, setReadbackKey] = useState(0)
  const active = campaigns.activeCampaignId !== null

  const load = async () => {
    const nextCampaigns = await window.saltMarcher.campaigns.list()
    setCampaigns(nextCampaigns)
    setSession(
      nextCampaigns.activeCampaignId
        ? await window.saltMarcher.session.read()
        : null
    )
  }

  useEffect(() => {
    void Promise.resolve().then(load).catch(showError(setError))
  }, [])

  useEffect(() => {
    void window.saltMarcher.runtime.coreStatus().then(setCoreStatus)
    return window.saltMarcher.runtime.onCoreStatus(setCoreStatus)
  }, [])

  useEffect(() => {
    const readback = () => {
      setReadbackKey((current) => current + 1)
      void load().catch(showError(setError))
    }
    window.addEventListener('saltmarcher:readback', readback)
    return () => window.removeEventListener('saltmarcher:readback', readback)
  }, [])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === 'p' && active) {
        event.preventDefault()
        setPartyOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [active])

  async function createCampaign(event: FormEvent) {
    event.preventDefault()
    try {
      const capability = window.saltMarcher
        .campaigns as import('../../../shared/contracts/capability-api.js').CampaignCapability
      setCampaigns(await capability.create(campaignName))
      setCampaignName('')
      setSession(await window.saltMarcher.session.read())
      setWorkspace('session')
    } catch (cause) {
      setError(errorText(cause))
    }
  }

  async function switchCampaign(id: string) {
    try {
      const capability = window.saltMarcher
        .campaigns as import('../../../shared/contracts/capability-api.js').CampaignCapability
      setCampaigns(await capability.activate(id))
      setSession(await window.saltMarcher.session.read())
      setWorkspace('session')
      setScenarios({})
    } catch (cause) {
      setError(errorText(cause))
    }
  }

  const heading = active
    ? workspace === 'catalog'
      ? 'Katalog'
      : workspace === 'hex'
        ? 'Hex-Editor'
        : 'Session'
    : 'Kampagnen'

  return (
    <main className="app-shell">
      {coreStatus !== 'ready' && (
        <div className="core-status-banner" role="status">
          <span>
            {coreStatus === 'unavailable'
              ? message('core.unavailable')
              : message('core.recovering')}
          </span>
          {coreStatus === 'unavailable' && (
            <button
              type="button"
              onClick={() => void window.saltMarcher.runtime.retryCore()}
            >
              {message('core.retry')}
            </button>
          )}
        </div>
      )}
      <header className="top-bar">
        <button className="menu-button" aria-label="Menü" title="Menü">
          <span aria-hidden="true">☰</span>
        </button>
        {active && session && (
          <>
            <nav className="shell-quick-actions" aria-label="Sitzungssteuerung">
              <button>Zeit</button>
              <button>Wetter</button>
              <button>Musik</button>
            </nav>
            <AdventuringDayDropdown
              party={session.party}
              open={dayOpen}
              setOpen={setDayOpen}
            />
            <PartyDropdown
              party={session.party}
              open={partyOpen}
              setOpen={setPartyOpen}
              changed={(party) => {
                setSession({ ...session, party })
                void window.saltMarcher.session.read().then(setSession)
              }}
              onError={setError}
            />
          </>
        )}
        <div className="workspace-heading">
          <p className="eyebrow">SaltMarcher</p>
          <h1>{heading}</h1>
        </div>
        <p className="top-bar-status">
          {active ? 'Live-Session' : 'Kampagne auswählen oder erstellen'}
        </p>
        <button
          className="theme-toggle"
          aria-label={
            theme === 'dark'
              ? 'Zum Pergamentmodus wechseln'
              : 'Zum Kerzenlichtmodus wechseln'
          }
          title={theme === 'dark' ? 'Tageslicht' : 'Kerzenlicht'}
          aria-pressed={theme === 'dark'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? 'Tageslicht' : 'Kerzenlicht'}
        </button>
      </header>
      <div className="shell-body">
        <nav className="icon-bar" aria-label="Arbeitsbereiche">
          <button
            className="icon-button"
            aria-label="Kampagnen"
            title="Kampagnen"
            aria-pressed={!active}
            onClick={() => {
              setCampaigns({ ...campaigns, activeCampaignId: null })
              setSession(null)
            }}
          >
            <FantasyIcon name="campaign" />
          </button>
          {active && (
            <>
              <button
                className="icon-button"
                aria-label="Session"
                title="Session"
                aria-pressed={workspace === 'session'}
                onClick={() => setWorkspace('session')}
              >
                <FantasyIcon name="session" />
              </button>
              <button
                className="icon-button"
                aria-label="Hex-Editor"
                title="Hex-Editor"
                aria-pressed={workspace === 'hex'}
                onClick={() => setWorkspace('hex')}
              >
                <FantasyIcon name="hex" />
              </button>
              <button
                className="icon-button"
                aria-label="Katalog"
                title="Katalog"
                aria-pressed={workspace === 'catalog'}
                onClick={() => setWorkspace('catalog')}
              >
                <FantasyIcon name="catalog" />
              </button>
            </>
          )}
        </nav>
        <div className={`work-area${active ? ' session-work-area' : ''}`}>
          {error && (
            <p className="error-message" role="alert">
              {error}{' '}
              <button className="compact" onClick={() => setError('')}>
                {message('action.close')}
              </button>
            </p>
          )}
          {!active && (
            <CampaignChooser
              campaigns={campaigns}
              name={campaignName}
              setName={setCampaignName}
              createCampaign={createCampaign}
              switchCampaign={switchCampaign}
            />
          )}
          {active && session && workspace === 'session' && (
            <SessionWorkspace
              key={`session-${readbackKey}`}
              snapshot={session}
              setSnapshot={setSession}
              groupDialogOpen={groupDialogOpen}
              setGroupDialogOpen={setGroupDialogOpen}
              scenario={
                session.combat
                  ? 'encounter'
                  : (scenarios[session.scene.focusedSceneId] ?? '')
              }
              setScenario={(scenario) =>
                setScenarios((current) => ({
                  ...current,
                  [session.scene.focusedSceneId]: scenario
                }))
              }
              layout={sessionLayout}
              setLayout={setSessionLayout}
              onError={setError}
            />
          )}
          {active && session && workspace === 'catalog' && (
            <LazyCatalogWorkspace
              key={`catalog-${readbackKey}`}
              snapshot={session}
              setSnapshot={setSession}
              close={() => setWorkspace('session')}
              inspect={setInspected}
              onError={setError}
            />
          )}
          {active && session && workspace === 'hex' && (
            <LazyHexEditor key={`hex-${readbackKey}`} onError={setError} />
          )}
        </div>
      </div>
      {inspected && (
        <CreatureInspector
          creature={inspected}
          close={() => setInspected(null)}
        />
      )}
    </main>
  )
}

function CampaignChooser(props: {
  campaigns: CampaignSnapshot
  name: string
  setName: (value: string) => void
  createCampaign: (event: FormEvent) => Promise<void>
  switchCampaign: (id: string) => Promise<void>
}) {
  return (
    <section className="workspace-panel campaign-panel">
      <div>
        <p className="section-kicker">Kampagnenarchiv</p>
        <h2>Kampagne auswählen</h2>
        <p>Eine neue Kampagne beginnen oder eine bestehende fortsetzen.</p>
      </div>
      <form
        onSubmit={(event) => void props.createCampaign(event)}
        className="inline-form"
      >
        <input
          id="campaign-name"
          aria-label="Kampagnenname"
          placeholder="Kampagnenname"
          required
          value={props.name}
          onChange={(event) => props.setName(event.target.value)}
        />
        <button>Kampagne erstellen</button>
      </form>
      <div className="campaigns">
        {props.campaigns.campaigns.map((campaign) => (
          <button
            key={campaign.id}
            onClick={() => void props.switchCampaign(campaign.id)}
          >
            {campaign.name}
          </button>
        ))}
      </div>
    </section>
  )
}

function AdventuringDayDropdown(props: {
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

function PartyDropdown(props: {
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

function SessionWorkspace(props: {
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  groupDialogOpen: boolean
  setGroupDialogOpen: (open: boolean) => void
  scenario: '' | 'encounter' | 'travel'
  setScenario: (scenario: '' | 'encounter' | 'travel') => void
  layout: SessionLayoutPreference
  setLayout: (layout: SessionLayoutPreference) => void
  onError: (message: string) => void
}) {
  const [editingGroup, setEditingGroup] = useState<SceneGroup | null>(null)
  const [detailHistories, setDetailHistories] = useState<
    Record<string, { entries: Creature[]; index: number }>
  >({})
  const focused = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.snapshot.scene.focusedSceneId
  )!

  const history = detailHistories[focused.id] ?? { entries: [], index: -1 }
  const detail = history.entries[history.index] ?? null
  const openDetail = (creature: Creature) =>
    setDetailHistories((current) => {
      const previous = current[focused.id] ?? { entries: [], index: -1 }
      if (previous.entries[previous.index]?.id === creature.id) return current
      const entries = [
        ...previous.entries.slice(0, previous.index + 1),
        creature
      ]
      return {
        ...current,
        [focused.id]: { entries, index: entries.length - 1 }
      }
    })
  const moveHistory = (offset: number) =>
    setDetailHistories((current) => {
      const previous = current[focused.id] ?? { entries: [], index: -1 }
      return {
        ...current,
        [focused.id]: {
          ...previous,
          index: Math.max(
            -1,
            Math.min(previous.entries.length - 1, previous.index + offset)
          )
        }
      }
    })

  const control = (
    <section className="session-control-panel" aria-label="Session Steuerung">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Session</p>
          <h2>Steuerung</h2>
        </div>
        <button
          onClick={() => {
            setEditingGroup(null)
            props.setGroupDialogOpen(true)
          }}
        >
          Gruppen managen
        </button>
      </div>
      <label>
        Aktive Szene
        <select
          aria-label="Aktive Szene"
          value={focused.id}
          disabled={props.snapshot.scene.scenes.length < 2}
          onChange={(event) =>
            void scenarioAction(props, () =>
              window.saltMarcher.scene.focus(
                event.target.value,
                props.snapshot.scene.revision
              )
            )
          }
        >
          {props.snapshot.scene.scenes.map((scene) => (
            <option key={scene.id} value={scene.id}>
              {scene.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Ort
        <select
          aria-label="Scene-Ort"
          value={focused.locationId ?? ''}
          onChange={(event) =>
            void scenarioAction(props, () =>
              window.saltMarcher.scene.setLocation(
                focused.id,
                event.target.value || null,
                props.snapshot.scene.revision
              )
            )
          }
        >
          <option value="">Kein Ort</option>
          {focused.locationId &&
            !props.snapshot.scene.locationChoices.some(
              (location) => location.id === focused.locationId
            ) && (
              <option value={focused.locationId}>Nicht verfügbarer Ort</option>
            )}
          {props.snapshot.scene.locationChoices.map((location) => (
            <option key={location.id} value={location.id}>
              {location.displayName}
            </option>
          ))}
        </select>
      </label>
      <p className="panel-hint">
        {props.snapshot.scene.scenes.length > 1
          ? 'Szenen führen Gruppen, Details und Combat unabhängig.'
          : 'Weitere simultane Szenen erscheinen automatisch in der Auswahl.'}
      </p>
    </section>
  )

  const groups = (
    <section className="session-groups" aria-label="Gruppen">
      <div className="groups-heading">
        <h2>Gruppen</h2>
      </div>
      <PartyGroup
        snapshot={props.snapshot}
        sceneId={focused.id}
        setSnapshot={props.setSnapshot}
        onError={props.onError}
      />
      {focused.groups.map((group) => (
        <article className="group-card" key={group.id}>
          <div className="group-card-title">
            <strong>{group.name}</strong>
            <div className="row-actions">
              <button
                onClick={() => {
                  setEditingGroup(group)
                  props.setGroupDialogOpen(true)
                }}
              >
                Bearbeiten
              </button>
              <button
                className="danger"
                onClick={() =>
                  void scenarioAction(props, () =>
                    window.saltMarcher.scene.deleteGroup(
                      focused.id,
                      group.id,
                      props.snapshot.scene.revision
                    )
                  )
                }
              >
                Löschen
              </button>
            </div>
          </div>
          <div className="group-members">
            {group.entries.map((entry) => (
              <button
                key={entry.id}
                className={entry.available ? '' : 'unavailable'}
                disabled={!entry.available}
                onClick={() =>
                  void window.saltMarcher.creatures
                    .detail(entry.creatureId)
                    .then(openDetail)
                    .catch(showError(props.onError))
                }
              >
                {entry.displayName} × {entry.quantity}
              </button>
            ))}
          </div>
        </article>
      ))}
    </section>
  )

  const details = (
    <section className="session-detail-panel" aria-label="Detailansicht">
      <div className="session-panel-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={props.layout.upperRightTab === 'details'}
          onClick={() =>
            props.setLayout({ ...props.layout, upperRightTab: 'details' })
          }
        >
          Details
        </button>
        <button
          role="tab"
          aria-selected={props.layout.upperRightTab === 'map'}
          onClick={() =>
            props.setLayout({ ...props.layout, upperRightTab: 'map' })
          }
        >
          Karte
        </button>
      </div>
      {props.layout.upperRightTab === 'map' ? (
        <SessionHexMap
          snapshot={props.snapshot}
          setSnapshot={props.setSnapshot}
          onError={props.onError}
        />
      ) : (
        <>
          <nav className="detail-history" aria-label="Detail Verlauf">
            <button
              aria-label="Zurück"
              disabled={history.index <= 0}
              onClick={() => moveHistory(-1)}
            >
              ←
            </button>
            <button
              aria-label="Vor"
              disabled={history.index >= history.entries.length - 1}
              onClick={() => moveHistory(1)}
            >
              →
            </button>
            <button
              aria-label="Detail schließen"
              disabled={!detail}
              onClick={() =>
                setDetailHistories((current) => ({
                  ...current,
                  [focused.id]: { entries: [], index: -1 }
                }))
              }
            >
              ×
            </button>
            <span>
              {detail?.name ?? (focused.locationName || focused.title)}
            </span>
          </nav>
          <div className="detail-scroll">
            {detail ? (
              <CreatureInspector creature={detail} embedded />
            ) : (
              <div className="detail-empty">
                <p className="section-kicker">{focused.title}</p>
                <h2>{focused.locationName || 'Keine Detailauswahl'}</h2>
                <p>
                  Wähle ein Monster aus einer Gruppe oder später einen Ort bzw.
                  ein anderes beschriebenes Szenenobjekt aus.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )

  const scenarioPanel = (
    <aside className="scenario-panel" aria-label="Szenario Panel">
      <select
        aria-label="Szenario Auswahl"
        value={props.scenario}
        onChange={(event) =>
          props.setScenario(event.target.value as '' | 'encounter' | 'travel')
        }
      >
        <option value="">Szenario auswählen …</option>
        <option value="encounter">Encounter</option>
        <option value="travel">Reise</option>
      </select>
      {!props.scenario ? (
        <div className="scenario-empty">Szenario Panel</div>
      ) : props.scenario === 'travel' ? (
        <TravelScenario
          snapshot={props.snapshot}
          setSnapshot={props.setSnapshot}
          openMap={() =>
            props.setLayout({ ...props.layout, upperRightTab: 'map' })
          }
          onError={props.onError}
        />
      ) : (
        <SessionEncounterPanel
          {...props}
          inspect={openDetail}
          close={() => props.setScenario('')}
        />
      )}
    </aside>
  )

  return (
    <section className="session-mockup" aria-label="Session workspace">
      <div className="session-layout">
        <SessionPanelLayout
          preference={props.layout}
          changed={props.setLayout}
          control={control}
          groups={groups}
          details={details}
          scenario={scenarioPanel}
        />
      </div>
      {props.groupDialogOpen && (
        <GroupDialog
          snapshot={props.snapshot}
          group={editingGroup}
          close={() => props.setGroupDialogOpen(false)}
          saved={(snapshot) => {
            props.setSnapshot(snapshot)
            props.setGroupDialogOpen(false)
          }}
          inspect={openDetail}
          onError={props.onError}
        />
      )}
    </section>
  )
}

function SessionPanelLayout(props: {
  preference: SessionLayoutPreference
  changed: (preference: SessionLayoutPreference) => void
  control: ReactNode
  groups: ReactNode
  details: ReactNode
  scenario: ReactNode
}) {
  const p = props.preference
  return (
    <div className="session-workspace">
      <div
        className="session-column session-left-column"
        style={{ flexBasis: `${p.leftFraction * 100}%` }}
      >
        <div className="session-control-pane">{props.control}</div>
        <div className="session-pane">{props.groups}</div>
      </div>
      <SessionDivider
        axis="vertical"
        value={p.leftFraction}
        changed={(leftFraction) => props.changed({ ...p, leftFraction })}
        label="Gekoppelte Grenze zwischen linker und rechter Spalte"
      />
      <div className="session-column">
        <div
          className="session-pane"
          style={{ flexBasis: `${p.rightTopFraction * 100}%` }}
        >
          {props.details}
        </div>
        <SessionDivider
          axis="horizontal"
          value={p.rightTopFraction}
          changed={(rightTopFraction) =>
            props.changed({ ...p, rightTopFraction })
          }
          label="Grenze zwischen Details und Szenario"
        />
        <div className="session-pane">{props.scenario}</div>
      </div>
    </div>
  )
}

function SessionDivider(props: {
  axis: 'horizontal' | 'vertical'
  value: number
  changed: (value: number) => void
  label: string
}) {
  const resize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    const parent = event.currentTarget.parentElement
    if (!parent) return
    const bounds = parent.getBoundingClientRect()
    const update = (clientX: number, clientY: number) => {
      const raw =
        props.axis === 'vertical'
          ? (clientX - bounds.left) / bounds.width
          : (clientY - bounds.top) / bounds.height
      props.changed(Math.max(0.18, Math.min(0.82, raw)))
    }
    update(event.clientX, event.clientY)
    const move = (next: PointerEvent) => update(next.clientX, next.clientY)
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop, { once: true })
  }
  const keyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const direction =
      props.axis === 'vertical'
        ? event.key === 'ArrowLeft'
          ? -1
          : event.key === 'ArrowRight'
            ? 1
            : 0
        : event.key === 'ArrowUp'
          ? -1
          : event.key === 'ArrowDown'
            ? 1
            : 0
    if (!direction) return
    event.preventDefault()
    props.changed(
      Math.max(0.18, Math.min(0.82, props.value + direction * 0.02))
    )
  }
  return (
    <div
      className={`session-divider session-divider-${props.axis}`}
      role="separator"
      aria-label={props.label}
      aria-orientation={props.axis}
      aria-valuemin={18}
      aria-valuemax={82}
      aria-valuenow={Math.round(props.value * 100)}
      tabIndex={0}
      onPointerDown={resize}
      onKeyDown={keyboard}
    />
  )
}

function PartyGroup(props: {
  snapshot: LiveSessionSnapshot
  sceneId: string
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  onError: (message: string) => void
}) {
  const active = props.snapshot.party.members.filter((member) => member.active)
  const scene = props.snapshot.scene.scenes.find(
    (entry) => entry.id === props.sceneId
  )!
  return (
    <article className="group-card party-group">
      <div className="group-card-title">
        <strong>Party</strong>
        <span>{scene.partyMemberIds.length} in dieser Scene</span>
      </div>
      <div className="group-members">
        {active.length === 0 ? (
          <span>Keine aktiven Mitglieder</span>
        ) : (
          active.map((member) => (
            <span key={member.id} className="scene-party-member">
              {member.name} · Lv {member.level ?? '—'}{' '}
              <button
                onClick={() =>
                  void scenarioAction(props, () =>
                    window.saltMarcher.scene.assignPartyMember(
                      props.sceneId,
                      member.id,
                      !scene.partyMemberIds.includes(member.id),
                      props.snapshot.scene.revision
                    )
                  )
                }
              >
                {scene.partyMemberIds.includes(member.id)
                  ? 'Entfernen'
                  : 'Zur Scene'}
              </button>
            </span>
          ))
        )}
      </div>
    </article>
  )
}

function CreatureCollectionCatalogPane(props: {
  query: CreatureCatalogQuery
  options: CreatureFilterOptions
  page: CreatureCatalogPage | null
  changed: (query: CreatureCatalogQuery) => void
  add: (creature: Creature) => void
  inspect: (creature: Creature) => void
}) {
  return (
    <section className="group-catalog-pane" aria-label="Monsterkatalog">
      <CreatureFilters
        query={props.query}
        options={props.options}
        changed={props.changed}
        compact
      />
      <div className="filter-chips">
        <FilterChips query={props.query} changed={props.changed} />
      </div>
      <div className="group-catalog-table-wrap">
        <table className="catalog-table group-catalog-table">
          <thead>
            <tr>
              <th>Monster</th>
              <th>CR</th>
              <th>Typ</th>
              <th>XP</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {props.page?.rows.map((creature) => (
              <tr key={creature.id}>
                <td>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => props.inspect(creature)}
                  >
                    {creature.name}
                  </button>
                </td>
                <td>{creature.challengeRating}</td>
                <td>{creature.type}</td>
                <td>{creature.xp.toLocaleString()}</td>
                <td>
                  <button
                    type="button"
                    aria-label={`${creature.name} hinzufügen`}
                    onClick={() => props.add(creature)}
                  >
                    +
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {props.page?.status === 'empty' && (
          <p className="empty-state">{props.page.message}</p>
        )}
      </div>
      <footer className="catalog-footer">
        <span>
          {props.page?.message || `${props.page?.total ?? 0} Monster`}
        </span>
        <div>
          <button
            type="button"
            disabled={!props.page || props.query.offset === 0}
            onClick={() =>
              props.changed({
                ...props.query,
                offset: Math.max(0, props.query.offset - props.query.limit)
              })
            }
          >
            Zurück
          </button>
          <span>{Math.floor(props.query.offset / props.query.limit) + 1}</span>
          <button
            type="button"
            disabled={
              !props.page ||
              props.query.offset + props.query.limit >= props.page.total
            }
            onClick={() =>
              props.changed({
                ...props.query,
                offset: props.query.offset + props.query.limit
              })
            }
          >
            Weiter
          </button>
        </div>
      </footer>
    </section>
  )
}

function CreatureCollectionSelection(props: {
  label: string
  value: string | null
  emptyLabel: string
  newLabel: string
  choices: readonly { id: string; label: string }[]
  changed: (value: string | null) => void
}) {
  return (
    <div className="group-selection-row">
      <label>
        {props.label}
        <select
          aria-label={`${props.label} auswählen`}
          value={props.value ?? ''}
          onChange={(event) => props.changed(event.target.value || null)}
        >
          <option value="">{props.emptyLabel}</option>
          <option value="new">{props.newLabel}</option>
          {props.choices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={() => props.changed('new')}>
        {props.newLabel}
      </button>
    </div>
  )
}

function GroupDialog(props: {
  snapshot: LiveSessionSnapshot
  group: SceneGroup | null
  close: () => void
  saved: (snapshot: LiveSessionSnapshot) => void
  inspect: (creature: Creature) => void
  onError: (message: string) => void
}) {
  const focused = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.snapshot.scene.focusedSceneId
  )!
  const initialQuantities = Object.fromEntries(
    props.group?.entries.map((entry) => [entry.creatureId, entry.quantity]) ??
      []
  )
  const initialFacts = Object.fromEntries(
    props.group?.entries.map((entry) => [
      entry.creatureId,
      {
        displayName: entry.displayName,
        cr: 0,
        xp: 0,
        available: entry.available
      }
    ]) ?? []
  )
  const [selection, setSelection] = useState<string | null>(
    props.group?.id ?? null
  )
  const [name, setName] = useState(props.group?.name ?? '')
  const [query, setQuery] = useState<CreatureCatalogQuery>({
    ...emptyQuery,
    limit: 30
  })
  const [page, setPage] = useState<CreatureCatalogPage | null>(null)
  const [options, setOptions] = useState(emptyCreatureOptions)
  const [quantities, setQuantities] =
    useState<Record<string, number>>(initialQuantities)
  const [facts, setFacts] =
    useState<Record<string, DraftCreatureFact>>(initialFacts)
  const [tuning, setTuning] = useState<EncounterTuning>({
    difficulty: 'auto',
    amount: 'auto',
    balance: 'auto',
    diversity: 'auto'
  })
  const [evaluation, setEvaluation] =
    useState<SceneGroupDraftEvaluation | null>(null)
  const [baseline, setBaseline] = useState(() =>
    groupDraftSignature(props.group?.name ?? '', initialQuantities)
  )
  const [pending, setPending] = useState<GroupDraftAction | null>(null)
  const [seed, setSeed] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const evaluationRequest = useRef(0)
  const factsRequest = useRef(0)
  const entries = useMemo(() => groupDraftEntries(quantities), [quantities])
  const active = selection !== null
  const dirty = active && groupDraftSignature(name, quantities) !== baseline
  const assigned = props.snapshot.party.members.filter((member) =>
    focused.partyMemberIds.includes(member.id)
  )
  const canGenerate =
    active &&
    assigned.length > 0 &&
    assigned.every((member) => member.level !== null)
  const sourceQuery = useMemo(
    () => ({ ...query, locationId: focused.locationId }),
    [focused.locationId, query]
  )

  useCreatureSearch(sourceQuery, setPage, props.onError)
  useEffect(() => {
    void window.saltMarcher.creatures
      .filterOptions()
      .then(setOptions)
      .catch(showError(props.onError))
  }, [props.onError])

  useEffect(() => {
    if (!active) return
    const token = ++evaluationRequest.current
    const timer = window.setTimeout(() => {
      void window.saltMarcher.scene
        .evaluateGroupDraft(focused.id, entries, props.snapshot.scene.revision)
        .then((next) => {
          if (evaluationRequest.current === token) setEvaluation(next)
        })
        .catch((cause) => {
          if (evaluationRequest.current === token) setMessage(errorText(cause))
        })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [active, entries, focused.id, props.snapshot.scene.revision])

  useEffect(() => {
    if (!selection || selection === 'new') return
    const group = focused.groups.find((candidate) => candidate.id === selection)
    if (!group) return
    const token = ++factsRequest.current
    void Promise.all(
      group.entries.map((entry) =>
        window.saltMarcher.creatures.detail(entry.creatureId).catch(() => null)
      )
    ).then((creatures) => {
      if (factsRequest.current !== token) return
      setFacts((current) => {
        const next = { ...current }
        for (const creature of creatures)
          if (creature) next[creature.id] = creatureFact(creature)
        return next
      })
    })
  }, [focused.groups, selection])

  function load(nextSelection: string | null) {
    const group =
      nextSelection && nextSelection !== 'new'
        ? focused.groups.find((candidate) => candidate.id === nextSelection)
        : undefined
    const nextName = group?.name ?? ''
    const nextQuantities = Object.fromEntries(
      group?.entries.map((entry) => [entry.creatureId, entry.quantity]) ?? []
    )
    const nextFacts = Object.fromEntries(
      group?.entries.map((entry) => [
        entry.creatureId,
        {
          displayName: entry.displayName,
          cr: 0,
          xp: 0,
          available: entry.available
        }
      ]) ?? []
    )
    setSelection(nextSelection)
    setName(nextName)
    setQuantities(nextQuantities)
    setFacts(nextFacts)
    setBaseline(groupDraftSignature(nextName, nextQuantities))
    setEvaluation(null)
    setMessage('')
    setSeed(0)
  }

  function perform(action: GroupDraftAction) {
    setPending(null)
    if (action.kind === 'close') props.close()
    else load(action.selection)
  }

  function request(action: GroupDraftAction) {
    if (dirty) setPending(action)
    else perform(action)
  }

  function addCreature(creature: Creature) {
    if (!active) {
      setSelection('new')
      setName('')
      setQuantities({ [creature.id]: 1 })
      setBaseline(groupDraftSignature('', {}))
    } else {
      setQuantities((current) => ({
        ...current,
        [creature.id]: Math.min(999, (current[creature.id] ?? 0) + 1)
      }))
    }
    setFacts((current) => ({
      ...current,
      [creature.id]: creatureFact(creature)
    }))
  }

  function changeQuantity(creatureId: string, delta: number) {
    setQuantities((current) => {
      const quantity = Math.max(
        0,
        Math.min(999, (current[creatureId] ?? 0) + delta)
      )
      const next = { ...current }
      if (quantity === 0) delete next[creatureId]
      else next[creatureId] = quantity
      return next
    })
  }

  async function inspect(creature: Creature) {
    try {
      props.inspect(await window.saltMarcher.creatures.detail(creature.id))
    } catch (cause) {
      setMessage(errorText(cause))
    }
  }

  async function generate(mode: 'fill' | 'replace') {
    if (!canGenerate) return
    const nextSeed = seed + 1
    setBusy(true)
    try {
      const result = await window.saltMarcher.scene.generateGroupDraft(
        focused.id,
        entries,
        mode,
        sourceQuery,
        tuning,
        nextSeed,
        props.snapshot.scene.revision
      )
      setQuantities(
        Object.fromEntries(
          result.entries.map((entry) => [entry.creatureId, entry.quantity])
        )
      )
      setFacts((current) => ({
        ...current,
        ...Object.fromEntries(
          result.entries.map((entry) => [
            entry.creatureId,
            {
              displayName: entry.displayName,
              cr: entry.cr,
              xp: entry.xp,
              available: entry.available
            }
          ])
        )
      }))
      setEvaluation(result.evaluation)
      setSeed(nextSeed)
      setMessage(result.message)
    } catch (cause) {
      setMessage(errorText(cause))
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!active || !name.trim() || entries.length === 0) {
      setMessage('Gruppenname und mindestens ein Monster sind erforderlich.')
      return
    }
    if (!entries.some((entry) => facts[entry.creatureId]?.available === true)) {
      setMessage('Mindestens ein verfügbares Monster ist erforderlich.')
      return
    }
    setBusy(true)
    try {
      props.saved(
        await window.saltMarcher.scene.saveGroup(
          focused.id,
          selection === 'new' ? null : selection,
          name.trim(),
          entries,
          props.snapshot.scene.revision
        )
      )
    } catch (cause) {
      setMessage(errorText(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="group-dialog group-builder-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-builder-title"
      >
        <header>
          <div>
            <p className="section-kicker">{focused.title}</p>
            <h2 id="group-builder-title">Gruppen managen</h2>
          </div>
          <button
            type="button"
            aria-label="Dialog schließen"
            onClick={() => request({ kind: 'close' })}
          >
            ×
          </button>
        </header>
        <div className="group-builder-layout">
          <CreatureCollectionCatalogPane
            query={query}
            options={{ ...options, locations: [] }}
            page={page}
            changed={setQuery}
            add={addCreature}
            inspect={(creature) => void inspect(creature)}
          />
          <section className="group-draft-pane" aria-label="Aktuelle Gruppe">
            <CreatureCollectionSelection
              label="Gruppe"
              value={selection}
              emptyLabel="Gruppe auswählen …"
              newLabel="Neue Gruppe"
              choices={focused.groups.map((group) => ({
                id: group.id,
                label: group.name
              }))}
              changed={(nextSelection) =>
                request({ kind: 'select', selection: nextSelection })
              }
            />
            {!active ? (
              <p className="empty-state">
                Wähle eine Gruppe aus oder lege eine neue Gruppe an.
              </p>
            ) : (
              <>
                <input
                  autoFocus
                  aria-label="Gruppenname"
                  placeholder="Gruppenname"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <ul className="group-draft-roster">
                  {entries.map((entry) => {
                    const fact = facts[entry.creatureId]
                    return (
                      <li
                        key={entry.creatureId}
                        className={
                          fact?.available === false ? 'unavailable' : ''
                        }
                      >
                        <div className="roster-quantity">
                          <button
                            aria-label={`Anzahl ${fact?.displayName ?? entry.creatureId} verringern`}
                            onClick={() => changeQuantity(entry.creatureId, -1)}
                          >
                            −
                          </button>
                          <strong>{entry.quantity}</strong>
                          <button
                            aria-label={`Anzahl ${fact?.displayName ?? entry.creatureId} erhöhen`}
                            onClick={() => changeQuantity(entry.creatureId, 1)}
                          >
                            +
                          </button>
                        </div>
                        <span>
                          <strong>
                            {fact?.displayName ?? entry.creatureId}
                          </strong>
                          <small>
                            CR {fact?.cr ?? '—'} ·{' '}
                            {(fact?.xp ?? 0).toLocaleString()} XP
                          </small>
                        </span>
                        <button
                          aria-label={`${fact?.displayName ?? entry.creatureId} entfernen`}
                          onClick={() =>
                            changeQuantity(entry.creatureId, -entry.quantity)
                          }
                        >
                          ×
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {entries.length === 0 && (
                  <p className="empty-state">
                    Monster links mit <strong>+</strong> hinzufügen oder eine
                    Gruppe generieren.
                  </p>
                )}
                <TuningControls tuning={tuning} changed={setTuning} />
                <div className="group-generator-actions">
                  <button
                    disabled={busy || !canGenerate}
                    onClick={() => void generate('fill')}
                  >
                    Auffüllen
                  </button>
                  <button
                    disabled={busy || !canGenerate}
                    onClick={() => void generate('replace')}
                  >
                    Neu generieren
                  </button>
                </div>
                {!canGenerate && (
                  <small className="muted">
                    Zum Generieren braucht die Scene eine zugewiesene Party mit
                    vollständigen Leveln.
                  </small>
                )}
                {evaluation && (
                  <DifficultySummary evaluation={evaluation} meter />
                )}
              </>
            )}
            {pending && (
              <div className="confirm-row group-draft-confirm" role="alert">
                <span>Ungespeicherte Änderungen verwerfen?</span>
                <button onClick={() => setPending(null)}>Abbrechen</button>
                <button className="danger" onClick={() => perform(pending)}>
                  Änderungen verwerfen
                </button>
              </div>
            )}
            {message && (
              <p className="generator-status" role="status">
                {message}
              </p>
            )}
          </section>
        </div>
        <footer className="group-builder-footer">
          <span className="muted">
            {focused.locationName || 'Kein Ort gesetzt'} · {assigned.length}{' '}
            zugewiesene PCs
          </span>
          <div>
            <button type="button" onClick={() => request({ kind: 'close' })}>
              Abbrechen
            </button>
            <button
              disabled={busy || !active || !name.trim() || entries.length === 0}
              onClick={() => void save()}
            >
              {selection === 'new' ? 'Gruppe erstellen' : 'Speichern'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

type DraftCreatureFact = {
  displayName: string
  cr: number
  xp: number
  available: boolean
}

type GroupDraftAction =
  { kind: 'close' } | { kind: 'select'; selection: string | null }

function creatureFact(creature: Creature): DraftCreatureFact {
  return {
    displayName: creature.name,
    cr: creature.cr,
    xp: creature.xp,
    available: true
  }
}

function groupDraftEntries(quantities: Record<string, number>) {
  return Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([creatureId, quantity]) => ({ creatureId, quantity }))
    .sort((a, b) => a.creatureId.localeCompare(b.creatureId))
}

function groupDraftSignature(
  name: string,
  quantities: Record<string, number>
): string {
  return JSON.stringify({ name, entries: groupDraftEntries(quantities) })
}

export function CatalogWorkspace(
  props: ScenarioProps & { inspect: (creature: Creature) => void }
) {
  const [section, setSection] = useState<
    'monsters' | 'locations' | 'factions' | 'encounterTables'
  >('monsters')
  const [query, setQuery] = useState<CreatureCatalogQuery>(emptyQuery)
  const [page, setPage] = useState<CreatureCatalogPage | null>(null)
  const [options, setOptions] = useState(emptyCreatureOptions)
  const [loading, setLoading] = useState(false)
  const [locations, setLocations] = useState<WorldLocationSnapshot>({
    revision: 0,
    locations: []
  })
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationSearchInput, setLocationSearchInput] = useState('')
  const [locationSearch, setLocationSearch] = useState('')
  const [locationDirection, setLocationDirection] = useState<'asc' | 'desc'>(
    'asc'
  )
  const [selectedLocation, setSelectedLocation] =
    useState<WorldLocation | null>(null)
  const [editingLocation, setEditingLocation] = useState<
    WorldLocation | null | undefined
  >(undefined)
  const [deleteLocationConfirm, setDeleteLocationConfirm] = useState(false)
  const [placingLocation, setPlacingLocation] = useState<WorldLocation | null>(
    null
  )
  const [locationTables, setLocationTables] = useState<EncounterTable[]>([])
  const [locationFactions, setLocationFactions] = useState<WorldFaction[]>([])
  const request = useRef(0)
  const onError = props.onError
  useEffect(() => {
    if (section !== 'monsters') return
    void window.saltMarcher.creatures
      .filterOptions()
      .then(setOptions)
      .catch(showError(onError))
  }, [onError, section])
  useEffect(() => {
    if (section !== 'monsters') return
    const token = ++request.current
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const result = await window.saltMarcher.creatures.search(query)
        if (request.current !== token) return
        setPage(result)
      } catch (cause) {
        if (request.current === token) onError(errorText(cause))
      } finally {
        if (request.current === token) setLoading(false)
      }
    }, 200)
    return () => window.clearTimeout(timer)
  }, [query, onError, section])
  useEffect(() => {
    if (section !== 'locations') return
    void Promise.resolve().then(async () => {
      setLocationLoading(true)
      try {
        const [next, tableSnapshot, factionSnapshot] = await Promise.all([
          window.saltMarcher.locations.read(),
          window.saltMarcher.encounterTables.read(),
          window.saltMarcher.factions.read()
        ])
        setLocations(next)
        setLocationTables([...tableSnapshot.tables])
        setLocationFactions([...factionSnapshot.factions])
        setSelectedLocation((current) =>
          current
            ? (next.locations.find((location) => location.id === current.id) ??
              null)
            : null
        )
      } catch (cause) {
        onError(errorText(cause))
      } finally {
        setLocationLoading(false)
      }
    })
  }, [onError, section])
  useEffect(() => {
    if (section !== 'locations') return
    const timer = window.setTimeout(
      () => setLocationSearch(locationSearchInput),
      200
    )
    return () => window.clearTimeout(timer)
  }, [locationSearchInput, section])
  const open = async (creature: Creature) => {
    try {
      props.inspect(await window.saltMarcher.creatures.detail(creature.id))
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }
  const visibleLocations = useMemo(() => {
    const needle = locationSearch.trim().toLocaleLowerCase()
    return locations.locations
      .filter(
        (location) =>
          !needle ||
          location.displayName.toLocaleLowerCase().includes(needle) ||
          location.notes.toLocaleLowerCase().includes(needle)
      )
      .toSorted((a, b) => {
        const order = a.displayName.localeCompare(b.displayName)
        return locationDirection === 'asc' ? order : -order
      })
  }, [locationDirection, locationSearch, locations.locations])

  const saveLocation = async (draft: WorldLocationDraft) => {
    try {
      const previousIds = new Set(
        locations.locations.map((location) => location.id)
      )
      const next = editingLocation
        ? await window.saltMarcher.locations.update(
            editingLocation.id,
            draft,
            locations.revision
          )
        : await window.saltMarcher.locations.create(draft, locations.revision)
      const selectedId =
        editingLocation?.id ??
        next.locations.find((location) => !previousIds.has(location.id))?.id
      setLocations(next)
      setSelectedLocation(
        next.locations.find((location) => location.id === selectedId) ?? null
      )
      setEditingLocation(undefined)
      props.setSnapshot(await window.saltMarcher.session.read())
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }

  const deleteLocation = async () => {
    if (!selectedLocation) return
    try {
      const next = await window.saltMarcher.locations.delete(
        selectedLocation.id,
        locations.revision
      )
      setLocations(next)
      setSelectedLocation(null)
      setDeleteLocationConfirm(false)
      props.setSnapshot(await window.saltMarcher.session.read())
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }

  return (
    <section className="catalog-workspace">
      <div
        className={`catalog-browser${section !== 'monsters' ? ' locations-catalog-browser' : ''}`}
      >
        <header className="catalog-section-selector">
          <button
            aria-pressed={section === 'monsters'}
            onClick={() => setSection('monsters')}
          >
            Monster
          </button>
          <button
            aria-pressed={section === 'locations'}
            onClick={() => setSection('locations')}
          >
            Orte
          </button>
          <button
            aria-pressed={section === 'factions'}
            onClick={() => setSection('factions')}
          >
            Fraktionen
          </button>
          <button
            aria-pressed={section === 'encounterTables'}
            onClick={() => setSection('encounterTables')}
          >
            Encounter-Tabellen
          </button>
        </header>
        {section === 'monsters' ? (
          <>
            <CreatureFilters
              query={query}
              options={options}
              changed={setQuery}
            />
            <div className="filter-chips">
              <FilterChips query={query} changed={setQuery} />
            </div>
            <div className="catalog-table-wrap">
              <table className="catalog-table">
                <thead>
                  <tr>
                    <SortHeader
                      label="Name"
                      field="name"
                      query={query}
                      changed={setQuery}
                    />
                    <SortHeader
                      label="CR"
                      field="cr"
                      query={query}
                      changed={setQuery}
                    />
                    <th>Typ</th>
                    <th>Größe</th>
                    <SortHeader
                      label="XP"
                      field="xp"
                      query={query}
                      changed={setQuery}
                    />
                  </tr>
                </thead>
                <tbody>
                  {page?.rows.map((creature) => (
                    <tr key={creature.id} className="catalog-row">
                      <td>
                        <button
                          className="link-button"
                          onClick={() => void open(creature)}
                        >
                          {creature.name}
                        </button>
                      </td>
                      <td>{creature.challengeRating}</td>
                      <td>
                        {creature.type}
                        {creature.subtype ? ` (${creature.subtype})` : ''}
                      </td>
                      <td>{creature.size}</td>
                      <td>{creature.xp.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="catalog-footer">
              <span>
                {loading
                  ? 'Monster werden aktualisiert …'
                  : page?.message || `${page?.total ?? 0} Monster`}
              </span>
              <div>
                <button
                  disabled={!page || query.offset === 0}
                  onClick={() =>
                    setQuery({
                      ...query,
                      offset: Math.max(0, query.offset - query.limit)
                    })
                  }
                >
                  Zurück
                </button>
                <span>{Math.floor(query.offset / query.limit) + 1}</span>
                <button
                  disabled={!page || query.offset + query.limit >= page.total}
                  onClick={() =>
                    setQuery({ ...query, offset: query.offset + query.limit })
                  }
                >
                  Weiter
                </button>
              </div>
            </footer>
          </>
        ) : section === 'locations' ? (
          <>
            <form
              className="catalog-filters"
              onSubmit={(event) => {
                event.preventDefault()
                setLocationSearch(locationSearchInput)
              }}
            >
              <input
                aria-label="Orte suchen"
                placeholder="Orte suchen …"
                value={locationSearchInput}
                onChange={(event) => setLocationSearchInput(event.target.value)}
              />
              <button type="button" onClick={() => setEditingLocation(null)}>
                Erstellen
              </button>
            </form>
            <div className="catalog-table-wrap">
              <table className="catalog-table">
                <thead>
                  <tr>
                    <th>
                      <button
                        className="sort-header"
                        onClick={() =>
                          setLocationDirection((current) =>
                            current === 'asc' ? 'desc' : 'asc'
                          )
                        }
                      >
                        Name {locationDirection === 'asc' ? '↑' : '↓'}
                      </button>
                    </th>
                    <th>Notizen</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLocations.map((location) => (
                    <tr key={location.id} className="catalog-row">
                      <td>
                        <button
                          className="link-button"
                          onClick={() => {
                            setSelectedLocation(location)
                            setDeleteLocationConfirm(false)
                          }}
                        >
                          {location.displayName}
                        </button>
                      </td>
                      <td>{location.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="catalog-footer">
              <span>
                {locationLoading
                  ? 'Orte werden aktualisiert …'
                  : visibleLocations.length === 0
                    ? 'Keine Orte gefunden.'
                    : `${visibleLocations.length} von ${locations.locations.length} Orten`}
              </span>
            </footer>
          </>
        ) : section === 'factions' ? (
          <FactionCatalog onError={props.onError} inspect={props.inspect} />
        ) : (
          <EncounterTableCatalog
            onError={props.onError}
            inspect={props.inspect}
          />
        )}
      </div>
      {selectedLocation && (
        <LocationInspector
          location={selectedLocation}
          close={() => {
            setSelectedLocation(null)
            setDeleteLocationConfirm(false)
          }}
          edit={() => {
            setEditingLocation(selectedLocation)
            setSelectedLocation(null)
          }}
          place={() => setPlacingLocation(selectedLocation)}
          deleteConfirm={deleteLocationConfirm}
          setDeleteConfirm={setDeleteLocationConfirm}
          remove={() => void deleteLocation()}
        />
      )}
      {editingLocation !== undefined && (
        <LocationDialog
          location={editingLocation}
          factions={locationFactions}
          tables={locationTables}
          close={() => setEditingLocation(undefined)}
          save={(draft) => void saveLocation(draft)}
        />
      )}
      {placingLocation && (
        <HexLocationPlacementDialog
          location={placingLocation}
          close={() => setPlacingLocation(null)}
          onPlaced={() =>
            void window.saltMarcher.session.read().then(props.setSnapshot)
          }
          onError={props.onError}
        />
      )}
    </section>
  )
}

const LazyCatalogWorkspace = lazy(
  () => import('../catalog/catalog-workspace.js')
)

function LocationInspector(props: {
  location: WorldLocation
  close: () => void
  edit: () => void
  place: () => void
  deleteConfirm: boolean
  setDeleteConfirm: (value: boolean) => void
  remove: () => void
}) {
  return (
    <aside className="location-inspector" aria-label="Ort Details">
      <header>
        <div>
          <p className="section-kicker">Ort</p>
          <IlluminatedHeading title={props.location.displayName} />
        </div>
        <button aria-label="Ort Details schließen" onClick={props.close}>
          ×
        </button>
      </header>
      <p className="location-notes">
        {props.location.notes || 'Keine Beschreibung hinterlegt.'}
      </p>
      <p>
        {props.location.factionIds.length} Fraktionen ·{' '}
        {props.location.encounterTableIds.length} direkte Encounter-Tabellen
      </p>
      <footer className="row-actions">
        <button onClick={props.place}>Platzieren / verschieben</button>
        <button onClick={props.edit}>Bearbeiten</button>
        {!props.deleteConfirm ? (
          <button
            className="danger"
            onClick={() => props.setDeleteConfirm(true)}
          >
            Löschen
          </button>
        ) : (
          <>
            <span>Ort wirklich löschen?</span>
            <button onClick={() => props.setDeleteConfirm(false)}>
              Abbrechen
            </button>
            <button className="danger" onClick={props.remove}>
              Wirklich löschen
            </button>
          </>
        )}
      </footer>
    </aside>
  )
}

function LocationDialog(props: {
  location: WorldLocation | null
  factions: readonly WorldFaction[]
  tables: readonly EncounterTable[]
  close: () => void
  save: (draft: WorldLocationDraft) => void
}) {
  const [displayName, setDisplayName] = useState(
    props.location?.displayName ?? ''
  )
  const [notes, setNotes] = useState(props.location?.notes ?? '')
  const [factionIds, setFactionIds] = useState<string[]>([
    ...(props.location?.factionIds ?? [])
  ])
  const [encounterTableIds, setEncounterTableIds] = useState<string[]>([
    ...(props.location?.encounterTableIds ?? [])
  ])
  return (
    <div className="modal-backdrop" role="presentation">
      <form
        className="location-editor"
        role="dialog"
        aria-modal="true"
        aria-label={props.location ? 'Ort bearbeiten' : 'Ort erstellen'}
        onSubmit={(event) => {
          event.preventDefault()
          props.save({ displayName, notes, factionIds, encounterTableIds })
        }}
      >
        <header>
          <div>
            <p className="section-kicker">World Planner</p>
            <h2>{props.location ? 'Ort bearbeiten' : 'Ort erstellen'}</h2>
          </div>
        </header>
        <label>
          Name
          <input
            aria-label="Ortsname"
            required
            maxLength={100}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <ReferenceMultiSelect
          label="Verknüpfte Fraktionen"
          options={props.factions.map((faction) => ({
            id: faction.id,
            label: faction.displayName
          }))}
          selected={factionIds}
          changed={setFactionIds}
        />
        <ReferenceMultiSelect
          label="Direkte Encounter-Tabellen"
          options={props.tables.map((table) => ({
            id: table.id,
            label: table.displayName
          }))}
          selected={encounterTableIds}
          changed={setEncounterTableIds}
        />
        <label>
          Notizen
          <textarea
            aria-label="Ortsnotizen"
            maxLength={20_000}
            rows={10}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <footer>
          <button type="button" onClick={props.close}>
            Abbrechen
          </button>
          <button disabled={!displayName.trim()}>
            {props.location ? 'Speichern' : 'Erstellen'}
          </button>
        </footer>
      </form>
    </div>
  )
}

function EncounterTableCatalog(props: {
  onError: (message: string) => void
  inspect: (creature: Creature) => void
}) {
  const [snapshot, setSnapshot] = useState<EncounterTableSnapshot>({
    revision: 0,
    tables: []
  })
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<EncounterTable | null | undefined>(
    undefined
  )
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    void window.saltMarcher.encounterTables
      .read()
      .then(setSnapshot)
      .catch(showError(props.onError))
  }, [props.onError])

  const visible = snapshot.tables.filter((table) =>
    `${table.displayName} ${table.description}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
  )

  async function save(
    table: EncounterTable | null,
    draft: EncounterTableDraft
  ) {
    try {
      const next = table
        ? await window.saltMarcher.encounterTables.update(
            table.id,
            draft,
            snapshot.revision
          )
        : await window.saltMarcher.encounterTables.create(
            draft,
            snapshot.revision
          )
      setSnapshot(next)
      setEditing(undefined)
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }

  async function remove(id: string) {
    try {
      setSnapshot(
        await window.saltMarcher.encounterTables.delete(id, snapshot.revision)
      )
      setDeleteId(null)
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }

  return (
    <>
      <div className="catalog-filters">
        <input
          aria-label="Encounter-Tabellen suchen"
          placeholder="Encounter-Tabellen suchen …"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button onClick={() => setEditing(null)}>Erstellen</button>
      </div>
      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Einträge</th>
              <th>Beschreibung</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((table) => (
              <tr key={table.id}>
                <td>
                  <button
                    className="link-button"
                    onClick={() => setEditing(table)}
                  >
                    {table.displayName}
                  </button>
                </td>
                <td>{table.entries.length}</td>
                <td>{table.description || '—'}</td>
                <td className="row-actions">
                  {deleteId === table.id ? (
                    <>
                      <button onClick={() => setDeleteId(null)}>
                        Abbrechen
                      </button>
                      <button
                        className="danger"
                        onClick={() => void remove(table.id)}
                      >
                        Bestätigen
                      </button>
                    </>
                  ) : (
                    <button
                      className="danger"
                      onClick={() => setDeleteId(table.id)}
                    >
                      Löschen
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="catalog-footer">
        <span>{visible.length} Encounter-Tabellen</span>
      </footer>
      {editing !== undefined && (
        <EncounterTableDialog
          key={editing?.id ?? 'new'}
          table={editing}
          tables={snapshot.tables}
          close={() => setEditing(undefined)}
          select={setEditing}
          save={(table, draft) => void save(table, draft)}
          onError={props.onError}
          inspect={props.inspect}
        />
      )}
    </>
  )
}

function EncounterTableDialog(props: {
  table: EncounterTable | null
  tables: readonly EncounterTable[]
  close: () => void
  select: (table: EncounterTable | null) => void
  save: (table: EncounterTable | null, draft: EncounterTableDraft) => void
  onError: (message: string) => void
  inspect: (creature: Creature) => void
}) {
  const [displayName, setDisplayName] = useState(props.table?.displayName ?? '')
  const [description, setDescription] = useState(props.table?.description ?? '')
  const [query, setQuery] = useState<CreatureCatalogQuery>({
    ...emptyQuery,
    limit: 30
  })
  const [page, setPage] = useState<CreatureCatalogPage | null>(null)
  const [options, setOptions] = useState(emptyCreatureOptions)
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(
      props.table?.entries.map((entry) => [entry.creatureId, entry.weight]) ??
        []
    )
  )
  const [names, setNames] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<
    { kind: 'close' } | { kind: 'select'; id: string } | null
  >(null)
  useCreatureSearch(query, setPage, props.onError)

  useEffect(() => {
    void window.saltMarcher.creatures
      .filterOptions()
      .then(setOptions)
      .catch(showError(props.onError))
  }, [props.onError])

  useEffect(() => {
    void Promise.all(
      Object.keys(weights).map((id) =>
        window.saltMarcher.creatures.detail(id).catch(() => null)
      )
    ).then((rows) =>
      setNames(
        Object.fromEntries(
          rows
            .filter((row): row is Creature => row !== null)
            .map((row) => [row.id, row.name])
        )
      )
    )
  }, [weights])

  const entries = Object.entries(weights).toSorted((left, right) =>
    (names[left[0]] ?? left[0]).localeCompare(names[right[0]] ?? right[0])
  )
  const signature = JSON.stringify({
    displayName,
    description,
    entries: Object.entries(weights).toSorted(([left], [right]) =>
      left.localeCompare(right)
    )
  })
  const initialSignature = JSON.stringify({
    displayName: props.table?.displayName ?? '',
    description: props.table?.description ?? '',
    entries: (props.table?.entries ?? [])
      .map((entry) => [entry.creatureId, entry.weight])
      .toSorted((left, right) =>
        String(left[0]).localeCompare(String(right[0]))
      )
  })
  const dirty = signature !== initialSignature

  function requestClose() {
    if (dirty) setPending({ kind: 'close' })
    else props.close()
  }

  function requestSelection(id: string | null) {
    if (!id) return
    if (dirty) setPending({ kind: 'select', id })
    else select(id)
  }

  function select(id: string) {
    props.select(
      id === 'new'
        ? null
        : (props.tables.find((table) => table.id === id) ?? null)
    )
  }

  function discardPending() {
    if (!pending) return
    const action = pending
    setPending(null)
    if (action.kind === 'close') props.close()
    else select(action.id)
  }
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="group-dialog group-builder-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="encounter-table-manager-title"
      >
        <header>
          <div>
            <p className="section-kicker">Katalog</p>
            <h2 id="encounter-table-manager-title">
              Encounter-Tabellen managen
            </h2>
          </div>
          <button
            type="button"
            aria-label="Dialog schließen"
            onClick={requestClose}
          >
            ×
          </button>
        </header>
        <div className="group-builder-layout">
          <CreatureCollectionCatalogPane
            query={query}
            options={options}
            page={page}
            changed={setQuery}
            inspect={props.inspect}
            add={(creature) => {
              setWeights((current) => ({
                ...current,
                [creature.id]: current[creature.id] ?? 1
              }))
              setNames((current) => ({
                ...current,
                [creature.id]: creature.name
              }))
            }}
          />
          <section
            className="group-draft-pane"
            aria-label="Aktuelle Encounter-Tabelle"
          >
            <CreatureCollectionSelection
              label="Encounter-Tabelle"
              value={props.table?.id ?? 'new'}
              emptyLabel="Tabelle auswählen …"
              newLabel="Neue Tabelle"
              choices={props.tables.map((table) => ({
                id: table.id,
                label: table.displayName
              }))}
              changed={requestSelection}
            />
            <label>
              Name
              <input
                required
                aria-label="Tabellenname"
                maxLength={100}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
            <label>
              Beschreibung
              <textarea
                aria-label="Tabellenbeschreibung"
                rows={4}
                maxLength={20_000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <h3>Gewichtete Einträge</h3>
            <ul className="group-draft-roster">
              {entries.map(([id, weight]) => (
                <li key={id}>
                  <div className="roster-quantity">
                    <button
                      type="button"
                      aria-label={`Gewicht ${names[id] ?? id} verringern`}
                      disabled={weight <= 1}
                      onClick={() =>
                        setWeights({ ...weights, [id]: weight - 1 })
                      }
                    >
                      −
                    </button>
                    <strong>{weight}</strong>
                    <button
                      type="button"
                      aria-label={`Gewicht ${names[id] ?? id} erhöhen`}
                      disabled={weight >= 10}
                      onClick={() =>
                        setWeights({ ...weights, [id]: weight + 1 })
                      }
                    >
                      +
                    </button>
                  </div>
                  <span>
                    <strong>{names[id] ?? `Nicht verfügbar (${id})`}</strong>
                    <small>Gewicht {weight} von 10</small>
                  </span>
                  <button
                    type="button"
                    aria-label={`${names[id] ?? id} entfernen`}
                    onClick={() => {
                      const next = { ...weights }
                      delete next[id]
                      setWeights(next)
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            {entries.length === 0 && (
              <p className="empty-state">
                Monster links mit <strong>+</strong> hinzufügen.
              </p>
            )}
            {pending && (
              <div className="confirm-row group-draft-confirm" role="alert">
                <span>Ungespeicherte Änderungen verwerfen?</span>
                <button type="button" onClick={() => setPending(null)}>
                  Abbrechen
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={discardPending}
                >
                  Änderungen verwerfen
                </button>
              </div>
            )}
          </section>
        </div>
        <footer className="group-builder-footer">
          <span className="muted">
            Gewichte bestimmen die relative Auswahlwahrscheinlichkeit.
          </span>
          <div>
            <button type="button" onClick={requestClose}>
              Abbrechen
            </button>
            <button
              type="button"
              disabled={!displayName.trim()}
              onClick={() =>
                props.save(props.table, {
                  displayName,
                  description,
                  entries: Object.entries(weights).map(
                    ([creatureId, weight]) => ({ creatureId, weight })
                  )
                })
              }
            >
              {props.table ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

function FactionCatalog(props: {
  onError: (message: string) => void
  inspect: (creature: Creature) => void
}) {
  const [snapshot, setSnapshot] = useState<WorldFactionSnapshot>({
    revision: 0,
    factions: []
  })
  const [tableSnapshot, setTableSnapshot] = useState<EncounterTableSnapshot>({
    revision: 0,
    tables: []
  })
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<WorldFaction | null | undefined>(
    undefined
  )
  const [deleteId, setDeleteId] = useState<string | null>(null)
  useEffect(() => {
    void Promise.all([
      window.saltMarcher.factions.read(),
      window.saltMarcher.encounterTables.read()
    ])
      .then(([factions, tableSnapshot]) => {
        setSnapshot(factions)
        setTableSnapshot(tableSnapshot)
      })
      .catch(showError(props.onError))
  }, [props.onError])

  const visible = snapshot.factions.filter((faction) =>
    `${faction.displayName} ${faction.notes}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
  )
  async function save(draft: WorldFactionDraft) {
    try {
      setSnapshot(
        editing
          ? await window.saltMarcher.factions.update(
              editing.id,
              draft,
              snapshot.revision
            )
          : await window.saltMarcher.factions.create(draft, snapshot.revision)
      )
      setEditing(undefined)
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }
  async function remove(id: string) {
    try {
      setSnapshot(
        await window.saltMarcher.factions.delete(id, snapshot.revision)
      )
      setDeleteId(null)
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }
  return (
    <>
      <div className="catalog-filters">
        <input
          aria-label="Fraktionen suchen"
          placeholder="Fraktionen suchen …"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button onClick={() => setEditing(null)}>Erstellen</button>
      </div>
      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Gesinnung</th>
              <th>Primärtabelle</th>
              <th>Bestand</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((faction) => (
              <tr key={faction.id}>
                <td>
                  <button
                    className="link-button"
                    onClick={() => setEditing(faction)}
                  >
                    {faction.displayName}
                  </button>
                </td>
                <td>{faction.disposition}</td>
                <td>
                  {tableSnapshot.tables.find(
                    (table) => table.id === faction.primaryEncounterTableId
                  )?.displayName ?? 'Keine'}
                </td>
                <td>{faction.inventory.length} Grenzen</td>
                <td className="row-actions">
                  {deleteId === faction.id ? (
                    <>
                      <button onClick={() => setDeleteId(null)}>
                        Abbrechen
                      </button>
                      <button
                        className="danger"
                        onClick={() => void remove(faction.id)}
                      >
                        Bestätigen
                      </button>
                    </>
                  ) : (
                    <button
                      className="danger"
                      onClick={() => setDeleteId(faction.id)}
                    >
                      Löschen
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="catalog-footer">
        <span>{visible.length} Fraktionen</span>
      </footer>
      {editing !== undefined && (
        <FactionDialog
          faction={editing}
          tableSnapshot={tableSnapshot}
          tablesChanged={setTableSnapshot}
          factionsChanged={setSnapshot}
          close={() => setEditing(undefined)}
          save={(draft) => void save(draft)}
          onError={props.onError}
          inspect={props.inspect}
        />
      )}
    </>
  )
}

function FactionDialog(props: {
  faction: WorldFaction | null
  tableSnapshot: EncounterTableSnapshot
  tablesChanged: (snapshot: EncounterTableSnapshot) => void
  factionsChanged: (snapshot: WorldFactionSnapshot) => void
  close: () => void
  save: (draft: WorldFactionDraft) => void
  onError: (message: string) => void
  inspect: (creature: Creature) => void
}) {
  const [displayName, setDisplayName] = useState(
    props.faction?.displayName ?? ''
  )
  const [notes, setNotes] = useState(props.faction?.notes ?? '')
  const [disposition, setDisposition] = useState(
    props.faction?.disposition ?? 0
  )
  const [primaryEncounterTableId, setPrimaryEncounterTableId] = useState<
    string | null
  >(props.faction?.primaryEncounterTableId ?? null)
  const [inventory, setInventory] = useState<Record<string, number>>(
    Object.fromEntries(
      props.faction?.inventory.map((entry) => [
        entry.creatureId,
        entry.maximum
      ]) ?? []
    )
  )
  const [names, setNames] = useState<Record<string, string>>({})
  const [tableManager, setTableManager] = useState<
    EncounterTable | null | undefined
  >(undefined)
  const selectedTable = props.tableSnapshot.tables.find(
    (table) => table.id === primaryEncounterTableId
  )
  const selectedCreatureIds = useMemo(
    () => selectedTable?.entries.map((entry) => entry.creatureId) ?? [],
    [selectedTable]
  )
  useEffect(() => {
    void Promise.all(
      selectedCreatureIds.map((id) =>
        window.saltMarcher.creatures.detail(id).catch(() => null)
      )
    ).then((rows) =>
      setNames(
        Object.fromEntries(
          rows
            .filter((row): row is Creature => row !== null)
            .map((row) => [row.id, row.name])
        )
      )
    )
  }, [selectedCreatureIds])

  function selectPrimaryTable(id: string | null) {
    const allowed = new Set(
      props.tableSnapshot.tables
        .find((table) => table.id === id)
        ?.entries.map((entry) => entry.creatureId) ?? []
    )
    setPrimaryEncounterTableId(id)
    setInventory((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([creatureId]) =>
          allowed.has(creatureId)
        )
      )
    )
  }

  async function saveTable(
    table: EncounterTable | null,
    draft: EncounterTableDraft
  ) {
    try {
      const previousIds = new Set(
        props.tableSnapshot.tables.map((candidate) => candidate.id)
      )
      const next = table
        ? await window.saltMarcher.encounterTables.update(
            table.id,
            draft,
            props.tableSnapshot.revision
          )
        : await window.saltMarcher.encounterTables.create(
            draft,
            props.tableSnapshot.revision
          )
      const selectedId =
        table?.id ??
        next.tables.find((candidate) => !previousIds.has(candidate.id))?.id ??
        null
      props.tablesChanged(next)
      props.factionsChanged(await window.saltMarcher.factions.read())
      selectPrimaryTableFromSnapshot(selectedId, next)
      setTableManager(undefined)
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }

  function selectPrimaryTableFromSnapshot(
    id: string | null,
    snapshot: EncounterTableSnapshot
  ) {
    const allowed = new Set(
      snapshot.tables
        .find((table) => table.id === id)
        ?.entries.map((entry) => entry.creatureId) ?? []
    )
    setPrimaryEncounterTableId(id)
    setInventory((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([creatureId]) =>
          allowed.has(creatureId)
        )
      )
    )
  }
  return (
    <>
      <div className="modal-backdrop" role="presentation">
        <form
          className="location-editor faction-editor"
          role="dialog"
          aria-modal="true"
          aria-label={
            props.faction ? 'Fraktion bearbeiten' : 'Fraktion erstellen'
          }
          onSubmit={(event) => {
            event.preventDefault()
            props.save({
              displayName,
              notes,
              disposition,
              primaryEncounterTableId,
              inventory: Object.entries(inventory).map(
                ([creatureId, maximum]) => ({ creatureId, maximum })
              )
            })
          }}
        >
          <header>
            <div>
              <p className="section-kicker">World Planner</p>
              <h2>
                {props.faction ? 'Fraktion bearbeiten' : 'Fraktion erstellen'}
              </h2>
            </div>
            <button
              type="button"
              aria-label="Dialog schließen"
              onClick={props.close}
            >
              ×
            </button>
          </header>
          <label>
            Name
            <input
              required
              aria-label="Fraktionsname"
              maxLength={100}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <label>
            Notizen
            <textarea
              aria-label="Fraktionsnotizen"
              rows={4}
              maxLength={20_000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <label>
            Gesinnung ({disposition})
            <input
              aria-label="Fraktionsgesinnung"
              type="range"
              min={-50}
              max={50}
              value={disposition}
              onChange={(event) => setDisposition(Number(event.target.value))}
            />
          </label>
          <label>
            Primäre Encounter-Tabelle
            <span className="faction-table-selection">
              <select
                aria-label="Primäre Encounter-Tabelle"
                value={primaryEncounterTableId ?? ''}
                onChange={(event) =>
                  selectPrimaryTable(event.target.value || null)
                }
              >
                <option value="">Keine primäre Tabelle</option>
                {props.tableSnapshot.tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.displayName}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setTableManager(null)}>
                Neue Encounter-Tabelle
              </button>
            </span>
          </label>
          <h3>Endlicher Bestand</h3>
          <p className="muted">
            Der Bestand basiert auf der Primärtabelle. Ein leeres Maximum
            bedeutet unbegrenzt.
          </p>
          <ul className="source-entry-list">
            {selectedTable?.entries.map((entry) => (
              <li key={entry.creatureId}>
                <span>
                  {names[entry.creatureId] ??
                    `Nicht verfügbar (${entry.creatureId})`}
                </span>
                <label>
                  Maximum
                  <input
                    aria-label={`Maximum ${names[entry.creatureId] ?? entry.creatureId}`}
                    type="number"
                    min={0}
                    placeholder="Unbegrenzt"
                    value={inventory[entry.creatureId] ?? ''}
                    onChange={(event) => {
                      const next = { ...inventory }
                      if (!event.target.value) delete next[entry.creatureId]
                      else
                        next[entry.creatureId] = Math.max(
                          0,
                          Number(event.target.value)
                        )
                      setInventory(next)
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...inventory }
                    delete next[entry.creatureId]
                    setInventory(next)
                  }}
                >
                  Unbegrenzt
                </button>
              </li>
            ))}
          </ul>
          {!selectedTable && (
            <p className="empty-state">
              Wähle eine Encounter-Tabelle, um den Bestand festzulegen.
            </p>
          )}
          <footer>
            <button type="button" onClick={props.close}>
              Abbrechen
            </button>
            <button disabled={!displayName.trim()}>
              {props.faction ? 'Speichern' : 'Erstellen'}
            </button>
          </footer>
        </form>
      </div>
      {tableManager !== undefined && (
        <EncounterTableDialog
          key={tableManager?.id ?? 'new-faction-table'}
          table={tableManager}
          tables={props.tableSnapshot.tables}
          close={() => setTableManager(undefined)}
          select={setTableManager}
          save={(table, draft) => void saveTable(table, draft)}
          onError={props.onError}
          inspect={props.inspect}
        />
      )}
    </>
  )
}

function CreatureFilters(props: {
  query: CreatureCatalogQuery
  options: CreatureFilterOptions
  changed: (query: CreatureCatalogQuery) => void
  compact?: boolean
}) {
  const q = props.query
  const update = (values: Partial<CreatureCatalogQuery>) =>
    props.changed({ ...q, ...values, offset: 0 })
  return (
    <div
      className={`catalog-filters${props.compact ? ' compact-filters' : ''}`}
    >
      <input
        aria-label="Monster suchen"
        placeholder="Monster suchen …"
        value={q.name}
        onChange={(event) => update({ name: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Enter') update({ name: event.currentTarget.value })
        }}
      />
      <select
        aria-label="CR minimum"
        value={q.crMin ?? ''}
        onChange={(event) =>
          update({
            crMin: event.target.value ? Number(event.target.value) : undefined
          })
        }
      >
        <option value="">CR min</option>
        {props.options.challengeRatings.map((value) => (
          <option key={value} value={crNumber(value)}>
            {value}
          </option>
        ))}
      </select>
      <select
        aria-label="CR maximum"
        value={q.crMax ?? ''}
        onChange={(event) =>
          update({
            crMax: event.target.value ? Number(event.target.value) : undefined
          })
        }
      >
        <option value="">CR max</option>
        {props.options.challengeRatings.map((value) => (
          <option key={value} value={crNumber(value)}>
            {value}
          </option>
        ))}
      </select>
      <MultiSelect
        label="Größe"
        options={props.options.sizes}
        selected={q.sizes}
        changed={(sizes) => update({ sizes })}
      />
      <MultiSelect
        label="Typ"
        options={props.options.types}
        selected={q.types}
        changed={(types) => update({ types })}
      />
      <MultiSelect
        label="Unterart"
        options={props.options.subtypes}
        selected={q.subtypes}
        changed={(subtypes) => update({ subtypes })}
      />
      <MultiSelect
        label="Umgebung"
        options={props.options.biomes}
        selected={q.biomes}
        changed={(biomes) => update({ biomes })}
      />
      <MultiSelect
        label="Gesinnung"
        options={props.options.alignments}
        selected={q.alignments}
        changed={(alignments) => update({ alignments })}
      />
      {props.options.encounterTables.length > 0 && (
        <ReferenceMultiSelect
          label="Tabelle"
          options={props.options.encounterTables}
          selected={q.encounterTableIds}
          changed={(encounterTableIds) => update({ encounterTableIds })}
        />
      )}
      {props.options.factions.length > 0 && (
        <ReferenceMultiSelect
          label="Fraktionen"
          options={props.options.factions}
          selected={q.factionIds}
          changed={(factionIds) => update({ factionIds })}
        />
      )}
      {props.options.locations.length > 0 && (
        <select
          aria-label="Ort"
          value={q.locationId ?? ''}
          onChange={(event) =>
            update({ locationId: event.target.value || null })
          }
        >
          <option value="">Ort</option>
          {props.options.locations.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      )}
      <button onClick={() => props.changed({ ...emptyQuery, limit: q.limit })}>
        Filter zurücksetzen
      </button>
    </div>
  )
}

function MultiSelect(props: {
  label: string
  options: readonly string[]
  selected: readonly string[]
  changed: (values: string[]) => void
}) {
  return (
    <label className="multi-filter">
      <span>
        {props.label}
        {props.selected.length ? ` (${props.selected.length})` : ''}
      </span>
      <select
        multiple
        aria-label={props.label}
        value={[...props.selected]}
        onChange={(event) =>
          props.changed(
            Array.from(
              event.currentTarget.selectedOptions,
              (option) => option.value
            )
          )
        }
      >
        {props.options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

function ReferenceMultiSelect(props: {
  label: string
  options: readonly { id: string; label: string }[]
  selected: readonly string[]
  changed: (values: string[]) => void
}) {
  return (
    <label className="multi-filter">
      <span>
        {props.label}
        {props.selected.length ? ` (${props.selected.length})` : ''}
      </span>
      <select
        multiple
        aria-label={props.label}
        value={[...props.selected]}
        onChange={(event) =>
          props.changed(
            Array.from(
              event.currentTarget.selectedOptions,
              (option) => option.value
            )
          )
        }
      >
        {props.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function FilterChips(props: {
  query: CreatureCatalogQuery
  changed: (query: CreatureCatalogQuery) => void
}) {
  const chips: { label: string; clear: () => void }[] = []
  const q = props.query
  if (q.name)
    chips.push({
      label: `Suche: ${q.name}`,
      clear: () => props.changed({ ...q, name: '', offset: 0 })
    })
  if (q.crMin !== undefined || q.crMax !== undefined)
    chips.push({
      label: `CR ${q.crMin ?? '0'}–${q.crMax ?? '∞'}`,
      clear: () => {
        const { crMin, crMax, ...rest } = q
        void crMin
        void crMax
        props.changed({ ...rest, offset: 0 })
      }
    })
  const groups = [
    ['sizes', q.sizes],
    ['types', q.types],
    ['subtypes', q.subtypes],
    ['biomes', q.biomes],
    ['alignments', q.alignments],
    ['encounterTableIds', q.encounterTableIds],
    ['factionIds', q.factionIds]
  ] as const
  for (const [field, values] of groups)
    for (const value of values)
      chips.push({
        label: value,
        clear: () =>
          props.changed({
            ...q,
            [field]: values.filter((entry) => entry !== value),
            offset: 0
          })
      })
  if (q.locationId)
    chips.push({
      label: `Ort: ${q.locationId}`,
      clear: () => props.changed({ ...q, locationId: null, offset: 0 })
    })
  return (
    <>
      {chips.map((chip, index) => (
        <button
          key={`${chip.label}-${index}`}
          className="filter-chip"
          onClick={chip.clear}
        >
          {chip.label} ×
        </button>
      ))}
    </>
  )
}

function SortHeader(props: {
  label: string
  field: 'name' | 'cr' | 'xp'
  query: CreatureCatalogQuery
  changed: (query: CreatureCatalogQuery) => void
}) {
  const active = props.query.sort === props.field
  return (
    <th>
      <button
        className="sort-header"
        onClick={() =>
          props.changed({
            ...props.query,
            sort: props.field,
            direction:
              active && props.query.direction === 'asc' ? 'desc' : 'asc',
            offset: 0
          })
        }
      >
        {props.label}{' '}
        {active ? (props.query.direction === 'asc' ? '▲' : '▼') : ''}
      </button>
    </th>
  )
}

function SessionEncounterPanel(
  props: ScenarioProps & { inspect: (creature: Creature) => void }
) {
  const [selected, setSelected] = useState<string[]>([])
  const [evaluation, setEvaluation] =
    useState<EncounterSelectionEvaluation | null>(null)
  const onError = props.onError
  const focused = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.snapshot.scene.focusedSceneId
  )!
  const assignedParty = props.snapshot.party.members.filter(
    (member) => member.active && focused.partyMemberIds.includes(member.id)
  )
  useEffect(() => {
    let current = true
    void window.saltMarcher.encounter
      .evaluate(focused.id, selected, props.snapshot.scene.revision)
      .then((value) => {
        if (current) setEvaluation(value)
      })
      .catch((cause) => {
        if (current) onError(errorText(cause))
      })
    return () => {
      current = false
    }
  }, [focused.id, props.snapshot.scene.revision, selected, onError])
  if (props.snapshot.combat) return <CombatScenario {...props} />
  async function direct() {
    await scenarioAction(props, () =>
      window.saltMarcher.combat.prepare(
        focused.id,
        selected,
        props.snapshot.scene.revision
      )
    )
  }
  return (
    <div className="scenario-scroll">
      <section className="scenario-content combat-setup">
        <p className="section-kicker">Encounter</p>
        <h2>Gruppen aus {focused.title}</h2>
        <label className="scenario-choice locked">
          <input type="checkbox" checked readOnly /> Scene-Party (
          {assignedParty.length})
        </label>
        {focused.groups.map((group) => (
          <label className="scenario-choice" key={group.id}>
            <input
              type="checkbox"
              checked={selected.includes(group.id)}
              onChange={(event) =>
                setSelected(
                  event.target.checked
                    ? [...selected, group.id]
                    : selected.filter((id) => id !== group.id)
                )
              }
            />
            {group.name}
          </label>
        ))}
        {focused.groups.length === 0 && (
          <p className="empty-state">
            Lege zuerst eine Gruppe in dieser Scene an.
          </p>
        )}
        {evaluation && <DifficultySummary evaluation={evaluation} />}
        <footer>
          <button onClick={props.close}>Schließen</button>
          <button
            disabled={!evaluation?.canStart}
            onClick={() => void direct()}
          >
            Initiative vorbereiten
          </button>
        </footer>
      </section>
    </div>
  )
}

function DifficultySummary(props: {
  evaluation: Pick<
    EncounterSelectionEvaluation,
    | 'difficultyLabel'
    | 'adjustedXp'
    | 'baseXp'
    | 'partyThresholds'
    | 'creatureCount'
    | 'message'
  >
  meter?: boolean
}) {
  const evaluation = props.evaluation
  const meterMaximum = Math.max(1, evaluation.partyThresholds[3] * 1.5)
  const meterPosition = Math.min(
    100,
    Math.round((evaluation.adjustedXp / meterMaximum) * 100)
  )
  return (
    <div className="difficulty-summary" aria-live="polite">
      <strong>{evaluation.difficultyLabel}</strong>
      <span>
        {evaluation.adjustedXp.toLocaleString()} adjusted XP ·{' '}
        {evaluation.baseXp.toLocaleString()} base XP ·{' '}
        {evaluation.creatureCount} Monster
      </span>
      <small>
        Easy {evaluation.partyThresholds[0]} · Medium{' '}
        {evaluation.partyThresholds[1]} · Hard {evaluation.partyThresholds[2]} ·
        Deadly {evaluation.partyThresholds[3]}
      </small>
      {props.meter && (
        <div className="difficulty-meter" aria-hidden="true">
          <span style={{ width: `${meterPosition}%` }} />
        </div>
      )}
      <small>{evaluation.message}</small>
    </div>
  )
}

function TuningControls(props: {
  tuning: EncounterTuning
  changed: (tuning: EncounterTuning) => void
}) {
  const select = <K extends keyof EncounterTuning>(
    field: K,
    values: readonly EncounterTuning[K][]
  ) => (
    <select
      aria-label={field}
      value={props.tuning[field]}
      onChange={(event) =>
        props.changed({
          ...props.tuning,
          [field]: event.target.value as EncounterTuning[K]
        })
      }
    >
      {values.map((value) => (
        <option key={value} value={value}>
          {tuningLabel(value)}
        </option>
      ))}
    </select>
  )
  return (
    <div className="tuning-controls">
      <label>
        Schwierigkeit
        {select('difficulty', ['auto', 'easy', 'medium', 'hard', 'deadly'])}
      </label>
      <label>
        Menge
        {select('amount', ['auto', 'few', 'standard', 'many'])}
      </label>
      <label>
        Balance
        {select('balance', ['auto', 'even', 'varied'])}
      </label>
      <label>
        Vielfalt
        {select('diversity', ['auto', 'low', 'high'])}
      </label>
    </div>
  )
}

function tuningLabel(value: string): string {
  return (
    {
      auto: 'Auto',
      easy: 'Leicht',
      medium: 'Mittel',
      hard: 'Schwer',
      deadly: 'Tödlich',
      few: 'Wenige',
      standard: 'Standard',
      many: 'Viele',
      even: 'Ausgeglichen',
      varied: 'Variiert',
      low: 'Niedrig',
      high: 'Hoch'
    }[value] ?? value
  )
}

function CombatScenario(props: ScenarioProps) {
  if (!props.snapshot.combat)
    return <p className="scenario-empty">Kein aktiver Encounter.</p>
  if (props.snapshot.combat.phase === 'initiative')
    return <InitiativePanel {...props} combat={props.snapshot.combat} />
  if (props.snapshot.combat.phase === 'combat')
    return <CombatPanel {...props} combat={props.snapshot.combat} />
  return <ResolutionPanel {...props} combat={props.snapshot.combat} />
}

function InitiativePanel(props: ScenarioProps & { combat: CombatSnapshot }) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      props.combat.initiativeRows.map((row) => [row.id, row.initiative])
    )
  )
  return (
    <section className="scenario-content">
      <h2>Initiative</h2>
      <ul className="initiative-list">
        {props.combat.initiativeRows.map((row) => (
          <li key={row.id}>
            <span>{row.label}</span>
            <input
              aria-label={`Initiative ${row.label}`}
              type="number"
              min="-10"
              max="40"
              value={values[row.id] ?? row.initiative}
              onChange={(event) =>
                setValues({ ...values, [row.id]: Number(event.target.value) })
              }
            />
          </li>
        ))}
      </ul>
      <footer>
        <button
          onClick={() =>
            void scenarioAction(props, () =>
              window.saltMarcher.combat.rollInitiative(props.combat.revision)
            )
          }
        >
          Alle würfeln
        </button>
        <button
          onClick={() =>
            void scenarioAction(props, () =>
              window.saltMarcher.combat.confirmInitiative(
                props.combat.initiativeRows.map((row) => ({
                  id: row.id,
                  initiative: values[row.id] ?? row.initiative
                })),
                props.combat.revision
              )
            )
          }
        >
          Kampf starten
        </button>
      </footer>
    </section>
  )
}

function CombatPanel(props: ScenarioProps & { combat: CombatSnapshot }) {
  const [confirmEnd, setConfirmEnd] = useState(false)
  return (
    <section className="scenario-content">
      <h2>Runde {props.combat.round}</h2>
      <ul className="combat-cards">
        {props.combat.cards.map((card) => (
          <CombatCardView
            key={card.id}
            card={card}
            combat={props.combat}
            action={(operation) => scenarioAction(props, operation)}
          />
        ))}
      </ul>
      <button
        className="primary-action"
        onClick={() =>
          void scenarioAction(props, () =>
            window.saltMarcher.combat.advanceTurn(props.combat.revision)
          )
        }
      >
        ▶ Weiter
      </button>
      {!confirmEnd ? (
        <button
          className={props.combat.allEnemiesDefeated ? 'accent' : ''}
          onClick={() => setConfirmEnd(true)}
        >
          Kampf beenden
        </button>
      ) : (
        <div className="confirm-row">
          <button onClick={() => setConfirmEnd(false)}>Abbruch</button>
          <button
            onClick={() =>
              void scenarioAction(props, () =>
                window.saltMarcher.combat.end(props.combat.revision)
              )
            }
          >
            Bestätigen
          </button>
        </div>
      )}
    </section>
  )
}

function CombatCardView(props: {
  card: CombatSnapshot['cards'][number]
  combat: CombatSnapshot
  action: (operation: () => Promise<LiveSessionSnapshot>) => Promise<void>
}) {
  const [amount, setAmount] = useState(1)
  const [initiative, setInitiative] = useState(props.card.initiative)
  const card = props.card
  return (
    <li
      className={`combat-card${card.active ? ' active' : ''}${!card.alive ? ' dead' : ''}`}
    >
      <header>
        <strong>
          {card.active ? '▶ ' : ''}
          {card.alive ? card.name : `† ${card.name}`}
          {card.count > 1 ? ` × ${card.count}` : ''}
        </strong>
      </header>
      {!card.playerCharacter && (
        <>
          <span>
            HP {card.currentHp}/{card.maxHp} · AC {card.armorClass}
          </span>
          <progress max={card.maxHp} value={card.currentHp} />
          <div className="card-controls">
            <input
              aria-label={`HP Änderung ${card.name}`}
              type="number"
              min="1"
              value={amount}
              onChange={(event) =>
                setAmount(Math.max(1, Number(event.target.value)))
              }
            />
            <button
              disabled={!card.alive}
              onClick={() =>
                void props.action(() =>
                  window.saltMarcher.combat.changeHp(
                    card.id,
                    amount,
                    false,
                    props.combat.revision
                  )
                )
              }
            >
              − HP
            </button>
            <button
              disabled={!card.alive}
              onClick={() =>
                void props.action(() =>
                  window.saltMarcher.combat.changeHp(
                    card.id,
                    amount,
                    true,
                    props.combat.revision
                  )
                )
              }
            >
              + HP
            </button>
          </div>
        </>
      )}
      <div className="card-controls">
        <input
          aria-label={`Initiative ändern ${card.name}`}
          type="number"
          min="-10"
          max="40"
          value={initiative}
          onChange={(event) => setInitiative(Number(event.target.value))}
        />
        <button
          onClick={() =>
            void props.action(() =>
              window.saltMarcher.combat.adjustInitiative(
                card.id,
                initiative,
                props.combat.revision
              )
            )
          }
        >
          Init
        </button>
      </div>
      <small>{card.detail}</small>
    </li>
  )
}

function ResolutionPanel(props: ScenarioProps & { combat: CombatSnapshot }) {
  const resolution = props.combat.resolution
  const [selected, setSelected] = useState(() =>
    (resolution?.enemies ?? [])
      .filter((enemy) => enemy.selected)
      .map((enemy) => enemy.id)
  )
  const [threshold, setThreshold] = useState(resolution?.thresholdFraction ?? 1)
  const [fraction, setFraction] = useState(resolution?.xpFraction ?? 1)
  if (!resolution) return null
  const saveResolution = () =>
    window.saltMarcher.combat.updateResolution(
      selected,
      threshold,
      fraction,
      props.combat.revision
    )
  async function award() {
    try {
      const updated = await saveResolution()
      if (!updated.combat) throw new Error('Combat nicht verfügbar')
      props.setSnapshot(
        await window.saltMarcher.combat.awardXp(updated.combat.revision)
      )
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }
  async function complete() {
    try {
      const updated = await saveResolution()
      if (!updated.combat) throw new Error('Combat nicht verfügbar')
      props.setSnapshot(
        await window.saltMarcher.combat.complete(updated.combat.revision)
      )
      props.close()
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }
  const eligible = resolution.enemies
    .filter((enemy) => selected.includes(enemy.id))
    .reduce((total, enemy) => total + enemy.xp, 0)
  const awarded = Math.floor(eligible * fraction)
  const perPlayer = Math.floor(awarded / Math.max(1, resolution.partySize))
  return (
    <section className="scenario-content resolution-panel">
      <h2>Kampfergebnis</h2>
      <p>
        {selected.length} Gegner besiegt · {eligible} XP
      </p>
      <p>
        <strong>{perPlayer} XP pro Spieler</strong> ({awarded} gesamt)
      </p>
      <label>
        Besiegungsschwelle <span>{Math.round(threshold * 100)}%</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={threshold}
          onChange={(event) => setThreshold(Number(event.target.value))}
        />
      </label>
      <label>
        XP-Anteil <span>{Math.round(fraction * 100)}%</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={fraction}
          onChange={(event) => setFraction(Number(event.target.value))}
        />
      </label>
      <ul className="result-enemies">
        {resolution.enemies.map((enemy) => (
          <li key={enemy.id}>
            <label>
              <input
                type="checkbox"
                checked={selected.includes(enemy.id)}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? [...selected, enemy.id]
                      : selected.filter((id) => id !== enemy.id)
                  )
                }
              />
              {enemy.name} ({enemy.alive ? 'Lebt' : 'Tot'}) · {enemy.xp} XP
            </label>
          </li>
        ))}
      </ul>
      <p className="loot-summary">{resolution.lootSummary}</p>
      <footer>
        <button
          disabled={resolution.xpAwarded || perPlayer <= 0}
          onClick={() => void award()}
        >
          {resolution.xpAwarded ? 'XP verteilt' : 'XP verteilen'}
        </button>
        <button onClick={() => void complete()}>Zum Planer</button>
      </footer>
    </section>
  )
}

function CreatureInspector(props: {
  creature: Creature
  close?: () => void
  embedded?: boolean
}) {
  const c = props.creature
  const ability = (label: string, value: number) => (
    <div>
      <strong>{label}</strong>
      <span>
        {value} ({Math.floor((value - 10) / 2) >= 0 ? '+' : ''}
        {Math.floor((value - 10) / 2)})
      </span>
    </div>
  )
  return (
    <aside
      className={`creature-inspector${props.embedded ? ' embedded' : ''}`}
      aria-label="Monster Details"
    >
      <header>
        <div>
          <p className="section-kicker">Statblock</p>
          <IlluminatedHeading title={c.name} />
        </div>
        {props.close && (
          <button aria-label="Monster Details schließen" onClick={props.close}>
            ×
          </button>
        )}
      </header>
      <p className="stat-meta">
        {c.size} {c.type}
        {c.subtype ? ` (${c.subtype})` : ''}, {c.alignment}
      </p>
      <hr />
      <p>
        <strong>Rüstungsklasse</strong> {c.ac}
      </p>
      <p>
        <strong>Trefferpunkte</strong> {c.hp} ({c.hitDice})
      </p>
      <p>
        <strong>Bewegung</strong> {c.speed}
      </p>
      <div className="ability-grid">
        {ability('STR', c.abilities.str)}
        {ability('DEX', c.abilities.dex)}
        {ability('CON', c.abilities.con)}
        {ability('INT', c.abilities.int)}
        {ability('WIS', c.abilities.wis)}
        {ability('CHA', c.abilities.cha)}
      </div>
      <p>
        <strong>Rettungswürfe</strong> {c.savingThrows || '—'}
      </p>
      <p>
        <strong>Fertigkeiten</strong> {c.skills || '—'}
      </p>
      <p>
        <strong>Sinne</strong> {c.senses || '—'}
      </p>
      <p>
        <strong>Sprachen</strong> {c.languages || '—'}
      </p>
      <p>
        <strong>Herausforderung</strong> {c.challengeRating} (
        {c.xp.toLocaleString()} XP)
      </p>
      {c.traits.length > 0 && (
        <>
          <h3>Merkmale</h3>
          {c.traits.map((trait) => (
            <p key={trait.name}>
              <strong>{trait.name}.</strong> {trait.description}
            </p>
          ))}
        </>
      )}
      <h3>Aktionen</h3>
      {c.actions.map((action) => (
        <p key={action.name}>
          <strong>{action.name}.</strong> {action.description}
        </p>
      ))}
      {c.legendaryActions.length > 0 && (
        <>
          <h3>Legendäre Aktionen</h3>
          {c.legendaryActions.map((action) => (
            <p key={action.name}>
              <strong>{action.name}.</strong> {action.description}
            </p>
          ))}
        </>
      )}
    </aside>
  )
}

function useCreatureSearch(
  query: CreatureCatalogQuery,
  setPage: (page: CreatureCatalogPage) => void,
  onError: (message: string) => void
) {
  const request = useRef(0)
  useEffect(() => {
    const token = ++request.current
    const timer = window.setTimeout(() => {
      void window.saltMarcher.creatures
        .search(query)
        .then((page) => {
          if (request.current === token) setPage(page)
        })
        .catch((cause) => {
          if (request.current === token) onError(errorText(cause))
        })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [query, setPage, onError])
}

function crNumber(value: string): number {
  const [left, right] = value.split('/')
  return right ? Number(left) / Number(right) : Number(value)
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

type ScenarioProps = {
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  close: () => void
  onError: (message: string) => void
}

async function scenarioAction(
  props: Pick<ScenarioProps, 'snapshot' | 'setSnapshot' | 'onError'>,
  operation: () => Promise<LiveSessionSnapshot>
) {
  try {
    props.setSnapshot(await operation())
  } catch (cause) {
    props.onError(errorText(cause))
  }
}
function errorText(cause: unknown): string {
  if (capabilityErrorCode(cause) === 'outcome_unknown')
    window.dispatchEvent(new Event('saltmarcher:readback'))
  return capabilityErrorMessage(cause)
}
function showError(setError: (message: string) => void) {
  return (cause: unknown) => setError(errorText(cause))
}
