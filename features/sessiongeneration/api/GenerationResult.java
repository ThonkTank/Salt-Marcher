package features.sessiongeneration.api;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

public record GenerationResult(
        GenerationRunId runId,
        String engineVersion,
        String catalogVersion,
        String catalogContentHash,
        long seed,
        List<PartyLevel> party,
        SessionSummary session,
        List<EncounterTarget> encounterTargets,
        List<Encounter> encounters,
        List<Treasure> treasures,
        List<LootItem> lootItems,
        List<Packing> packing,
        RewardSummary rewards,
        String formattedText,
        List<Audit> audits
) {

    public GenerationResult {
        runId = Objects.requireNonNull(runId, "runId");
        engineVersion = required(engineVersion, "engineVersion");
        catalogVersion = required(catalogVersion, "catalogVersion");
        catalogContentHash = required(catalogContentHash, "catalogContentHash");
        party = List.copyOf(party);
        session = Objects.requireNonNull(session, "session");
        encounterTargets = List.copyOf(encounterTargets);
        encounters = List.copyOf(encounters);
        treasures = List.copyOf(treasures);
        lootItems = List.copyOf(lootItems);
        packing = List.copyOf(packing);
        rewards = Objects.requireNonNull(rewards, "rewards");
        formattedText = Objects.requireNonNull(formattedText, "formattedText");
        audits = List.copyOf(audits);
    }

    public record PartyLevel(int level, int players) {
    }

    private static String required(String value, String name) {
        String normalized = Objects.requireNonNull(value, name).trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(name + " must not be empty");
        }
        return normalized;
    }

    public record SessionSummary(
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

    public record Encounter(
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

        public Encounter {
            blocks = List.copyOf(blocks);
        }
    }

    public record EncounterBlock(
            String id,
            EncounterRole requestedRole,
            int challengeCode,
            String challengeLabel,
            long monsterXp,
            int count
    ) {
    }

    public record Treasure(
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

    public record LootItem(
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

    public record Packing(
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

        public Audit {
            code = required(code, "code");
            status = Objects.requireNonNull(status, "status");
            detail = Objects.requireNonNullElse(detail, "");
        }
    }

    public enum Difficulty { EASY, MEDIUM, HARD, DEADLY }

    public enum EncounterRole { MINION, SUPPORT, STANDARD, ELITE, BOSS }

    public enum StockClass { NORMAL, OVERSTOCK }

    public enum RewardChannel { QUEST, ENCOUNTER, ENVIRONMENT }

    public enum LootRole { CARRIER, USEFUL, FLAVOR, MAGIC }

    public enum AuditStatus { PASS, WARNING, FAIL }
}
