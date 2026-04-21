package src.domain.encounter.generation.policy;

import src.domain.encounter.generation.value.EncounterDraftComposition;
import src.domain.encounter.generation.value.EncounterDraftEntry;
import src.domain.encounter.generation.value.EncounterTuningIntent;

public final class EncounterTuningTargets {

    private static final int MAX_TARGET_CREATURES = 8;
    private static final int MIN_BALANCE_ENTRIES = 2;
    private static final int BOSS_BIAS_MAX_BALANCE_LEVEL = 2;
    private static final double EXTREME_SPREAD = 2.0;
    private static final double MIXED_SPREAD = 1.6;
    private static final double LIGHT_SPREAD = 1.35;
    private static final double LOOSE_PEER_SPREAD = 2.4;

    private EncounterTuningTargets() {
    }

    public static Targets targetsFor(EncounterTuningIntent tuning, int partySize) {
        EncounterTuningIntent effective = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
        int diversity = effective.diversityLevel();
        int targetCreatures = targetCreatureCount(effective.amountValue(), Math.max(1, partySize), diversity);
        return new Targets(
                targetCreatures,
                Math.max(1, (int) Math.ceil(targetCreatures * 0.30)),
                diversity,
                Math.min(4, Math.max(diversity, diversity + 1)));
    }

    public static int score(EncounterDraftComposition composition, EncounterTuningIntent tuning, int partySize) {
        Targets targets = targetsFor(tuning, partySize);
        int creatureCount = composition.stats().creatureCount();
        int distinctCount = composition.entries().size();
        return scoreCreatureCount(creatureCount, targets)
                + scoreDiversity(distinctCount, targets)
                + scoreBalance(composition, tuning == null ? EncounterTuningIntent.defaultIntent() : tuning);
    }

    public record Targets(
            int targetCreatureCount,
            int creatureCountTolerance,
            int targetDistinctStatBlocks,
            int maxDistinctStatBlocks
    ) {
    }

    private static int targetCreatureCount(double amountValue, int partySize, int diversity) {
        int rounded = Math.max(1, Math.min(5, (int) Math.round(amountValue)));
        double target = switch (rounded) {
            case 1 -> 1.0 + Math.max(0, diversity - 1) * 0.35;
            case 2 -> 2.0 + diversity * 0.50;
            case 3 -> Math.max(3.0, partySize * 0.90 + diversity * 0.50);
            case 4 -> partySize * 1.25 + diversity * 0.85;
            default -> partySize * 1.70 + diversity;
        };
        return Math.max(diversity, Math.min(MAX_TARGET_CREATURES, (int) Math.ceil(target)));
    }

    private static int scoreCreatureCount(int creatureCount, Targets targets) {
        int distance = Math.abs(creatureCount - targets.targetCreatureCount());
        if (distance <= targets.creatureCountTolerance()) {
            return 130 - distance * 25;
        }
        return Math.max(-80, 80 - distance * 45);
    }

    private static int scoreDiversity(int distinctCount, Targets targets) {
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
