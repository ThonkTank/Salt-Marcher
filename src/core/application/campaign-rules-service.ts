import type Database from 'better-sqlite3'
import {
  campaignRulesSchema,
  updateCampaignRulesInputSchema,
  type CampaignRules,
  type UpdateCampaignRulesInput
} from '../../shared/contracts/campaign-rules.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { fingerprint } from '../fingerprint.js'

export function initializeCampaignRulesSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_rules (
      singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
      revision INTEGER NOT NULL CHECK(revision >= 0),
      reward_xp_basis TEXT NOT NULL CHECK(reward_xp_basis IN ('base', 'adjusted')),
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS campaign_rules_command_receipt (
      command_id TEXT PRIMARY KEY NOT NULL,
      request_fingerprint TEXT NOT NULL,
      result_json TEXT NOT NULL
    );
  `)
  db.prepare(
    `INSERT OR IGNORE INTO campaign_rules (
       singleton, revision, reward_xp_basis, updated_at
     ) VALUES (1, 0, 'base', ?)`
  ).run(new Date(0).toISOString())
}

export class CampaignRulesService {
  constructor(
    private readonly activeDatabase: () => Database.Database,
    private readonly clock: () => Date = () => new Date()
  ) {}

  read(): CampaignRules {
    return readCampaignRules(this.activeDatabase())
  }

  update(raw: unknown): CampaignRules {
    const input = updateCampaignRulesInputSchema.parse(raw)
    const db = this.activeDatabase()
    const requestFingerprint = rulesRequestFingerprint(input)
    const write = db.transaction(() => {
      const receipt = db
        .prepare(
          `SELECT request_fingerprint AS requestFingerprint,
                  result_json AS resultJson
             FROM campaign_rules_command_receipt WHERE command_id = ?`
        )
        .get(input.commandId) as
        | {
            requestFingerprint: string
            resultJson: string
          }
        | undefined
      if (receipt) {
        if (receipt.requestFingerprint !== requestFingerprint)
          throw new CapabilityError('idempotency_conflict', false)
        return campaignRulesSchema.parse(
          JSON.parse(receipt.resultJson) as unknown
        )
      }
      const current = readCampaignRules(db)
      if (current.revision !== input.expectedRevision)
        throw new CapabilityError('stale', true)
      const nextRevision = current.revision + 1
      const updatedAt = this.clock().toISOString()
      const changed = db
        .prepare(
          `UPDATE campaign_rules
              SET revision = ?, reward_xp_basis = ?, updated_at = ?
            WHERE singleton = 1 AND revision = ?`
        )
        .run(
          nextRevision,
          input.rewardXpBasis,
          updatedAt,
          input.expectedRevision
        ).changes
      if (changed !== 1) throw new CapabilityError('stale', true)
      db.prepare(
        `INSERT INTO campaign_rules_command_receipt (
           command_id, request_fingerprint, result_json
         ) VALUES (?, ?, ?)`
      ).run(
        input.commandId,
        requestFingerprint,
        JSON.stringify(
          campaignRulesSchema.parse({
            revision: nextRevision,
            rewardXpBasis: input.rewardXpBasis,
            updatedAt
          })
        )
      )
      return campaignRulesSchema.parse({
        revision: nextRevision,
        rewardXpBasis: input.rewardXpBasis,
        updatedAt
      })
    })
    return write.immediate()
  }

  commandReceipt(commandId: string): CampaignRules | null {
    const db = this.activeDatabase()
    const receipt = db
      .prepare(
        `SELECT result_json AS resultJson
           FROM campaign_rules_command_receipt WHERE command_id = ?`
      )
      .get(commandId) as { resultJson: string } | undefined
    if (!receipt) return null
    return campaignRulesSchema.parse(JSON.parse(receipt.resultJson) as unknown)
  }
}

export function readCampaignRules(db: Database.Database): CampaignRules {
  const row = db
    .prepare(
      `SELECT revision, reward_xp_basis AS rewardXpBasis,
              updated_at AS updatedAt
         FROM campaign_rules WHERE singleton = 1`
    )
    .get()
  return campaignRulesSchema.parse(row)
}

function rulesRequestFingerprint(input: UpdateCampaignRulesInput): string {
  return fingerprint({
    expectedRevision: input.expectedRevision,
    rewardXpBasis: input.rewardXpBasis
  })
}
