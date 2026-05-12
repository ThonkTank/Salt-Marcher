package src.domain.party.model.roster.helper;

public final class PartyAdventuringDayBudgetHelper {

    private static final int MIN_LEVEL = 1;
    private static final int MAX_LEVEL = 20;

    private static final int[] ADVENTURING_DAY_BUDGETS = {
            0,
            300,
            600,
            1_200,
            1_700,
            3_500,
            4_000,
            5_000,
            6_000,
            7_500,
            9_000,
            10_500,
            11_500,
            13_500,
            15_000,
            18_000,
            20_000,
            25_000,
            27_000,
            30_000,
            40_000
    };

    private PartyAdventuringDayBudgetHelper() {
    }

    public static int perCharacter(int level) {
        return ADVENTURING_DAY_BUDGETS[clampLevel(level)];
    }

    public static int perThird(int level) {
        return Math.max(0, (int) Math.round(perCharacter(level) / 3.0));
    }

    public static int afterFirstShortRest(int level) {
        return perThird(level);
    }

    public static int afterSecondShortRest(int level) {
        return Math.max(0, (int) Math.round(perCharacter(level) * 2.0 / 3.0));
    }

    public static int finalSegment(int level) {
        return Math.max(0, perCharacter(level) - afterSecondShortRest(level));
    }

    private static int clampLevel(int level) {
        return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, level));
    }
}
