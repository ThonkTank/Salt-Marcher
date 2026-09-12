import type Database from 'better-sqlite3'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import { InstallationSettingsStore } from '../persistence/sqlite/installation-settings-store.js'
import type { PartyQuickField } from '../../shared/contracts/party-quick-fields.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
export function initializePartyHistoryIndex(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS party_history_installation (singleton INTEGER PRIMARY KEY CHECK(singleton = 1), id TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS party_history_campaign (campaign_id TEXT PRIMARY KEY, epoch TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS party_history_index (campaign_id TEXT NOT NULL, epoch TEXT NOT NULL, command_id TEXT NOT NULL, sequence INTEGER NOT NULL, PRIMARY KEY(campaign_id, epoch, command_id));`)
  db.prepare(
    'INSERT OR IGNORE INTO party_history_installation (singleton, id) VALUES (1, ?)'
  ).run(uuidv7())
}
export class PartyHistoryIndex {
  constructor(private readonly db: Database.Database) {}
  scope(campaignId: string): string {
    const installation = this.db
      .prepare('SELECT id FROM party_history_installation WHERE singleton = 1')
      .get() as { id: string }
    const campaign = this.db
      .prepare('SELECT epoch FROM party_history_campaign WHERE campaign_id = ?')
      .get(campaignId) as { epoch: string } | undefined
    return `${installation.id}:${campaign?.epoch ?? campaignId}`
  }
  invalidate(campaignId: string) {
    this.db
      .prepare(
        'INSERT INTO party_history_campaign (campaign_id, epoch) VALUES (?, ?) ON CONFLICT(campaign_id) DO UPDATE SET epoch = excluded.epoch'
      )
      .run(campaignId, uuidv7())
  }
  complete(
    campaignId: string,
    scope: string,
    commandId: string,
    sequence: number,
    preferences: { before: PartyQuickField[]; after: PartyQuickField[] } | null
  ) {
    this.db.transaction(() => {
      if (
        this.db
          .prepare(
            'SELECT 1 FROM party_history_index WHERE campaign_id = ? AND epoch = ? AND command_id = ?'
          )
          .get(campaignId, scope, commandId)
      )
        return
      if (preferences) {
        const settings = new InstallationSettingsStore(this.db)
        const current = settings.read()
        if (
          JSON.stringify(current.preferences.partyQuickFields) !==
          JSON.stringify(preferences.before)
        )
          throw new CapabilityError('stale', false)
        settings.update(
          { partyQuickFields: preferences.after },
          current.revision
        )
      }
      this.db
        .prepare(
          'INSERT INTO party_history_index (campaign_id, epoch, command_id, sequence) VALUES (?, ?, ?, ?)'
        )
        .run(campaignId, scope, commandId, sequence)
    })()
  }
}
