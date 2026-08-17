import type Database from 'better-sqlite3'
import {
  generatedRewardBasisSchema,
  type GeneratedRewardBasis,
  type GeneratedRun
} from '../../shared/contracts/session-generation.js'

/** Owner-internal repository for a generated run's reward basis aggregate. */
export class GeneratedRunRewardBasisStore {
  constructor(private readonly db: Database.Database) {}

  insert(run: GeneratedRun): void {
    if (!run.rewardBasis) return
    const basis = run.rewardBasis
    this.db
      .prepare(
        `INSERT INTO session_generation_reward_basis (
           run_id, target_gold_cp, current_gold_cp, gold_deficit_cp,
           target_common, target_uncommon, target_rare, target_very_rare,
           target_legendary, current_common, current_uncommon, current_rare,
           current_very_rare, current_legendary, deficit_common,
           deficit_uncommon, deficit_rare, deficit_very_rare,
           deficit_legendary
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        run.id,
        basis.targetGoldCp,
        basis.currentGoldCp,
        basis.goldDeficitCp,
        basis.targetMagic.Common,
        basis.targetMagic.Uncommon,
        basis.targetMagic.Rare,
        basis.targetMagic['Very Rare'],
        basis.targetMagic.Legendary,
        basis.currentMagic.Common,
        basis.currentMagic.Uncommon,
        basis.currentMagic.Rare,
        basis.currentMagic['Very Rare'],
        basis.currentMagic.Legendary,
        basis.magicDeficit.Common,
        basis.magicDeficit.Uncommon,
        basis.magicDeficit.Rare,
        basis.magicDeficit['Very Rare'],
        basis.magicDeficit.Legendary
      )
    const member = this.db.prepare(
      `INSERT INTO session_generation_reward_member (
         run_id, position, character_id, level, current_xp, projected_xp,
         ledger_revision, current_non_magic_cp, magic_common, magic_uncommon,
         magic_rare, magic_very_rare, magic_legendary
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    basis.members.forEach((entry, position) =>
      member.run(
        run.id,
        position,
        entry.characterId,
        entry.level ?? null,
        entry.currentXp,
        entry.projectedXp,
        entry.ledgerRevision,
        entry.currentNonMagicCp,
        entry.currentMagic.Common,
        entry.currentMagic.Uncommon,
        entry.currentMagic.Rare,
        entry.currentMagic['Very Rare'],
        entry.currentMagic.Legendary
      )
    )
  }

  read(runId: string): GeneratedRewardBasis | null {
    const rows = this.db
      .prepare(
        `SELECT basis.target_gold_cp AS targetGoldCp,
                basis.current_gold_cp AS currentGoldCp,
                basis.gold_deficit_cp AS goldDeficitCp,
                basis.target_common AS targetCommon,
                basis.target_uncommon AS targetUncommon,
                basis.target_rare AS targetRare,
                basis.target_very_rare AS targetVeryRare,
                basis.target_legendary AS targetLegendary,
                basis.current_common AS currentCommon,
                basis.current_uncommon AS currentUncommon,
                basis.current_rare AS currentRare,
                basis.current_very_rare AS currentVeryRare,
                basis.current_legendary AS currentLegendary,
                basis.deficit_common AS deficitCommon,
                basis.deficit_uncommon AS deficitUncommon,
                basis.deficit_rare AS deficitRare,
                basis.deficit_very_rare AS deficitVeryRare,
                basis.deficit_legendary AS deficitLegendary,
                member.position, member.character_id AS characterId,
                member.level,
                member.current_xp AS currentXp,
                member.projected_xp AS projectedXp,
                member.ledger_revision AS ledgerRevision,
                member.current_non_magic_cp AS currentNonMagicCp,
                member.magic_common AS magicCommon,
                member.magic_uncommon AS magicUncommon,
                member.magic_rare AS magicRare,
                member.magic_very_rare AS magicVeryRare,
                member.magic_legendary AS magicLegendary
           FROM session_generation_reward_basis basis
           LEFT JOIN session_generation_reward_member member
             ON member.run_id = basis.run_id
          WHERE basis.run_id = ? ORDER BY member.position`
      )
      .all(runId) as Array<Record<string, number | string | null>>
    const basis = rows[0]
    if (!basis) return null
    const magic = (prefix: 'target' | 'current' | 'deficit') => ({
      Common: Number(basis[`${prefix}Common`]),
      Uncommon: Number(basis[`${prefix}Uncommon`]),
      Rare: Number(basis[`${prefix}Rare`]),
      'Very Rare': Number(basis[`${prefix}VeryRare`]),
      Legendary: Number(basis[`${prefix}Legendary`])
    })
    return generatedRewardBasisSchema.parse({
      members: rows.flatMap((row) =>
        row['characterId'] === null
          ? []
          : [
              {
                characterId: row['characterId'],
                ...(row['level'] === null ? {} : { level: row['level'] }),
                currentXp: row['currentXp'],
                projectedXp: row['projectedXp'],
                ledgerRevision: row['ledgerRevision'],
                currentNonMagicCp: row['currentNonMagicCp'],
                currentMagic: {
                  Common: row['magicCommon'],
                  Uncommon: row['magicUncommon'],
                  Rare: row['magicRare'],
                  'Very Rare': row['magicVeryRare'],
                  Legendary: row['magicLegendary']
                }
              }
            ]
      ),
      targetGoldCp: basis['targetGoldCp'],
      currentGoldCp: basis['currentGoldCp'],
      goldDeficitCp: basis['goldDeficitCp'],
      targetMagic: magic('target'),
      currentMagic: magic('current'),
      magicDeficit: magic('deficit')
    })
  }
}
