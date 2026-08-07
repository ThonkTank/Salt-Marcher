import type {
  EncounterTableScope,
  EncounterTableSnapshot
} from '../../../shared/contracts/encounter-source.js'

export const emptyEncounterTableSnapshot: EncounterTableSnapshot = {
  installation: { revision: 0, tables: [], summaries: [] },
  campaign: { revision: 0, tables: [], summaries: [] }
}

/** Scope revisions form a vector, not a single total order. */
export function mergeEncounterTableSnapshots(
  known: EncounterTableSnapshot,
  candidate: EncounterTableSnapshot
): EncounterTableSnapshot {
  return {
    installation:
      candidate.installation.revision >= known.installation.revision
        ? candidate.installation
        : known.installation,
    campaign:
      candidate.campaign.revision >= known.campaign.revision
        ? candidate.campaign
        : known.campaign
  }
}

export function encounterTables(snapshot: EncounterTableSnapshot) {
  return [...snapshot.installation.tables, ...snapshot.campaign.tables]
}

export function encounterTableSummaries(snapshot: EncounterTableSnapshot) {
  return [...snapshot.installation.summaries, ...snapshot.campaign.summaries]
}

export function encounterTableRevision(
  snapshot: EncounterTableSnapshot,
  scope: EncounterTableScope
): number {
  return snapshot[scope].revision
}

/** Keeps delayed reads and inline mutation receipts out of React components. */
export class EncounterTableSnapshotAccumulator {
  private known = emptyEncounterTableSnapshot

  current(): EncounterTableSnapshot {
    return this.known
  }

  accept(candidate: EncounterTableSnapshot): EncounterTableSnapshot {
    this.known = mergeEncounterTableSnapshots(this.known, candidate)
    return this.known
  }
}
