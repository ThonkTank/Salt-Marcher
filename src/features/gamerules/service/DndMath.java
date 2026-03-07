package features.gamerules.service;

import features.creaturecatalog.model.ChallengeRating;

/**
 * Stateless utility methods encoding D&D 5e game rules.
 *
 * <p>All methods are static. This class centralises game-rule computations that derive
 * from raw entity values but do not belong in the entities layer (which is pure data).
 */
public final class DndMath {

    private DndMath() {}

    /**
     * Returns the proficiency bonus for a given Challenge Rating.
     * Based on the D&D 5e proficiency bonus progression table.
     */
    public static int proficiencyBonus(ChallengeRating cr) {
        double n = cr.numeric;
        if (n <= 4)  return 2;
        if (n <= 8)  return 3;
        if (n <= 12) return 4;
        if (n <= 16) return 5;
        if (n <= 20) return 6;
        if (n <= 24) return 7;
        if (n <= 30) return 8;
        return 9;
    }

    /**
     * Converts a CR to an array index matching the {@code CR_BENCHMARKS} array in {@link RoleClassifier}:
     * 0 = CR 0, 1 = CR 1/8, 2 = CR 1/4, 3 = CR 1/2, 4 = CR 1, 5 = CR 2, … capped at 33 for CR 30+.
     * Maximum return value is 33 — must stay in bounds with {@code CR_BENCHMARKS} (34 entries).
     * If {@code CR_BENCHMARKS} grows, update the cap here accordingly.
     */
    public static int crToIndex(ChallengeRating cr) {
        double n = cr.numeric;
        if (n == 0.0)   return 0;  // CR 0
        if (n <= 0.125) return 1;  // CR 1/8
        if (n <= 0.25)  return 2;  // CR 1/4
        if (n <= 0.5)   return 3;  // CR 1/2
        if (n <= 1)     return 4;  // CR 1
        return 4 + (int) Math.min(n - 1, 29);  // CR 2–30+
    }
}
