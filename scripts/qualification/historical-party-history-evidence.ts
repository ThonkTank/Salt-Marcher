import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { join, dirname, relative, sep } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

type Row = Record<string, unknown>
type Rows = Row[] | null
const installationTables = [
  'party_history_installation',
  'party_history_campaign',
  'party_history_index'
] as const
const campaignTables = ['party_action_history', 'party_action_receipt'] as const
function tables(path: string, names: readonly string[]): Record<string, Rows> {
  const db = new DatabaseSync(path, { readOnly: true })
  try {
    return Object.fromEntries(
      names.map((name) => {
        const exists = db
          .prepare(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?"
          )
          .get(name)
        // Names come exclusively from the fixed evidence table lists above.
        const rows = exists
          ? db
              .prepare(`SELECT * FROM "${name}"`)
              .all()
              .map((row) => ({ ...row }))
              .sort((a, b) =>
                JSON.stringify(a).localeCompare(JSON.stringify(b))
              )
          : null
        return [name, rows]
      })
    )
  } finally {
    db.close()
  }
}
export function readPartyHistoryEvidence(profile: string) {
  const data = join(profile, 'campaign-data')
  const campaignRoot = join(data, 'campaigns')
  const paths: string[] = []
  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      assert(!entry.isSymbolicLink(), 'Campaign evidence rejects symlinks')
      const path = join(directory, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (entry.isFile() && entry.name === 'campaign.sqlite')
        paths.push(path)
    }
  }
  visit(campaignRoot)
  const campaigns = paths.sort().map((path) => ({
    id: relative(campaignRoot, dirname(path)).split(sep).join('/'),
    tables: tables(path, campaignTables)
  }))
  return {
    installation: tables(join(data, 'installation.sqlite'), installationTables),
    campaigns
  }
}
export type PartyHistoryEvidence = ReturnType<typeof readPartyHistoryEvidence>

export {
  assertPartyHistoryMigration,
  assertPartyHistoryXp
} from './party-history-assertions.js'
