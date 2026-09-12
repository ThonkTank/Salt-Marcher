import { AsyncCommandCoordinator } from '../../async/async-command-coordinator.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'
/** Resolve an uncertain original command before any subsequent Party write. */
export class PartyCommandGate {
  private readonly commands = new AsyncCommandCoordinator()
  private unresolved: (() => Promise<unknown>) | null = null

  async run<T>(
    write: () => Promise<T>,
    readOriginal: () => Promise<unknown>
  ): Promise<T> {
    const outcome = await this.commands.run({
      scope: 'party-actions',
      mode: 'queue',
      execute: async () => {
        if (this.unresolved) {
          await this.unresolved()
          this.unresolved = null
        }
        this.unresolved = readOriginal
        const result = await write()
        this.unresolved = null
        return result
      }
    })
    if (outcome.status === 'success') return outcome.value
    if (outcome.status === 'failure') throw outcome.cause
    throw new CapabilityError('outcome_unknown', true)
  }
}
const hosts = new WeakMap<object, Map<string, PartyCommandGate>>()
export function partyCommandGate(
  host: object,
  campaignId: string
): PartyCommandGate {
  let campaigns = hosts.get(host)
  if (!campaigns) {
    campaigns = new Map()
    hosts.set(host, campaigns)
  }
  let gate = campaigns.get(campaignId)
  if (!gate) {
    gate = new PartyCommandGate()
    campaigns.set(campaignId, gate)
  }
  return gate
}
