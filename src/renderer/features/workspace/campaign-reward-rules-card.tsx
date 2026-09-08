import { useEffect, useRef, useState } from 'react'
import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
import type {
  CampaignRules,
  RewardXpBasis
} from '../../../shared/contracts/campaign-rules.js'
import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'
import { message } from '../../i18n/generator-runtime.de.js'
import type { CampaignRewardRulesPort } from './campaign-reward-rules-port.js'

export function CampaignRewardRulesCard(props: {
  maintenanceId?: string
  campaignRules: CampaignRewardRulesPort
  activeCampaignId: string | null
  onError: (message: string) => void
}) {
  const { activeCampaignId, campaignRules, onError } = props
  const [rules, setRules] = useState<CampaignRules | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const pending = useRef<Promise<boolean> | null>(null)
  const uncertainCommand = useRef<string | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const blocked = useMaintenanceDraft(
    {
      label: 'Kampagnen-Belohnungsregel',
      isDirty: () =>
        pending.current !== null || uncertainCommand.current !== null,
      save: settle,
      discard: settle
    },
    props.maintenanceId
  )
  function run(operation: () => Promise<boolean>): Promise<boolean> {
    if (pending.current) return pending.current
    setBusy(true)
    const result = Promise.resolve()
      .then(operation)
      .catch((cause: unknown) => {
        onError(errorText(cause))
        return false
      })
      .finally(() => {
        pending.current = null
        setBusy(false)
      })
    pending.current = result
    return result
  }
  async function reconcile(): Promise<boolean> {
    const commandId = uncertainCommand.current
    if (!commandId) return true
    const receipt = await campaignRules.commandReceipt({ commandId })
    if (!receipt) {
      setStatus(message('g.reward.status.unknown'))
      return false
    }
    setRules(receipt)
    uncertainCommand.current = null
    setUncertain(false)
    setStatus(message('g.reward.status.saved'))
    return true
  }
  function settle(): Promise<boolean> {
    if (pending.current) return pending.current
    return uncertainCommand.current ? run(reconcile) : Promise.resolve(true)
  }

  useEffect(() => {
    let live = true
    if (!activeCampaignId) return () => undefined
    void campaignRules
      .read()
      .then((next) => live && setRules(next))
      .catch((cause: unknown) => {
        if (live) onError(errorText(cause))
      })
    return () => {
      live = false
    }
  }, [activeCampaignId, campaignRules, onError])

  function update(rewardXpBasis: RewardXpBasis) {
    if (
      maintenanceDraftCoordinator.isLocked() ||
      pending.current ||
      uncertainCommand.current ||
      !rules ||
      rewardXpBasis === rules.rewardXpBasis
    )
      return
    setStatus('')
    const commandId = crypto.randomUUID()
    void run(async () => {
      try {
        setRules(
          await campaignRules.update({
            commandId,
            expectedRevision: rules.revision,
            rewardXpBasis
          })
        )
        setStatus(message('g.reward.status.saved'))
        return true
      } catch (cause) {
        if (capabilityErrorCode(cause) === 'outcome_unknown') {
          uncertainCommand.current = commandId
          setUncertain(true)
          setStatus(message('g.reward.status.unknown'))
          return reconcile()
        }
        if (capabilityErrorCode(cause) === 'stale') {
          setRules(await campaignRules.read())
          setStatus(message('g.reward.status.stale'))
          return false
        }
        throw cause
      }
    })
  }

  return (
    <section
      className="campaign-reward-rules-card"
      aria-labelledby="campaign-reward-rules-title"
      aria-busy={busy || !rules}
    >
      <div>
        <h3 id="campaign-reward-rules-title">{message('g.reward.title')}</h3>
        <p>{message('g.reward.description')}</p>
      </div>
      <fieldset disabled={busy || blocked || uncertain || !rules}>
        <legend>{message('g.reward.basis')}</legend>
        <label>
          <input
            type="radio"
            name="reward-xp-basis"
            checked={rules?.rewardXpBasis === 'base'}
            onChange={() => void update('base')}
          />
          <span>
            <strong>{message('g.reward.base')}</strong>
            <small>{message('g.reward.baseHint')}</small>
          </span>
        </label>
        <label>
          <input
            type="radio"
            name="reward-xp-basis"
            checked={rules?.rewardXpBasis === 'adjusted'}
            onChange={() => void update('adjusted')}
          />
          <span>
            <strong>{message('g.reward.adjusted')}</strong>
            <small>{message('g.reward.adjustedHint')}</small>
          </span>
        </label>
      </fieldset>
      {uncertain && (
        <button
          type="button"
          disabled={busy || blocked}
          onClick={() => {
            if (!maintenanceDraftCoordinator.isLocked()) void settle()
          }}
        >
          {message('g.reward.check')}
        </button>
      )}
      <p className="campaign-reward-rules-status" role="status">
        {busy
          ? message('g.reward.status.saving')
          : status || (!rules ? message('g.reward.status.loading') : '')}
      </p>
    </section>
  )
}

function errorText(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
