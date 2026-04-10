package shared.rules.model;

@SuppressWarnings("unused")
public record AdventuringDayBudget(
        int totalXp,
        int perThirdXp,
        int shortRestAfterFirstThirdXp,
        int shortRestAfterSecondThirdXp,
        int characterCount) {
}
