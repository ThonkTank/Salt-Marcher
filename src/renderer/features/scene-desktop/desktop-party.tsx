import { message } from '../../i18n/session-runtime.de.js'
import { useContext, useState } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { PartyQuickField } from '../../../shared/contracts/party-quick-fields.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { CapabilityContext } from '../../capabilities/capability-context.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { useAsyncCommandCoordinator } from '../../async/use-async-command-coordinator.js'
import { useInstallationSettingsProjection } from '../../shell/use-installation-settings-projection.js'
import { AnchoredPopup } from '../../shell/anchored-popup.js'
import {
  partyFieldGroups,
  partyFieldLabels,
  partyFieldValues
} from './party-fields.js'

export function DesktopParty(props: {
  campaignId: string
  sceneId: string
  snapshot: LiveSessionSnapshot
  expanded: readonly string[]
  toggle: (id: string) => void
}) {
  const api = useCapabilityApi()
  const workspace = useContext(CapabilityContext)!.campaignWorkspace
  const commands = useAsyncCommandCoordinator()
  const { snapshot: settings, projection } =
    useInstallationSettingsProjection(true)
  const fields = settings.value?.preferences.partyQuickFields ?? [
    'armorClass',
    'passivePerception'
  ]
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [move, setMove] = useState<{ anchor: HTMLElement; id: string } | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const scene = props.snapshot.scene.scenes.find((s) => s.id === props.sceneId)!
  const members = props.snapshot.party.members.filter(
    (m) => m.active && scene.partyMemberIds.includes(m.id)
  )
  async function saveFields(next: PartyQuickField[]) {
    setBusy(true)
    setError(null)
    const outcome = await commands.run({
      scope: 'installation.preferences',
      mode: 'queue',
      execute: async () => {
        const current = await projection.refresh()
        return api.settings.update({
          patch: { partyQuickFields: next },
          expectedRevision: current.revision
        })
      },
      accept: (value) => projection.publish(value)
    })
    if (outcome.status === 'failure') {
      setError(capabilityErrorText(outcome.cause))
      await projection.refresh().catch(() => undefined)
    }
    setBusy(false)
  }
  async function moveTo(sceneId: string) {
    if (!move || busy) return
    setBusy(true)
    setError(null)
    const outcome = await commands.run({
      scope: 'desktop-roster',
      entityKey: `${props.campaignId}:${props.sceneId}`,
      mode: 'latest-only',
      execute: async () => {
        await api.scene.moveRoster({
          sceneId: props.sceneId,
          memberIds: [move.id],
          expectedRevision: props.snapshot.scene.revision,
          expectedPartyRevision: props.snapshot.party.revision,
          target: { kind: 'existing', sceneId }
        })
        return workspace.refreshActiveSession()
      },
      accept: (result) => {
        if (result.status === 'failure')
          setError(capabilityErrorText(result.cause))
        else setMove(null)
      }
    })
    if (outcome.status === 'failure') {
      setError(capabilityErrorText(outcome.cause))
      await workspace.refreshActiveSession()
    }
    setBusy(false)
  }
  return (
    <div
      role="group"
      className="desktop-party"
      aria-label={message('partyWindow.title')}
    >
      <div className="desktop-party-tools">
        <button
          disabled={!settings.value}
          onClick={(e) => {
            setError(null)
            setAnchor(e.currentTarget)
          }}
        >
          {message('partyWindow.quick')}
        </button>
      </div>
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
              <div className="desktop-party-quick">
                {!open &&
                  partyFieldValues(
                    member,
                    partyFieldGroups.flatMap((g) =>
                      g.fields.filter((f) => fields.includes(f))
                    )
                  ).map((value, i) => <span key={i}>{value}</span>)}
              </div>
              <button
                disabled={busy || props.snapshot.scene.scenes.length < 2}
                aria-label={`${member.name} verschieben`}
                onClick={(e) => {
                  setError(null)
                  setMove({ anchor: e.currentTarget, id: member.id })
                }}
              >
                {message('partyWindow.move')}
              </button>
            </div>
            <div
              id={`party-${member.id}`}
              hidden={!open}
              className="desktop-party-details"
            >
              {partyFieldGroups.map((group) => (
                <div className="desktop-party-category" key={group.label}>
                  <span>{group.label}</span>
                  <div>
                    {partyFieldValues(member, group.fields).map((value, i) => (
                      <span key={i}>{value}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {settings.status === 'failure' && (
        <p role="alert">{capabilityErrorText(settings.cause)}</p>
      )}
      {!members.length && (
        <p className="desktop-empty">{message('partyWindow.empty')}</p>
      )}
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
                  disabled={busy}
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
      <AnchoredPopup
        open={!!move}
        anchor={move?.anchor ?? null}
        onDismiss={() => setMove(null)}
        className="desktop-party-popup"
      >
        <h3>{message('partyWindow.target')}</h3>
        {props.snapshot.scene.scenes
          .filter((s) => s.id !== props.sceneId)
          .map((s) => (
            <button
              key={s.id}
              disabled={busy}
              onClick={() => void moveTo(s.id)}
            >
              {s.title}
            </button>
          ))}
        {error && <p role="alert">{error}</p>}
      </AnchoredPopup>
    </div>
  )
}
