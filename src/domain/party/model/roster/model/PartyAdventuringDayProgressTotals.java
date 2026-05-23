package src.domain.party.model.roster.model;

public final class PartyAdventuringDayProgressTotals {

    private final int totalGroupXp;
    private final int perCharacterAwardedXp;
    private final int partySize;
    private final double totalDays;

    public PartyAdventuringDayProgressTotals(
            int totalGroupXp,
            int perCharacterAwardedXp,
            int partySize,
            double totalDays
    ) {
        this.totalGroupXp = Math.max(0, totalGroupXp);
        this.perCharacterAwardedXp = Math.max(0, perCharacterAwardedXp);
        this.partySize = Math.max(0, partySize);
        this.totalDays = Math.max(0.0, totalDays);
    }

    public int totalGroupXp() {
        return totalGroupXp;
    }

    public int perCharacterAwardedXp() {
        return perCharacterAwardedXp;
    }

    public int partySize() {
        return partySize;
    }

    public double totalDays() {
        return totalDays;
    }

    public boolean hasAwardedXp() {
        return totalGroupXp > 0;
    }

    public boolean hasParty() {
        return partySize > 0;
    }

    public int completedDayCount() {
        return (int) Math.floor(totalDays);
    }
}
