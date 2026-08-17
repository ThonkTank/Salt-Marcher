import type Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  characterLootEntrySchema,
  characterLootLedgerSchema,
  itemDefinitionLineValueCp,
  itemReferenceKey,
  itemReferenceSchema,
  type CharacterLootEntry,
  type CharacterLootLedger,
  type CorrectCharacterLootInput,
  type ItemReference
} from '../../shared/contracts/loot.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import { ItemDefinitionResolver } from './item-definition-resolver.js'

export type CharacterRewardBalance = Readonly<{
  characterId: string
  ledgerRevision: number
  currentNonMagicCp: number
  currentMagic: Readonly<{
    Common: number
    Uncommon: number
    Rare: number
    'Very Rare': number
    Legendary: number
  }>
}>

export function initializeCharacterLootSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS character_loot_ledger_metadata (
      character_id TEXT PRIMARY KEY NOT NULL,
      revision INTEGER NOT NULL CHECK(revision >= 0)
    );
    CREATE TABLE IF NOT EXISTS character_loot_entry (
      id TEXT PRIMARY KEY NOT NULL,
      command_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      treasure_id TEXT,
      treasure_item_id TEXT,
      source TEXT NOT NULL CHECK(source IN ('award', 'manual', 'purchase', 'correction')),
      item_reference_json TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      status TEXT NOT NULL CHECK(status IN ('received', 'given_away', 'sold')),
      provenance_kind TEXT NOT NULL CHECK(provenance_kind = 'treasure_distribution'),
      provenance_treasure_label TEXT NOT NULL,
      provenance_recipient_name TEXT NOT NULL,
      source_run_id TEXT,
      generated_treasure_id TEXT,
      reward_channel TEXT CHECK(reward_channel IN ('encounter', 'quest', 'environment')),
      corrects_entry_id TEXT UNIQUE,
      correction_reason TEXT,
      received_at TEXT NOT NULL,
      UNIQUE(command_id, treasure_item_id, character_id),
      CHECK(
        (source_run_id IS NULL AND generated_treasure_id IS NULL AND reward_channel IS NULL)
        OR
        (source_run_id IS NOT NULL AND generated_treasure_id IS NOT NULL AND reward_channel IS NOT NULL)
      ),
      CHECK(
        (source = 'correction' AND corrects_entry_id IS NOT NULL AND correction_reason IS NOT NULL)
        OR
        (source != 'correction' AND corrects_entry_id IS NULL AND correction_reason IS NULL)
      )
    );
    CREATE INDEX IF NOT EXISTS character_loot_entry_character
      ON character_loot_entry(character_id, received_at, id);
    CREATE INDEX IF NOT EXISTS character_loot_entry_correction
      ON character_loot_entry(corrects_entry_id);
  `)
}

type AwardDraft = Readonly<{
  id: string
  commandId: string
  characterId: string
  treasureId: string
  treasureItemId: string
  itemReference: ItemReference
  quantity: number
  provenance: CharacterLootEntry['provenance']
  rewardProvenance: Readonly<{
    runId: string
    generatedTreasureId: string
    rewardChannel: 'encounter' | 'quest' | 'environment'
  }> | null
  receivedAt: string
}>

export class CharacterLootStore {
  private readonly definitions: ItemDefinitionResolver

  constructor(
    private readonly db: Database.Database,
    definitions?: ItemDefinitionResolver
  ) {
    this.definitions =
      definitions ??
      new ItemDefinitionResolver(db, () => {
        throw new Error('Catalog definition resolver is not configured')
      })
  }

  addAward(draft: AwardDraft): CharacterLootEntry {
    this.db
      .prepare(
        `INSERT INTO character_loot_entry (
           id, command_id, character_id, treasure_id, treasure_item_id,
           source, item_reference_json, quantity, status, provenance_kind,
           provenance_treasure_label, provenance_recipient_name,
           source_run_id, generated_treasure_id, reward_channel,
           corrects_entry_id, correction_reason, received_at
         ) VALUES (?, ?, ?, ?, ?, 'award', ?, ?, 'received', ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`
      )
      .run(
        draft.id,
        draft.commandId,
        draft.characterId,
        draft.treasureId,
        draft.treasureItemId,
        JSON.stringify(draft.itemReference),
        draft.quantity,
        draft.provenance.kind,
        draft.provenance.treasureLabel,
        draft.provenance.recipientName,
        draft.rewardProvenance?.runId ?? null,
        draft.rewardProvenance?.generatedTreasureId ?? null,
        draft.rewardProvenance?.rewardChannel ?? null,
        draft.receivedAt
      )
    return this.require(draft.id)
  }

  bumpRevisions(characterIds: ReadonlySet<string>): void {
    const bump = this.db.prepare(
      `INSERT INTO character_loot_ledger_metadata (character_id, revision)
       VALUES (?, 1)
       ON CONFLICT(character_id) DO UPDATE SET revision = revision + 1`
    )
    for (const characterId of characterIds) bump.run(characterId)
  }

  correct(
    input: CorrectCharacterLootInput,
    receivedAt: string
  ): CharacterLootLedger {
    const current = this.ledger(input.characterId)
    if (current.revision !== input.expectedRevision)
      throw new CapabilityError('stale', true)
    const original = current.entries.find((entry) => entry.id === input.entryId)
    if (!original || original.supersededByEntryId)
      throw new CapabilityError('validation_failed', false)
    this.db
      .prepare(
        `INSERT INTO character_loot_entry (
           id, command_id, character_id, treasure_id, treasure_item_id,
           source, item_reference_json, quantity, status, provenance_kind,
           provenance_treasure_label, provenance_recipient_name,
           source_run_id, generated_treasure_id, reward_channel,
           corrects_entry_id, correction_reason, received_at
         ) VALUES (?, ?, ?, ?, ?, 'correction', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        uuidv7(),
        input.commandId,
        input.characterId,
        original.treasureId,
        original.treasureItemId,
        JSON.stringify(original.itemReference),
        input.quantity,
        input.status,
        original.provenance.kind,
        original.provenance.treasureLabel,
        original.provenance.recipientName,
        original.rewardProvenance?.runId ?? null,
        original.rewardProvenance?.generatedTreasureId ?? null,
        original.rewardProvenance?.rewardChannel ?? null,
        original.id,
        input.reason.trim(),
        receivedAt
      )
    this.bumpRevisions(new Set([input.characterId]))
    return this.ledger(input.characterId)
  }

  entriesForCommand(commandId: string): readonly CharacterLootEntry[] {
    return this.db
      .prepare(
        `${entrySelect} WHERE entry.command_id = ? ORDER BY entry.received_at, entry.id`
      )
      .all(commandId)
      .map((row) => rowToEntry(row, this.definitions))
  }

  ledger(characterId: string): CharacterLootLedger {
    const rows = this.db
      .prepare(
        `${entrySelect}
          WHERE entry.character_id = ?
          ORDER BY entry.received_at DESC, entry.id DESC`
      )
      .all(characterId)
    const revision =
      (
        this.db
          .prepare(
            `SELECT revision FROM character_loot_ledger_metadata
              WHERE character_id = ?`
          )
          .get(characterId) as { revision: number } | undefined
      )?.revision ?? 0
    return characterLootLedgerSchema.parse({
      characterId,
      revision,
      entries: rows.map((row) => rowToEntry(row, this.definitions))
    })
  }

  /**
   * Returns cumulative effective grants for reward compensation. Status is
   * deliberately ignored: selling or giving an item away does not earn a
   * replacement. Superseded rows are replaced by their correction row.
   */
  rewardBalances(
    characterIds: readonly string[]
  ): readonly CharacterRewardBalance[] {
    const ids = [...new Set(characterIds)]
    if (ids.length === 0) return []
    const placeholders = ids.map(() => '?').join(',')
    const rows = this.db
      .prepare(
        `SELECT entry.character_id AS characterId,
                entry.item_reference_json AS itemReferenceJson,
                entry.quantity
           FROM character_loot_entry entry
           LEFT JOIN character_loot_entry correction
             ON correction.corrects_entry_id = entry.id
          WHERE entry.character_id IN (${placeholders})
            AND correction.id IS NULL
          ORDER BY entry.character_id, entry.received_at, entry.id`
      )
      .all(...ids) as Array<{
      characterId: string
      itemReferenceJson: string
      quantity: number
    }>
    const revisions = new Map(
      (
        this.db
          .prepare(
            `SELECT character_id AS characterId, revision
               FROM character_loot_ledger_metadata
              WHERE character_id IN (${placeholders})`
          )
          .all(...ids) as Array<{ characterId: string; revision: number }>
      ).map((row) => [row.characterId, row.revision])
    )
    const referencedRows = rows.map((row) => ({
      ...row,
      itemReference: itemReferenceSchema.parse(
        JSON.parse(row.itemReferenceJson)
      )
    }))
    const definitions = this.definitions.resolveMany(
      referencedRows.map((row) => row.itemReference)
    )
    return ids.map((characterId) => {
      const currentMagic = {
        Common: 0,
        Uncommon: 0,
        Rare: 0,
        'Very Rare': 0,
        Legendary: 0
      }
      let currentNonMagicCp = 0
      for (const row of referencedRows.filter(
        (entry) => entry.characterId === characterId
      )) {
        const definition = definitions.get(itemReferenceKey(row.itemReference))!
        if (!definition.magic)
          currentNonMagicCp += itemDefinitionLineValueCp(
            definition,
            row.quantity
          )
        else if (definition.rarity && definition.rarity in currentMagic)
          currentMagic[definition.rarity] += row.quantity
      }
      return Object.freeze({
        characterId,
        ledgerRevision: revisions.get(characterId) ?? 0,
        currentNonMagicCp,
        currentMagic: Object.freeze(currentMagic)
      })
    })
  }

  private require(id: string): CharacterLootEntry {
    const row = this.db.prepare(`${entrySelect} WHERE entry.id = ?`).get(id)
    return rowToEntry(row, this.definitions)
  }
}

