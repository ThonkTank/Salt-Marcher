package src.domain.encounter.service;

import src.domain.encounter.api.EncounterDifficultyBand;

public final class EncounterDifficultyTargets {

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
        if (partySize < 3) {
            index = Math.min(index + 1, MULTIPLIER_STEPS.length - 1);
        } else if (partySize > 5) {
            index = Math.max(index - 1, 0);
        }
        return MULTIPLIER_STEPS[index];
    }

    public static EncounterDifficultyBand bandFor(int adjustedXp, EncounterDifficultyMath.Thresholds thresholds) {
        if (adjustedXp >= thresholds.deadly()) {
            return EncounterDifficultyBand.DEADLY;
        }
        if (adjustedXp >= thresholds.hard()) {
            return EncounterDifficultyBand.HARD;
        }
        if (adjustedXp >= thresholds.medium()) {
            return EncounterDifficultyBand.MEDIUM;
        }
        return EncounterDifficultyBand.EASY;
    }

    public static int minAdjustedXp(EncounterDifficultyBand band, EncounterDifficultyMath.Thresholds thresholds) {
        return switch (band) {
            case EASY -> Math.max(1, thresholds.easy());
            case MEDIUM -> Math.max(1, thresholds.medium());
            case HARD -> Math.max(1, thresholds.hard());
            case DEADLY -> Math.max(1, thresholds.deadly());
        };
    }

    public static int maxAdjustedXp(EncounterDifficultyBand band, EncounterDifficultyMath.Thresholds thresholds) {
        return switch (band) {
            case EASY -> Math.max(minAdjustedXp(band, thresholds), thresholds.medium() - 1);
            case MEDIUM -> Math.max(minAdjustedXp(band, thresholds), thresholds.hard() - 1);
            case HARD -> Math.max(minAdjustedXp(band, thresholds), thresholds.deadly() - 1);
            case DEADLY -> Math.max(minAdjustedXp(band, thresholds), thresholds.deadly() + Math.max(200, thresholds.deadly() / 2));
        };
    }

    public static int targetAdjustedXp(EncounterDifficultyBand band, EncounterDifficultyMath.Thresholds thresholds) {
        return (minAdjustedXp(band, thresholds) + maxAdjustedXp(band, thresholds)) / 2;
    }

    public static int candidateMaxXp(EncounterDifficultyMath.Thresholds thresholds) {
        return Math.max(200, thresholds.deadly() * 2);
    }

    private static int multiplierIndexForCount(int monsterCount) {
        if (monsterCount <= 1) {
            return 0;
        }
        if (monsterCount == 2) {
            return 1;
        }
        if (monsterCount <= 6) {
            return 2;
        }
        if (monsterCount <= 10) {
            return 3;
        }
        if (monsterCount <= 14) {
            return 4;
        }
        return 5;
    }
}
