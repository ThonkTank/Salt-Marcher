package src.domain.party.model.roster;

public record PartyAdventuringDayProgressTotals(
        int totalGroupXp,
        int perCharacterAwardedXp,
        int partySize,
        double totalDays
) {
    public PartyAdventuringDayProgressTotals {
        totalGroupXp = Math.max(0, totalGroupXp);
        perCharacterAwardedXp = Math.max(0, perCharacterAwardedXp);
        partySize = Math.max(0, partySize);
        totalDays = Math.max(0.0, totalDays);
    }
}
