package src.domain.encounter.service;

import src.domain.encounter.api.EncounterBudgetSummary;
import src.domain.party.api.AdventuringDaySummary;

import java.util.List;

public final class EncounterDifficultyMath {

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

    private EncounterDifficultyMath() {
    }

    public static Thresholds thresholdsFor(List<Integer> partyLevels) {
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

    public static EncounterBudgetSummary summarizeBudget(
            List<Integer> partyLevels,
            AdventuringDaySummary daySummary
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

    public record Thresholds(
            int easy,
            int medium,
            int hard,
            int deadly
    ) {
    }
}
