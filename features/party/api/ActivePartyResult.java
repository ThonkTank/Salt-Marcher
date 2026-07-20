package features.party.api;

import java.util.List;

public record ActivePartyResult(
        ReadStatus status,
        List<PartyMemberSummary> members,
        List<Long> memberIds
) {
    public ActivePartyResult(ReadStatus status, List<PartyMemberSummary> members) {
        this(status, members, memberIdsFrom(members));
    }

    public ActivePartyResult {
        members = members == null ? List.of() : List.copyOf(members);
        memberIds = memberIds == null ? List.of() : List.copyOf(memberIds);
    }

    private static List<Long> memberIdsFrom(List<PartyMemberSummary> members) {
        return (members == null ? List.<PartyMemberSummary>of() : members).stream()
                .map(PartyMemberSummary::id)
                .filter(id -> id != null && id > 0L)
                .toList();
    }
}
