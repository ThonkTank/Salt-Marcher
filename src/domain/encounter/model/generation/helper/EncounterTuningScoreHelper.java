package src.domain.encounter.model.generation.helper;

import src.domain.encounter.model.generation.model.EncounterDraftComposition;
import src.domain.encounter.model.generation.model.EncounterDraftEntry;
import src.domain.encounter.model.generation.model.EncounterTuningIntent;

final class EncounterTuningScoreHelper {

    private static final int MIN_BALANCE_ENTRIES = 2;
    private static final int BOSS_BIAS_MAX_BALANCE_LEVEL = 2;
    private static final double EXTREME_SPREAD = 2.0;
    private static final double MIXED_SPREAD = 1.6;
    private static final double LIGHT_SPREAD = 1.35;
    private static final double LOOSE_PEER_SPREAD = 2.4;

    private EncounterTuningScoreHelper() {
    }

    static int score(EncounterDraftComposition composition, EncounterTuningIntent tuning, int partySize) {
        EncounterTuningTargets targets = EncounterTuningTargetHelper.targetsFor(tuning, partySize);
        int creatureCount = composition.stats().creatureCount();
        int distinctCount = composition.entries().size();
        return scoreCreatureCount(creatureCount, targets)
                + scoreDiversity(distinctCount, targets)
                + scoreBalance(composition, tuning == null ? EncounterTuningIntent.defaultIntent() : tuning);
    }

    private static int scoreCreatureCount(int creatureCount, EncounterTuningTargets targets) {
        int distance = Math.abs(creatureCount - targets.targetCreatureCount());
        if (distance <= targets.creatureCountTolerance()) {
            return 130 - distance * 25;
        }
        return Math.max(-80, 80 - distance * 45);
    }

    private static int scoreDiversity(int distinctCount, EncounterTuningTargets targets) {
        int score = Math.max(0, 120 - Math.abs(distinctCount - targets.targetDistinctStatBlocks()) * 55);
        if (distinctCount > targets.maxDistinctStatBlocks()) {
            score -= (distinctCount - targets.maxDistinctStatBlocks()) * 60;
        }
        return score;
    }

    private static int scoreBalance(EncounterDraftComposition composition, EncounterTuningIntent tuning) {
        if (composition.entries().size() < MIN_BALANCE_ENTRIES) {
            return tuning.balanceLevel() <= BOSS_BIAS_MAX_BALANCE_LEVEL ? 45 : 20;
        }
        double spread = xpSpread(composition);
        return switch (tuning.balanceLevel()) {
            case 1 -> scoreExtremeSpread(spread);
            case 2 -> scoreMixedSpread(spread);
            case 4 -> scorePeerSpread(spread);
            case 5 -> scoreTightPeerSpread(spread);
            default -> 65;
        };
    }

    private static double xpSpread(EncounterDraftComposition composition) {
        int minXp = Integer.MAX_VALUE;
        int maxXp = 0;
        for (EncounterDraftEntry entry : composition.entries()) {
            minXp = Math.min(minXp, entry.xp());
            maxXp = Math.max(maxXp, entry.xp());
        }
        return (double) maxXp / Math.max(1, minXp);
    }

    private static int scoreExtremeSpread(double spread) {
        return spread >= EXTREME_SPREAD ? 110 : spread >= MIXED_SPREAD ? 75 : -25;
    }

    private static int scoreMixedSpread(double spread) {
        return spread >= MIXED_SPREAD ? 90 : spread >= LIGHT_SPREAD ? 55 : 5;
    }

    private static int scorePeerSpread(double spread) {
        return spread <= EXTREME_SPREAD ? 90 : spread <= LOOSE_PEER_SPREAD ? 45 : -20;
    }

    private static int scoreTightPeerSpread(double spread) {
        return spread <= LIGHT_SPREAD ? 110 : spread <= MIXED_SPREAD ? 75 : -35;
    }
}
