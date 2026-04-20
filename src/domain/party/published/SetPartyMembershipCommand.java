package src.domain.party.published;

public record SetPartyMembershipCommand(long id, MembershipState membership) {
}
