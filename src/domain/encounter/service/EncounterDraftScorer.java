package src.domain.encounter.service;

import src.domain.encounter.api.EncounterDifficultyBand;

import java.util.List;
import java.util.Set;

final class EncounterDraftScorer {

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
        if (roles.contains("Boss") && roles.size() > 1) {
            score += 90;
        }
        if (roles.contains("Brute") && roles.contains("Skirmisher")) {
            score += 70;
        }
        return score;
    }

    private static int scoreCompositionPenalties(List<EncounterDraftEntry> entries, int creatureCount, int bossCount) {
        int score = 0;
        if (bossCount > 0 && creatureCount > 4) {
            score -= 120;
        }
        if (creatureCount >= 6) {
            score -= 30;
        }
        for (EncounterDraftEntry entry : entries) {
            score += scoreEntryPenalty(entry, creatureCount);
        }
        return score;
    }

    private static int scoreEntryPenalty(EncounterDraftEntry entry, int creatureCount) {
        int score = 0;
        if (entry.quantity() > 4) {
            score -= (entry.quantity() - 4) * 35;
        }
        if ("Minion".equals(entry.profile().role()) && creatureCount <= 2) {
            score -= 40;
        }
        return score;
    }
}
