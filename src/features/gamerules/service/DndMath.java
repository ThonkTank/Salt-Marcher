package features.gamerules.service;

import features.creaturecatalog.model.ChallengeRating;

/**
 * Stateless utility methods encoding D&D 5e game rules.
 *
 * <p>All methods are static. This class centralises game-rule computations that derive
 * from raw entity values but do not belong in the entities layer (which is pure data).
 */
public final class DndMath {

    private DndMath() {
        throw new AssertionError("No instances");
    }

    // DMG benchmarks: expected HP and AC per CR tier.
    // Row format: { expectedHp, expectedAc }.
    private static final int[][] CR_BENCHMARKS = {
        {   3, 13 }, // CR 0
        {   7, 13 }, // CR 1/8
        {  14, 13 }, // CR 1/4
        {  21, 13 }, // CR 1/2
        {  33, 13 }, // CR 1
        {  52, 13 }, // CR 2
        {  67, 13 }, // CR 3
        {  82, 14 }, // CR 4
        {  97, 15 }, // CR 5
        { 112, 15 }, // CR 6
        { 127, 15 }, // CR 7
        { 144, 16 }, // CR 8
        { 161, 16 }, // CR 9
        { 178, 17 }, // CR 10
        { 195, 17 }, // CR 11
        { 210, 17 }, // CR 12
        { 225, 18 }, // CR 13
        { 240, 18 }, // CR 14
        { 255, 18 }, // CR 15
        { 270, 18 }, // CR 16
        { 285, 19 }, // CR 17
        { 300, 19 }, // CR 18
        { 315, 19 }, // CR 19
        { 330, 19 }, // CR 20
        { 345, 19 }, // CR 21
        { 400, 19 }, // CR 22
        { 420, 19 }, // CR 23
        { 445, 19 }, // CR 24
        { 470, 19 }, // CR 25
        { 495, 19 }, // CR 26
        { 520, 19 }, // CR 27
        { 545, 19 }, // CR 28
        { 580, 19 }, // CR 29
        { 625, 19 }, // CR 30
    };

    /**
     * Returns the proficiency bonus for a given Challenge Rating.
     * Based on the D&D 5e proficiency bonus progression table.
     */
    public static int proficiencyBonus(ChallengeRating cr) {
        requireSupportedCr(cr);
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
     * Converts a CR to an array index in {@code CR_BENCHMARKS}:
     * 0 = CR 0, 1 = CR 1/8, 2 = CR 1/4, 3 = CR 1/2, 4 = CR 1, 5 = CR 2, … capped at 33 for CR 30+.
     */
    public static int crToIndex(ChallengeRating cr) {
        requireSupportedCr(cr);
        double n = cr.numeric;
        if (n == 0.0)   return 0;  // CR 0
        if (n <= 0.125) return 1;  // CR 1/8
        if (n <= 0.25)  return 2;  // CR 1/4
        if (n <= 0.5)   return 3;  // CR 1/2
        if (n <= 1)     return 4;  // CR 1
        return 4 + (int) Math.min(n - 1, 29);  // CR 2–30+
    }

    public static int expectedHpBenchmark(ChallengeRating cr) {
        return CR_BENCHMARKS[crToIndex(cr)][0];
    }

    public static int expectedAcBenchmark(ChallengeRating cr) {
        return CR_BENCHMARKS[crToIndex(cr)][1];
    }

    private static void requireSupportedCr(ChallengeRating cr) {
        if (cr == null) {
            throw new IllegalArgumentException("ChallengeRating cannot be null");
        }
        double n = cr.numeric;
        if (!Double.isFinite(n)) {
            throw new IllegalArgumentException("ChallengeRating numeric value must be finite: " + n);
        }
        boolean supportedFraction = n == 0.0 || n == 0.125 || n == 0.25 || n == 0.5;
        boolean supportedInteger = n >= 1.0 && n <= 30.0 && n == Math.rint(n);
        if (!(supportedFraction || supportedInteger)) {
            throw new IllegalArgumentException("Unsupported ChallengeRating numeric value: " + n);
        }
    }
}
