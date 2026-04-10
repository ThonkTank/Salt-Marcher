package features.creatures.service;

import features.creatures.model.ChallengeRating;
import shared.rules.service.ChallengeRatingRules;

/**
 * Creature-package compatibility wrapper around shared CR-derived rule lookups.
 *
 * <p>`shared.rules.service.ChallengeRatingRules` is the canonical cross-feature home. This wrapper
 * keeps existing creature-owned call sites stable while the remaining consumers migrate slice by slice.
 */
@SuppressWarnings("unused")
public final class DndMath {
    private DndMath() {
        throw new AssertionError("No instances");
    }

    /**
     * Returns the proficiency bonus for a given Challenge Rating.
     * Based on the D&D 5e proficiency bonus progression table.
     */
    public static int proficiencyBonus(ChallengeRating cr) {
        return ChallengeRatingRules.proficiencyBonus(toSharedModel(cr));
    }

    /**
     * Converts a CR to an array index in {@code CR_BENCHMARKS}:
     * 0 = CR 0, 1 = CR 1/8, 2 = CR 1/4, 3 = CR 1/2, 4 = CR 1, 5 = CR 2, … capped at 33 for CR 30+.
     */
    public static int crToIndex(ChallengeRating cr) {
        return ChallengeRatingRules.crToIndex(toSharedModel(cr));
    }

    public static int expectedHpBenchmark(ChallengeRating cr) {
        return ChallengeRatingRules.expectedHpBenchmark(toSharedModel(cr));
    }

    public static int expectedAcBenchmark(ChallengeRating cr) {
        return ChallengeRatingRules.expectedAcBenchmark(toSharedModel(cr));
    }

    private static shared.rules.model.ChallengeRating toSharedModel(ChallengeRating cr) {
        if (cr == null) {
            throw new IllegalArgumentException("ChallengeRating cannot be null");
        }
        return cr.model();
    }
}
