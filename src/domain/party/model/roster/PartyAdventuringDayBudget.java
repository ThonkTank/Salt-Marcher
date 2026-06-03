package src.domain.party.model.roster;

public record PartyAdventuringDayBudget(int level) {

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

    public PartyAdventuringDayBudget {
        level = clampLevel(level);
    }

    public static PartyAdventuringDayBudget forLevel(int level) {
        return new PartyAdventuringDayBudget(level);
    }

    public int perCharacter() {
        return ADVENTURING_DAY_BUDGETS[level];
    }

    public int perThird() {
        return Math.max(0, (int) Math.round(perCharacter() / 3.0));
    }

    public int afterFirstShortRest() {
        return perThird();
    }

    public int afterSecondShortRest() {
        return Math.max(0, (int) Math.round(perCharacter() * 2.0 / 3.0));
    }

    public int finalSegment() {
        return Math.max(0, perCharacter() - afterSecondShortRest());
    }

    private static int clampLevel(int level) {
        return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, level));
    }
}
