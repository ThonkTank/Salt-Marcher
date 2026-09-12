import { desktopXpDraftId } from './desktop-xp-draft-id.js'
import { useMaintenanceEditingBlocked } from '../../shell/maintenance-drafts.js'
import { DesktopRosterActions } from './desktop-roster-actions.js'
import { message } from '../../i18n/session-runtime.de.js'
import {
  lazy,
  Suspense,
  useLayoutEffect,
  useEffect,
  useState,
  useSyncExternalStore
} from 'react'
import { PartyActionController } from './party-action-controller.js'
import { usePartyActionPort } from './use-party-action-port.js'
import type { PartyHistory } from '../../../shared/contracts/party-actions.js'
import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import {
  draftConcern,
  maintenanceDraftCoordinator
} from '../../shell/maintenance-draft-coordinator.js'
import { useDraftTransition } from '../../shell/use-draft-transition.js'
import type { PartyCharacter } from '../../../shared/contracts/party.js'
import { DesktopXpAction } from './desktop-xp-action.js'
import { DesktopTitleActions } from './desktop-title-actions.js'
import { PartyRestMeter } from './party-meter.js'
import { partyRestProgress, restProgress } from './party-progress.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { PartyQuickField } from '../../../shared/contracts/party-quick-fields.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { useInstallationSettingsProjection } from '../../shell/use-installation-settings-projection.js'
import { AnchoredPopup } from '../../shell/anchored-popup.js'
import {
  partyFieldGroups,
  partyFieldLabels,
  partyFieldValues
} from './party-fields.js'

const Ledger = lazy(async () => ({
  default: (await import('../loot/character-loot-ledger-dialog.js'))
    .CharacterLootLedgerDialog
}))

