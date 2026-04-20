package src.domain.party.published;

import java.util.List;

public record ActivePartyResult(
        ReadStatus status,
        List<PartyMemberSummary> members
) {
    public ActivePartyResult {
        members = members == null ? List.of() : List.copyOf(members);
    }
}
