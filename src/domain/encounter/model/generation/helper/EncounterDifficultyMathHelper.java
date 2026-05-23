package src.domain.encounter.model.generation.helper;

import java.util.List;
import src.domain.encounter.model.generation.model.EncounterBudgetSummary;
import src.domain.encounter.model.generation.model.EncounterDifficultyThresholds;

public final class EncounterDifficultyMathHelper {

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

    private EncounterDifficultyMathHelper() {
    }

    public static EncounterDifficultyThresholds thresholdsFor(List<Integer> partyLevels) {
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
        return new EncounterDifficultyThresholds(easy, medium, hard, deadly);
    }

    public static EncounterBudgetSummary summarizeBudget(
            List<Integer> partyLevels,
            int consumedDailyXp,
            int dailyBudgetXp
    ) {
        EncounterDifficultyThresholds thresholds = thresholdsFor(partyLevels);
        int consumedXp = Math.max(0, consumedDailyXp);
        int budgetXp = Math.max(0, dailyBudgetXp);
        return new EncounterBudgetSummary(
                partyLevels,
                averageLevel(partyLevels),
                thresholds.easy(),
                thresholds.medium(),
                thresholds.hard(),
                thresholds.deadly(),
                budgetXp,
                consumedXp,
                Math.max(0, budgetXp - consumedXp)
        );
    }

    private static int averageLevel(List<Integer> partyLevels) {
        if (partyLevels == null || partyLevels.isEmpty()) {
            return 1;
        }
        int total = 0;
        int count = 0;
        for (Integer rawLevel : partyLevels) {
            total += clampLevel(rawLevel == null ? 1 : rawLevel);
            count++;
        }
        if (count == 0) {
            return 1;
        }
        return (int) Math.round((double) total / count);
    }

    private static int clampLevel(int rawLevel) {
        return Math.max(1, Math.min(20, rawLevel));
    }

}
