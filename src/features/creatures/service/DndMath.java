package features.creatures.service;

import features.creatures.model.ChallengeRating;

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

    // Data-driven benchmarks: median HP and AC per CR tier from local game.db snapshot
    // (2502 creatures, computed 2026-03-07). Row format: { expectedHp, expectedAc }.
    // CR 29 had no samples in the snapshot; value is linearly interpolated between CR 28 and 30.
    private static final int[][] CR_BENCHMARKS = {
        {   4, 12 }, // CR 0
        {   9, 12 }, // CR 1/8
        {  13, 12 }, // CR 1/4
        {  21, 13 }, // CR 1/2
        {  27, 13 }, // CR 1
        {  39, 13 }, // CR 2
        {  58, 14 }, // CR 3
        {  66, 14 }, // CR 4
        {  85, 15 }, // CR 5
        {  91, 15 }, // CR 6
        { 107, 15 }, // CR 7
        { 115, 15 }, // CR 8
        { 139, 16 }, // CR 9
        { 148, 17 }, // CR 10
        { 161, 17 }, // CR 11
        { 147, 15 }, // CR 12
        { 184, 16 }, // CR 13
        { 188, 17 }, // CR 14
        { 187, 17 }, // CR 15
        { 208, 18 }, // CR 16
        { 225, 19 }, // CR 17
        { 245, 18 }, // CR 18
        { 241, 19 }, // CR 19
        { 300, 19 }, // CR 20
        { 290, 19 }, // CR 21
        { 307, 19 }, // CR 22
        { 346, 20 }, // CR 23
        { 426, 21 }, // CR 24
        { 472, 20 }, // CR 25
        { 507, 21 }, // CR 26
        { 533, 22 }, // CR 27
        { 565, 22 }, // CR 28
        { 583, 23 }, // CR 29
        { 600, 24 }, // CR 30
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