const entrySelect = `
  SELECT entry.id, entry.character_id AS characterId,
         entry.treasure_id AS treasureId,
         entry.treasure_item_id AS treasureItemId, entry.source,
         entry.item_reference_json AS itemReferenceJson, entry.quantity,
         entry.status,
         entry.provenance_kind AS provenanceKind,
         entry.provenance_treasure_label AS provenanceTreasureLabel,
         entry.provenance_recipient_name AS provenanceRecipientName,
         entry.source_run_id AS sourceRunId,
         entry.generated_treasure_id AS generatedTreasureId,
         entry.reward_channel AS rewardChannel,
         entry.corrects_entry_id AS correctsEntryId,
         correction.id AS supersededByEntryId,
         entry.correction_reason AS correctionReason,
         entry.received_at AS receivedAt
    FROM character_loot_entry entry
    LEFT JOIN character_loot_entry correction
      ON correction.corrects_entry_id = entry.id`

function rowToEntry(
  row: unknown,
  definitions: ItemDefinitionResolver
): CharacterLootEntry {
  const value = row as Record<string, unknown>
  const {
    sourceRunId,
    generatedTreasureId,
    rewardChannel,
    provenanceKind,
    provenanceTreasureLabel,
    provenanceRecipientName,
    itemReferenceJson,
    ...entry
  } = value
  const itemReference = JSON.parse(itemReferenceJson as string) as ItemReference
  return characterLootEntrySchema.parse({
    ...entry,
    itemReference,
    definition: definitions.resolve(itemReference),
    provenance: {
      kind: provenanceKind,
      treasureLabel: provenanceTreasureLabel,
      recipientName: provenanceRecipientName
    },
    rewardProvenance:
      sourceRunId && generatedTreasureId && rewardChannel
        ? {
            runId: sourceRunId,
            generatedTreasureId,
            rewardChannel
          }
        : null
  })
}
