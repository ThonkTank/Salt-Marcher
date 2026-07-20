package features.sessiongeneration.domain.generation;

import java.math.BigDecimal;
import java.util.List;

public record GeneratedRun(
        String runId,
        String engineVersion,
        String catalogVersion,
        String catalogContentHash,
        long seed,
        List<PartyLevel> party,
        SessionContext session,
        List<EncounterTarget> encounterTargets,
        List<EncounterPlan> encounters,
        List<TreasurePlan> treasures,
        List<LootLine> loot,
        List<PackingRow> packing,
        RewardSummary rewards,
        String formattedText,
        List<Audit> audits
) {

    public GeneratedRun {
        party = List.copyOf(party);
        encounterTargets = List.copyOf(encounterTargets);
        encounters = List.copyOf(encounters);
        treasures = List.copyOf(treasures);
        loot = List.copyOf(loot);
        packing = List.copyOf(packing);
        audits = List.copyOf(audits);
    }

    public record PartyLevel(int level, int players) {
    }

    public record SessionContext(
            int partyCount,
            BigDecimal adventureDayFraction,
            int encounterCount,
            long dayXpBudget,
            long sessionXpTarget,
            BigDecimal averageLevel,
            long normalBudgetCp,
            long overstockBudgetCp,
            int nonMagicSlots,
            int normalMagic,
            int overstockMagic,
            int treasureCount
    ) {
    }

    public record EncounterTarget(int encounterNumber, long targetXp) {
    }

    public record EncounterBlock(
            String id,
            EncounterRole role,
            int challengeCode,
            String challengeLabel,
            long unitXp,
            int quantity
    ) {
    }

    public record EncounterPlan(
            int encounterNumber,
            long targetXp,
            long adjustedXp,
            Difficulty difficulty,
            String candidateId,
            String monsterSummary,
            int monsterCount,
            BigDecimal multiplier,
            int maxChallengeCode,
            BigDecimal bossScore,
            List<EncounterBlock> blocks
    ) {

        public EncounterPlan {
            blocks = List.copyOf(blocks);
        }
    }

    public record TreasurePlan(
            int treasureId,
            StockClass stockClass,
            RewardChannel channel,
            int anchorEncounterNumber,
            String theme,
            String magicType,
            long targetCp,
            int nonMagicSlots,
            int magicSlots
    ) {
    }

    public record LootLine(
            int lineId,
            int treasureId,
            LootRole role,
            String itemId,
            String text,
            long quantity,
            long unitCp,
            long actualCp,
            BigDecimal totalCapacity,
            String allowedContainers,
            String magicRarity,
            boolean cursed
    ) {
    }

    public record PackingRow(
            int lineId,
            int treasureId,
            String containerType,
            int containerCount,
            String containerId,
            boolean valid
    ) {
    }

    public record RewardSummary(long normalActualCp, long overstockActualCp, int magicCount) {
    }

    public record Audit(String code, AuditStatus status, String detail) {
    }

    public enum Difficulty { EASY, MEDIUM, HARD, DEADLY }

    public enum EncounterRole { MINION, SUPPORT, STANDARD, ELITE, BOSS }

    public enum StockClass { NORMAL, OVERSTOCK }

    public enum RewardChannel { QUEST, ENCOUNTER, ENVIRONMENT }

    public enum LootRole { CARRIER, USEFUL, FLAVOR, MAGIC }

    public enum AuditStatus { PASS, WARNING, FAIL }
}
