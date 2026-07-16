package features.sessionplanner.domain.session;

public record SessionAdventuringDayBudgetFact(
        boolean available,
        int totalBudgetXp,
        int firstShortRestXp,
        int secondShortRestXp,
        int recommendedShortRests,
        int recommendedLongRests
) {

    public static SessionAdventuringDayBudgetFact unavailable() {
        return new SessionAdventuringDayBudgetFact(false, 0, 0, 0, 0, 0);
    }
}
