package src.domain.encounter.model.generation.model;

import java.util.Set;

final class EncounterDraftScoringModel {

    private static final int LARGE_CREATURE_GROUP = 6;
    private static final int LARGE_QUANTITY_STACK = 4;
    private static final int MAX_CREATURES_WITH_BOSS = 4;

    private EncounterDraftScoringModel() {
    }

    static int score(EncounterDraftGenerationModel.ScoreInput input) {
        int score = 0;
        EncounterDraftGenerationModel.ScoreContext context = input.context();
        EncounterDraftComposition composition = input.composition();
        EncounterDraftXpProfile xp = context.xpProfile();
        score += scoreTargetBand(context.targetDifficulty(), xp.adjustedXp(), context.thresholds(), xp.targetAdjustedXp());
        score += scoreAdjustedXpProximity(xp.adjustedXp(), xp.targetAdjustedXp());
        score += context.achievedDifficulty() == context.targetDifficulty() ? 140 : 0;
        score += scoreEntryCount(composition.entries().size());
        score += scoreRoleSynergy(composition.roles());
        score += scoreSelectionWeights(composition);
        score += scoreCompositionPenalties(composition);
        score += EncounterDraftTuningScoringModel.tuningScore(composition, context.tuning(), context.partySize());
        return score;
    }

    private static int scoreTargetBand(
            EncounterDifficultyIntent targetDifficulty,
            int adjustedXp,
            EncounterDifficultyThresholds thresholds,
            int targetAdjustedXp
    ) {
        EncounterDifficultyBandModel band = EncounterDifficultyBandModel.of(targetDifficulty, thresholds);
        int minXp = band.minAdjustedXp();
        int maxXp = band.maxAdjustedXp();
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

    private static int scoreRoleSynergy(Set<EncounterRole> roles) {
        int score = roles.size() * 25;
        if (roles.contains(EncounterRole.BOSS) && roles.size() > 1) {
            score += 90;
        }
        if (roles.contains(EncounterRole.BRUTE) && roles.contains(EncounterRole.SKIRMISHER)) {
            score += 70;
        }
        return score;
    }

    private static int scoreSelectionWeights(EncounterDraftComposition composition) {
        int score = 0;
        for (EncounterDraftEntry entry : composition.entries()) {
            score += (entry.selectionWeight() - 1) * 18 * Math.min(3, entry.quantity());
        }
        return score;
    }

    private static int scoreCompositionPenalties(EncounterDraftComposition composition) {
        int score = 0;
        int creatureCount = composition.stats().creatureCount();
        if (composition.stats().bossCount() > 0 && creatureCount > MAX_CREATURES_WITH_BOSS) {
            score -= 120;
        }
        if (creatureCount >= LARGE_CREATURE_GROUP) {
            score -= 30;
        }
        for (EncounterDraftEntry entry : composition.entries()) {
            score += scoreEntryPenalty(entry, creatureCount);
        }
        return score;
    }

    private static int scoreEntryPenalty(EncounterDraftEntry entry, int creatureCount) {
        int score = 0;
        if (entry.quantity() > LARGE_QUANTITY_STACK) {
            score -= (entry.quantity() - LARGE_QUANTITY_STACK) * 35;
        }
        if (EncounterRolePredicateModel.minion(entry.role()) && creatureCount <= 2) {
            score -= 40;
        }
        return score;
    }

}
