package src.domain.party.api;

import java.util.List;

public record PartySnapshot(
        List<PartyMemberDetails> activeMembers,
        List<PartyMemberDetails> reserveMembers,
        PartySummary summary
) {
    public PartySnapshot {
        activeMembers = activeMembers == null ? List.of() : List.copyOf(activeMembers);
        reserveMembers = reserveMembers == null ? List.of() : List.copyOf(reserveMembers);
    }
}
