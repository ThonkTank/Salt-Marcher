package src.domain.encounter.generation;

import src.domain.encounter.api.EncounterDifficultyBand;

import java.util.List;
import java.util.Set;

final class EncounterDraftScorer {

    private static final int LARGE_CREATURE_GROUP = 6;
    private static final int LARGE_QUANTITY_STACK = 4;
    private static final int MAX_CREATURES_WITH_BOSS = 4;
    private static final String BOSS_ROLE = "Boss";
    private static final String BRUTE_ROLE = "Brute";
    private static final String MINION_ROLE = "Minion";
    private static final String SKIRMISHER_ROLE = "Skirmisher";

    private EncounterDraftScorer() {
    }

    static int score(ScoreInput input) {
        int score = 0;
        score += scoreTargetBand(input.targetDifficulty(), input.adjustedXp(), input.thresholds(), input.targetAdjustedXp());
        score += scoreAdjustedXpProximity(input.adjustedXp(), input.targetAdjustedXp());
        score += input.achievedDifficulty() == input.targetDifficulty() ? 140 : 0;
        score += scoreEntryCount(input.entries().size());
        score += scoreRoleSynergy(input.roles());
        score += scoreCompositionPenalties(input.entries(), input.creatureCount(), input.bossCount());
        return score;
    }

    record ScoreInput(
            List<EncounterDraftEntry> entries,
            EncounterDifficultyBand targetDifficulty,
            EncounterDifficultyBand achievedDifficulty,
            int adjustedXp,
            EncounterDifficultyMath.Thresholds thresholds,
            int targetAdjustedXp,
            int creatureCount,
            int bossCount,
            Set<String> roles
    ) {
    }

    private static int scoreTargetBand(
            EncounterDifficultyBand targetDifficulty,
            int adjustedXp,
            EncounterDifficultyMath.Thresholds thresholds,
            int targetAdjustedXp
    ) {
        int minXp = EncounterDifficultyTargets.minAdjustedXp(targetDifficulty, thresholds);
        int maxXp = EncounterDifficultyTargets.maxAdjustedXp(targetDifficulty, thresholds);
        if (adjustedXp >= minXp && adjustedXp <= maxXp) {
            return 700;
        }
        int miss = adjustedXp < minXp ? minXp - adjustedXp : adjustedXp - maxXp;
        return Math.max(0, 500 - miss * 400 / Math.max(1, targetAdjustedXp));
    }

    private static int scoreAdjustedXpProximity(int adjustedXp, int targetAdjustedXp) {
        return Math.max(0, 250 - Math.abs(adjustedXp - targetAdjustedXp) * 250 / Math.max(1, targetAdjustedXp));
    }

    private static int scoreEntryCount(int entryCount) {
        return switch (entryCount) {
            case 1 -> 40;
            case 2 -> 90;
            case 3 -> 70;
            default -> 50;
        };
    }

    private static int scoreRoleSynergy(Set<String> roles) {
        int score = roles.size() * 25;
        if (roles.contains(BOSS_ROLE) && roles.size() > 1) {
            score += 90;
        }
        if (roles.contains(BRUTE_ROLE) && roles.contains(SKIRMISHER_ROLE)) {
            score += 70;
        }
        return score;
    }

    private static int scoreCompositionPenalties(List<EncounterDraftEntry> entries, int creatureCount, int bossCount) {
        int score = 0;
        if (bossCount > 0 && creatureCount > MAX_CREATURES_WITH_BOSS) {
            score -= 120;
        }
        if (creatureCount >= LARGE_CREATURE_GROUP) {
            score -= 30;
        }
        for (EncounterDraftEntry entry : entries) {
            score += scoreEntryPenalty(entry, creatureCount);
        }
        return score;
    }

    private static int scoreEntryPenalty(EncounterDraftEntry entry, int creatureCount) {
        int score = 0;
        if (entry.quantity() > LARGE_QUANTITY_STACK) {
            score -= (entry.quantity() - LARGE_QUANTITY_STACK) * 35;
        }
        if (MINION_ROLE.equals(entry.profile().role()) && creatureCount <= 2) {
            score -= 40;
        }
        return score;
    }
}
