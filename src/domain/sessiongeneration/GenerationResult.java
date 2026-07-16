package src.domain.sessiongeneration;

import java.math.BigDecimal;
import java.util.List;

public record GenerationResult(
        long generationId,
        GenerationRequest request,
        SessionContext session,
        List<EncounterPlan> encounters,
        List<TreasureResult> treasures,
        RewardSummary summary,
        String formattedText,
        List<AuditResult> audits,
        String dataContentHash
) {

    public GenerationResult {
        encounters = encounters == null ? List.of() : List.copyOf(encounters);
        treasures = treasures == null ? List.of() : List.copyOf(treasures);
        formattedText = formattedText == null ? "" : formattedText;
        audits = audits == null ? List.of() : List.copyOf(audits);
        dataContentHash = dataContentHash == null ? "" : dataContentHash;
    }

    public boolean applicable() {
        return !encounters.isEmpty() && audits.stream().allMatch(AuditResult::passed);
    }

    public record SessionContext(
            int partyCount,
            int dayXpBudget,
            int sessionXpTarget,
            BigDecimal averageLevel,
            long normalBudgetCp,
            long overstockBudgetCp,
            int nonMagicSlots,
            int treasureCount,
            List<RarityTarget> rarityTargets
    ) {
        public SessionContext {
            rarityTargets = rarityTargets == null ? List.of() : List.copyOf(rarityTargets);
        }
    }

    public record RarityTarget(String rarity, int normalCount, int overstockCount) {
    }

    public record EncounterPlan(
            int encounterNumber,
            int targetXp,
            int adjustedXp,
            String difficulty,
            List<EncounterBlock> blocks,
            double xpMultiplier,
            int bossRank,
            String line
    ) {
        public EncounterPlan {
            blocks = blocks == null ? List.of() : List.copyOf(blocks);
            difficulty = difficulty == null ? "" : difficulty;
            line = line == null ? "" : line;
        }

        public int monsterCount() {
            return blocks.stream().mapToInt(EncounterBlock::quantity).sum();
        }
    }

    public record EncounterBlock(String role, String challengeRating, int challengeRatingCode, int quantity, int unitXp) {
    }

    public record TreasureResult(
            int treasureId,
            String stockClass,
            String rewardChannel,
            Integer anchorEncounterNumber,
            String theme,
            long targetCp,
            long actualCp,
            List<LootLine> loot
    ) {
        public TreasureResult {
            loot = loot == null ? List.of() : List.copyOf(loot);
        }
    }

    public record LootLine(
            int lineId,
            String role,
            String item,
            int quantity,
            long unitCp,
            long actualCp,
            String container,
            String rarity,
            boolean cursed,
            String text
    ) {
    }

    public record RewardSummary(long normalActualCp, long overstockActualCp, int magicCount, List<String> rarities) {
        public RewardSummary {
            rarities = rarities == null ? List.of() : List.copyOf(rarities);
        }
    }

    public record AuditResult(String name, boolean passed, String detail) {
        public AuditResult {
            name = name == null ? "" : name;
            detail = detail == null ? "" : detail;
        }
    }
}
