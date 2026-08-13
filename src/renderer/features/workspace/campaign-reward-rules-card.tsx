import { useEffect, useState } from 'react'
import type {
  CampaignRules,
  RewardXpBasis
} from '../../../shared/contracts/campaign-rules.js'
import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'
import { message } from '../../i18n/generator-runtime.de.js'
import type { CampaignRewardRulesPort } from './campaign-reward-rules-port.js'

export function CampaignRewardRulesCard(props: {
  campaignRules: CampaignRewardRulesPort
  activeCampaignId: string | null
  onError: (message: string) => void
}) {
  const { activeCampaignId, campaignRules, onError } = props
  const [rules, setRules] = useState<CampaignRules | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

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

  async function update(rewardXpBasis: RewardXpBasis) {
    if (!rules || rewardXpBasis === rules.rewardXpBasis) return
    setBusy(true)
    setStatus('')
    const commandId = crypto.randomUUID()
    try {
      setRules(
        await campaignRules.update({
          commandId,
          expectedRevision: rules.revision,
          rewardXpBasis
        })
      )
      setStatus(message('g.reward.status.saved'))
    } catch (cause) {
      if (capabilityErrorCode(cause) === 'outcome_unknown') {
        const receipt = await campaignRules.commandReceipt({ commandId })
        if (receipt) {
          setRules(receipt)
          setStatus(message('g.reward.status.saved'))
          return
        }
      }
      if (capabilityErrorCode(cause) === 'stale') {
        setRules(await campaignRules.read())
        setStatus(message('g.reward.status.stale'))
      } else onError(errorText(cause))
    } finally {
      setBusy(false)
    }
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
      <fieldset disabled={busy || !rules}>
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
