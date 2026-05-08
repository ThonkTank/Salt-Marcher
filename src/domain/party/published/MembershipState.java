package src.domain.party.published;

import src.domain.party.roster.value.PartyMembership;

public final class MembershipState {

    public static final MembershipState ACTIVE = new MembershipState(PartyMembership.ACTIVE);
    public static final MembershipState RESERVE = new MembershipState(PartyMembership.RESERVE);

    private final PartyMembership membership;

    private MembershipState(PartyMembership membership) {
        this.membership = membership;
    }

    public static MembershipState fromInternal(PartyMembership membership) {
        return membership == PartyMembership.ACTIVE ? ACTIVE : RESERVE;
    }

    public PartyMembership toInternal() {
        return membership;
    }

    public String name() {
        return membership.name();
    }

    public static MembershipState valueOf(String value) {
        return "ACTIVE".equals(value) ? ACTIVE : RESERVE;
    }

    @Override
    public String toString() {
        return membership.name();
    }
}
