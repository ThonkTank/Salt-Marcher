package features.party.api;

public record AdventuringDayPlanningSummary(
        int totalBudgetXp,
        int firstShortRestXp,
        int secondShortRestXp,
        int recommendedShortRests,
        int recommendedLongRests
) {

    public AdventuringDayPlanningSummary {
        totalBudgetXp = Math.max(0, totalBudgetXp);
        firstShortRestXp = Math.max(0, firstShortRestXp);
        secondShortRestXp = Math.max(0, secondShortRestXp);
        recommendedShortRests = Math.max(0, recommendedShortRests);
        recommendedLongRests = Math.max(0, recommendedLongRests);
    }

    public static AdventuringDayPlanningSummary empty() {
        return new AdventuringDayPlanningSummary(0, 0, 0, 0, 0);
    }
}
