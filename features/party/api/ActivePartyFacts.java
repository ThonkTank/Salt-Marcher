package features.party.api;

import java.util.List;

/** One immutable, revisioned read of every Party fact needed for derived runtime work. */
public record ActivePartyFacts(
        long revision,
        List<PartyMemberSummary> members,
        ActivePartyComposition composition,
        AdventuringDaySummary adventuringDay
) {
    public ActivePartyFacts {
        if (revision < 0L) {
            throw new IllegalArgumentException("revision must not be negative");
        }
        members = members == null ? List.of() : List.copyOf(members);
        composition = composition == null ? new ActivePartyComposition(List.of(), null) : composition;
        adventuringDay = adventuringDay == null
                ? new AdventuringDaySummary(List.of(), 0, 0, 0, 0, 0, List.of())
                : adventuringDay;
    }

    @Override
    public List<PartyMemberSummary> members() {
        return List.copyOf(members);
    }
}
