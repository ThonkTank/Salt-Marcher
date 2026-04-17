package src.domain.party.valueobject;

import src.domain.party.partyAPI;

public enum PartyMembership {
    ACTIVE,
    RESERVE;

    public static PartyMembership fromApi(partyAPI.MembershipState membershipState) {
        if (membershipState == null) {
            return RESERVE;
        }
        return membershipState == partyAPI.MembershipState.ACTIVE ? ACTIVE : RESERVE;
    }

    public partyAPI.MembershipState toApi() {
        return this == ACTIVE ? partyAPI.MembershipState.ACTIVE : partyAPI.MembershipState.RESERVE;
    }
}
