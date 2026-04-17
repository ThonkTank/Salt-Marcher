package src.domain.encounter.usecase;

import src.domain.encounter.api.EncounterBudgetSummary;
import src.domain.encounter.api.EncounterDifficultyBand;
import src.domain.party.partyAPI;

import java.util.List;

final class EncounterDifficultyMath {

    private static final int[] EASY_THRESHOLDS = {
            0,
            25,
            50,
            75,
            125,
            250,
            300,
            350,
            450,
            550,
            600,
            800,
            1000,
            1100,
            1250,
            1400,
            1600,
            2000,
            2100,
            2400,
            2800
    };

    private static final int[] MEDIUM_THRESHOLDS = {
            0,
            50,
            100,
            150,
            250,
            500,
            600,
            750,
            900,
            1100,
            1200,
            1600,
            2000,
            2200,
            2500,
            2800,
            3200,
            3900,
            4200,
            4900,
            5700
    };

    private static final int[] HARD_THRESHOLDS = {
            0,
            75,
            150,
            225,
            375,
            750,
            900,
            1100,
            1400,
            1600,
            1900,
            2400,
            3000,
            3400,
            3800,
            4300,
            4800,
            5900,
            6300,
            7300,
            8500
    };

    private static final int[] DEADLY_THRESHOLDS = {
            0,
            100,
            200,
            400,
            500,
            1100,
            1400,
            1700,
            2100,
            2400,
            2800,
            3600,
            4500,
            5100,
            5700,
            6400,
            7200,
            8800,
            9500,
            10900,
            12700
    };

    private static final double[] MULTIPLIER_STEPS = {
            1.0,
            1.5,
            2.0,
            2.5,
            3.0,
            4.0
    };

    private EncounterDifficultyMath() {
    }

    static Thresholds thresholdsFor(List<Integer> partyLevels) {
        int easy = 0;
        int medium = 0;
        int hard = 0;
        int deadly = 0;
        for (Integer rawLevel : partyLevels) {
            int level = clampLevel(rawLevel == null ? 1 : rawLevel);
            easy += EASY_THRESHOLDS[level];
            medium += MEDIUM_THRESHOLDS[level];
            hard += HARD_THRESHOLDS[level];
            deadly += DEADLY_THRESHOLDS[level];
        }
        return new Thresholds(easy, medium, hard, deadly);
    }

    static EncounterBudgetSummary summarizeBudget(
            List<Integer> partyLevels,
            partyAPI.AdventuringDaySummary daySummary
    ) {
        Thresholds thresholds = thresholdsFor(partyLevels);
        int consumedDailyXp = daySummary == null ? 0 : Math.max(0, daySummary.consumedXp());
        int dailyBudgetXp = daySummary == null ? 0 : Math.max(0, daySummary.totalBudgetXp());
        return new EncounterBudgetSummary(
                partyLevels,
                averageLevel(partyLevels),
                thresholds.easy(),
                thresholds.medium(),
                thresholds.hard(),
                thresholds.deadly(),
                dailyBudgetXp,
                consumedDailyXp,
                Math.max(0, dailyBudgetXp - consumedDailyXp)
        );
    }

    static double multiplierFor(int monsterCount, int partySize) {
        int index = multiplierIndexForCount(monsterCount);
        if (partySize < 3) {
            index = Math.min(index + 1, MULTIPLIER_STEPS.length - 1);
        } else if (partySize > 5) {
            index = Math.max(index - 1, 0);
        }
        return MULTIPLIER_STEPS[index];
    }

    static EncounterDifficultyBand bandFor(int adjustedXp, Thresholds thresholds) {
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

    static int minAdjustedXp(EncounterDifficultyBand band, Thresholds thresholds) {
        return switch (band) {
            case EASY -> Math.max(1, thresholds.easy());
            case MEDIUM -> Math.max(1, thresholds.medium());
            case HARD -> Math.max(1, thresholds.hard());
            case DEADLY -> Math.max(1, thresholds.deadly());
        };
    }

    static int maxAdjustedXp(EncounterDifficultyBand band, Thresholds thresholds) {
        return switch (band) {
            case EASY -> Math.max(minAdjustedXp(band, thresholds), thresholds.medium() - 1);
            case MEDIUM -> Math.max(minAdjustedXp(band, thresholds), thresholds.hard() - 1);
            case HARD -> Math.max(minAdjustedXp(band, thresholds), thresholds.deadly() - 1);
            case DEADLY -> Math.max(minAdjustedXp(band, thresholds), thresholds.deadly() + Math.max(200, thresholds.deadly() / 2));
        };
    }

    static int targetAdjustedXp(EncounterDifficultyBand band, Thresholds thresholds) {
        return (minAdjustedXp(band, thresholds) + maxAdjustedXp(band, thresholds)) / 2;
    }

    static int candidateMaxXp(Thresholds thresholds) {
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

    private static int averageLevel(List<Integer> partyLevels) {
        if (partyLevels == null || partyLevels.isEmpty()) {
            return 1;
        }
        return (int) Math.round(partyLevels.stream()
                .mapToInt(level -> clampLevel(level == null ? 1 : level))
                .average()
                .orElse(1.0));
    }

    private static int clampLevel(int rawLevel) {
        return Math.max(1, Math.min(20, rawLevel));
    }

    record Thresholds(
            int easy,
            int medium,
            int hard,
            int deadly
    ) {
    }
}
