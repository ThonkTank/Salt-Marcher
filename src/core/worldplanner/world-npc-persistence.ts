import type { WorldFactionSnapshot } from '../../shared/contracts/encounter-source.js'

export const WORLD_NPC_RECEIPT_RETENTION_LIMIT = 1_000

export interface CreatureReferenceResolver {
  resolve(id: string): Readonly<{ id: string; displayName: string }> | null
}

export interface WorldNpcFactionMembershipCoordinator {
  read(): WorldFactionSnapshot
  assertMembershipRevision(expectedRevision: number): void
  recordMembershipChange(): void
}