export function DesktopParty(props: {
  openCharacter?: ((id: string) => void) | undefined
  onError?: (message: string) => void
  campaignId: string
  sceneId: string
  snapshot: LiveSessionSnapshot
  expanded: readonly string[]
  toggle: (id: string) => void
}) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLButtonElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [ledger, setLedger] = useState<PartyCharacter | null>(null)
  const api = useCapabilityApi()
  const maintenanceBlocked = useMaintenanceEditingBlocked()
  const port = usePartyActionPort(props.campaignId)
  const [controller] = useState(() => new PartyActionController(port))
  const command = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot
  )
  const [history, setHistory] = useState<PartyHistory | null>(null)
  const [historyRefresh, refreshHistory] = useState(0)
  useLayoutEffect(() => {
    controller.attach((receipt) => setHistory(receipt.history))
  })
  useLayoutEffect(() => controller.detach, [controller])
  const historyBlocked = useMaintenanceDraft({
    label: 'Party-Verlauf',
    concerns: [draftConcern.window('party')],
    isDirty: controller.unresolved,
    settleBackgroundWrites: async () => {
      await controller.settle()
    },
    save: controller.settle,
    discard: async () => (await controller.settle()) && controller.reset()
  })
  const transition = useDraftTransition(
    `${props.campaignId}:party-history`,
    {
      title: 'Offene Änderungen abschließen',
      text: 'Vor der Rücknahme müssen offene Änderungen abgeschlossen sein.'
    },
    { kind: 'concerns', concerns: [draftConcern.scene(props.sceneId)] }
  )
  useEffect(() => {
    let active = true
    void api.party
      .history({ campaignId: props.campaignId })
      .then((value) => {
        if (active) setHistory(value)
      })
      .catch(() => {
        if (active) setHistory(null)
      })
    return () => {
      active = false
    }
  }, [
    api,
    props.campaignId,
    props.snapshot,
    command.busy,
    ledger,
    historyRefresh
  ])
  const busy = command.busy || command.uncertain || historyBlocked
  function undoRedo(direction: 'undo' | 'redo') {
    const step = history?.[direction]
    if (
      !step ||
      step.blockedReason ||
      busy ||
      maintenanceDraftCoordinator.isLocked()
    )
      return
    transition.request(() => {
      void controller.execute({
        campaignId: props.campaignId,
        commandId: crypto.randomUUID(),
        direction,
        stepId: step.id
      })
    })
  }
  const { snapshot: settings, projection } =
    useInstallationSettingsProjection(true)
  const fields = settings.value?.preferences.partyQuickFields ?? [
    'armorClass',
    'passivePerception'
  ]
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scene = props.snapshot.scene.scenes.find((s) => s.id === props.sceneId)!
  const members = props.snapshot.party.members.filter(
    (m) => m.active && scene.partyMemberIds.includes(m.id)
  )
  async function saveFields(next: PartyQuickField[]) {
    if (maintenanceBlocked) return
    const current = await projection.refresh()
    await controller.execute({
      campaignId: props.campaignId,
      commandId: crypto.randomUUID(),
      fields: next,
      expectedRevision: current.revision
    })
  }

  return (
    <div
      role="group"
      className="desktop-party"
      aria-label={message('partyWindow.title')}
    >
      <DesktopTitleActions>
        <PartyRestMeter
          value={partyRestProgress(members)}
          partial={members.some(
            (member) =>
              !member.burden?.sectionsTrusted ||
              !member.burden.longTrusted ||
              member.burden.dailyBudget === null
          )}
        />
        {(['undo', 'redo'] as const).map((direction) => (
          <button
            key={direction}
            title={
              history?.[direction]?.blockedReason ??
              history?.[direction]?.description ??
              (direction === 'undo' ? 'Rückgängig' : 'Wiederherstellen')
            }
            aria-label={
              history?.[direction]
                ? `${direction === 'undo' ? 'Rückgängig' : 'Wiederherstellen'}: ${history[direction].description}`
                : direction === 'undo'
                  ? 'Party-Aktion rückgängig machen'
                  : 'Party-Aktion wiederherstellen'
            }
            disabled={
              busy ||
              maintenanceBlocked ||
              !history?.[direction] ||
              !!history[direction]?.blockedReason
            }
            onClick={() => undoRedo(direction)}
          >
            {direction === 'undo' ? '↶' : '↷'}
          </button>
        ))}
        <button
          ref={setMenuAnchor}
          aria-label={message('party.actions')}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          ▾
        </button>
        <AnchoredPopup
          open={menuOpen}
          anchor={menuAnchor}
          onDismiss={() => setMenuOpen(false)}
          keepMounted
          className="party-action-menu"
        >
          <div>
            <DesktopRosterActions
              campaignId={props.campaignId}
              sceneId={props.sceneId}
              snapshot={props.snapshot}
              windowId="party"
              characterDraftIds={members.map((member) =>
                desktopXpDraftId(props.campaignId, props.sceneId, member.id)
              )}
            />
            <button
              disabled={!settings.value || maintenanceBlocked}
              onClick={(event) => {
                setError(null)
                setAnchor(event.currentTarget)
              }}
            >
              {message('partyWindow.quick')}
            </button>
          </div>
        </AnchoredPopup>
      </DesktopTitleActions>
      {members.map((member) => {
        const open = props.expanded.includes(member.id)
        return (
          <div className="desktop-party-entry" key={member.id}>
            <div className="desktop-party-row">
              <button
                className="desktop-party-toggle"
                aria-expanded={open}
                aria-controls={`party-${member.id}`}
                onClick={() => props.toggle(member.id)}
              >
                {open ? '▾' : '▸'} {member.name}
              </button>
              <DesktopXpAction
                campaignId={props.campaignId}
                sceneId={props.sceneId}
                windowId="party"
                maintenanceId={desktopXpDraftId(
                  props.campaignId,
                  props.sceneId,
                  member.id
                )}
                member={member}
                revision={props.snapshot.party.revision}
              />
              <PartyRestMeter value={restProgress(member)} />
            </div>
            <div
              id={`party-${member.id}`}
              className={open ? 'desktop-party-details' : 'desktop-party-quick'}
            >
              {partyFieldValues(
                member,
                partyFieldGroups.flatMap((group) =>
                  group.fields.filter((field) => open || fields.includes(field))
                )
              ).map((value, i) => (
                <span key={i}>{value}</span>
              ))}
              {open && (
                <>
                  <button onClick={() => setLedger(member)}>
                    {message('character.loot')}
                  </button>
                  {props.openCharacter && (
                    <button onClick={() => props.openCharacter?.(member.id)}>
                      {message('character.catalog')}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })}
      {command.error && (
        <p role="alert">
          {command.error}
          <button
            disabled={command.busy}
            onClick={() => {
              if (command.uncertain) void controller.settle()
              else if (controller.reset()) refreshHistory((value) => value + 1)
            }}
          >
            {message(
              command.uncertain ? 'party.resultCheck' : 'party.historyRefresh'
            )}
          </button>
        </p>
      )}
      {transition.dialog}
      {settings.status === 'failure' && (
        <p role="alert">{capabilityErrorText(settings.cause)}</p>
      )}
      {!members.length && (
        <p className="desktop-empty">{message('partyWindow.empty')}</p>
      )}
      <Suspense fallback={null}>
        {ledger && (
          <Ledger
            character={ledger}
            close={() => setLedger(null)}
            onError={props.onError ?? setError}
          />
        )}
      </Suspense>
      <AnchoredPopup
        open={!!anchor}
        anchor={anchor}
        onDismiss={() => setAnchor(null)}
        className="desktop-party-popup"
      >
        <div className="desktop-section-heading">
          <h3>{message('partyWindow.collapsed')}</h3>
          <button onClick={() => setAnchor(null)}>
            {message('partyWindow.done')}
          </button>
        </div>
        {partyFieldGroups.map((group) => (
          <fieldset key={group.label}>
            <legend>{group.label}</legend>
            {group.fields.map((field) => (
              <label key={field}>
                <input
                  type="checkbox"
                  disabled={busy || maintenanceBlocked}
                  checked={fields.includes(field)}
                  onChange={(e) =>
                    void saveFields(
                      e.target.checked
                        ? [...fields, field]
                        : fields.filter((f) => f !== field)
                    )
                  }
                />
                {partyFieldLabels[field]}
              </label>
            ))}
          </fieldset>
        ))}
        {error && <p role="alert">{error}</p>}
      </AnchoredPopup>
    </div>
  )
}
