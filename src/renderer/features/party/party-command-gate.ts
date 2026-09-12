/** Resolve an uncertain original command before any subsequent Party write. */
export class PartyCommandGate {
  private tail: Promise<unknown> = Promise.resolve()
  private unresolved: (() => Promise<unknown>) | null = null

  run<T>(
    write: () => Promise<T>,
    readOriginal: () => Promise<unknown>
  ): Promise<T> {
    const next = this.tail
      .catch(() => undefined)
      .then(async () => {
        if (this.unresolved) {
          await this.unresolved()
          this.unresolved = null
        }
        this.unresolved = readOriginal
        const result = await write()
        this.unresolved = null
        return result
      })
    this.tail = next
    return next
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
