package src.domain.encounter.generation.policy;

import src.domain.encounter.generation.value.EncounterDifficultyIntent;

public final class EncounterDifficultyTargets {

    private static final int SMALL_PARTY_SIZE = 3;
    private static final int LARGE_PARTY_SIZE = 5;
    private static final int SOLO_MONSTER_COUNT = 1;
    private static final int PAIR_MONSTER_COUNT = 2;
    private static final int SMALL_GROUP_MONSTER_COUNT = 6;
    private static final int LARGE_GROUP_MONSTER_COUNT = 10;
    private static final int HORDE_MONSTER_COUNT = 14;

    private static final double[] MULTIPLIER_STEPS = {
            1.0,
            1.5,
            2.0,
            2.5,
            3.0,
            4.0
    };

    private EncounterDifficultyTargets() {
    }

    public static double multiplierFor(int monsterCount, int partySize) {
        int index = multiplierIndexForCount(monsterCount);
        if (partySize < SMALL_PARTY_SIZE) {
            index = Math.min(index + 1, MULTIPLIER_STEPS.length - 1);
        } else if (partySize > LARGE_PARTY_SIZE) {
            index = Math.max(index - 1, 0);
        }
        return MULTIPLIER_STEPS[index];
    }

    public static EncounterDifficultyIntent bandFor(int adjustedXp, EncounterDifficultyMath.Thresholds thresholds) {
        if (adjustedXp >= thresholds.deadly()) {
            return EncounterDifficultyIntent.DEADLY;
        }
        if (adjustedXp >= thresholds.hard()) {
            return EncounterDifficultyIntent.HARD;
        }
        if (adjustedXp >= thresholds.medium()) {
            return EncounterDifficultyIntent.MEDIUM;
        }
        return EncounterDifficultyIntent.EASY;
    }

    public static int minAdjustedXp(EncounterDifficultyIntent band, EncounterDifficultyMath.Thresholds thresholds) {
        return switch (band) {
            case EASY -> Math.max(1, thresholds.easy());
            case MEDIUM -> Math.max(1, thresholds.medium());
            case HARD -> Math.max(1, thresholds.hard());
            case DEADLY -> Math.max(1, thresholds.deadly());
        };
    }

    public static int maxAdjustedXp(EncounterDifficultyIntent band, EncounterDifficultyMath.Thresholds thresholds) {
        return switch (band) {
            case EASY -> Math.max(minAdjustedXp(band, thresholds), thresholds.medium() - 1);
            case MEDIUM -> Math.max(minAdjustedXp(band, thresholds), thresholds.hard() - 1);
            case HARD -> Math.max(minAdjustedXp(band, thresholds), thresholds.deadly() - 1);
            case DEADLY -> Math.max(minAdjustedXp(band, thresholds), thresholds.deadly() + Math.max(200, thresholds.deadly() / 2));
        };
    }

    public static int targetAdjustedXp(EncounterDifficultyIntent band, EncounterDifficultyMath.Thresholds thresholds) {
        return (minAdjustedXp(band, thresholds) + maxAdjustedXp(band, thresholds)) / 2;
    }

    public static int candidateMaxXp(EncounterDifficultyMath.Thresholds thresholds) {
        return Math.max(200, thresholds.deadly() * 2);
    }

    private static int multiplierIndexForCount(int monsterCount) {
        if (monsterCount <= SOLO_MONSTER_COUNT) {
            return 0;
        }
        if (monsterCount == PAIR_MONSTER_COUNT) {
            return 1;
        }
        if (monsterCount <= SMALL_GROUP_MONSTER_COUNT) {
            return 2;
        }
        if (monsterCount <= LARGE_GROUP_MONSTER_COUNT) {
            return 3;
        }
        if (monsterCount <= HORDE_MONSTER_COUNT) {
            return 4;
        }
        return 5;
    }
}
