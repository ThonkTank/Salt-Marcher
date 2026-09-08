import { useContext, useState } from 'react'
import type { PartyCharacter } from '../../../shared/contracts/party.js'
import { CapabilityContext } from '../../capabilities/capability-context.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { useAsyncCommandCoordinator } from '../../async/use-async-command-coordinator.js'
import { AnchoredPopup } from '../../shell/anchored-popup.js'
import { message } from '../../i18n/session-runtime.de.js'
export function DesktopXpAction(props: {
  campaignId: string
  member: PartyCharacter
  revision: number
}) {
  const api = useCapabilityApi()
  const workspace = useContext(CapabilityContext)!.campaignWorkspace
  const commands = useAsyncCommandCoordinator()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const target = {
    scope: 'desktop-xp',
    entityKey: `${props.campaignId}:${props.member.id}`
  }
  const busy = commands.state(target).status === 'pending'
  async function write(mode: 'add' | 'subtract' | 'set') {
    if (commands.state(target).status === 'pending') return
    const value = Number(amount)
    if (
      !amount.trim() ||
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value > 1_000_000
    ) {
      setError(message('character.valueError'))
      return
    }
    setError(null)
    const outcome = await commands.run({
      ...target,
      mode: 'latest-only',
      execute: async () => {
        const base = { id: props.member.id, expectedRevision: props.revision }
        const result =
          mode === 'set'
            ? await api.party.setXp({ ...base, amount: value })
            : await api.party.adjustXp({
                ...base,
                delta: mode === 'add' ? value : -value
              })
        workspace.publishSession(props.campaignId, (current) =>
          result.revision < current.party.revision
            ? current
            : { ...current, party: result }
        )
        return result
      }
    })
    if (outcome.status === 'failure')
      setError(capabilityErrorText(outcome.cause))
  }
  return (
    <>
      <button
        onClick={(event) => {
          setAnchor(event.currentTarget)
          setAmount('')
          setError(null)
          setOpen(!open)
        }}
      >
        {message('xp.action')}
      </button>
      <AnchoredPopup
        open={open}
        anchor={anchor}
        onDismiss={() => setOpen(false)}
        className="desktop-xp-popup"
      >
        <div>
          <input
            type="number"
            aria-label={message('xp.amount')}
            min={0}
            max={1_000_000}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <button disabled={busy} onClick={() => void write('add')}>
            +
          </button>
          <button disabled={busy} onClick={() => void write('subtract')}>
            −
          </button>
          <button disabled={busy} onClick={() => void write('set')}>
            {message('xp.set')}
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
      </AnchoredPopup>
    </>
  )
}
