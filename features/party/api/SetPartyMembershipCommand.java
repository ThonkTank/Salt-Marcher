package features.party.api;

public record SetPartyMembershipCommand(long id, MembershipState membership) {

    public String membershipName() {
        return membership == null ? "RESERVE" : membership.name();
    }
}
