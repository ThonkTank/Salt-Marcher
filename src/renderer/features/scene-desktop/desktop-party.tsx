import { desktopXpDraftId } from './desktop-xp-draft-id.js'
import { useMaintenanceEditingBlocked } from '../../shell/maintenance-drafts.js'
import { DesktopRosterActions } from './desktop-roster-actions.js'
import { message } from '../../i18n/session-runtime.de.js'
import { useState } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { PartyQuickField } from '../../../shared/contracts/party-quick-fields.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
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
  const maintenanceBlocked = useMaintenanceEditingBlocked()
  const commands = useAsyncCommandCoordinator()
  const { snapshot: settings, projection } =
    useInstallationSettingsProjection(true)
  const fields = settings.value?.preferences.partyQuickFields ?? [
    'armorClass',
    'passivePerception'
  ]
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const scene = props.snapshot.scene.scenes.find((s) => s.id === props.sceneId)!
  const members = props.snapshot.party.members.filter(
    (m) => m.active && scene.partyMemberIds.includes(m.id)
  )
  async function saveFields(next: PartyQuickField[]) {
    if (maintenanceBlocked) return
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
  return (
    <div
      role="group"
      className="desktop-party"
      aria-label={message('partyWindow.title')}
    >
      <div className="desktop-party-tools">
        <button
          disabled={!settings.value || maintenanceBlocked}
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
              <DesktopRosterActions
                campaignId={props.campaignId}
                sceneId={props.sceneId}
                snapshot={props.snapshot}
                windowId="party"
                characterDraftIds={[
                  desktopXpDraftId(props.campaignId, props.sceneId, member.id)
                ]}
                singleCharacter={{ id: member.id, name: member.name }}
              />
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
